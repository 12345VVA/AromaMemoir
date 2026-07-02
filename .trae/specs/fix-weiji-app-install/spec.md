# 修复 weiji-app 依赖安装失败并完成环境创建 Spec

## Why
在初始化 `weiji-app`（cool-uni 移动端）时执行 `npm install` 失败，导致 `node_modules` 无法生成、H5 开发服务无法启动，阻塞前端本地开发环境搭建。

根因（已通过 `npm install` 实跑确认）：
- `package.json` 中 `devDependencies` 直接声明了 `@dcloudio/vite-plugin-uni@3.0.0-3081220230817001`
- 该包声明 peer 依赖 `vite@^4.0.0`，而项目实际使用 `vite@^5.4.14`
- npm 7+ 默认严格校验 peer 依赖，抛出 `ERESOLVE unable to resolve dependency tree` 错误并终止安装

补充事实：
- `weiji-app/README.md` 明确推荐使用 `pnpm install`，仓库已存在 `pnpm-lock.yaml`
- 项目记忆中已记录：「weiji-app 中 @dcloudio/vite-plugin-uni 不可直接 npm install，需通过 @dcloudio/uni-cli-shared 间接引入」
- 用户本机环境：Node v24.6.0、npm 11.5.1、未安装 pnpm

## What Changes
- 全局安装 pnpm 包管理器（`npm install -g pnpm`）
- 在 `weiji-app/` 目录执行 `pnpm install`，利用 pnpm 对 peer 依赖更宽容的策略 + 已有 `pnpm-lock.yaml` 完成依赖安装
- 验证关键依赖（`@dcloudio/vite-plugin-uni`、`@dcloudio/uni-cli-shared`、`vite`、`vue`）已在 `node_modules` 中正确就位
- 验证 `pnpm dev:h5` 能够进入启动流程（端口 9900；是否完全启动受后端服务 `weiji-server@http://localhost:8001` 是否运行影响，本 spec 仅验证 vite 能成功加载 `vite-plugin-uni` 不再因依赖缺失报错）
- 在 `weiji-app/README.md` 的「依赖安装」小节追加「npm 不支持」提示，避免后续重复踩坑（**最小化改动**，仅追加几行说明，不重写文档）

## Impact
- Affected specs: 无（环境搭建基础工作，不影响既有功能 spec）
- Affected code:
  - `weiji-app/package.json`（只读，不修改依赖声明）
  - `weiji-app/pnpm-lock.yaml`（只读，已存在并锁定依赖版本）
  - `weiji-app/node_modules/`（新建，由 pnpm 生成）
  - `weiji-app/README.md`（追加几行说明）
- 影响范围仅限 `weiji-app/` 子目录，不影响 `weiji-admin-web`、`weiji-server`、`weiji-ai`、`weiji-web`

## ADDED Requirements

### Requirement: pnpm 包管理器可用
系统（开发者本机）SHALL 安装 pnpm 并使其在终端中可被调用。

#### Scenario: pnpm 已安装
- **WHEN** 执行 `pnpm --version`
- **THEN** 返回非空版本号字符串，且命令退出码为 0

### Requirement: weiji-app 依赖完整安装
`weiji-app/` 目录 SHALL 通过 `pnpm install` 完成全部依赖安装，生成可用的 `node_modules`。

#### Scenario: 安装成功
- **WHEN** 在 `weiji-app/` 下执行 `pnpm install`
- **THEN** 命令退出码为 0，`node_modules/` 目录生成
- **AND** `node_modules/@dcloudio/vite-plugin-uni` 存在
- **AND** `node_modules/@dcloudio/uni-cli-shared` 存在
- **AND** `node_modules/vite` 存在
- **AND** `node_modules/vue` 存在

### Requirement: H5 开发服务可进入启动流程
执行 `pnpm dev:h5` SHALL 能成功加载 vite 配置与 `@dcloudio/vite-plugin-uni`，不再因依赖缺失而立即崩溃。

#### Scenario: vite 配置加载成功
- **WHEN** 在 `weiji-app/` 下执行 `pnpm dev:h5`
- **THEN** 进程能够进入 vite 启动阶段（出现 vite banner 或 uni-app 编译日志）
- **AND** 不出现 `Cannot find module '@dcloudio/vite-plugin-uni'` 之类的依赖解析错误

## MODIFIED Requirements

### Requirement: weiji-app 依赖安装文档
`weiji-app/README.md` 的「依赖安装」小节 SHALL 明确标注必须使用 pnpm，避免用户误用 npm 触发 peer 依赖冲突。

#### Scenario: 文档包含 npm 不兼容提示
- **WHEN** 阅读 `weiji-app/README.md` 的依赖安装部分
- **THEN** 能看到「不要使用 npm install，因 @dcloudio/vite-plugin-uni 的 peer 依赖与 vite 5 冲突」之类的明确提示
- **AND** 给出 `npm install -g pnpm` 的安装指引

## REMOVED Requirements
无。
