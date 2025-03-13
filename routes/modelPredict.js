/* *******************************************
Express.js / modelPredict 路由 API 文件，用于模型训练、预测和数据保存

提供以下路由操作:
POST /predict：训练模型(如需)，执行预测并将结果存入数据库
GET /predict/:stockId：获取指定股票的预测结果
GET /predict/factor/:stockId：获取指定股票的因子预测结果

返回结果或错误消息时统一使用 JSON 格式
******************************************* */
import express from 'express';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { authenticate, adminOnly } from './authenticate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default function (database) {
    const router = express.Router();
    router.use(express.json());

    // 综合路由：训练模型、执行预测并保存结果
    router.post('/', authenticate, adminOnly, async (req, res) => {
        try {
            console.log(`开始执行模型预测...`);
            
            // 1. 从数据库获取所有股票数据
            const stockData = await database.getAllStocks();
            
            if (!stockData || stockData.length === 0) {
                return res.status(404).json({ error: '未找到股票数据' });
            }
            
            // 2. 调用Python脚本进行训练和预测
            const pythonProcess = spawn('python', [
                path.join(__dirname, '../model/model.py')
            ]);
            
            // 3. 通过stdin将数据传递给Python脚本
            pythonProcess.stdin.write(JSON.stringify(stockData));
            pythonProcess.stdin.end(); // 结束输入
            
            let pythonOutput = '';
            let pythonError = '';
            
            // 4. 收集Python脚本的输出
            pythonProcess.stdout.on('data', (data) => {
                const output = data.toString();
                pythonOutput += output;
                console.log(`Python输出: ${output.substring(0, 200)}...`); // 只显示部分输出
            });
            
            pythonProcess.stderr.on('data', (data) => {
                const error = data.toString();
                pythonError += error;
                console.error(`Python错误: ${error}`);
            });
            
            // 5. 等待Python脚本执行完成
            const exitCode = await new Promise((resolve) => {
                pythonProcess.on('close', resolve);
            });
            if (exitCode !== 0) {
                return res.status(500).json({
                    error: '模型执行失败',
                    details: pythonError
                });
            }
            
            // 6. 解析预测结果并保存到数据库
            try {
                // 解析Python输出
                let predictions;
                try {
                    predictions = JSON.parse(pythonOutput);
                }
                catch (directParseError) {
                    // 如果直接解析失败，尝试提取JSON部分
                    const jsonStartIndex = pythonOutput.indexOf('{');
                    const jsonEndIndex = pythonOutput.lastIndexOf('}') + 1;
                    
                    if (jsonStartIndex >= 0 && jsonEndIndex > jsonStartIndex) {
                        const jsonStr = pythonOutput.substring(jsonStartIndex, jsonEndIndex);
                        predictions = JSON.parse(jsonStr);
                        console.log('通过提取JSON部分成功解析数据');
                    } else {
                        throw new Error('未能在输出中找到有效的JSON数据');
                    }
                }
                
                // 检查是否有两种预测结果
                if (!predictions.final_predictions || !predictions.factor_predictions) {
                    throw new Error('预测结果格式不正确，缺少必要的数据字段');
                }
                
                // 处理股价预测结果
                const savedPricePredictions = [];
                for (const prediction of predictions.final_predictions) {
                    const predictionRecord = {
                        stockId: prediction.stockid,
                        date: prediction.date,
                        predictedPrice: prediction.label,
                        createdAt: new Date().toISOString()
                    };
                    
                    await database.savePrediction(predictionRecord);
                    savedPricePredictions.push(predictionRecord);
                }
                
                // 处理因子预测结果
                const savedFactorPredictions = [];
                for (const prediction of predictions.factor_predictions) {
                    // y0, y1, y2, y3 分别对应 TTM, PE, PB, PCF
                    const predictionRecord = {
                        stockId: prediction.stockid,
                        date: prediction.date,
                        TTM: prediction.y0,
                        PE: prediction.y1,
                        PB: prediction.y2,
                        PCF: prediction.y3
                    };
                    
                    await database.saveFactorPrediction(predictionRecord);
                    savedFactorPredictions.push(predictionRecord);
                }
                
                res.status(200).json({
                    message: '预测完成并保存到数据库',
                    pricePredictions: {
                        count: savedPricePredictions.length,
                        samples: savedPricePredictions.slice(0, 5) // 仅返回前5条示例
                    },
                    factorPredictions: {
                        count: savedFactorPredictions.length,
                        samples: savedFactorPredictions.slice(0, 5) // 仅返回前5条示例
                    }
                });
            }
            catch (parseError) {
                console.error('解析预测结果出错:', parseError, 'Python输出:', pythonOutput.substring(0, 500));
                return res.status(500).json({
                    error: '解析预测结果失败',
                    details: parseError.message,
                    pythonOutput: pythonOutput.substring(0, 200) // 仅显示部分避免过大响应
                });
            }
            
        }
        catch (error) {
            console.error('执行模型预测过程中出错:', error);
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/:stockId', authenticate, async (req, res) => {
        try {
            const stockId = req.params.stockId;
            const result = await database.getStockPredictions(stockId);

            if(!result || result.length === 0) {
                return res.status(404).json({ error: '未找到预测结果' });
            }
            res.json(result);
        }
        catch (error) {
            console.error('获取预测结果时出错:', error);
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/factor/:stockId', authenticate, async (req, res) => {
        try {
            const stockId = req.params.stockId;
            const result = await database.getStockFactorPredictions(stockId);

            if(!result || result.length === 0) {
                return res.status(404).json({ error: '未找到预测结果' });
            }
            res.json(result);
        }
        catch (error) {
            console.error('获取预测结果时出错:', error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
}