# Tasks

- [x] Task 1: 搭建 weiji-server 测试基础设施
  - [ ] SubTask 1.1: 在 weiji-server/package.json 追加 devDependencies：`supertest`、`@types/supertest`；追加 scripts：`"test:unit": "node --test tests/unit/"`、`"test:integration": "node --test tests/integration/"`、`"test": "npm run test:unit && npm run test:integration"`
  - [ ] SubTask 1.2: 创建 `weiji-server/tests/` 目录结构：`tests/unit/`、`tests/integration/`、`tests/helpers/`（含 app 启动辅助）
  - [ ] SubTask 1.3: 创建 `weiji-server/tests/setup.ts`（或在 integration 测试文件内联）：导出一个 `createTestApp()` 函数，require bootstrap 并返回 supertest agent；处理 app 启动与关闭（避免端口冲突，用 supertest 直接调 router 而非真实 listen）
  - [ ] SubTask 1.4: 创建 `weiji-server/tests/helpers/auth.ts`：提供 `loginAsDemo()` 返回 JWT token（调 `/api/auth/login` demo/123456），供集成测试复用

- [x] Task 2: weiji-server 单元测试（纯函数层）
  - [ ] SubTask 2.1: `tests/unit/store.test.ts`：测试种子数据完整性（demo 用户存在、记录数 ≥5、家庭组存在）；测试 list 方法分页参数（page/pageSize）；测试 create 方法生成 ID 唯一
  - [ ] SubTask 2.2: `tests/unit/helpers.test.ts`：测试分页计算（page=1,pageSize=10 返回正确 slice）、排序、ID 生成格式、响应包装（success/error）
  - [ ] SubTask 2.3: `tests/unit/jwt.test.ts`：测试 sign + verify 往返；测试过期 token 验证失败；测试无 token 验证失败
  - [ ] SubTask 2.4: `tests/unit/bcrypt.test.ts`（如封装了 bcrypt 工具）：测试 hash + compare 往返；错误密码 compare 返回 false

- [x] Task 3: weiji-server 集成测试 - auth + health 控制器
  - [ ] SubTask 3.1: `tests/integration/health.test.ts`：`GET /health` 返回 200 + `{status:'ok', ai:'up'|'down'}`
  - [ ] SubTask 3.2: `tests/integration/auth.test.ts`：`POST /api/auth/register`（重复用户名失败）；`POST /api/auth/login`（demo/123456 成功返 token，错误密码失败）；`POST /api/auth/logout`（带 token 返回成功）

- [x] Task 4: weiji-server 集成测试 - 业务控制器（record/family/achievement/checkin/user/challenge）
  - [ ] SubTask 4.1: `tests/integration/record.test.ts`：`GET /api/record/list`（带 JWT 返回分页记录）；`POST /api/record`（创建记录）；`GET /api/record/:id`；不带 JWT 返回 401
  - [ ] SubTask 4.2: `tests/integration/family.test.ts`：`GET /api/family/info`（demo 用户有家庭）；`GET /api/family/members`；`POST /api/family/invite`（生成邀请码）；`POST /api/family/recipes`（创建菜谱）；`GET /api/family/menu`；`POST /api/family/menu/:id/vote`；`GET /api/family/shopping-list`
  - [ ] SubTask 4.3: `tests/integration/achievement.test.ts`：`GET /api/achievement/list`；`GET /api/achievement/level`
  - [ ] SubTask 4.4: `tests/integration/checkin.test.ts`：`GET /api/checkin/status`；`POST /api/checkin`
  - [ ] SubTask 4.5: `tests/integration/user.test.ts`：`GET /api/user/profile` 返回 demo 用户档案 + 统计
  - [ ] SubTask 4.6: `tests/integration/challenge.test.ts`：`GET /api/challenge/list`

- [x] Task 5: weiji-server 集成测试 - AI 代理端点
  - [ ] SubTask 5.1: `tests/integration/ai.test.ts`：测试 5 个 AI 代理端点 `/api/ai/{recognize,beautify,recommend,voice/recognize,sticker}` 在 weiji-ai 不可用时返回 503 降级（mock ai-proxy.service 让其抛错）；测试 health 端点反映 ai 状态

- [x] Task 6: 搭建 weiji-ai 测试基础设施
  - [ ] SubTask 6.1: 创建 `weiji-ai/pytest.ini`：配置 `testpaths = tests`、`python_files = test_*.py`
  - [ ] SubTask 6.2: 创建 `weiji-ai/conftest.py`：提供 `client` fixture（FastAPI TestClient）、`monkeypatch_clean_env` fixture（确保测试时无环境变量 key）
  - [ ] SubTask 6.3: 创建 `weiji-ai/tests/` 目录：`tests/unit/`、`tests/integration/`、`tests/__init__.py`

