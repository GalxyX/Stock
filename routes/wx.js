/* *******************************************
Express.js / wx 路由 API 文件，用于处理微信小程序登录认证功能

提供以下路由操作:
GET /openid：获取用户openid并验证用户

返回结果或错误消息时统一使用 JSON 格式，保证接口结构一致。
******************************************* */
import express from 'express';
// 用于创建路由对象等功能。
import axios from 'axios';
const APPID = process.env.APPID;
const SECRET = process.env.SECRET;
// 从环境变量中获取 APPID 和 SECRET。

export default function (database) {
    // 环境变量检查
    if (!APPID || !SECRET) {
        console.error('错误: 未设置APPID或SECRET环境变量');
    }
    
    const router = express.Router();
    router.use(express.json());
    // 创建一个新的路由实例，并开启对 JSON 请求体的解析。
    
    // 处理微信登录，获取openid并验证用户
    router.get('/openid', async (req, res) => {
        try {
            const { code } = req.query;
            if (!code) {
                return res.status(400).json({ error: "缺少必要参数code" });
            }
            
            // 处理 GET /wx/openid 请求，向微信服务器请求openid
            const result = await axios.get(
                `https://api.weixin.qq.com/sns/jscode2session?appid=${APPID}&secret=${SECRET}&js_code=${code}&grant_type=authorization_code`
            );
            // 处理获取到的openid和session_key
            const { openid, session_key, errcode, errmsg } = result.data;
            // 检查微信API返回的错误
            if (errcode) {
                return res.status(400).json({ error: `微信API错误: ${errmsg || `错误码${errcode}`}` });
            }

            // 通过openid查找用户
            const user = await database.readPersonbyAccount(openid);

            // 返回openid和用户是否存在
            return res.status(200).json({
                openid,
                userExists: !!user // 转换为布尔值（null/undefined-->true）
            });
        }
        catch (err) {
            console.error('微信登录错误:', err);
            res.status(500).json({ error: err?.message || '服务器内部错误' });
        }
    });
    
    
    return router;
    // 将 router 作为默认导出，供其他文件（如 index.js）使用。
}
