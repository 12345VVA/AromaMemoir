# Tasks

- [ ] Task 1: 安装 pnpm 包管理器
  - [ ] SubTask 1.1: 执行 `npm install -g pnpm` 全局安装 pnpm
  - [ ] SubTask 1.2: 执行 `pnpm --version` 验证 pnpm 可用，记录版本号

- [ ] Task 2: 在 weiji-app 目录执行 pnpm install 完成依赖安装
  - [ ] SubTask 2.1: 在 `weiji-app/` 下执行 `pnpm install`（使用已有 pnpm-lock.yaml）
  - [ ] SubTask 2.2: 验证命令退出码为 0、`node_modules/` 目录生成
  - [ ] SubTask 2.3: 验证关键依赖目录存在：`@dcloudio/vite-plugin-uni`、`@dcloudio/uni-cli-shared`、`vite`、`vue`

- [ ] Task 3: 验证 H5 开发服务可进入启动流程
  - [ ] SubTask 3.1: 在 `weiji-app/` 下后台启动 `pnpm dev:h5`
  - [ ] SubTask 3.2: 检查启动日志，确认进入 vite 启动阶段（出现 vite banner 或 uni-app 编译日志），且无 `Cannot find module '@dcloudio/vite-plugin-uni'` 之类的依赖解析错误
  - [ ] SubTask 3.3: 停止 dev 服务（验证完成后）

- [ ] Task 4: 在 weiji-app/README.md 追加 npm 不兼容提示
  - [ ] SubTask 4.1: 在 README.md「依赖安装」小节追加「不要使用 npm install」与 pnpm 安装指引
  - [ ] SubTask 4.2: 保持其余文档内容不变，最小化改动

# Task Dependencies
- Task 2 依赖 Task 1（需 pnpm 可用）
- Task 3 依赖 Task 2（需依赖安装完成）
- Task 4 与 Task 2/3 并行，无依赖
