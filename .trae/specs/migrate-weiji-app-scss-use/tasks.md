# Tasks

- [x] Task 1: 迁移 App.vue style 块的 @import → @use
  - [x] SubTask 1.1: `App.vue` 改为 `@use "/$/cool-ui/index.scss" as coolui;`（加命名空间避免与另一 index.scss 命名冲突）
  - [x] SubTask 1.2: `App.vue` 改为 `@use "/@/static/css/index.scss" as appcss;`（同上）

- [x] Task 2: 迁移 uni.scss 的 @import → @use
  - [x] SubTask 2.1: `uni.scss` 改为 `@use "/$/cool-ui/theme.scss" as *;`

- [x] Task 3: 迁移 cool-ui barrel 文件的 @import → @use
  - [x] SubTask 3.1: `cool-ui/index.scss` 改为 `@use "./static/iconfont/index.scss" as iconfont;` + `@use "./static/css/index.scss" as clcomponents;`（加命名空间避免两个 index.scss 命名冲突）
  - [x] SubTask 3.2: `cool-ui/static/iconfont/index.scss` 改为 `@use "./iconfont.scss";`
  - [x] SubTask 3.3: `cool-ui/static/css/index.scss` 的 61 处 `@import` 全部改为 `@use`

- [x] Task 4: 为 44 个使用 $cl-* 的 cool-ui 组件 scss 添加 @use theme
  - [x] SubTask 4.1: 44 个文件顶部添加 `@use "../../theme.scss" as *;`（修正：原 `../theme.scss` 路径错误，正确为 `../../theme.scss`，因文件在 static/css/ 下而 theme.scss 在 cool-ui/ 下）
  - [x] SubTask 4.2: `slider-verify.scss` 已有 `@use "sass:math"`，新增 @use 紧随其后（col.scss 实际未使用 $cl-，无需处理）

- [x] Task 5: 为项目自有 static/css/index.scss 添加 @use theme
  - [x] SubTask 5.1: 顶部添加 `@use "/$/cool-ui/theme.scss" as *;`

- [x] Task 6: 验证无 @import 残留
  - [x] SubTask 6.1: Grep `@import\s+["']`（glob `*.{scss,vue,css}`）返回 0 条匹配

- [x] Task 7: 启动 dev:h5 验证编译与警告消除
  - [x] SubTask 7.1: `pnpm dev:h5` 进入 vite 启动阶段（vite v5.4.14 / ready in 3498ms / http://localhost:9906）
  - [x] SubTask 7.2: 日志不出现 `@import rules are deprecated` 警告
  - [x] SubTask 7.3: 日志不出现 `Undefined variable: $cl-` 之类编译错误（页面请求返回 200）
  - [x] SubTask 7.4: 已停止 dev 服务

- [x] Task 8: 更新 browserslist 数据
  - [x] SubTask 8.1: 执行 `npx update-browserslist-db@latest`，caniuse-lite 更新成功
  - [x] SubTask 8.2: 重启 dev:h5 确认无 `browsers data ... months old` 警告，已停止

# Task Dependencies
- Task 1-5 互相独立，可并行
- Task 6 依赖 Task 1-5 全部完成
- Task 7 依赖 Task 6
- Task 8 与 Task 1-7 独立，可并行
