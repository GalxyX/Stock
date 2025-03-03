/* *******************************************
用于读取环境变量并构造适当 mssql 连接对象的配置文件。
配置 mssql 连接对象
mssql 包通过为身份验证类型提供配置设置来实现与 Azure SQL 数据库的连接。
******************************************* */
import * as dotenv from 'dotenv';
// 从 'dotenv' 库中加载所有导出的函数和对象，
// 主要应用于解析并加载 .env 文件中的环境变量。

if (process.env.NODE_ENV === 'development') {
    dotenv.config({ path: `.env.${process.env.NODE_ENV}`, debug: true });
    // 如果当前环境是 'development'，则从对应的 .env.development 文件加载环境变量。
    // debug: true 可在控制台输出 dotenv 加载的调试信息，便于排查问题。
}

// 以下通过读取环境变量设置若干变量，用于后续的数据库连接配置。
// 注意： process.env.<变量> 读取的是系统/进程中的环境变量，可在编译或运行时设定。

// TIP: Port must be a number, not a string!
const server = process.env.AZURE_SQL_SERVER;
// 从环境变量中读取 SQL Server 的主机（或地址）。
const database = process.env.AZURE_SQL_DATABASE;
// 从环境变量中读取要连接的数据库名。
const port = +process.env.AZURE_SQL_PORT;
// 用一元加号将字符串转换为数字，得到数据库端口号。
const type = process.env.AZURE_SQL_AUTHENTICATIONTYPE;
// 从环境变量中读取认证类型（如 'default' 或 'azure-active-directory-msi' 等）。
const user = process.env.AZURE_SQL_USER;
// 数据库用户名。
const password = process.env.AZURE_SQL_PASSWORD;
// 数据库密码。

export const noPasswordConfig = {
    // 当不需要密码进行认证时的配置对象。
    server,
    port,
    database,
    authentication: {
        type
    },
    options: {
        encrypt: true // 打开传输加密，常用于 Azure SQL 等需要安全连接的场景。
    }
};

export const passwordConfig = {
    // 使用用户名密码进行认证的配置对象。
    server,
    port,
    database,
    user,
    password,
    options: {
        encrypt: true // 同样开启连接加密。
    }
};