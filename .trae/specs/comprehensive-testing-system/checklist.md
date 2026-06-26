# Checklist

## weiji-server 测试基础设施
- [x] weiji-server/package.json 含 supertest/@types/supertest devDependencies
- [x] weiji-server/package.json 含 test:unit / test:integration / test 三个 scripts
- [x] weiji-server/tests/ 目录存在（unit/ integration/ helpers/）
- [x] 存在 createTestApp() 辅助函数，用 supertest 调起 app 不占真实端口
- [x] 存在 loginAsDemo() 辅助函数返回 JWT token

## weiji-server 单元测试
- [x] tests/unit/store.test.ts 测试种子数据完整性 + 分页 + create
- [x] tests/unit/helpers.test.ts 测试分页/排序/ID/响应包装
- [x] tests/unit/jwt.test.ts 测试 sign+verify 往返 + 过期/无 token 失败
- [x] tests/unit/bcrypt.test.ts 测试 hash+compare 往返 + 错误密码 false

## weiji-server 集成测试 - auth + health
- [x] tests/integration/health.test.ts 测 GET /health
- [x] tests/integration/auth.test.ts 测 register/login/logout 成功与失败路径

## weiji-server 集成测试 - 业务控制器
- [x] tests/integration/record.test.ts 测 list/create/get + 401 未认证
- [x] tests/integration/family.test.ts 测家庭/成员/邀请/菜谱/菜单/购物 7 类端点
- [x] tests/integration/achievement.test.ts 测 list/level
- [x] tests/integration/checkin.test.ts 测 status/create
- [x] tests/integration/user.test.ts 测 profile
- [x] tests/integration/challenge.test.ts 测 list

## weiji-server 集成测试 - AI 代理
- [x] tests/integration/ai.test.ts 测 5 个 AI 代理端点 503 降级（mock ai-proxy 抛错）

## weiji-ai 测试基础设施
- [x] weiji-ai/pytest.ini 存在，配置 testpaths/python_files
- [x] weiji-ai/conftest.py 提供 client fixture（TestClient）和 clean_env fixture
- [x] weiji-ai/tests/ 目录存在（unit/ integration/）

## weiji-ai 单元测试
- [x] tests/unit/test_config.py 测 Settings 字段映射 + *_ready 判定 + log_config_status 不打印 key
- [x] tests/unit/test_exceptions.py 测 4 异常类型构造 + provider/message + 继承关系
- [x] tests/unit/test_services_degradation.py 测 6 service 模块 key 缺失抛 AiAuthError、调用失败抛对应异常

## weiji-ai 集成测试
- [x] tests/integration/test_endpoints.py 测 5 端点无 key 环境 code:0 + 降级提示 + /health 200

## weiji-admin-web 测试基础设施
- [x] weiji-admin-web/package.json 含 vitest/@vue/test-utils/jsdom devDependencies
- [x] weiji-admin-web/package.json 含 test / test:watch scripts
- [x] weiji-admin-web/vitest.config.ts 存在，配置 jsdom + globals + alias

## weiji-admin-web 单元测试
- [x] src/api/__tests__/client.spec.ts 测 JWT 注入 + 响应解包 + 401 重定向 + 网络错误
- [x] src/stores/__tests__/auth.spec.ts 测 login/logout/isAuthenticated
- [x] src/views/__tests__/Login.spec.ts 测表单提交 + 错误提示
- [x] src/views/__tests__/AiRecord.spec.ts 测文件选择 + handleRecognize + 结果展示

## 统一测试入口
- [x] scripts/run-all-tests.sh 存在且可执行
- [x] 脚本串联三服务测试，任一失败 exit 1
- [x] 末尾打印汇总（通过/失败计数）

## 全量验证
- [x] `cd weiji-server && npm test` 全绿
- [x] `cd weiji-ai && pytest` 全绿
- [x] `cd weiji-admin-web && npm test` 全绿
- [x] `bash scripts/run-all-tests.sh` 三服务全绿，exit 0
