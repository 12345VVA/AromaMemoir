# Checklist

- [x] `weiji-app/App.vue` style 块的 2 处 `@import` 已改为 `@use`（带命名空间 `as coolui` / `as appcss` 避免命名冲突）
- [x] `weiji-app/uni.scss` 的 `@import "/$/cool-ui/theme.scss"` 已改为 `@use "/$/cool-ui/theme.scss" as *;`
- [x] `weiji-app/uni_modules/cool-ui/index.scss` 的 2 处 `@import` 已改为 `@use`（带命名空间 `as iconfont` / `as clcomponents` 避免命名冲突）
- [x] `weiji-app/uni_modules/cool-ui/static/iconfont/index.scss` 的 `@import "./iconfont.scss"` 已改为 `@use`
- [x] `weiji-app/uni_modules/cool-ui/static/css/index.scss` 的 61 处 `@import` 已全部改为 `@use`
- [x] 44 个使用 `$cl-*` 的 cool-ui 组件 scss 文件顶部均已添加 `@use "../../theme.scss" as *;`（含 common.scss）
- [x] `slider-verify.scss` 的新增 `@use "../../theme.scss" as *;` 与已有 `@use "sass:math"` 并列于文件顶部（col.scss 实际未使用 $cl-，无需处理）
- [x] `weiji-app/static/css/index.scss` 顶部已添加 `@use "/$/cool-ui/theme.scss" as *;`
- [x] 在 `weiji-app/` 下 Grep `@import\s+["']`（glob `*.{scss,vue,css}`）返回 0 条匹配
- [x] `pnpm dev:h5` 能进入 vite 启动阶段（vite v5.4.14 / ready in 3498ms / http://localhost:9906）
- [x] 启动日志中不出现 `@import rules are deprecated` 警告
- [x] 启动日志中不出现 `Undefined variable: $cl-` 之类编译错误（页面请求返回 200）
- [x] 已执行 `npx update-browserslist-db@latest`，重启 dev:h5 后无 `browsers data ... months old` 警告
- [x] `vite.config.ts` 未被修改
- [x] 路径修正：原 spec 中 `../theme.scss` 有误（从 static/css/ 到 cool-ui/theme.scss 需上溯两级），实际已修正为 `../../theme.scss`
- [x] 命名空间冲突修正：cool-ui/index.scss 与 App.vue 中两个同名 index.scss 改用显式命名空间
