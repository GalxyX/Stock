/* *******************************************
Express.js / person 路由 API 文件，用于处理 CRUD 操作。
管理对 "person" 数据的增删改查（基于某个数据库操作层）。

提供 /persons 路由下的 CRUD 操作接口。
首先建立数据库连接（通过 createDatabaseConnection），并将实例保存在 database 变量中。
定义多个路由方法：
GET /persons：查询所有 person 记录。
GET /persons/:id：按指定 ID 查询单条记录。
POST /persons：创建新记录。
PUT /persons/:id：更新指定记录。
DELETE /persons/:id：删除指定记录。

用户股票管理接口：
GET /persons/:id/stocks：获取指定用户的股票列表。
POST /persons/:id/stocks：向用户的选择列表添加股票。
DELETE /persons/:id/stocks/:stockId：从用户的选择列表移除特定股票。

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

router.get('/', async (req, res) => {
    try {
        // 处理 GET /persons 请求，返回所有 persons。
        const persons = await database.readAll();
        console.log(`persons: ${JSON.stringify(persons)}`);
        res.status(200).json(persons);
    } catch (err) {
        res.status(500).json({ error: err?.message });
    }
});
// 定义路由 GET /，查询并返回所有 person 数据；如果出错，返回 500。

router.post('/', async (req, res) => {
    try {
        // 处理 POST /persons 请求，创建新 person。
        const person = req.body;
        console.log(`person: ${JSON.stringify(person)}`);
        const rowsAffected = await database.create(person);
        res.status(201).json({ rowsAffected });
    } catch (err) {
        res.status(500).json({ error: err?.message });
    }
});
// 定义路由 POST /，插入数据到数据库；如果出错，返回 500。

router.get('/:id', async (req, res) => {
    try {
        // 处理 GET /persons/:id 请求，根据 ID 返回单个 person。
        const personId = req.params.id;
        console.log(`personId: ${personId}`);
        if (personId) {
            const result = await database.read(personId);
            console.log(`persons: ${JSON.stringify(result)}`);
            res.status(200).json(result);
        } else {
            res.status(404);
        }
    } catch (err) {
        res.status(500).json({ error: err?.message });
    }
});
// 定义路由 GET /:id，按 ID 查询数据库中对应的 person；找不到则返回 404，出错则返回 500。

router.put('/:id', async (req, res) => {
    try {
        // 处理 PUT /persons/:id 请求，更新指定 ID 的 person 数据。
        const personId = req.params.id;
        console.log(`personId: ${personId}`);
        const person = req.body;
        
        if (personId && person) {
            delete person.id;
            console.log(`person: ${JSON.stringify(person)}`);
            const rowsAffected = await database.update(personId, person);
            res.status(200).json({ rowsAffected });
        } else {
            res.status(404);
        }
    } catch (err) {
        res.status(500).json({ error: err?.message });
    }
});
// 定义路由 PUT /:id，先移除请求体中可能带的 id 字段，然后更新数据库；出错返回 500。

router.delete('/:id', async (req, res) => {
    try {
        // 处理 DELETE /persons/:id 请求，删除指定 ID 的 person。
        const personId = req.params.id;
        console.log(`personId: ${personId}`);

        if (!personId) {
            res.status(404);
        } else {
            const rowsAffected = await database.delete(personId);
            res.status(204).json({ rowsAffected });
        }
    } catch (err) {
        res.status(500).json({ error: err?.message });
    }
});
// 定义路由 DELETE /:id，若 ID 存在则执行删除操作；删除成功返回 204，出错返回 500。

// 获取用户选择的股票列表
router.get('/:id/stocks', async (req, res) => {
    try {
        const userId = req.params.id;
        console.log(`Getting stocks for user: ${userId}`);
        
        if (!userId) {
            return res.status(400).json({ error: "用户ID不能为空" });
        }
        
        const stocks = await database.getUserSelectedStocks(userId);
        res.status(200).json({ stocks });
    } catch (err) {
        console.error(`Error getting user stocks: ${err}`);
        res.status(500).json({ error: err?.message });
    }
});

// 添加股票到用户选择列表
router.post('/:id/stocks', async (req, res) => {
    try {
        const userId = req.params.id;
        const { stockId } = req.body;
        
        if (!userId || !stockId) {
            return res.status(400).json({ error: "用户ID和股票ID都不能为空" });
        }
        
        console.log(`Adding stock ${stockId} to user ${userId}`);
        const rowsAffected = await database.addStockToUser(userId, stockId);
        
        if (rowsAffected === 0) {
            return res.status(404).json({ error: "用户不存在" });
        }
        
        res.status(200).json({ success: true, rowsAffected });
    } catch (err) {
        console.error(`Error adding stock to user: ${err}`);
        res.status(500).json({ error: err?.message });
    }
});

// 从用户选择列表移除股票
router.delete('/:id/stocks/:stockId', async (req, res) => {
    try {
        const userId = req.params.id;
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
    } catch (err) {
        console.error(`Error removing stock from user: ${err}`);
        res.status(500).json({ error: err?.message });
    }
});

export default router;
// 将 router 作为默认导出，供其他文件（如 index.js）使用。