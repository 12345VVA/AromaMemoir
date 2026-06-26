# weiji-server

味记（weiji）cool-admin 业务后端服务，基于 **Midway.js 风格装饰器 + Koa** 实现。

> 三服务架构中的业务后端：weiji-admin-web（前端 :5173）→ **weiji-server（业务后端 :8001）** → weiji-ai（AI 服务 :8002）。

## 项目结构

```
weiji-server/
├── package.json              # 依赖与脚本
├── tsconfig.json             # TypeScript 配置（experimentalDecorators + emitDecoratorMetadata）
├── .gitignore
├── README.md
└── src/
    ├── bootstrap.ts          # 应用启动入口（Koa + 装饰器路由扫描，监听 :8001）
    ├── configuration.ts      # 应用配置（端口 / CORS / JWT / AI 服务地址）
    ├── common/
    │   ├── response.ts       # 统一响应辅助：ok() / fail() / unauthorized() / forbidden()
    │   └── decorators.ts     # Midway 风格装饰器：@Controller / @Get / @Post / @Put / @Patch / @Delete
    ├── controller/
    │   └── health.controller.ts   # GET /health
    └── store/
        ├── types.ts          # 业务实体类型定义（参考 MVP 速查手册 2.2 节）
        ├── db.ts             # 内存存储 + 种子数据（启动时打印统计）
        └── helpers.ts        # 查询辅助：findById / findByField / filterBy / insert / updateById / softDelete
```

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 开发模式启动（监听 :8001）
npm run dev

# 3. 类型检查 + 编译到 dist/
npm run build

# 4. 生产模式运行
npm start
```

## 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 返回 `{ status: "ok", ai: "up" }`，ai 字段待 Task 7 接入真实 AI 代理层 |

> 业务端点（auth / record / family / achievement / checkin / user / challenge / ai）将在 Task 3-7 追加。

## 统一响应格式

与前端 [client.ts](file:///workspace/weiji-admin-web/src/api/client.ts) 契约一致：

```ts
// 成功
{ code: 0, data: <payload>, message: "" }

// 失败
{ code: <非零错误码>, data: null, message: "人类可读消息" }
```

辅助函数位于 `src/common/response.ts`：`ok(data, message='')` / `fail(message, code=1, data=null)`。

## 演示账号

所有账号密码统一为 `123456`（bcrypt 哈希后存储）。

| 用户名 | 昵称 | 家庭组角色 |
|--------|------|------------|
| demo | 小明 | owner（家庭组创建者） |
| mom | 妈妈 | admin |
| dad | 爸爸 | member |
| grandma | 奶奶 | member |

家庭组：王家厨房（inviteCode: WJ1234）

## 种子数据

启动时控制台会打印各表记录数，便于验证：

```
[store] 种子数据加载完成:
  - users count: 4
  - families count: 1
  - family_members count: 4
  - family_recipes count: 4
  - invitations count: 1
  - records count: 3
  - weekly_menu count: 21
  - shopping_items count: 7
  - achievements count: 6
  - user_achievements count: 2
  - check_ins count: 7
  - challenges count: 3
```

## CORS 配置

允许源：`http://localhost:5173`、`http://127.0.0.1:5173`，允许携带 `Authorization` header（`credentials: true`）。

## 技术说明

由于完整 Midway.js DI 容器在 dev 模式下需要 `mwtsc` + `@midwayjs/mock` 等额外工具链，本骨架采用 spec 允许的降级方案：

- 保留 `@midwayjs/core`、`@midwayjs/koa`、`@midwayjs/decorator` 等依赖（可平滑升级到完整 Midway）
- 装饰器 API（`@Controller(prefix)` / `@Get(path)` / `@Post(path)`）与 Midway 完全一致
- 启动入口使用 `ts-node src/bootstrap.ts`，直接 koa 监听 8001，规避复杂工具链
- 后续 Task 升级时，控制器代码无需改动，仅 bootstrap / configuration 切换到 Midway Bootstrap 即可
