/* *******************************************
使用 mssql npm 包处理 Azure SQL CRUD 操作的数据库类。
添加代码以连接到 Azure SQL 数据库
******************************************* */
import sql from 'mssql';
// 导入 mssql，用于连接并操作 Azure SQL 或其他 SQL Server 数据库。

let database = null;
// 在该文件范围内声明一个 'database' 变量，用于缓存数据库实例。

export default class Database {
    // 导出默认的 Database 类，封装数据库连接和 CRUD 功能。

    config = {};
    // 用于存储数据库连接配置，如主机、用户名、密码等。
    poolconnection = null;
    // 保存执行连接后返回的连接池对象，能提供 request() 方法等，以执行 SQL 语句。
    connected = false;
    // 标记是否已成功连接数据库，设计成布尔值。

    constructor(config) {
        this.config = config;
        // 构造函数接收连接配置对象，如 { server, database, user, password, ... }。
    }

    async connect() {
        // 负责建立与数据库的连接。
        try {
            this.poolconnection = await sql.connect(this.config);
            // 使用 mssql.connect() 方法传入配置对象，以建立连接（返回连接池）。
            this.connected = true;
            console.log('Database connected successfully.');
            return this.poolconnection;
            // 连接成功后，返回连接池对象，并设置 connected = true。
        } catch (error) {
            console.error('Error connecting to the database:', error);
            this.connected = false;
            // 出错则记录错误信息，并将 connected 设为 false。
        }
    }

    async disconnect() {
        // 可主动断开数据库连接。
        try {
            if (this.connected) {
                // 如果已连接，则关闭连接池。
                await this.poolconnection.close();
                this.connected = false;
                console.log('Database disconnected successfully.');
            }
        } catch (error) {
            console.error('Error disconnecting from the database:', error);
        }
    }

    async executeQuery(query) {
        // 通用执行 SQL 语句的方法，返回受影响的行数。
        const request = this.poolconnection.request();
        // 获取对连接池的 request 对象，以执行查询。
        const result = await request.query(query);
        // 执行传入的 SQL 字符串。

        return result.rowsAffected[0];
        // rowsAffected 是一个数组，通常包含各个语句受影响的行数，这里取 [0] 返回。
    }

    async create(data) {
        // 按字段插入一条 Person 记录
        const request = this.poolconnection.request();

        request.input('name', sql.NVarChar(255), data.name);
        request.input('selectedStocks', sql.NVarChar(sql.MAX), data.selectedStocks || '');
        // 通过 request.input 绑定输入参数，避免 SQL 注入

        const result = await request.query(
            `INSERT INTO Person (name, selectedStocks) VALUES (@name, @selectedStocks)`
        );
        // 执行 INSERT 语句，插入新记录到 Person 表

        return result.rowsAffected[0];
        // 返回受影响的行数
    }

    async readAll() {
        // 查询 Person 表所有记录。
        const request = this.poolconnection.request();
        const result = await request.query(`SELECT * FROM Person`);
        // 执行 SELECT 查询，获取所有行。

        return result.recordsets[0];
        // recordsets[0] 为查询的第一组结果。
    }

    async read(id) {
        // 按主键 ID 查询单条记录。
        const request = this.poolconnection.request();
        // 创建 request 对象。
        const result = await request
            .input('id', sql.Int, +id)
            // 向查询语句绑定 id 参数。
            .query(`SELECT * FROM Person WHERE id = @id`);
            // 按绑定的 @id 参数查找对应记录。

        return result.recordset[0];
        // recordset[0] 仅返回一条记录。
    }

    async update(id, data) {
        // 更新指定 ID 的记录
        const request = this.poolconnection.request();

        request.input('id', sql.Int, +id);
        request.input('name', sql.NVarChar(255), data.name);
        request.input('selectedStocks', sql.NVarChar(sql.MAX), data.selectedStocks);

        const result = await request.query(
            `UPDATE Person SET name=@name, selectedStocks=@selectedStocks WHERE id = @id`
        );
        // 执行 UPDATE 语句

        return result.rowsAffected[0];
        // 返回受影响的行数
    }

    async delete(id) {
        // 删除指定 ID 的记录。
        const idAsNumber = Number(id);
        // 转换传入 id 为数字，确保正确性。

        const request = this.poolconnection.request();
        const result = await request
            .input('id', sql.Int, idAsNumber)
            .query(`DELETE FROM Person WHERE id = @id`);
            // 执行 DELETE 语句。

        return result.rowsAffected[0];
        // 返回受影响的行数。
    }

