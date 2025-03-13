/**
 * 导入Excel文件中的股票数据到数据库
 * 处理stocks_new.xlsx文件并将数据写入到Stockdata表
 */

import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';
import { passwordConfig } from '../config/config.js';
import { createDatabaseConnection } from '../config/database.js';

// 解析命令行参数
const args = process.argv.slice(2);
let filePath = './data/stocks_new.xlsx';
let clearExistingData = false;

// 解析命令行参数
for (let i = 0; i < args.length; i++) {
    if (args[i] === '-f' || args[i] === '--file') {
        filePath = args[i + 1];
        i++;
    } else if (args[i] === '-c' || args[i] === '--clear') {
        clearExistingData = true;
    } else if (args[i] === '-h' || args[i] === '--help') {
        console.log(`
        使用方法: node importStocksNew.js [options]
        
        选项:
          -f, --file    指定Excel文件路径 (默认: ./data/stocks_new.xlsx)
          -c, --clear   在导入前清除所有现有股票数据
          -h, --help    显示帮助信息
        `);
        process.exit(0);
    }
}

// 定义Excel文件路径
const excelFilePath = path.resolve(filePath);

// 将Excel数据转换为数据库格式
function transformExcelData(excelRow) {
    // 确保 total_asset 的值是字符串或有效数值
    let totalAsset = null;
    if (excelRow.total_asset !== undefined) {
        // 检查是否是科学计数法格式
        const assetStr = String(excelRow.total_asset);
        if (assetStr.includes('E') || assetStr.includes('e')) {
            // 将科学计数法转换为普通数字字符串
            totalAsset = parseFloat(assetStr);
        } else {
            totalAsset = parseFloat(assetStr);
        }
        
        // 如果是 NaN，设置为 null
        if (isNaN(totalAsset)) {
            totalAsset = null;
        }
    }

    return {
        stockid: excelRow.stockid,
        date: excelRow.date,
        TTM: parseFloat(excelRow.TTM) || 0,
        PE: parseFloat(excelRow.PE) || 0,
        PB: parseFloat(excelRow.PB) || 0,
        PCF: parseFloat(excelRow.PCF) || 0,
        baiduindex: parseInt(excelRow.baiduindex) || 0,
        weibo_cnsenti: parseFloat(excelRow.weibo_cnsenti) || 0,
        weibo_dictionary: parseFloat(excelRow.weibo_dictionary) || 0,
        marketGDP: parseFloat(excelRow.marketGDP) || 0,
        marketpopulation: parseFloat(excelRow.marketpopulation) || 0,
        marketaslary: parseFloat(excelRow.marketaslary) || 0,
        
        ratio_TTM: excelRow.ratio_TTM !== undefined ? parseFloat(excelRow.ratio_TTM) : null,
        ratio_PE: excelRow.ratio_PE !== undefined ? parseFloat(excelRow.ratio_PE) : null,
        ratio_PB: excelRow.ratio_PB !== undefined ? parseFloat(excelRow.ratio_PB) : null,
        ratio_PCF: excelRow.ratio_PCF !== undefined ? parseFloat(excelRow.ratio_PCF) : null,
        ratio_baiduindex: excelRow.ratio_baiduindex !== undefined ? parseFloat(excelRow.ratio_baiduindex) : null,
        ratio_weibo_cnsenti: excelRow.ratio_weibo_cnsenti !== undefined ? parseFloat(excelRow.ratio_weibo_cnsenti) : null,
        ratio_weibo_dictionary: excelRow.ratio_weibo_dictionary !== undefined ? parseFloat(excelRow.ratio_weibo_dictionary) : null,
        ratio_marketGDP: excelRow.ratio_marketGDP !== undefined ? parseFloat(excelRow.ratio_marketGDP) : null,
        ratio_marketpopulation: excelRow.ratio_marketpopulation !== undefined ? parseFloat(excelRow.ratio_marketpopulation) : null,
        ratio_marketaslary: excelRow.ratio_marketaslary !== undefined ? parseFloat(excelRow.ratio_marketaslary) : null,
        
        total_asset: totalAsset,
        quarterly_asset_growth: excelRow.quarterly_asset_growth !== undefined ? parseFloat(excelRow.quarterly_asset_growth) : null,
        cash_flow_perhold_processed: excelRow.cash_flow_perhold_processed !== undefined ? parseFloat(excelRow.cash_flow_perhold_processed) : null,
        rfr: excelRow.rfr !== undefined ? parseFloat(excelRow.rfr) : null,
        smooth_asset_growth: excelRow.smooth_asset_growth !== undefined ? parseFloat(excelRow.smooth_asset_growth) : null,
        close_price: excelRow.close_price !== undefined ? parseFloat(excelRow.close_price) : null
    };
}

// 主函数 - 导入数据
async function importStocksData() {
    console.log('开始导入股票数据...');
    
    let db = null;
    
    try {
        // 检查Excel文件是否存在
        if (!fs.existsSync(excelFilePath)) {
            throw new Error(`Excel文件不存在: ${excelFilePath}`);
        }
        
        console.log(`读取Excel文件: ${excelFilePath}`);
        
        // 读取Excel文件
        const workbook = xlsx.readFile(excelFilePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // 将工作表转换为JSON对象
        const rows = xlsx.utils.sheet_to_json(worksheet);
        
        console.log(`从Excel文件读取了 ${rows.length} 条记录`);
        
        // 连接到数据库
        db = await createDatabaseConnection(passwordConfig);
        
        if (!db || !db.connected) {
            throw new Error('无法连接到数据库');
        }
        
        console.log('数据库连接成功，开始导入数据...');
        
        // 如果需要清除现有数据
        if (clearExistingData) {
            console.log('清除所有现有股票数据...');
            await db.deleteAllStocks();
            console.log('所有现有股票数据已清除');
        }
        
        // 记录成功和失败的数量
        let successCount = 0;
        let failureCount = 0;
        
        // 遍历每一行数据并插入到数据库
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            
            // 跳过没有必要字段的行
            if (!row.stockid || !row.date) {
                console.warn(`跳过第 ${i+1} 行: 缺少stockid或date字段`);
                failureCount++;
                continue;
            }
            
            // 转换数据格式
            const stockData = transformExcelData(row);
            
            try {
                // 检查该股票和日期的记录是否已存在
                const existingRecord = await db.getStockByIdAndDate(stockData.stockid, stockData.date);
                
                if (existingRecord) {
                    // 更新存在的记录
                    await db.updateStock(stockData);
                    console.log(`更新记录: ${stockData.stockid} - ${stockData.date}`);
                } else {
                    // 插入新记录
                    await db.createStock(stockData);
                    console.log(`插入新记录: ${stockData.stockid} - ${stockData.date}`);
                }
                
                successCount++;
                
                // 每100条记录显示进度
                if (successCount % 100 === 0) {
                    console.log(`已处理 ${successCount} 条记录...`);
                }
            } catch (error) {
                failureCount++;
                console.error(`处理记录时出错 (${stockData.stockid} - ${stockData.date}): ${error.message}`);
            }
        }
        
        console.log('数据导入完成!');
        console.log(`成功导入: ${successCount} 条记录`);
        console.log(`导入失败: ${failureCount} 条记录`);
        
    } catch (error) {
        console.error(`导入过程中出错: ${error.message}`);
    } finally {
        // 关闭数据库连接
        if (db && db.connected) {
            await db.disconnect();
            console.log('数据库连接已关闭');
        }
    }
}

// 执行导入功能
importStocksData().catch(error => {
    console.error(`执行导入时出错: ${error}`);
    process.exit(1);
});