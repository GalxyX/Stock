/* *******************************************
OpenAPI 资源管理器 UI 的 Express.js /api-docs 路由。 根重定向到此路由。
提供了 Swagger UI 文档路由；

提供 Swagger UI 的路由配置，用于对外展示 API 文档。
读取并解析一个 openApiSchema.yml（或类似）文件，然后用 swagger-ui-express 将其渲染成可交互的文档界面。
当被挂载到 /api-docs 时，访问该路径即可查看并测试接口文档。
******************************************* */
import express from 'express';
// 从 'express' 库导入 express，用于创建路由对象。
import { join, dirname } from 'path';
// 从 Node.js 内置的 'path' 模块中导入 join、dirname，用于构建路径和获取当前文件目录名。
import swaggerUi from 'swagger-ui-express';
// 导入 swagger-ui-express，用于提供 Swagger UI 界面。
import yaml from 'yamljs';
// 导入 yamljs，用于解析 YAML 格式的文件。
import { fileURLToPath } from 'url';
// 导入 fileURLToPath，用于将 ES 模块中的 import.meta.url 转换为文件物理路径。

const __dirname = dirname(fileURLToPath(import.meta.url));
// 使用 fileURLToPath 将当前模块的 URL 转换为文件路径，然后用 dirname 获取目录名。

const router = express.Router();
router.use(express.json());
// 创建一个新的路由（router），并启用对 JSON 请求体的解析。

const pathToSpec = join(__dirname, '../openApiSchema.yml');
// 构建 openApiSchema.yml 文件的完整路径。
const openApiSpec = yaml.load(pathToSpec);
// 使用 yaml.load 读取并解析 YAML 格式的 openApiSchema.yml。

router.use('/', swaggerUi.serve, swaggerUi.setup(openApiSpec));
// 当有请求访问此路由时，为其提供 Swagger UI 界面，并基于 openApiSpec 显示 API 文档。

export default router;
// 将该 router 作为默认导出，供其他文件（如 index.js）使用。