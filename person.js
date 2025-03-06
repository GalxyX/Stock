/* *******************************************
Express.js / person 路由 API 文件，用于身份认证和用户数据管理。

主要功能：
1. 用户认证：提供注册和登录端点，使用 JWT 进行身份验证
2. 用户管理：提供对用户数据的 CRUD 操作接口
3. 权限控制：区分普通用户和管理员权限
4. 用户股票管理：允许用户选择、查看和移除股票

主要路由：
- POST /persons/register：用户注册（创建新用户）
- POST /persons/login：用户登录（获取 JWT 令牌）
- GET /persons/all：管理员查看所有用户（需管理员权限）
- POST /persons：管理员创建新用户（需管理员权限）
- GET /persons：获取当前登录用户信息
- PUT /persons：更新当前用户数据
- PUT /persons/name：更新当前用户姓名
- PUT /persons/password：更新当前用户密码
- DELETE /persons：删除当前用户账户
- GET /persons/stocks：获取当前用户的股票列表
- POST /persons/stocks：向当前用户的选择列表添加股票
- DELETE /persons/stocks/:stockId：从当前用户的选择列表移除特定股票

所有接口均使用 JSON 格式进行数据交换，并提供恰当的 HTTP 状态码响应。
数据库操作通过导入的 database.js 模块执行，身份验证通过 auth.js 中间件实现。
******************************************* */
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt'; // 密码哈希库
import express from 'express';
// 用于创建路由对象等功能。
import { authenticate, adminOnly } from './authenticate.js';
// 从 auth.js 中导入两个中间件函数，分别用于身份验证和管理员权限验证。


const JWT_SECRET = process.env.JWT_SECRET || 'default_jwt_secret_for_development';
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    console.error('警告: 生产环境下未设置JWT_SECRET环境变量，这会带来安全风险!');
}
const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS || '10', 10); // 密码哈希盐值复杂度

/**
 * POST /persons/register
 * 功能：用户注册
 */
