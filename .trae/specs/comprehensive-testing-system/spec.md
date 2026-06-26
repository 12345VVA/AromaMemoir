# 全方面测试体系 Spec

## Why

项目经过 6 轮 spec 实施后，三服务架构（weiji-admin-web / weiji-server / weiji-ai）已成立，weiji-server 有 32 个业务端点、weiji-ai 有 5 个 AI 端点，但**全项目零测试文件**。每次改动都靠手工 curl 验证，回归风险高、不可重复。本 spec 目标是为三服务建立分层、可自动化运行的测试体系，覆盖单元/集成/端到端三层，使后续迭代有质量护栏。

## What Changes

- **新增** `weiji-server` 测试体系（Node.js + 内置 node:test，不引入 jest 控制依赖）：
  - 单元测试：`tests/unit/` 覆盖 store（内存数据层）、helpers（分页/排序/ID 生成）、JWT 工具、bcrypt 工具
  - 集成测试：`tests/integration/` 用 supertest 调起 Koa app 实测 32 个端点，覆盖 auth/record/family/achievement/checkin/user/challenge/ai/health 全部控制器
  - 测试种子：复用现有 `store/db.ts` 种子数据（demo/123456），不连真实 DB
- **新增** `weiji-ai` 测试体系（Python + pytest）：
  - 单元测试：`tests/unit/` 覆盖 config（Settings 字段映射、`*_ready` 判定）、exceptions（异常类型与 provider/message）、各 service 模块的降级路径（mock httpx/openai 客户端，验证异常映射正确）
  - 集成测试：`tests/integration/` 用 FastAPI TestClient 实测 5 个端点（无 key 环境验证降级返回 code:0 + 友好提示）
  - Mock 策略：所有外部 AI 厂商调用用 monkeypatch 替换为 mock，不依赖真实 key
- **新增** `weiji-admin-web` 测试体系（Vitest，与 Vite 原生集成）：
  - 单元测试：`src/api/__tests__/client.spec.ts` 覆盖 axios 拦截器（JWT 注入、401 重定向、响应解包）
  - 组件测试：`src/views/__tests__/` 覆盖 Login/AiRecord 的关键交互（mock api 模块）
  - 集成测试占位：1 个路由守卫测试（未登录跳 /login）
- **新增** CI 脚本：根目录 `scripts/run-all-tests.sh`，串联三服务测试，任一失败即 exit 1
- **新增** 三服务各自 package.json/pytest 的 `test` 脚本入口
- **不修改** 任何现有业务代码（仅追加测试文件与配置）

## Impact

- Affected specs:
  - `implement-cooladmin-backend`（测试 weiji-server 32 端点，固化其行为契约）
  - `integrate-real-ai-providers`（测试 weiji-ai 5 端点降级与异常映射，固化降级策略）
- Affected code:
  - 新增 `weiji-server/tests/` 目录（unit + integration）
  - 新增 `weiji-ai/tests/` 目录（unit + integration）
  - 新增 `weiji-admin-web/src/**/*.test.ts` / `*.spec.ts`
  - 新增 `scripts/run-all-tests.sh`
  - 修改三服务各自 `package.json`（加 test script 和 devDependencies）或 `pytest.ini` / `conftest.py`

## ADDED Requirements

### Requirement: weiji-server 单元测试
系统 SHALL 为业务后端核心纯函数提供单元测试，覆盖率不低于关键工具函数全部路径。

#### Scenario: 运行 weiji-server 单元测试
- **WHEN** 执行 `cd weiji-server && npm run test:unit`
- **THEN** node:test 运行 store/helpers/jwt/bcrypt 的测试，全部通过，exit 0

### Requirement: weiji-server 集成测试
系统 SHALL 为 32 个业务端点提供集成测试，覆盖成功路径与主要错误路径（401 未认证、404 不存在、400 参数错误）。

#### Scenario: 运行 weiji-server 集成测试
- **WHEN** 执行 `cd weiji-server && npm run test:integration`
- **THEN** supertest 调起 Koa app，对 9 个控制器逐一测试，全部通过，exit 0

#### Scenario: 认证端点集成测试
- **WHEN** 测试 `POST /api/auth/login` 用 demo/123456
- **THEN** 返回 code:0 + JWT token；用错误密码返回业务错误码

#### Scenario: 受保护端点 401 测试
- **WHEN** 不带 JWT 访问 `GET /api/record/list`
- **THEN** 返回 401 或业务层鉴权错误

### Requirement: weiji-ai 单元测试
系统 SHALL 为 AI 服务的配置、异常、各 service 模块的降级路径提供单元测试。

#### Scenario: 运行 weiji-ai 单元测试
- **WHEN** 执行 `cd weiji-ai && pytest tests/unit/`
- **THEN** 覆盖 config 的 `*_ready` 判定、exceptions 的 provider/message、各 service 模块的 key 缺失降级，全部通过

### Requirement: weiji-ai 集成测试
系统 SHALL 为 5 个 AI 端点提供集成测试，验证无 key 环境下的降级行为，不依赖真实外部 API。

#### Scenario: 运行 weiji-ai 集成测试
- **WHEN** 执行 `cd weiji-ai && pytest tests/integration/`
- **THEN** FastAPI TestClient 实测 5 个端点，全部返回 code:0 + 降级提示，全部通过

### Requirement: weiji-admin-web 前端测试
系统 SHALL 为前端 axios 拦截器和关键页面交互提供 Vitest 单元测试。

#### Scenario: 运行前端测试
- **WHEN** 执行 `cd weiji-admin-web && npm run test`
- **THEN** Vitest 运行 client.ts 拦截器测试和 Login/AiRecord 组件测试，全部通过

### Requirement: 统一测试入口
系统 SHALL 提供根目录脚本一键运行三服务全部测试。

#### Scenario: 运行全量测试
- **WHEN** 执行 `bash scripts/run-all-tests.sh`
- **THEN** 依次运行 weiji-server / weiji-ai / weiji-admin-web 测试，任一失败即整体失败 exit 1，全部通过 exit 0 并打印汇总

## MODIFIED Requirements

### Requirement: 质量保障流程
项目此前无自动化测试，所有验证靠手工 curl。本 spec 引入分层测试后，每次 spec 实施完成需运行 `scripts/run-all-tests.sh` 确认无回归，作为 spec 收尾的强制步骤。

## REMOVED Requirements

### Requirement: 手工 curl 验证
**Reason**: 6 轮 spec 均靠手工 curl 验证端点，不可重复、易遗漏。集成测试固化后，curl 仅用于调试，不作为验收依据。
**Migration**: 现有手工验证脚本保留在对话历史，新功能改用集成测试覆盖。