    // 添加股票到用户的选择列表
    async addStockToUser(userId, stockId) {
        const user = await this.read(userId);
        if (!user) return 0;

        let stocks = user.selectedStocks ? user.selectedStocks.split(',') : [];
        if (!stocks.includes(stockId)) {
            stocks.push(stockId);
        }

        const request = this.poolconnection.request();
        request.input('id', sql.Int, +userId);
        request.input('selectedStocks', sql.NVarChar(sql.MAX), stocks.join(','));

        const result = await request.query(
            `UPDATE Person SET selectedStocks=@selectedStocks WHERE id = @id`
        );

        return result.rowsAffected[0];
    }

    // 从用户的选择列表移除股票
    async removeStockFromUser(userId, stockId) {
        const user = await this.read(userId);
        if (!user || !user.selectedStocks) return 0;

        let stocks = user.selectedStocks.split(',');
        stocks = stocks.filter(id => id !== stockId);

        const request = this.poolconnection.request();
        request.input('id', sql.Int, +userId);
        request.input('selectedStocks', sql.NVarChar(sql.MAX), stocks.join(','));

        const result = await request.query(
            `UPDATE Person SET selectedStocks=@selectedStocks WHERE id = @id`
        );

        return result.rowsAffected[0];
    }

    // 获取用户选择的所有股票
    async getUserSelectedStocks(userId) {
        const user = await this.read(userId);
        if (!user || !user.selectedStocks) return [];

        return user.selectedStocks.split(',');
    }

    async createTable() {
        // 如果是开发环境，创建 Person 表（若不存在）。
        if (process.env.NODE_ENV === 'development') {
            this.executeQuery(
                `IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Person')
                 BEGIN
                     CREATE TABLE Person (
                         id int NOT NULL IDENTITY PRIMARY KEY,
                         name varchar(255) NOT NULL,
                         selectedStocks varchar(MAX)
                     );
                 END`
            )
                .then(() => {
                    console.log('Table created');
                })
                .catch((err) => {
                    // 表已存在或出现其他错误时，捕获异常。
                    console.error(`Error creating table: ${err}`);
                });
        }
    }

    // 添加一个新方法到 Database 类中
    async createStockTable() {
        // 如果是开发环境，创建 Stockdata 表（若不存在）
        if (process.env.NODE_ENV === 'development') {
            this.executeQuery(
                `IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Stockdata')
                 BEGIN
                     CREATE TABLE Stockdata (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        stockid VARCHAR(255) NOT NULL,
                        date VARCHAR(255) NOT NULL,
                        TTM DECIMAL(20,10) NOT NULL,
                        PE DECIMAL(20,10) NOT NULL,
                        PB DECIMAL(20,10) NOT NULL,
                        PCF DECIMAL(20,10) NOT NULL,
                        baiduindex INT NOT NULL,
                        weibo_cnsenti DECIMAL(20,10) NOT NULL,
                        weibo_dictionary DECIMAL(20,10) NOT NULL,
                        marketGDP DECIMAL(20,10) NOT NULL,
                        marketpopulation DECIMAL(20,10) NOT NULL,
                        marketaslary DECIMAL(20,10) NOT NULL,

                        ratio_TTM DECIMAL(20,10),
                        ratio_PE DECIMAL(20,10),
                        ratio_PB DECIMAL(20,10),
                        ratio_PCF DECIMAL(20,10),
                        ratio_baiduindex DECIMAL(20,10),
                        ratio_weibo_cnsenti DECIMAL(20,10),
                        ratio_weibo_dictionary DECIMAL(20,10),
                        ratio_marketGDP DECIMAL(20,10),
                        ratio_marketpopulation DECIMAL(20,10),
                        ratio_marketaslary DECIMAL(20,10)
                     );
                 END`
            )
                .then(() => {
                    console.log('Stockdata table created');
                })
                .catch((err) => {
                    console.error(`Error creating Stockdata table: ${err}`);
                });
        }
    }

