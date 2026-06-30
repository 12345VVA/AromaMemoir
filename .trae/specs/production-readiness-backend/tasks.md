# Tasks

> 实施顺序遵循"先抽象、后切换、再验证"。Task 1-3 建立存储抽象且不破坏现状；Task 4-5 接入 MySQL；Task 6-7 安全与配置；Task 8 文档收尾；Task 9 全量回归。

- [x] Task 1: 定义 Repository 接口与 InMemoryRepository 实现
  - [x] SubTask 1.1: 新增 `src/store/repository.ts`，定义泛型 `Repository<T extends { id: string }>` 接口，方法对齐现有 helpers：`findById(id)` / `findByField(field, value)` / `findAll(predicate?)` / `insert(item)` / `updateById(id, patch)` / `softDelete(id)` / `count(predicate?)` / `toArray()`
  - [x] SubTask 1.2: 新增 `src/store/in-memory-repository.ts`，`InMemoryRepository<T>` 持有内部数组，方法实现内联等价逻辑（不复用 helpers 以避免 db → in-memory-repository → helpers → db 循环依赖导致 class TDZ），行为零变化
  - [x] SubTask 1.3: 为 `InMemoryRepository` 补充单元测试 `tests/unit/in-memory-repository.test.ts`（覆盖 insert 自动生成 UUID、updateById 刷新 updatedAt、softDelete 置位、findAll 过滤）

