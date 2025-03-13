import jwt from 'jsonwebtoken';
import { createDatabaseConnection } from '../config/database.js';
import {
    passwordConfig as SQLAuthentication,
    noPasswordConfig as PasswordlessConfig
} from '../config/config.js';

// 定义 JWT 密钥（通过环境变量注入）
const JWT_SECRET = process.env.JWT_SECRET || 'default_jwt_secret_for_development';
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    console.error('警告: 生产环境下未设置JWT_SECRET环境变量，这会带来安全风险!');
}

// 存储数据库连接实例
let dbInstance = null;

// 获取数据库连接（复用已有连接）
async function getDbConnection() {
    if (!dbInstance || !dbInstance.connected) {
        dbInstance = await createDatabaseConnection(SQLAuthentication);
    }
    return dbInstance;
}

/**
 * 身份验证中间件
 * 功能：验证请求头中的 JWT 令牌是否有效
 * RESTful 设计：通过标准 Authorization 头传递令牌
 */
export const authenticate = async (req, res, next) => {
    // 从请求头中提取令牌（格式：Bearer <token>）
    /** 常见认证类型
     * Bearer: JWT等令牌认证                    Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
     * Basic: 基本认证(用户名密码的Base64编码)   Authorization: Basic dXNlcm5hbWU6cGFzc3dvcmQ=
     * Digest: 摘要认证
     * OAuth: OAuth认证
     */
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {//未提供（undefined）
        return res.status(401).json({ error: "未提供有效的身份验证令牌" });
    }

    const token = authHeader.split(' ')[1]; // 提取令牌部分

    try {
        // 验证 JWT 令牌
        const decoded = jwt.verify(token, JWT_SECRET);

        try {
            // 连接数据库验证用户是否存在（防止令牌伪造）
            const db = await getDbConnection();
            const user = await db.readPersonbyId(decoded.userId);

            if (!user) {
                return res.status(403).json({ error: "用户不存在或令牌无效" });
            }

            // 将用户信息附加到请求对象，供后续路由使用
            req.user = {
                id: user.id,
                role: user.role // 支持角色权限控制
            };

            next(); // 验证通过，继续执行后续逻辑
        }
        catch (dbErr) {
            console.error('数据库验证失败:', dbErr);
            return res.status(500).json({ error: "服务器内部错误" });
        }
    }
    catch (err) {
        // 根据不同错误类型返回特定响应
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: "令牌已过期，请重新登录", code: "token_expired" });
        }
        else if (err.name === 'JsonWebTokenError') {
            return res.status(403).json({ error: "无效的令牌", code: "invalid_token" });
        }
        res.status(403).json({ error: "身份验证失败", code: "auth_failed" });
    }
};

/**
 * 管理员权限中间件
 * 功能：仅允许角色为 admin 的用户访问
 * RESTful 设计：通过 403 状态码明确拒绝权限
 */
export const adminOnly = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: "未通过身份验证", code: "not_authenticated" });
    }
    
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: "需要管理员权限", code: "admin_required" });
    }
    
    next();
};