    // 创建一条股票记录
    async createStock(stockData) {
        const request = this.poolconnection.request();
        
        // 绑定参数
        request.input('stockid', sql.VarChar(255), stockData.stockid);
        request.input('date', sql.VarChar(255), stockData.date);
        request.input('TTM', sql.Decimal(20, 10), stockData.TTM);
        request.input('PE', sql.Decimal(20, 10), stockData.PE);
        request.input('PB', sql.Decimal(20, 10), stockData.PB);
        request.input('PCF', sql.Decimal(20, 10), stockData.PCF);
        request.input('baiduindex', sql.Int, stockData.baiduindex);
        request.input('weibo_cnsenti', sql.Decimal(20, 10), stockData.weibo_cnsenti);
        request.input('weibo_dictionary', sql.Decimal(20, 10), stockData.weibo_dictionary);
        request.input('marketGDP', sql.Decimal(20, 10), stockData.marketGDP);
        request.input('marketpopulation', sql.Decimal(20, 10), stockData.marketpopulation);
        request.input('marketaslary', sql.Decimal(20, 10), stockData.marketaslary);
        request.input('ratio_TTM', sql.Decimal(20, 10), stockData.ratio_TTM);
        request.input('ratio_PE', sql.Decimal(20, 10), stockData.ratio_PE);
        request.input('ratio_PB', sql.Decimal(20, 10), stockData.ratio_PB);
        request.input('ratio_PCF', sql.Decimal(20, 10), stockData.ratio_PCF);
        request.input('ratio_baiduindex', sql.Decimal(20, 10), stockData.ratio_baiduindex);
        request.input('ratio_weibo_cnsenti', sql.Decimal(20, 10), stockData.ratio_weibo_cnsenti);
        request.input('ratio_weibo_dictionary', sql.Decimal(20, 10), stockData.ratio_weibo_dictionary);
        request.input('ratio_marketGDP', sql.Decimal(20, 10), stockData.ratio_marketGDP);
        request.input('ratio_marketpopulation', sql.Decimal(20, 10), stockData.ratio_marketpopulation);
        request.input('ratio_marketaslary', sql.Decimal(20, 10), stockData.ratio_marketaslary);
        
        const result = await request.query(`
            INSERT INTO Stockdata (
                stockid, date, TTM, PE, PB, PCF, baiduindex, weibo_cnsenti, weibo_dictionary, 
                marketGDP, marketpopulation, marketaslary, 
                ratio_TTM, ratio_PE, ratio_PB, ratio_PCF, ratio_baiduindex, ratio_weibo_cnsenti, 
                ratio_weibo_dictionary, ratio_marketGDP, ratio_marketpopulation, ratio_marketaslary
            ) VALUES (
                @stockid, @date, @TTM, @PE, @PB, @PCF, @baiduindex, @weibo_cnsenti, @weibo_dictionary, 
                @marketGDP, @marketpopulation, @marketaslary, 
                @ratio_TTM, @ratio_PE, @ratio_PB, @ratio_PCF, @ratio_baiduindex, @ratio_weibo_cnsenti, 
                @ratio_weibo_dictionary, @ratio_marketGDP, @ratio_marketpopulation, @ratio_marketaslary
            )
        `);
        
        return result.rowsAffected[0];
    }

    // 查询所有股票记录
    async getAllStocks() {
        const request = this.poolconnection.request();
        const result = await request.query(`SELECT * FROM Stockdata`);
        return result.recordsets[0];
    }

    // 按股票代号和日期查询记录
    async getStockByIdAndDate(stockid, date) {
        const request = this.poolconnection.request();
        request.input('stockid', sql.VarChar(255), stockid);
        request.input('date', sql.VarChar(255), date);
        
        const result = await request.query(`
            SELECT * FROM Stockdata 
            WHERE stockid = @stockid AND date = @date
        `);
        
        return result.recordset[0];
    }

    // 按股票代号查询记录
    async getStockById(stockid) {
        const request = this.poolconnection.request();
        request.input('stockid', sql.VarChar(255), stockid);

        const result = await request.query(`
            SELECT * FROM Stockdata 
            WHERE stockid = @stockid
        `);

        return result.recordset;
    }

    // 按日期查询记录
    async getStockByDate(date) {
        const request = this.poolconnection.request();
        request.input('date', sql.VarChar(255), date);

        const result = await request.query(`
            SELECT * FROM Stockdata 
            WHERE date = @date
        `);

        return result.recordset;
    }

