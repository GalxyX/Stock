/* *******************************************
Express.js / stock 路由 API 文件，用于处理 CRUD 操作。
管理对 stock 数据的增删改查（基于某个数据库操作层）。

提供以下路由操作:
GET /：查询所有 stock 记录。
POST /：创建新 stock 记录。
GET /byId/:id：按 ID 查询 stock 记录。
GET /byDate/:date：按日期查询 stock 记录。
GET /:id/:date：按 ID 和日期查询 stock 记录。
PUT /:id/:date：更新指定 ID 和日期的 stock 记录。
DELETE /:id/:date：删除指定 ID 和日期的 stock 记录。
DELETE /：删除所有 stock 记录。
GET /snowballAPI/suggest_stock/:keyword：调用雪球API获取 suggest_stock 数据。
GET /sinaAPI/SH：调用新浪API获取沪深数据。
GET /sinaAPI/HK：调用新浪API获取港股数据。
GET /sinaAPI/US：调用新浪API获取美股数据。

返回结果或错误消息时统一使用 JSON 格式，保证接口结构一致。
******************************************* */
import express from 'express';
// 用于创建路由对象等功能。
import { authenticate, adminOnly } from './authenticate.js';
// 从 authenticate.js 中导入两个中间件函数，用于验证用户身份。
import axios from 'axios';


