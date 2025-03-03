/* *******************************************
Express.js / stock 路由 API 文件，用于处理 CRUD 操作。
管理对 stock 数据的增删改查（基于某个数据库操作层）。

提供以下路由操作:
GET /：查询所有 stock 记录。
POST /：创建新记录。
GET /byId/:id：按指定 ID 查询记录。
GET /byDate/:date：按指定日期查询记录。
GET /:id/:date：按 ID 和日期查询记录。
PUT /:id/:date：更新指定记录。
DELETE /:id/:date：删除指定记录。
DELETE /：删除所有记录。
GET /snowballAPI/:symbol：调用雪球API获取K线数据。

返回结果或错误消息时统一使用 JSON 格式，保证接口结构一致。
******************************************* */
import express from 'express';
// 用于创建路由对象等功能。
import {
    passwordConfig as SQLAuthentication,
    noPasswordConfig as PasswordlessConfig
} from './config.js';
// 从 config.js 文件中导入两个配置对象，并分别重命名为 SQLAuthentication 和 PasswordlessConfig。
import { createDatabaseConnection } from './database.js';
// 从 database.js 中导入一个 createDatabaseConnection 函数，用于建立数据库连接。

const router = express.Router();
router.use(express.json());
// 创建一个新的路由实例，并开启对 JSON 请求体的解析。

const database = await createDatabaseConnection(SQLAuthentication);
// 以 SQLAuthentication 配置建立数据库连接，并将结果存到 database 变量中。
// 使用 await，说明此文件在某个支持 ESM 顶层 await 的环境下运行（或在上级已处理）。

// 获取所有股票信息
router.get('/', async (req, res) => {
    try {
        // 处理 GET /stocks 请求，返回所有 stocks。
        const stocks = await database.getAllStocks();
        console.log(`stocks: ${JSON.stringify(stocks)}`);
        res.status(200).json(stocks);
    }
    catch (err) {
        res.status(500).json({ error: err?.message });
    }
});
// 定义路由 GET /，查询并返回所有 stock 数据；如果出错，返回 500。

// 创建新股票信息
router.post('/', async (req, res) => {
    try {
        // 处理 POST /stocks 请求，创建新 stock。
        const stock = req.body;
        console.log(`stock: ${JSON.stringify(stock)}`);
        const rowsAffected = await database.createStock(stock);
        res.status(201).json({ rowsAffected });
    }
    catch (err) {
        res.status(500).json({ error: err?.message });
    }
});
// 定义路由 POST /，插入数据到数据库；如果出错，返回 500。

// 调用雪球api
import axios from 'axios';
// 配置请求头（模拟浏览器请求）
const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0',
    'Referer': 'https://xueqiu.com/',
    'Cookie': process.env.XUEQIU_COOKIE || '' // 添加默认空字符串
};

async function fetchKLine(symbol, begin, period = "day", type = "before", count = -284, indicator = "kline,pe,pb,ps,pcf,market_capital,agt,ggt,balance") {
    try {
        // 检查环境变量
        if (!process.env.XUEQIU_COOKIE) {
            console.warn('警告: XUEQIU_COOKIE 环境变量未设置，雪球API调用可能受限');
        }

        // 验证必需参数
        if (!symbol) {
            throw new Error('股票代码(symbol)是必需的');
        }

        /**************************************************************************
         * symbol：股票代码（前缀SZ表示深圳证券交易所，SH表示上海证券交易所）
         * begin：开始时间戳（一定要13位，不够用0补足）
         * period：周期（day-日，week-周，…）
         * type：类型（before-历史）
         * count：周期数（-8表示获取前8个周期（日）数据）
         * indicator：指示信号（kline-K线，pe-市盈率，pb市净率 等等）
         **************************************************************************/
        const url = 'https://stock.xueqiu.com/v5/stock/chart/kline.json';
        const params = {
            symbol: symbol,
            begin: begin || Date.now(), // 使用当前时间戳作为默认值
            period: period,
            type: type,
            count: count,
            indicator: indicator
        };

        const response = await axios.get(url, {
            headers: headers,
            params: params
        });

        // 验证响应数据结构
        if (!response.data || !response.data.data || !response.data.data.column || !response.data.data.item) {
            throw new Error('雪球API返回的数据结构不符合预期');
        }

        // 获取列名定义数组
        const columns = response.data.data.column;

        // 创建索引映射，便于后续按名称获取数据
        const columnIndexMap = {};
        columns.forEach((col, index) => {
            columnIndexMap[col] = index;
        });

        // 解析数据数组为对象格式
        const klines = response.data.data.item.map(item => {
            // 创建基础对象
            const kline = {};

            // 动态添加存在的字段
            columns.forEach(col => {
                if (columnIndexMap[col] !== undefined && item[columnIndexMap[col]] !== undefined) {
                    kline[col] = item[columnIndexMap[col]];
                }
            });

            return kline;
        });
        return klines;
    }
    catch (error) {
        console.error('请求雪球API失败:', error.message);
        return { error: error.message, status: error.response?.status };
    }
}