- [x] Task 7: weiji-ai 单元测试
  - [ ] SubTask 7.1: `tests/unit/test_config.py`：测试 Settings 从 os.environ 读取字段；测试 `baidu_ready`（两个 key 都有才 True）、`qwen_ready`（QWEN 或 OPENAI 有即 True）、其他 `*_ready`；测试 `log_config_status` 不打印 key 值
  - [ ] SubTask 7.2: `tests/unit/test_exceptions.py`：测试 4 个异常类型构造、provider/message 字段、继承关系（AiAuthError 是 AiProviderError 子类）
  - [ ] SubTask 7.3: `tests/unit/test_services_degradation.py`：用 monkeypatch mock httpx/openai，测试 6 个 service 模块在 key 缺失时抛 AiAuthError、在厂商调用失败时抛对应 AiProviderError 子类

- [x] Task 8: weiji-ai 集成测试
  - [ ] SubTask 8.1: `tests/integration/test_endpoints.py`：用 TestClient 测试 5 个端点在无 key 环境下全部返回 code:0 + 降级提示（recognize 返回 mock 菜品、recommend 返回 mock 菜谱、beautify 返回原图路径、voice 返回空文本、sticker 返回开发中提示）；测试 `/health` 返回 200

- [x] Task 9: 搭建 weiji-admin-web 测试基础设施
  - [ ] SubTask 9.1: 在 weiji-admin-web/package.json 追加 devDependencies：`vitest`、`@vue/test-utils`、`jsdom`、`@vitest/coverage-v8`（可选）；追加 scripts：`"test": "vitest run"`、`"test:watch": "vitest"`
  - [ ] SubTask 9.2: 创建 `weiji-admin-web/vitest.config.ts`：配置 environment: 'jsdom'、globals: true、alias（与 vite.config.ts 一致）

- [x] Task 10: weiji-admin-web 单元测试
  - [ ] SubTask 10.1: `src/api/__tests__/client.spec.ts`：测试 axios 请求拦截器注入 Authorization header；测试响应拦截器解包 `response.data`；测试 401 时清 token + 重定向（mock localStorage 和 window.location）；测试网络错误时 reject
  - [ ] SubTask 10.2: `src/stores/__tests__/auth.spec.ts`：测试 login action（mock api 成功后 setToken + setUser）；测试 logout 清空状态；测试 isAuthenticated 计算属性
  - [ ] SubTask 10.3: `src/views/__tests__/Login.spec.ts`：测试表单提交调用 login（mock useAuthStore）；测试错误提示展示
  - [ ] SubTask 10.4: `src/views/__tests__/AiRecord.spec.ts`：测试文件选择后 imageUrl 更新；测试 handleRecognize 调 api.recognizeFood（mock api）；测试识别结果展示 ingredients/nutrition

- [x] Task 11: 统一测试入口脚本
  - [ ] SubTask 11.1: 创建 `scripts/run-all-tests.sh`：依次 `cd weiji-server && npm test`、`cd weiji-ai && pytest`、`cd weiji-admin-web && npm test`；任一失败即 exit 1；末尾打印汇总（三服务通过/失败计数）
  - [ ] SubTask 11.2: 赋予执行权限 `chmod +x scripts/run-all-tests.sh`

- [x] Task 12: 运行全量测试验证
  - [ ] SubTask 12.1: 在 weiji-server 安装新依赖（supertest 等）后运行 `npm test`，修复发现的问题
  - [ ] SubTask 12.2: 在 weiji-ai 运行 `pytest`，修复发现的问题
  - [ ] SubTask 12.3: 在 weiji-admin-web 安装 vitest 等依赖后运行 `npm test`，修复发现的问题
  - [ ] SubTask 12.4: 运行 `bash scripts/run-all-tests.sh` 确认三服务测试全绿

# Task Dependencies
- Task 2/3/4/5 依赖 Task 1（weiji-server 测试基础设施）
- Task 3/4/5 之间无依赖，可并行
- Task 7/8 依赖 Task 6（weiji-ai 测试基础设施）
- Task 10 依赖 Task 9（前端测试基础设施）
- Task 11 依赖 Task 1/6/9（需要三服务测试就绪）
- Task 12 依赖 Task 1-11
- 跨服务无依赖：weiji-server（Task 1-5）、weiji-ai（Task 6-8）、前端（Task 9-10）可三组并行

# 修复任务（checklist 验证发现）
- [x] Task 13: 补全前端 client.ts 的 401 重定向逻辑与测试
  - [ ] SubTask 13.1: 在 src/api/client.ts 的响应错误拦截器中补 401 处理：当 error.response.status === 401 时，清除 localStorage 的 token，并重定向到 /login（用 window.location.href = '/login' 或 router，jsdom 测试用前者更简单）
  - [ ] SubTask 13.2: 在 src/api/__tests__/client.spec.ts 补 401 测试用例：mock 一个 401 响应，验证 localStorage token 被清除 + 重定向触发
  - [ ] SubTask 13.3: 运行 `cd /workspace/weiji-admin-web && npm test` 确认全部通过
