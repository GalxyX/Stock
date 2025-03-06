/* *******************************************
主应用程序文件，用于在端口 3000 上启动 Express.js 应用。
使用 Express 并整合了 person.js 与 openapi.js 两个路由；

这是主应用程序文件，用于在指定端口（默认 3000）启动一个基于 Express 的服务器。
通过 import 引入 person.js 和 openapi.js；前者处理与人员数据相关的路由，后者呈现 API 文档。
使用 app.use('/api-docs', openapi) 当访问 /api-docs 时，加载 openapi 路由展示 Swagger UI；同理访问 /persons 时，加载 person 路由进行数据库操作。
任何其他未匹配的请求会重定向到 /api-docs，以便统一处理。
最后通过 app.listen(port) 启动服务器，在控制台打印确认信息。
******************************************* */
import express from 'express';
// 从 'express' 库中导入 express 函数，用于创建服务器应用。

// Import App routes
import person from './person.js'; 
// 导入定义在 person.js 的路由。
import openapi from './openapi.js'; 
// 导入定义在 openapi.js 的路由（通常是 Swagger UI）。
import stock from './stock.js';
// 导入定义在 stock.js 的路由（通常是 Swagger UI）。
import { createDatabaseConnection } from './database.js';
import {
    passwordConfig as SQLAuthentication,
    noPasswordConfig as PasswordlessConfig
} from './config.js';

const port = process.env.PORT || 3000; 
// 设定服务器端口，优先使用环境变量 PORT，否则默认为 3000。

const app = express(); 
// 调用 express() 创建一个 Express 应用实例。

// 初始化数据库连接
const initApp = async () => {
    try {
        const database = await createDatabaseConnection(SQLAuthentication);
        console.log('数据库连接初始化成功');

        // 将数据库实例传递给路由
        app.use('/api-docs', openapi);
        // 当访问 /api-docs 时，使用 openapi 路由（通常用于文档展示）。
        app.use('/persons', person(database)); 
        // 当访问 /persons 时，使用 person 路由（管理与 person 相关的接口）。
        app.use('/stocks', stock(database));
        // 当访问 /stocks 时，使用 stock 路由（管理与 stock 相关的接口）。
        app.use('*', (_, res) => {
            res.redirect('/api-docs');
        });
        // 处理所有其他路径，将其重定向到 /api-docs。

        // Start the server
        app.listen(port, () => {
            console.log(`服务器启动在端口 ${port}`);
        });
    }
    catch (error) {
        console.error('无法连接到数据库:', error);
        process.exit(1);
    }
};

initApp();