export default function (database) {
    const router = express.Router();
    router.use(express.json());
    // 创建一个新的路由实例，并开启对 JSON 请求体的解析。

    router.get('/snowballAPI/suggest_stock/:keyword', authenticate, async (req, res) => {
        const keyword = req.params.keyword;

        // 添加参数验证
        if (!keyword || keyword.trim() === '') {
            return res.status(400).json({ error: '关键词不能为空' });
        }

        const url = 'https://xueqiu.com/query/v1/suggest_stock.json';
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0',
            'Referer': 'https://xueqiu.com/',
            'Cookie': process.env.XUEQIU_COOKIE || '' // 添加默认空字符串
        };

        try {
            // 检查环境变量
            if (!process.env.XUEQIU_COOKIE) {
                console.warn('警告: XUEQIU_COOKIE 环境变量未设置，雪球API调用可能受限');
            }

            const response = await axios.get(url, {
                headers: headers,
                params: {
                    q: keyword
                },
                timeout: 5000 // 添加超时设置
            });

            // 验证响应数据
            if (!response.data) {
                return res.status(404).json({ error: '未获取到数据' });
            }

            res.status(200).json(response.data);
        }
        catch (error) {
            console.error('请求雪球API失败:', error.message);

            // 细化错误处理
            if (error.response) {
                // 服务器响应了，但状态码不在 2xx 范围内
                return res.status(error.response.status).json({
                    error: `雪球API返回错误: ${error.message}`,
                    status: error.response.status
                });
            }
            else if (error.request) {
                // 请求已发送但未收到响应
                return res.status(504).json({ error: '雪球API未响应，请稍后再试' });
            }
            else {
                // 请求设置过程中出现问题
                return res.status(500).json({ error: error.message });
            }
        }
    });
    // 定义路由 GET /snowballAPI/suggest_stock，调用雪球api获取suggest_stock数据；如果出错，返回相应错误状态码。

    /**
     * node：指定市场分类。
     *  hs_a：沪深A股（示例中使用）
     *  hs_b：沪深B股
     *  ……
     * 
     * sort：指定排序字段。
     *  symbol：按股票代码排序（示例中使用）
     *  price：按最新价排序
     *  changepercent：按涨跌幅排序
     *  volume：按成交量排序
     *  amount：按成交额排序
     *  ……
     * 
     * asc：控制排序方向。
     *  1：升序（示例中使用）
     *  0 或 -1：降序（需实际测试接口是否支持负数）
     * 
     * page：分页页码。
     *  正整数，从 1 开始递增。
     * 
     * num：每页返回的数据条数。
     *  正整数（示例中为 300）。
     */
    router.get('/sinaAPI/SH', authenticate, async (req, res) => {
        try {
            // 转换并验证参数
            const page = parseInt(req.query.page) || 1;
            const num = parseInt(req.query.num) || 300;
            const sort = req.query.sort || 'symbol';
            const asc = parseInt(req.query.asc) || 1;
            const node = req.query.node || 'hs_a';

            // 参数有效性检查
            if (page < 1 || num < 1 || num > 500) {
                return res.status(400).json({ error: '无效的分页参数' });
            }

            const url = 'http://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeData';
            const params = {
                page: page,
                num: num,
                sort: sort,
                asc: asc,
                node: node,
            };
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Referer': 'http://vip.stock.finance.sina.com.cn/'
            };
            const response = await axios.get(url, {
                params,
                headers,
                timeout: 10000 // 10秒超时
            });

            // 检查响应数据
            if (!response.data) {
                return res.status(404).json({ error: '未获取到数据' });
            }
            res.status(200).json(response.data);
        }
        catch (error) {
            console.error('请求新浪API失败:', error);
            // 根据错误类型提供更详细的错误信息
            if (error.response) {
                // 服务器响应了，但状态码不在 2xx 范围内
                res.status(error.response.status).json({
                    error: `API返回错误: ${error.message}`,
                    status: error.response.status
                });
            }
            else if (error.request) {
                // 请求已发送但未收到响应
                res.status(504).json({ error: '新浪API未响应，请稍后再试' });
            }
            else {
                // 请求设置过程中出现问题
                res.status(500).json({ error: error.message });
            }
        }
    });
    // 定义路由 GET /sinaAPI/SH，调用新浪api获取沪深A股数据；如果出错，返回相应错误状态码。

    router.get('/sinaAPI/HK', authenticate, async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const num = parseInt(req.query.num) || 300;
            const sort = req.query.sort || 'symbol';
            const asc = parseInt(req.query.asc) || 1;
            const node = req.query.node || 'qbgg_hk';
            // 参数有效性检查
            if (page < 1 || num < 1 || num > 500) {
                return res.status(400).json({ error: '无效的分页参数' });
            }

            const url = "https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getRTHKStockData"
            const params = {
                page: page,
                num: num,
                sort: sort,
                asc: asc,
                node: node,
            }
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Referer': 'http://vip.stock.finance.sina.com.cn/'
            };
            const response = await axios.get(url, {
                params,
                headers,
                timeout: 10000 // 10秒超时
            });

            // 检查响应数据
            if (!response.data) {
                return res.status(404).json({ error: '未获取到数据' });
            }
            res.status(200).json(response.data);
        }
        catch (error) {
            console.error('请求新浪API失败:', error);
            // 根据错误类型提供更详细的错误信息
            if (error.response) {
                // 服务器响应了，但状态码不在 2xx 范围内
                res.status(error.response.status).json({
                    error: `API返回错误: ${error.message}`,
                    status: error.response.status
                });
            }
            else if (error.request) {
                // 请求已发送但未收到响应
                res.status(504).json({ error: '新浪API未响应，请稍后再试' });
            }
            else {
                // 请求设置过程中出现问题
                res.status(500).json({ error: error.message });
            }
        }
    });
    // 定义路由 GET /sinaAPI/HK，调用新浪api获取港股数据；如果出错，返回相应错误状态码。

    router.get('/sinaAPI/US', authenticate, async (req, res) => {
        try {
            // 转换并验证参数
            const page = parseInt(req.query.page) || 1;
            const num = parseInt(req.query.num) || 20;
            const sort = req.query.sort || '';
            const asc = parseInt(req.query.asc) || 0;
            const market = req.query.market || '';
            const id = req.query.id || '';
            
            // 参数有效性检查
            if (page < 1 || num < 1 || num > 500) {
                return res.status(400).json({ error: '无效的分页参数' });
            }
    
            // // 生成唯一的回调函数名
            // const callbackName = `callback_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
            
            // // 构造基础URL，不包含查询参数
            // const baseUrl = "https://stock.finance.sina.com.cn/usstock/api/jsonp.php";
            
            // // 构造完整URL，包含回调和请求参数
            // const url = `${baseUrl}/${encodeURIComponent(`IO.XSRV2.CallbackList['${callbackName}']`)}/US_CategoryService.getList`;
            const url = "https://stock.finance.sina.com.cn/usstock/api/jsonp.php/IO.XSRV2.CallbackList['fa8Vo3U4TzVRdsLs']/US_CategoryService.getList?page=1&num=20&sort=&asc=0&market=&id="
            
            const params = {
                page: page,
                num: num,
                sort: sort,
                asc: asc,
                market: market,
                id: id
            };
            
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Referer': 'http://stock.finance.sina.com.cn/usstock/index.php'
            };
            
            const response = await axios.get(url, {
                params,
                headers,
                timeout: 10000
            });
    
            // 检查响应数据
            if (!response.data) {
                return res.status(404).json({ error: '未获取到数据' });
            }
            
            // 解析JSONP响应
            const jsonpData = response.data;
            const jsonStart = jsonpData.indexOf('(') + 1;
            const jsonEnd = jsonpData.lastIndexOf(')');
            
            // 检查是否找到了括号
            if (jsonStart <= 0 || jsonEnd < 0 || jsonEnd <= jsonStart) {
                return res.status(500).json({ error: '解析JSONP响应失败' });
            }
            
            const jsonString = jsonpData.substring(jsonStart, jsonEnd);
            
            try {
                const parsedData = JSON.parse(jsonString);
                res.status(200).json(parsedData);
            }
            catch (parseError) {
                console.error('JSON解析失败:', parseError);
                return res.status(500).json({ error: 'JSON解析失败' });
            }
        }
        catch (error) {
            console.error('请求新浪API失败:', error);
            // 根据错误类型提供更详细的错误信息
            if (error.response) {
                // 服务器响应了，但状态码不在 2xx 范围内
                res.status(error.response.status).json({
                    error: `API返回错误: ${error.message}`,
                    status: error.response.status
                });
            }
            else if (error.request) {
                // 请求已发送但未收到响应
                res.status(504).json({ error: '新浪API未响应，请稍后再试' });
            }
            else {
                // 请求设置过程中出现问题
                res.status(500).json({ error: error.message });
            }
        }
    });
    // 定义路由 GET /sinaAPI/US，调用新浪api获取美股数据；如果出错，返回相应错误状态码

    // 获取所有股票信息
    router.get('/', authenticate, async (req, res) => {
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
    router.post('/', authenticate, adminOnly, async (req, res) => {
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

    // 获取指定 ID 的股票信息
    router.get('/byId/:id', authenticate, async (req, res) => {
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
    router.get('/byDate/:date', authenticate, async (req, res) => {
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
    router.get('/:id/:date', authenticate, async (req, res) => {
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
    router.put('/:id/:date', authenticate, adminOnly, async (req, res) => {
        try {
            // 处理 PUT /stocks/:id/:date 请求，更新指定 ID和日期 的 stock 数据。
            const stockid = req.params.id;
            const date = req.params.date;
            console.log(`stockid: ${stockid}\ndate: ${date}`);
            const stock = req.body;
        
            if (stockid && date && stock) {
                if (stock.stockid !== stockid || stock.date !== date) {
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
    router.delete('/:id/:date', authenticate, adminOnly, async (req, res) => {
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
    router.delete('/', authenticate, adminOnly, async (req, res) => {
        try {
            // 处理 DELETE /stocks 请求，删除所有 stock。
            const rowsAffected = await database.deleteAllStocks();
            res.status(204).end();
        }
        catch (err) {
            res.status(500).json({ error: err?.message });
        }
    });

    async function fetchKLine(symbol, begin, period = "day", type = "before", count = -284, indicator = "kline,pe,pb,ps,pcf,market_capital,agt,ggt,balance") {
        // 配置请求头（模拟浏览器请求）
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0',
            'Referer': 'https://xueqiu.com/',
            'Cookie': process.env.XUEQIU_COOKIE || '' // 添加默认空字符串
        };

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
             * begin：开始时间戳（13位，不足用0补齐）
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

    router.get('/snowballAPI/kline/:symbol', authenticate, async (req, res) => {
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
    // 定义路由 GET /snowballAPI/kline，调用雪球api获取kline数据；如果出错，返回 500。

    return router;
    // 将 router 作为默认导出，供其他文件（如 index.js）使用。
}
