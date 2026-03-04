const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch').default;

// 基金代码映射表，从app.js中提取
const FUND_CODES_MAP = {
    '399006': {场内代码: '159952', 场外代码: '01593'},
    '000300': {场内代码: '510310', 场外代码: '007339'},
    '000016': {场内代码: '510850', 场外代码: '007380'},
    '000905': {场内代码: '159922', 场外代码: '070039'},
    '000015': {场内代码: '510880', 场外代码: '016441'},
    '000932': {场内代码: '159928', 场外代码: '000248'},
    'H30533': {场内代码: '513050', 场外代码: '006327'},
    '399975': {场内代码: '512000', 场外代码: '004070'},
    '399973': {场内代码: '512670', 场外代码: '012041'},
    '399998': {场内代码: '515220', 场外代码: '008280'},
    '000993': {场内代码: '159939', 场外代码: '000942'},
    '000979': {场内代码: '161715', 场外代码: '161715'},
    '931594': {场内代码: '512630', 场外代码: '024749'},
    '399971': {场内代码: '512980', 场外代码: '004752'},
    '931151': {场内代码: '515790', 场外代码: '011102'},
    '980017': {场内代码: '159995', 场外代码: '008888'},
    'H30590': {场内代码: '562500', 场外代码: '014881'},
    '931079': {场内代码: '515050', 场外代码: '008087'},
    '931071': {场内代码: '515980', 场外代码: '014881'},
    '930598': {场内代码: '516150', 场外代码: '014332'},
    'H30199': {场内代码: '159611', 场外代码: '016186'},
    'HSCGSI': {场内代码: '159699', 场外代码: '023242'},
    '.INX': {场内代码: '513500', 场外代码: '050025'}
};

// 提取所有基金代码
function getAllFundCodes() {
    const codes = new Set();
    for (const [, fund] of Object.entries(FUND_CODES_MAP)) {
        if (fund.场内代码 && fund.场内代码 !== '-') {
            codes.add(fund.场内代码);
        }
        if (fund.场外代码 && fund.场外代码 !== '-') {
            codes.add(fund.场外代码);
        }
    }
    return Array.from(codes);
}

// 解析JSONP响应
function parseJSONP(response, callbackName) {
    try {
        // 调试信息：打印原始响应的前200个字符
        console.log(`原始响应前200字符: ${response.substring(0, 200)}...`);
        
        // 查找开始和结束位置
        const startIndex = response.indexOf(`${callbackName}(`);
        if (startIndex === -1) {
            throw new Error(`Callback name ${callbackName} not found in response`);
        }
        
        const endIndex = response.lastIndexOf(');');
        if (endIndex === -1) {
            throw new Error(`End of JSONP not found in response`);
        }
        
        // 提取JSON字符串
        const jsonStr = response.substring(startIndex + callbackName.length + 1, endIndex);
        console.log(`提取的JSON字符串: ${jsonStr.substring(0, 100)}...`);
        
        return JSON.parse(jsonStr);
    } catch (error) {
        console.error(`JSONP解析错误:`, error.message);
        throw error;
    }
}

// 获取基金净值数据
async function fetchFundNavData(code, days = 20) {
    try {
        // 计算开始日期和结束日期
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - days);
        
        const endDateStr = endDate.toISOString().split('T')[0];
        const startDateStr = startDate.toISOString().split('T')[0];
        
        const params = new URLSearchParams({
            fundCode: code,
            pageIndex: 1,
            pageSize: 20,
            startDate: startDateStr,
            endDate: endDateStr,
            _: Date.now()
        });
        
        const callbackName = `jQuery18305932565413289966_${Date.now()}`;
        const url = `https://api.fund.eastmoney.com/f10/lsjz?${params.toString()}&callback=${callbackName}`;
        
        console.log(`请求URL: ${url}`);
        
        // 使用node-fetch的正确方式
        const fetch = require('node-fetch');
        const response = await fetch(url);
        const data = await response.text();
        
        console.log(`响应状态: ${response.status}`);
        
        // 简单检查响应内容
        if (data.includes('Data')) {
            console.log(`响应包含Data字段，可能是有效的`);
        } else {
            console.log(`响应不包含Data字段，可能无效`);
        }
        
        return parseJSONP(data, callbackName);
    } catch (error) {
        console.error(`Failed to fetch data for fund ${code}:`, error.message);
        return { Data: null, ErrCode: -1, ErrMsg: error.message };
    }
}

// 主函数
async function main() {
    const fundCodes = getAllFundCodes();
    const allData = {};
    
    console.log(`Fetching data for ${fundCodes.length} funds over 20 days...`);
    
    for (let i = 0; i < fundCodes.length; i++) {
        const code = fundCodes[i];
        try {
            console.log(`[${i+1}/${fundCodes.length}] Fetching data for fund ${code}...`);
            const data = await fetchFundNavData(code, 20);
            allData[code] = data;
            
            // 避免请求过快被封
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            console.error(`[${i+1}/${fundCodes.length}] Failed to fetch data for fund ${code}:`, error.message);
            allData[code] = { error: error.message };
        }
    }
    
    // 确保data目录存在
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // 保存数据到JSON文件
    const dataPath = path.join(dataDir, 'fund-nav-data.json');
    fs.writeFileSync(dataPath, JSON.stringify(allData, null, 2));
    console.log(`Data saved to ${dataPath}`);
    console.log(`Successfully fetched data for ${Object.keys(allData).length} funds`);
}

// 运行主函数
main().catch(console.error);