export default function(database) {
    const router = express.Router();
    router.use(express.json());
    // 创建一个新的路由实例，并开启对 JSON 请求体的解析。

    router.post('/register', async (req, res) => {
        try {
            const { name,account, password } = req.body;

            // 参数校验
            if (!name||!account || !password) {
                return res.status(400).json({ error: "用户名、账户标识和密码不能为空" });
            }

            // 检查用户名是否已存在（避免重复注册）
            const existingUser = await database.readPersonbyAccount(account);
            if (existingUser) {
                return res.status(409).json({ error: "账户标识已存在" }); // 409 Conflict
            }

            // 密码哈希处理（安全存储）
            const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

            // 创建用户记录（扩展数据库方法）
            const newUser = await database.createPerson({
                name,
                account,
                password: hashedPassword,
                role: 'user' // 默认角色
            });

            // 返回新用户 ID
            res.status(201).json({ id: newUser.id });
        }
        catch (err) {
            if (err.message.includes('该账号已被注册')) { // 捕获特定错误
                res.status(409).json({ error: err.message });
            } else {
                console.error('注册错误:', err);
                res.status(500).json({ error: "服务器内部错误" });
            }
        }
    });

    /**
     * POST /persons/login
     * 功能：用户登录并获取 JWT 令牌
     */
    router.post('/login', async (req, res) => {
        try {
            const { account, password } = req.body;

            // 参数校验
            if (!account || !password) {
                return res.status(400).json({ error: "账户标识和密码不能为空" });
            }

            const user = await database.readPersonbyAccount(account);

            // 检查用户是否存在
            if (!user) {
                return res.status(401).json({ error: "账户标识不存在" });
            }
            
            // 检查密码字段是否存在且有效
            if (!user.password) {
                console.error('用户密码数据缺失或无效:', account);
                return res.status(401).json({ error: "用户密码数据缺失或无效" });
            }

            // 比对密码
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                return res.status(401).json({ error: "账户标识或密码错误" });
            }

            // 生成 JWT 令牌（包含用户 ID 和角色）
            const token = jwt.sign(
                { userId: user.id, role: user.role },
                JWT_SECRET,
                { expiresIn: '1h' } // 令牌有效期 1 小时
            );

            // 返回令牌（符合 OAuth 2.0 Bearer Token 规范）
            res.json({
                token,
                expiresIn: 3600 // 明确有效期（秒）
            });
        } catch (err) {
            console.error('登录错误:', err);
            res.status(500).json({ error: "服务器内部错误" });
        }
    });


    router.get('/all', authenticate, adminOnly, async (req, res) => {
        try {
            // 处理 GET /persons 请求，返回所有 persons。
            const persons = await database.readAllPerson();
            console.log(`persons: ${JSON.stringify(persons)}`);
            res.status(200).json(persons);
        } catch (err) {
            res.status(500).json({ error: err?.message });
        }
    });
    // 定义路由 GET /all，查询并返回所有 person 数据；如果出错，返回 500。

    router.post('/', authenticate, adminOnly, async (req, res) => {
        try {
            // 处理 POST /persons 请求，创建新 person。
            const person = req.body;
            console.log(`person: ${JSON.stringify(person)}`);
            // 创建用户并获取ID
            const result = await database.createPerson(person);
            res.status(201).json({ id: result.id });

        }
        catch (err) {
            res.status(500).json({ error: err?.message });
        }
    });
    // 定义路由 POST /，插入数据到数据库；如果出错，返回 500。

    router.get('/', authenticate, async (req, res) => {
        try {
            // 处理 GET /persons 请求，根据 ID 返回单个 person。
            const personId = req.user.id;
            console.log(`personId: ${personId}`);
            if (personId) {
                const result = await database.readPersonbyId(personId);
                console.log(`persons: ${JSON.stringify(result)}`);
                res.status(200).json(result);
            } else {
                res.status(404).json({ error: "未找到资源" });
            }
        }
        catch (err) {
            res.status(500).json({ error: err?.message });
        }
    });
    // 定义路由 GET /，按 ID 查询数据库中对应的 person；找不到则返回 404，出错则返回 500。

    router.put('/', authenticate, async (req, res) => {
        try {
            // 处理 PUT /persons 请求，更新指定 ID 的 person 数据。
            const personId = req.user.id;
            console.log(`personId: ${personId}`);
            const person = req.body;
            
            if (personId && person) {
                delete person.id;
                console.log(`person: ${JSON.stringify(person)}`);
                const rowsAffected = await database.update(personId, person);
                res.status(200).json({ rowsAffected });
            }
            else {
                res.status(404).json({ error: "未找到资源" });
            }
        }
        catch (err) {
            res.status(500).json({ error: err?.message });
        }
    });
    // 定义路由 PUT /，先移除请求体中可能带的 id 字段，然后更新数据库；出错返回 500。

    router.put('/name', authenticate, async (req, res) => {
        try {
            // 处理 PUT /persons/name 请求，更新指定 account 的 person 数据。
            const personId = req.user.id;
            console.log(`personId: ${personId}`);
            const name = req.body.name;

            if (personId && name) {
                console.log(`name: ${name}`);
                const rowsAffected = await database.updatePersonName(personId, name);
                res.status(200).json({ rowsAffected });
            }
            else {
                res.status(404).json({ error: "未找到资源" });
            }
        }
        catch (err) {
            res.status(500).json({ error: err?.message });
        }
    });
    // 定义路由 PUT /name，更新指定 account 的 person 数据；出错返回 500。

    router.put('/password', authenticate, async (req, res) => {
        try {
            // 处理 PUT /persons/password 请求，更新指定 account 的 person 数据。
            const personId = req.user.id;
            console.log(`personId: ${personId}`);
            const password = req.body.password;

            if (!personId || !password) {
                return res.status(400).json({ error: "用户ID和新密码不能为空" });
            }
            
            // 获取用户信息
            const user = await database.readPersonbyId(personId);
            if (!user) {
                return res.status(404).json({ error: "用户不存在" });
            }

            // 密码哈希处理（安全存储）
            const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
            const rowsAffected = await database.updatePersonPassword(personId, hashedPassword);
            res.status(200).json({ rowsAffected });
        }
        catch (err) {
            res.status(500).json({ error: err?.message });
        }
    });
    // 定义路由 PUT /password，更新指定 account 的 person 数据；出错返回 500。

    router.delete('/', authenticate, async (req, res) => {
        try {
            // 处理 DELETE /persons 请求，删除指定 ID 的 person。
            const personId = req.user.id;
            console.log(`personId: ${personId}`);

            if (!personId) {
                res.status(404).json({ error: "未找到资源" });
            }
            else {
                const rowsAffected = await database.deletePerson(personId);
                res.status(204).end();
            }
        }
        catch (err) {
            res.status(500).json({ error: err?.message });
        }
    });
    // 定义路由 DELETE /byId/:id，若 ID 存在则执行删除操作；删除成功返回 204，出错返回 500。

    // 获取用户选择的股票列表
    router.get('/stocks', authenticate, async (req, res) => {
        try {
            const userId = req.user.id;
            console.log(`Getting stocks for user: ${userId}`);
            
            if (!userId) {
                return res.status(400).json({ error: "用户Id不能为空" });
            }
            
            const stocks = await database.getUserSelectedStocks(userId);
            res.status(200).json({ stocks });
        }
        catch (err) {
            console.error(`Error getting user stocks: ${err}`);
            res.status(500).json({ error: err?.message });
        }
    });

    // 添加股票到用户选择列表
    router.post('/stocks', authenticate, async (req, res) => {
        try {
            const userId = req.user.id;
            const stockIds = req.body;

            if (!userId)
                return res.status(400).json({ error: "用户ID不能为空" });
            else if(!stockIds)
                return res.status(400).json({ error: "股票ID不能为空" });
            else if (!Array.isArray(stockIds))
                return res.status(400).json({ error: "股票ID应为数组" });

            console.log(`Adding stocks ${stockIds} to user ${userId}`);
            const rowsAffected = await database.addStocksToUser(userId, stockIds);
            
            if (rowsAffected === 0) {
                return res.status(404).json({ error: "用户不存在" });
            }
            
            res.status(200).json({ success: true, rowsAffected });
        }
        catch (err) {
            console.error(`Error adding stock to user: ${err}`);
            res.status(500).json({ error: err?.message });
        }
    });

    // 从用户选择列表移除股票
    router.delete('/stocks/:stockId', authenticate, async (req, res) => {
        try {
            const userId = req.user.id;
            const stockId = req.params.stockId;
            
            if (!userId || !stockId) {
                return res.status(400).json({ error: "用户ID和股票ID都不能为空" });
            }
            
            console.log(`Removing stock ${stockId} from user ${userId}`);
            const rowsAffected = await database.removeStockFromUser(userId, stockId);
            
            if (rowsAffected === 0) {
                return res.status(404).json({ error: "用户不存在或该用户未添加此股票" });
            }
            
            res.status(200).json({ success: true, rowsAffected });
        }
        catch (err) {
            console.error(`Error removing stock from user: ${err}`);
            res.status(500).json({ error: err?.message });
        }
    });

    return router;
    // 将 router 作为默认导出，供其他文件（如 index.js）使用。
}