router.get('/snowballAPI/:symbol', async (req, res) => {
    try {
        const symbol = req.params.symbol;
        const { begin, period, type, count, indicator } = req.query;
        const result = await fetchKLine(symbol, begin, period, type, count, indicator);

        // 检查结果是否包含错误
        if (result && result.error) {
            if (result.status === 404) {
                return res.status(404).json({ error: '未找到请求的数据' });
            }
            else if (result.status === 403) {
                return res.status(403).json({ error: '访问被拒绝，请检查凭据' });
            }
            else if (result.status === 429) {
                return res.status(429).json({ error: '请求过于频繁，请稍后再试' });
            }
            return res.status(result.status || 500).json({ error: result.error });
        }

        res.status(200).json(result);
    }
    catch (err) {
        console.error('处理雪球API请求时出错:', err);
        res.status(500).json({ error: err?.message || '未知错误' });
    }
});
// 定义路由 GET /snowballAPI，调用雪球api获取数据；如果出错，返回 500。

// 获取指定 ID 的股票信息
router.get('/byId/:id', async (req, res) => {
    try {
        // 处理 GET /stocks/:id 请求，根据 ID 返回所有 stock。
        const stockid = req.params.id;
        console.log(`stockid: ${stockid}`);
        if (stockid) {
            const result = await database.getStockById(stockid);
            console.log(`stocks: ${JSON.stringify(result)}`);
            res.status(200).json(result);
        }
        else {
            res.status(404).json({ error: "Not found" });
        }
    }
    catch (err) {
        res.status(500).json({ error: err?.message });
    }
});
// 定义路由 GET /byId/:id，按 ID 查询数据库中对应的 stock；找不到则返回 404，出错则返回 500。

// 获取指定 日期 的股票信息
router.get('/byDate/:date', async (req, res) => {
    try {
        // 处理 GET /stocks/:date 请求，根据 日期 返回所有 stock。
        const date = req.params.date;
        console.log(`date: ${date}`);
        if (date) {
            const result = await database.getStockByDate(date);
            console.log(`stocks: ${JSON.stringify(result)}`);
            res.status(200).json(result);
        }
        else {
            res.status(404).json({ error: "Not found" });
        }
    }
    catch (err) {
        res.status(500).json({ error: err?.message });
    }
});
// 定义路由 GET /byDate/:date，按 日期 查询数据库中对应的 stock；找不到则返回 404，出错则返回 500。

// 获取指定 ID 和 日期 的股票信息
router.get('/:id/:date', async (req, res) => {
    try {
        const stockid = req.params.id;
        const date = req.params.date;
        console.log(`stockid: ${stockid}\ndate: ${date}`);
        if (stockid && date) {
            const result = await database.getStockByIdAndDate(stockid, date);
            console.log(`stocks: ${JSON.stringify(result)}`);
            res.status(200).json(result);
        }
        else {
            res.status(404).json({ error: "Not found" });
        }
    }
    catch (err) {
        res.status(500).json({ error: err?.message });
    }
});
// 定义路由 GET /:id/:date，根据 ID 和日期查询数据库中对应的 stock；找不到则返回 404，出错则返回 500。

// 更新股票信息
router.put('/:id/:date', async (req, res) => {
    try {
        // 处理 PUT /stocks/:id/:date 请求，更新指定 ID和日期 的 stock 数据。
        const stockid = req.params.id;
        const date = req.params.date;
        console.log(`stockid: ${stockid}\ndate: ${date}`);
        const stock = req.body;
        
        if (stockid && date && stock) {
            if(stock.stockid !== stockid || stock.date !== date) {
                res.status(400).json({ error: 'ID or date mismatch' });
                return;
            }
            console.log(`stock: ${JSON.stringify(stock)}`);
            const rowsAffected = await database.updateStock(stock);
            res.status(200).json({ rowsAffected });
        }
        else {
            res.status(404).json({ error: "Not found" });
        }
    }
    catch (err) {
        res.status(500).json({ error: err?.message });
    }
});
// 定义路由 PUT /:id/:date，更新数据库；出错返回 500。

// 删除股票信息
router.delete('/:id/:date', async (req, res) => {
    try {
        const stockid = req.params.id;
        const date = req.params.date;
        console.log(`stockid: ${stockid}\ndate: ${date}`);

        const rowsAffected = await database.deleteStock(stockid, date);
        if (rowsAffected === 0) {
            res.status(404).json({ error: "Record not found" });
        }
        else {
            res.status(200).json({ rowsAffected });
        }
    }
    catch (err) {
        res.status(500).json({ error: err?.message });
    }
});
// 定义路由 DELETE /:id/:date，若 ID和日期 存在则执行删除操作；删除成功返回 200，出错返回 500。

// 删除全部股票信息
router.delete('/', async (req, res) => {
    try {
        // 处理 DELETE /stocks 请求，删除所有 stock。
        const rowsAffected = await database.deleteAllStocks();
        res.status(204).end();
    }
    catch (err) {
        res.status(500).json({ error: err?.message });
    }
});

export default router;
// 将 router 作为默认导出，供其他文件（如 index.js）使用。