    // 更新股票记录
    async updateStock(stockData) {
        const request = this.poolconnection.request();

        const stockid = stockData.stockid;
        const date = stockData.date;
        
        // 绑定参数
        request.input('stockid', sql.VarChar(255), stockid);
        request.input('date', sql.VarChar(255), date);
        request.input('TTM', sql.Decimal(20, 10), stockData.TTM);
        request.input('PE', sql.Decimal(20, 10), stockData.PE);
        request.input('PB', sql.Decimal(20, 10), stockData.PB);
        request.input('PCF', sql.Decimal(20, 10), stockData.PCF);
        request.input('baiduindex', sql.Int, stockData.baiduindex);
        request.input('weibo_cnsenti', sql.Decimal(20, 10), stockData.weibo_cnsenti);
        request.input('weibo_dictionary', sql.Decimal(20, 10), stockData.weibo_dictionary);
        request.input('marketGDP', sql.Decimal(20, 10), stockData.marketGDP);
        request.input('marketpopulation', sql.Decimal(20, 10), stockData.marketpopulation);
        request.input('marketaslary', sql.Decimal(20, 10), stockData.marketaslary);
        request.input('ratio_TTM', sql.Decimal(20, 10), stockData.ratio_TTM);
        request.input('ratio_PE', sql.Decimal(20, 10), stockData.ratio_PE);
        request.input('ratio_PB', sql.Decimal(20, 10), stockData.ratio_PB);
        request.input('ratio_PCF', sql.Decimal(20, 10), stockData.ratio_PCF);
        request.input('ratio_baiduindex', sql.Decimal(20, 10), stockData.ratio_baiduindex);
        request.input('ratio_weibo_cnsenti', sql.Decimal(20, 10), stockData.ratio_weibo_cnsenti);
        request.input('ratio_weibo_dictionary', sql.Decimal(20, 10), stockData.ratio_weibo_dictionary);
        request.input('ratio_marketGDP', sql.Decimal(20, 10), stockData.ratio_marketGDP);
        request.input('ratio_marketpopulation', sql.Decimal(20, 10), stockData.ratio_marketpopulation);
        request.input('ratio_marketaslary', sql.Decimal(20, 10), stockData.ratio_marketaslary);
        // 绑定其他需要更新的字段
        
        const result = await request.query(`
            UPDATE Stockdata 
            SET TTM = @TTM, PE = @PE, PB = @PB, PCF = @PCF, baiduindex = @baiduindex,
                weibo_cnsenti = @weibo_cnsenti, weibo_dictionary = @weibo_dictionary,
                marketGDP = @marketGDP, marketpopulation = @marketpopulation, marketaslary = @marketaslary,
                ratio_TTM = @ratio_TTM, ratio_PE = @ratio_PE, ratio_PB = @ratio_PB, ratio_PCF = @ratio_PCF,
                ratio_baiduindex = @ratio_baiduindex, ratio_weibo_cnsenti = @ratio_weibo_cnsenti,
                ratio_weibo_dictionary = @ratio_weibo_dictionary, ratio_marketGDP = @ratio_marketGDP,
                ratio_marketpopulation = @ratio_marketpopulation, ratio_marketaslary = @ratio_marketaslary
            WHERE stockid = @stockid AND date = @date
        `);
        
        return result.rowsAffected[0];
    }

    // 删除股票记录
    async deleteStock(stockid, date) {
        const request = this.poolconnection.request();
        request.input('stockid', sql.VarChar(255), stockid);
        request.input('date', sql.VarChar(255), date);
        
        const result = await request.query(`DELETE FROM Stockdata WHERE stockid = @stockid AND date = @date`);
        
        return result.rowsAffected[0];
    }

    // 删除所有股票记录
    async deleteAllStocks() {
        const request = this.poolconnection.request();
        const result = await request.query(`DELETE FROM Stockdata`);
        return result.rowsAffected[0];
    }
}

// 使用工厂函数创建并返回一个数据库实例。
export const createDatabaseConnection = async (passwordConfig) => {
    database = new Database(passwordConfig);
    // 创建 Database 类的实例，传入数据库配置。
    await database.connect();
    // 连接到数据库。
    await database.createTable();
    await database.createStockTable();
    // 在开发环境下创建 Table（若还不存在）。
    return database;
    // 返回该实例，以便在外部使用。
};