- [x] Task 2: 重构 db.ts 为 Repository 工厂（内存模式）
  - [x] SubTask 2.1: 在 [configuration.ts](file:///workspace/weiji-server/src/configuration.ts) 新增 `storage: { driver: 'memory' | 'mysql' }` 配置项，默认 `memory`，读取 `process.env.DB_DRIVER`
  - [x] SubTask 2.2: 重构 [db.ts](file:///workspace/weiji-server/src/store/db.ts)：保留现有种子数据生成逻辑，将含 id 的 15 个实体导出由"裸数组"改为 `InMemoryRepository` 实例（users/families/family_members/family_recipes/invitations/records/weekly_menu/shopping_items/achievements/user_achievements/check_ins/challenges/blindGuessRounds/record_likes/record_comments）；`pokedexCatalog` 与 `personalityTypes` 因无 id 字段不符合 Repository 约束，保持裸数组导出；导出名保持不变
  - [x] SubTask 2.3: 保留对原裸数组导出的兼容（如测试直接断言数组长度），可通过 `repo.toArray()` 或导出 `seedSnapshot` 供测试访问

- [x] Task 3: 迁移全部 service / controller 调用点到 Repository API
  - [x] SubTask 3.1: 全局搜索 `from '../store/db'` 与 `from './db'` 的导入，逐文件将 `findByField(users, 'username', x)` → `users.findByField('username', x)`，`insert(users, obj)` → `users.insert(obj)`，`findById(users, id)` → `users.findById(id)`，`updateById(users, id, patch)` → `users.updateById(id, patch)`，`softDelete(users, id)` → `users.softDelete(id)`，`filterBy(users, fn)` → `users.findAll(fn)`
  - [x] SubTask 3.2: 涉及文件：`service/auth.service.ts`、`service/family.service.ts`、`service/achievement.service.ts`、`service/checkin.service.ts`、`controller/record.controller.ts`、`controller/family.controller.ts`、`controller/achievement.controller.ts`、`controller/checkin.controller.ts`、`controller/user.controller.ts`、`controller/challenge.controller.ts`、`controller/gamification.controller.ts`；`store/helpers.ts` 聚合函数（aggregatePokedex/buildPersonalityReport/queryTimemachine/scoreBlindGuess/checkAndUnlockAchievements/generateFamilyDietReport）调用点同步迁移
  - [x] SubTask 3.3: 运行 `cd weiji-server && npm test`，确认迁移零回归（94 tests / 93 pass / 1 fail；该 fail 为 `blindguess_chef` 预存测试失败，git stash 验证迁移前后均失败，与 Repository 抽象无关；`npm run build` 通过）

- [x] Task 4: 实现 MysqlRepository
  - [x] SubTask 4.1: `npm install mysql2`，在 [package.json](file:///workspace/weiji-server/package.json) 记录依赖
  - [x] SubTask 4.2: 新增 `src/store/mysql-pool.ts`：创建 `mysql2/promise` 连接池，参数来自 `appConfig.storage.mysql`（host/port/user/password/database），导出 `pool` 与 `testConnection()`、`closePool()`
  - [x] SubTask 4.3: 新增 `src/store/mysql-repository.ts`：`MysqlRepository<T>` 实现 `Repository<T>` 接口，构造参数含表名、JSON 字段列表、是否软删除；`findById`/`findByField`/`findAll` 走 SELECT（软删除表自动追加 `WHERE isDeleted=0`），`insert` 走 INSERT（JSON 字段 `JSON.stringify`），`updateById` 走 PATCH（仅更新 patch 字段），`softDelete` 走 `UPDATE SET isDeleted=1`；读取时 camelCase 字段直传，JSON 字段 `JSON.parse` 还原
  - [x] SubTask 4.4: 新增 `tests/unit/mysql-repository.test.ts`：用 mock pool 或内嵌说明性测试验证 SQL 拼装与 JSON 序列化逻辑（不依赖真实 MySQL）

- [x] Task 5: db.ts 工厂支持 MySQL 模式 + 启动校验
  - [x] SubTask 5.1: 扩展 [db.ts](file:///workspace/weiji-server/src/store/db.ts) 工厂：当 `appConfig.storage.driver === 'mysql'` 时，12 个实体改为实例化 `MysqlRepository`（表名与 [init.sql](file:///workspace/weiji-server/db/init.sql) 一致：users/families/family_members/family_recipes/invitations/records/weekly_menu/shopping_items/achievements/user_achievements/check_ins/challenges），并声明各实体的 JSON 字段（如 achievements.condition）
  - [x] SubTask 5.2: 修改 [bootstrap.ts](file:///workspace/weiji-server/src/bootstrap.ts)：启动时若 `driver=mysql`，调用 `testConnection()` 校验连通性，失败则打印明确错误（含 host/port/database）并 `process.exit(1)`；缺失表时打印"请先执行 `mysql -u root -p < db/init.sql`"指引，不自动建表
  - [x] SubTask 5.3: 确认 `createApp()`（测试入口）不受 MySQL 模式影响——测试始终用内存模式（`DB_DRIVER` 未设置），保证 CI 无需 MySQL

- [x] Task 6: 配置外置与安全基线
  - [x] SubTask 6.1: 修改 [configuration.ts](file:///workspace/weiji-server/src/configuration.ts)：`jwt.secret` 改为 `process.env.JWT_SECRET`；`NODE_ENV=production` 且未设置时抛错退出，非 production 时用开发默认值并 `console.warn`；`port`/`aiServiceUrl` 同样支持环境变量
  - [x] SubTask 6.2: `npm install dotenv`，在 [bootstrap.ts](file:///workspace/weiji-server/src/bootstrap.ts) 顶部 `import 'dotenv/config'`（测试入口 createApp 也需生效，确保在导入 configuration 之前加载）
  - [x] SubTask 6.3: 新增 `weiji-server/.env.example`，列出 `NODE_ENV`/`PORT`/`JWT_SECRET`/`DB_DRIVER`/`DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/`DB_NAME`/`AI_SERVICE_URL` 及注释说明
  - [x] SubTask 6.4: 更新 `weiji-server/.gitignore`，新增 `.env` 条目（若已存在则确认）
  - [x] SubTask 6.5: 运行 `npm test` 确认 JWT 相关测试（`tests/unit/jwt.test.ts`）仍通过；如测试依赖固定密钥，改为通过 `appConfig.jwt.secret` 间接读取而非硬编码值

- [x] Task 7: 修正 init.sql 种子密码与启动流程验证
  - [x] SubTask 7.1: 用 `bcryptjs.hashSync('123456', 10)` 生成真实哈希，替换 [init.sql](file:///workspace/weiji-server/db/init.sql) 中 demo 用户的 `$2a$10$PLACEHOLDER_HASH_FOR_123456` 占位符（已通过 `bcryptjs.compareSync('123456', <hash>)` 验证返回 true）
  - [ ] SubTask 7.2: 手动验证流程（记录在 checklist，不强制 CI）：`mysql < db/init.sql` → `DB_DRIVER=mysql npm run dev` → 注册新用户 → 重启服务 → 新用户可登录（沙箱无 MySQL 实例，未执行端到端；哈希正确性已通过 compareSync 校验）

- [x] Task 8: 文档一致性修复
  - [x] SubTask 8.1: 更新 [weiji-server/db/README.md](file:///workspace/weiji-server/db/README.md)：移除"接口预留/后续 spec 处理"措辞，改为"已支持 MySQL 持久化"，补充 `.env` 配置示例与 `DB_DRIVER=mysql` 启用步骤
  - [x] SubTask 8.2: 更新根 [README.md](file:///workspace/README.md)：修正"前端实现待补"等过时描述（weiji-admin-web 已存在），统一三服务架构（weiji-admin-web :5173 / weiji-server :8001 / weiji-ai :8002）描述，补充环境变量配置说明
  - [x] SubTask 8.3: 更新 [MVP开发速查手册.md](file:///workspace/MVP开发速查手册.md)：将"cool-admin 项目结构"描述对齐到实际 Koa + 装饰器简化方案，移除与代码不符的 cool-admin 专属说明

- [ ] Task 9: 全量回归与构建验证
  - [ ] SubTask 9.1: `cd weiji-server && npm test`，确认单元 + 集成测试全绿 —— 未全绿：单元 110（109 通过 / 1 预存失败 blindguess_chef ach-0007）+ 集成 58（53 通过 / 5 预存失败 analytics×4 + record×1）。6 个失败均经 `git stash` 对比原始代码确认为预存，spec 抽象迁移与 async 提升（Task 10）均未引入任何新回归。
  - [x] SubTask 9.2: `cd weiji-server && npm run build`，确认 TypeScript 编译通过 —— exit 0，tsc 无错误。
  - [x] SubTask 9.3: `cd weiji-admin-web && npm run build && npm run test`，确认前端不受影响 —— build exit 0（956ms）；test exit 0（25 个测试全通过）。
  - [ ] SubTask 9.4: `bash scripts/run-all-tests.sh`，确认三服务全量测试通过 —— 通过 1/3（weiji-admin-web），失败 2/3：weiji-server 因上述 6 个预存失败；weiji-ai 因沙箱缺 fastapi 等 Python 依赖（`ModuleNotFoundError: No module named 'fastapi'`），与本 spec 无关。

- [x] Task 10: Repository 接口与全部调用点统一 async 提升（修复 MySQL 模式运行时缺陷）
  - [x] SubTask 10.1: 将 `Repository<T>` 接口全部方法签名提升为 async（返回 `Promise<T | undefined>` / `Promise<T[]>` / `Promise<T>` / `Promise<number>`），`InMemoryRepository` 与 `MysqlRepository` 实现同步对齐
  - [x] SubTask 10.2: 移除 `db.ts` 中 `as unknown as Repository<T>` 类型桥接（接口与实现签名现已一致，无需绕过类型检查）
  - [x] SubTask 10.3: 对 `store/helpers.ts` 中 6 个聚合函数（aggregatePokedex / buildPersonalityReport / queryTimemachine / scoreBlindGuess / checkAndUnlockAchievements / generateFamilyDietReport）加 async/await；6 个纯函数（findById / findByField / filterBy / insert / updateById / softDelete / uuid）保留同步签名不变
  - [x] SubTask 10.4: 对全部 service / controller 中 repository 方法调用加 `await`（涵盖 users/families/family_members/family_recipes/invitations/records/weekly_menu/shopping_items/achievements/user_achievements/check_ins/challenges/blindGuessRounds/record_likes/record_comments）；`.map` 回调含 async 调用重构为 `for...of` 循环配合 await；db.ts 顶层无法 await 故用 `seedArray.length` 替代 `await repo.count()`
  - [x] SubTask 10.5: 对 5 个 unit 测试文件（in-memory-repository / store / achievement.service / gamification.helpers / bcrypt）回调改 async、调用加 await；顺带修复 `in-memory-repository.test.ts` 中 UUID 正则预存 bug（错误 5 段 dash `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i` 改为正确 4 段 dash `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`）；测试语义全部保留
  - [x] SubTask 10.6: 修复 `db/init.sql` 文件头部注释（第 4-6 行）：移除"接口预留/不强制落地"过时措辞，改为"MySQL 持久化建表脚本，通过 DB_DRIVER=mysql 启用 weiji-server 持久化时执行"
  - [x] SubTask 10.7: 验证：`cd weiji-server && npm run build` exit 0（tsc 无错误）；`npm run test:unit` 110 测试 / 109 通过 / 1 预存失败（ach-0007 blindguess_chef）；`npm run test:integration` 58 测试 / 53 通过 / 5 预存失败（analytics×4 + record×1）；`cd weiji-admin-web && npm run build` exit 0（915ms）。6 个失败均为预存，async 提升未引入新回归

# Task Dependencies

- Task 2 依赖 Task 1（工厂需先有 InMemoryRepository）
- Task 3 依赖 Task 2（调用点迁移需 db.ts 已导出 Repository 实例）
- Task 4 可与 Task 3 并行（MysqlRepository 实现不依赖调用点迁移）
- Task 5 依赖 Task 4（工厂切换需 MysqlRepository 就绪）
- Task 6 可与 Task 1-5 并行（配置外置独立）
- Task 7 依赖 Task 5 + Task 6（端到端验证需 MySQL 模式 + 配置就绪）
- Task 8 可与 Task 5-7 并行（文档独立）
- Task 9 依赖全部前置任务完成
- Task 10 依赖 Task 5 + Task 8（async 提升需 MySQL 工厂就绪 + init.sql 注释收尾后统一处理接口/调用点一致性，修复 checklist 中标注的"接口与调用点签名不一致、db.ts 类型桥接"遗留）
