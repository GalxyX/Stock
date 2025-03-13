# 基于大数据的公司估值模型小程序后端

一个综合性的股票数据管理与预测系统，提供股票数据管理、用户认证、数据可视化和股价预测功能。该系统通过REST API接口提供服务，支持微信小程序登录，并集成多种数据源（如雪球API、新浪财经API）获取实时股票数据。

项目采用前后端分离架构，后端基于Node.js/Express构建，提供RESTful API接口；前端支持Web界面和微信小程序两种访问方式。系统内置机器学习模型，可对股票价格和关键财务指标进行预测分析。

## 功能特点

- **用户认证与管理**：
    - 注册、登录、权限控制（普通用户/管理员）
    - 用户信息管理
    - 股票关注列表管理
- **股票数据管理**：支持股票数据的创建、读取、更新和删除
- **市场行情查询**：
    - 沪深A股、B股实时行情
    - 港股实时行情
    - 美股实时行情
    - 雪球API股票搜索
- **模型预测**：
    - 基于机器学习算法的公司估值预测
    - 财务指标（TTM、PE、PB、PCF）预测
    - 预测结果存储与查询
    - 模型定期训练与更新
- **微信小程序认证**：支持微信小程序登录
- **API文档**：集成Swagger UI的交互式API文档

## 技术栈

- **后端**：Node.js + Express
- **数据库**：Azure SQL Server
- **认证**：JWT (JSON Web Token)
- **机器学习**：Python + scikit-learn + XGBoost
- **API文档**：Swagger UI + OpenAPI 3.0
- **数据处理**：Excel导入/导出
- **前端**：微信小程序

## 项目结构

```
Stock/
├── config/               # 配置文件
│   ├── config.js         # 数据库连接配置
│   └── database.js       # 数据库操作类
├── model/                # 预测模型
│   └── model.py          # Python预测模型
├── routes/               # API路由
│   ├── authenticate.js   # 认证中间件
│   ├── modelPredict.js   # 模型预测路由
│   ├── openapi.js        # API文档路由
│   ├── person.js         # 用户管理路由
│   ├── stock.js          # 股票数据路由
│   └── wx.js             # 微信小程序路由
├── scripts/              # 数据导入脚本
│   ├── importExcelData.js # Excel数据导入
│   └── importStocksNew.js # 股票数据导入
├── .vscode/              # VS Code配置
├── index.js              # 应用入口文件
├── package.json          # 项目依赖
├── openApiSchema.yml     # API文档定义
└── LICENSE               # MIT许可证
```

## 安装指南

1. 克隆仓库
```bash
git clone https://github.com/GalxyX/Stock.git
cd Stock
```

2. 安装Node.js依赖及Python依赖
```bash
npm install
```

3. 配置环境变量
创建`.env.development`文件（开发环境）或设置系统环境变量（生产环境）:
```
# 数据库配置
AZURE_SQL_SERVER=your_sql_server
AZURE_SQL_DATABASE=your_database
AZURE_SQL_PORT=1433
AZURE_SQL_USER=your_username
AZURE_SQL_PASSWORD=your_password
AZURE_SQL_AUTHENTICATIONTYPE=default

# 密码加密配置
SALT_ROUNDS=your_salt_rounds

# JWT配置
JWT_SECRET=your_jwt_secret

# 微信小程序配置
APPID=your_wx_app_id
SECRET=your_wx_app_secret

# 雪球API配置
XUEQIU_COOKIE=your_xueqiu_cookie
```

4. 数据库初始化
```javascript
# 导入示例股票数据
node scripts/importStocksNew.js
```

5. 启动服务器
```bash
node index.js
```

6. 访问API文档
浏览器打开 `http://localhost:3000/api-docs`

## API概览

- **认证相关**：`/persons/register`, `/persons/login`
- **用户管理**：`/persons`
- **股票数据**：`/stocks`
- **行情查询**：
    - `/stocks/sinaAPI/SH`（沪深市场）
    - `/stocks/sinaAPI/HK`（港股市场）
    - `/stocks/sinaAPI/US`（美股市场）
- **模型预测**：`/modelPredict`
- **微信认证**：`/wx/openid`

详细的API文档可通过 Swagger UI(`/api-docs`)访问。

## 数据导入

从Excel导入用于公司估值模型训练的数据
```bash
node scripts/importStocksNew.js
```

## 部署
项目可以部署到Azure App Service：

1. 创建Azure App Service实例
2. 设置环境变量（应用设置）
3. 配置部署方式（GitHub Actions或Azure DevOps）
4. 部署应用

## 模型预测

模型预测功能结合了Python机器学习算法:
- 使用RandomForestRegressor和XGBoost进行预测
- 支持各种金融因子的预测分析

## 许可证

本项目基于MIT许可证发布 - 详见 [LICENSE](LICENSE) 文件

## 作者

Copyright (c) 2025 GalxyX
