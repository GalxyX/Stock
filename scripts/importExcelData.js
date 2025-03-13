/* *******************************************
 * 从Excel文件导入股票数据到数据库
 * 使用xlsx库读取Excel文件，然后调用database.js的方法插入数据
 ******************************************* */

import xlsx from 'xlsx';
import { createDatabaseConnection } from './database.js';
import { passwordConfig } from './config.js';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Excel列名到数据库字段的映射
const fieldMapping = {
  '股票代号': 'stockid',
  '日期': 'date',
  '市盈率_TTM': 'TTM',
  '市盈率_静': 'PE',
  '市净率': 'PB',
  '市现率': 'PCF',
  '百度指数': 'baiduindex',
  '微博情绪_Cnsenti库': 'weibo_cnsenti',
  '微博情绪_纯金融词典': 'weibo_dictionary',
  '市场GDP': 'marketGDP',
  '市场从业人数': 'marketpopulation',
  '市场平均工资': 'marketaslary',
  'r市盈率_TTM': 'ratio_TTM',
  'r市盈率_静': 'ratio_PE',
  'r市净率': 'ratio_PB',
  'r市现率': 'ratio_PCF',
  'r百度指数': 'ratio_baiduindex',
  'r微博情绪_Cnsenti库': 'ratio_weibo_cnsenti',
  'r微博情绪_纯金融词典': 'ratio_weibo_dictionary',
  'r市场GDP': 'ratio_marketGDP',
  'r市场从业人数': 'ratio_marketpopulation',
  'r市场平均工资': 'ratio_marketaslary'
};

/**
 * 从Excel读取数据并转换为适合数据库的格式
 * @param {string} filePath Excel文件路径
 * @returns {Array} 转换后的数据数组
 */
function readExcelFile(filePath) {
  try {
    // 读取Excel文件
    const workbook = xlsx.readFile(filePath);
    
    // 获取第一个工作表
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // 将工作表转换为JSON对象数组
    const rawData = xlsx.utils.sheet_to_json(worksheet);
    console.log(`读取了 ${rawData.length} 条数据记录`);

    // 转换数据格式以匹配数据库结构
    return rawData.filter(row => row['股票代号'] && row['日期']).map(row => {
      const dbRecord = {};
      
      // 映射字段
      Object.keys(fieldMapping).forEach(excelField => {
        const dbField = fieldMapping[excelField];
        let value = row[excelField];
        
        // 处理特殊类型
        if (dbField === 'baiduindex' && value !== undefined) {
          value = parseInt(value, 10) || 0;
        } else if (value === undefined) {
          // 对于未定义的比率字段，设置为null
          if (dbField.startsWith('ratio_')) {
            value = null;
          } else {
            // 非比率字段设置默认值
            value = dbField === 'stockid' || dbField === 'date' ? '' : 0;
          }
        }
        
        dbRecord[dbField] = value;
      });
      
      return dbRecord;
    });
  }
  catch (error) {
    console.error('读取Excel文件时出错:', error);
    return [];
  }
}

/**
 * 将数据导入到数据库
 * @param {Array} data 数据数组
 */
async function importDataToDatabase(data) {
  // 设置开发环境标志，以确保表创建逻辑正常执行
  process.env.NODE_ENV = 'development';
  
  let database = null;
  try {
    // 连接数据库
    database = await createDatabaseConnection(passwordConfig);
    console.log('数据库连接成功');

    // 启动事务
    const transaction = await database.poolconnection.transaction();

    try {
      // 记录导入进度
      let successCount = 0;
      let errorCount = 0;
      
      // 循环导入数据
      for (const item of data) {
        try {
          // 检查记录是否已存在
          const existingRecord = await database.getStockByIdAndDate(item.stockid, item.date);
          
          if (existingRecord) {
            // 记录已存在，更新
            await database.updateStock(item);
            console.log(`更新记录 - 股票代号: ${item.stockid}, 日期: ${item.date}`);
          } else {
            // 记录不存在，创建新记录
            await database.createStock(item);
            console.log(`创建记录 - 股票代号: ${item.stockid}, 日期: ${item.date}`);
          }
          
          successCount++;
        }
        catch (error) {
          console.error(`导入记录出错 - 股票代号: ${item.stockid}, 日期: ${item.date}:`, error);
          errorCount++;
        }
      }
      
      // 提交事务
      await transaction.commit();
      console.log(`导入完成。成功: ${successCount}, 失败: ${errorCount}`);
    }
    catch (error) {
      // 回滚事务
      await transaction.rollback();
      console.error('导入过程中出错，已回滚所有操作:', error);
    }
  }
  catch (error) {
    console.error('导入过程中出错:', error);
  }
  finally {
    // 断开数据库连接
    if (database && database.disconnect) {
      await database.disconnect();
      console.log('数据库连接已关闭');
    }
  }
}

/**
 * 主函数，执行导入过程
 */
async function main() {
  // Excel文件路径
  const filePath = path.join(__dirname, 'MLrawdata.xlsx');
  
  // 读取Excel数据
  const data = readExcelFile(filePath);
  if (data.length === 0) {
    console.log('没有读取到有效数据，导入终止');
    return;
  }
  
  console.log(`准备导入 ${data.length} 条记录到数据库`);
  
  // 导入数据
  await importDataToDatabase(data);
}

// 执行主函数
main().catch(error => {
  console.error('执行导入脚本时发生错误:', error);
  process.exit(1);
});