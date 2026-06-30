# Checklist

## 存储抽象层
- [x] `Repository<T>` 接口已定义，方法与现有 helpers 一一对应
- [x] `InMemoryRepository<T>` 已实现，复用 helpers 逻辑，行为零变化
- [x] `InMemoryRepository` 单元测试已编写并通过
- [x] db.ts 已重构为工厂，导出 12 个 Repository 实例（内存模式默认）
- [x] 导出名保持不变（users/families/...），对调用方友好

## 调用点迁移
- [x] 全部 service 文件调用点已迁移到 Repository API
- [x] 全部 controller 文件调用点已迁移到 Repository API
- [x] store/analytics.ts 调用点已迁移
- [ ] `npm test` 141 个测试全绿（证明抽象对业务透明）—— 未通过：实际共 168 个测试（单元 110 + 集成 58，非 141），存在 6 个预存失败（1 个 unit blindguess_chef ach-0007 + 5 个 integration analytics/record）。已通过 `git stash` 对比原始代码确认这 6 个失败均为预存、spec 抽象迁移未引入任何新失败（"对业务透明"的意图已满足，但字面"141 全绿"不成立）。

## MySQL 持久化
- [x] mysql2 依赖已安装并记入 package.json
- [x] mysql-pool.ts 连接池已实现，参数来自环境变量
- [x] MysqlRepository 已实现，覆盖 findById/findByField/findAll/insert/updateById/softDelete
- [x] 软删除表查询自动追加 `WHERE isDeleted=0`
- [x] JSON 字段（achievements.condition 等）写入时 stringify、读取时 parse
- [x] db.ts 工厂在 `driver=mysql` 时切换为 MysqlRepository
- [x] MysqlRepository 单元测试已编写（SQL 拼装/JSON 序列化逻辑）

## 启动校验
- [x] bootstrap.ts 在 mysql 模式下校验数据库连通性
- [x] 连接失败时打印明确错误并 process.exit(1)，不静默降级
- [x] 缺失表时打印执行 init.sql 的指引
- [x] createApp()（测试入口）始终用内存模式，CI 无需 MySQL

## 配置外置与安全基线
- [x] configuration.ts 中 JWT 密钥改为 process.env.JWT_SECRET 读取
- [x] 源码中不再出现明文密钥 `'weiji-server-jwt-secret-2026'`（开发默认值已改为 `weiji-server-jwt-dev-secret`）
- [x] NODE_ENV=production 且未设 JWT_SECRET 时启动报错退出
- [x] 非 production 时使用开发默认值并打印警告
- [x] DB 连接参数（host/port/user/password/database）全部来自环境变量
- [x] dotenv 已安装，bootstrap/createApp 启动时加载 .env
- [x] .env.example 已创建，列出全部环境变量及说明
- [x] .gitignore 已忽略 .env

## 种子数据
- [x] init.sql 中 demo 用户密码占位符已替换为真实 bcrypt 哈希（123456）—— 哈希 `$2a$10$8A.mfPmXTioco4pWMmdznujyl/ajcGKlDKgg4HOAa6EK0p2cHgAV2` 已用 bcryptjs.compareSync('123456') 验证通过
- [ ] 手动验证：mysql 模式注册新用户 → 重启 → 新用户可登录 —— 无法验证：沙箱无 MySQL 实例。另注：Repository 接口与全部调用点已统一提升为 async，db.ts 移除 `as unknown as Repository<T>` 类型桥接（详见 Task 10）；MySQL 模式接口层已无签名遗留阻塞，仅沙箱无 MySQL 实例无法端到端验证。

## 文档一致性
- [x] weiji-server/db/README.md 已移除"接口预留"措辞，补充启用步骤 —— db/README.md 已无"接口预留/后续 spec/不强制落地"措辞并补充完整启用步骤。注：`db/init.sql` 文件头部注释已在 Task 10.6 修复，移除"接口预留/不强制落地"过时措辞，改为"MySQL 持久化建表脚本，通过 DB_DRIVER=mysql 启用 weiji-server 持久化时执行"。
- [x] 根 README.md 已修正"前端实现待补"等过时描述 —— "前端说明（待补）"已改为"前端说明（Vue3 管理后台）"。注：README 测试统计"共 82 个测试用例全绿"/weiji-server"用例数 36"仍陈旧（实际 168+25+21，且 weiji-server 有 6 个预存失败），但该处未被本 spec 修改、属预存内容、超出本 spec 范围。
- [x] 根 README.md 三服务架构描述与实际一致
- [x] MVP开发速查手册.md 已对齐到实际 Koa 简化方案

## 异步统一（Task 10）
- [x] `Repository<T>` 接口全部方法已提升为 async（返回 Promise），与 `InMemoryRepository` / `MysqlRepository` 实现签名一致
- [x] db.ts 移除 `as unknown as Repository<T>` 类型桥接（接口与实现签名已一致）
- [x] `store/helpers.ts` 6 个聚合函数（aggregatePokedex / buildPersonalityReport / queryTimemachine / scoreBlindGuess / checkAndUnlockAchievements / generateFamilyDietReport）已 async 化；6 个纯函数（findById / findByField / filterBy / insert / updateById / softDelete / uuid）保留同步签名
- [x] 全部 service / controller 中 repository 方法调用已加 `await`（含 auth/family/achievement/checkin service 与 record/family/achievement/checkin/user/challenge/gamification controller）
- [x] `.map` 回调含 async 调用已重构为 `for...of` 循环配合 await（family.controller 中 listFamilyRecords / generateShopping 等多处）
- [x] db.ts 顶层无法 await，种子数据计数用 `seedArray.length` 替代 `await repo.count()`
- [x] 5 个 unit 测试文件已 async 化（in-memory-repository / store / achievement.service / gamification.helpers / bcrypt），测试语义全部保留
- [x] UUID 正则预存 bug 已修复（错误 5 段 dash `8-4-4-4-4-12` 改为正确 4 段 dash `8-4-4-4-12`）
- [x] `db/init.sql` 头部注释已修复，移除"接口预留/不强制落地"过时措辞
- [x] async 提升未引入新回归（基线 6 个预存失败保持不变：1 unit ach-0007 + 5 integration analytics×4 + record×1）

## 全量回归
- [ ] weiji-server `npm test` 单元 + 集成全绿 —— 未全绿：单元 110（109 通过 / 1 预存失败 blindguess_chef ach-0007）+ 集成 58（53 通过 / 5 预存失败 analytics×4 + record×1）。6 个失败均经 `git stash` 对比确认为预存，spec 未引入回归。
- [x] weiji-server `npm run build` TypeScript 编译通过
- [x] weiji-admin-web `npm run build` 构建通过
- [x] weiji-admin-web `npm run test` 测试通过
- [ ] `bash scripts/run-all-tests.sh` 三服务全量测试通过 —— 未通过：通过 1/3（weiji-admin-web），失败 2/3。weiji-server 因上述 6 个预存失败而失败；weiji-ai 因沙箱缺少 fastapi 等 Python 依赖（`ModuleNotFoundError: No module named 'fastapi'`）失败，与本 spec 无关（本 spec 仅改 weiji-server + 文档）。
