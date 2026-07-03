# Tasks

- [x] Task 1: 安装 pnpm 包管理器
  - [x] SubTask 1.1: 执行 `npm install -g pnpm` 全局安装 pnpm
  - [x] SubTask 1.2: 执行 `pnpm --version` 验证 pnpm 可用（pnpm 11.9.0）

- [x] Task 2: 在 weiji-app 目录执行 pnpm install 完成依赖安装
  - [x] SubTask 2.1: 在 `weiji-app/` 下执行 `pnpm install`（使用已有 pnpm-lock.yaml）
  - [x] SubTask 2.2: 验证命令退出码为 0、`node_modules/` 目录生成
  - [x] SubTask 2.3: 验证关键依赖目录存在：`@dcloudio/vite-plugin-uni`、`@dcloudio/uni-cli-shared`、`vite`、`vue`
  - 备注：过程中发现 pnpm 11 的 `ERR_PNPM_IGNORED_BUILDS` 阻塞，已将 `pnpm-workspace.yaml` 中 `allowBuilds` 占位符改为 `true`（该文件为 pnpm 构建审批模板，非 package.json/pnpm-lock.yaml）

- [x] Task 3: 验证 H5 开发服务可进入启动流程
  - [x] SubTask 3.1: 在 `weiji-app/` 下后台启动 `pnpm dev:h5`
  - [x] SubTask 3.2: 检查启动日志，确认进入 vite 启动阶段（出现 vite banner / `http://localhost:9901` / `ready in 6741ms`），且无 `Cannot find module '@dcloudio/vite-plugin-uni'` 之类的依赖解析错误
  - [x] SubTask 3.3: 停止 dev 服务（验证完成后）

- [x] Task 4: 在 weiji-app/README.md 追加 npm 不兼容提示
  - [x] SubTask 4.1: 在 README.md「依赖安装」小节追加「不要使用 npm install」与 pnpm 安装指引
  - [x] SubTask 4.2: 保持其余文档内容不变，最小化改动

- [x] Task 5: 修复 Windows 下 `pnpm dev:h5` 脚本兼容性（新增，因 Task 3 验证发现脚本 `UNI_INPUT_DIR=. uni` 在 Windows cmd 下无法识别）
  - [x] SubTask 5.1: 在 `weiji-app/package.json` 的 `devDependencies` 中添加 `cross-env` 依赖
  - [x] SubTask 5.2: 将 `scripts.dev:h5` 与 `scripts.build:h5` 改为使用 `cross-env UNI_INPUT_DIR=. uni` 形式，保证跨平台兼容
  - [x] SubTask 5.3: 执行 `pnpm install` 安装 `cross-env`
  - [x] SubTask 5.4: 执行 `pnpm dev:h5` 验证能进入 vite 启动阶段（出现 vite banner / `http://localhost:9901` / `ready in 6741ms`），无依赖解析错误
  - [x] SubTask 5.5: 验证完成后停止 dev 服务

# Task Dependencies
- Task 2 依赖 Task 1（需 pnpm 可用）
- Task 3 依赖 Task 5（需先修复 Windows 脚本兼容性，否则 `pnpm dev:h5` 无法启动）
- Task 4 与 Task 2/3 并行，无依赖
- Task 5 依赖 Task 2（需依赖已安装，cross-env 才能被 pnpm 安装）
