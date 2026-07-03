# weiji-app SCSS @import → @use 迁移 Spec

## Why
`pnpm dev:h5` 启动时刷屏 67 条 `Deprecation Warning [import]: Sass @import rules are deprecated` 警告（含「62 repetitive deprecation warnings omitted」）。根因：项目（含 cool-ui 第三方模块）共 67 处 `@import` 语句，Dart Sass 已弃用 `@import`，将在 Sass 3.0 移除。需全量迁移到 `@use`/`@forward` 以消除警告、面向未来。

补充：dev server 本身能正常启动（vite v5.4.14 / ready in 9112ms），这些是弃用警告非错误。用户选择「全量迁移 @import→@use」方案。

## 依赖关系分析（已通过 Grep 确认）
- **67 处 @import 分布**：
  - `App.vue` style 块：2 处
  - `uni.scss`：1 处（`@import "/$/cool-ui/theme.scss"`）
  - `cool-ui/index.scss`：2 处
  - `cool-ui/static/iconfont/index.scss`：1 处
  - `cool-ui/static/css/index.scss`：61 处（barrel 文件，聚合 61 个组件 scss）
- **`$cl-*` 变量跨文件依赖**：44 个 cool-ui 组件 scss + `common.scss` 使用 `theme.scss` 定义的 `$cl-*` 变量，当前靠 @import 级联全局可见。迁移后每个文件需显式 `@use "../theme.scss" as *`。
- **项目自有 `static/css/index.scss`**：第 108 行使用 `$cl-color-primary`，需 `@use "/$/cool-ui/theme.scss" as *`。
- **本地 @mixin**：`button.scss`、`badge.scss`、`tag.scss` 各自定义并使用本地 @mixin，无跨文件 mixin 依赖。
- **无跨文件 @extend**（已 Grep 确认 `@extend .cl-` / `@extend .wj-` 均无匹配）。
- **uni.scss 特殊性**：uni-app 自动将 uni.scss 内容注入每个组件的 style 块，`@use "/$/cool-ui/theme.scss" as *` 会使 `$cl-*` 在所有组件中可用（与现有行为一致）。
- **4 个 .vue 页面**（`pages/index/components/tabbar.vue`、`pages/demo/extend/tree.vue`、`pages/demo/view/tabs.vue`、`pages/demo/view/waterfall.vue`）使用 `$cl-*` 变量，依赖 uni.scss 注入，无需改动。
- **col.scss、slider-verify.scss** 已有 `@use "sass:math"`，新增的 `@use "../theme.scss" as *` 需与之并列于文件顶部。

## What Changes
- 将 `App.vue` style 块的 2 处 `@import` 改为 `@use`
- 将 `uni.scss` 的 1 处 `@import` 改为 `@use ... as *`
- 将 `cool-ui/index.scss` 的 2 处 `@import` 改为 `@use`
- 将 `cool-ui/static/iconfont/index.scss` 的 1 处 `@import` 改为 `@use`
- 将 `cool-ui/static/css/index.scss` 的 61 处 `@import` 改为 `@use`
- 在 44 个使用 `$cl-*` 的 cool-ui 组件 scss 文件顶部添加 `@use "../theme.scss" as *;`（含 common.scss；col.scss/slider-verify.scss 与已有 `@use "sass:math"` 并列）
- 在项目自有 `static/css/index.scss` 顶部添加 `@use "/$/cool-ui/theme.scss" as *;`
- （附带）更新 browserslist 数据消除 browserslist 过期警告（`npx update-browserslist-db@latest`）

## 不在本次范围
- `The CJS build of Vite's Node API is deprecated`：来自 `@dcloudio/vite-plugin-uni` 内部，不修改第三方插件。
- `Deprecation [legacy-js-api]`：Vite 用 sass legacy JS API，切 modern API 有兼容性风险（用户未选），本次不动。迁移 @use 后该警告仍会显示，但属另一独立问题。
- 不修改 `vite.config.ts`、`package.json` 依赖声明（除 browserslist 数据更新外）、`pnpm-lock.yaml`。

## Impact
- Affected specs: 无
- Affected code:
  - `weiji-app/App.vue`（style 块）
  - `weiji-app/uni.scss`
  - `weiji-app/uni_modules/cool-ui/index.scss`
  - `weiji-app/uni_modules/cool-ui/static/iconfont/index.scss`
  - `weiji-app/uni_modules/cool-ui/static/css/index.scss`
  - `weiji-app/uni_modules/cool-ui/static/css/*.scss`（44 个组件文件，顶部加 @use theme）
  - `weiji-app/static/css/index.scss`（顶部加 @use theme）
  - `weiji-app/package.json` 的 browserslist/caniuse 数据（通过 npx 命令更新，非手动改依赖）

## ADDED Requirements

### Requirement: 项目 SCSS 不再使用 @import
所有 weiji-app 项目内（含 uni_modules/cool-ui）的 `.scss` 与 `.vue` style 块 SHALL 不再包含 `@import` 语句，改用 `@use`/`@forward`。

#### Scenario: 无 @import 残留
- **WHEN** 在 `weiji-app/` 下搜索 `@import\s+["']`（限定 `*.scss`、`*.vue`）
- **THEN** 返回 0 条匹配

### Requirement: $cl-* 变量在迁移后仍可用
迁移后所有使用 `$cl-*` 变量的文件 SHALL 通过显式 `@use "../theme.scss" as *`（或等效路径）获取变量，编译不报 `Undefined variable`。

#### Scenario: 组件 scss 编译通过
- **WHEN** 执行 `pnpm dev:h5`
- **THEN** 不出现 `Undefined variable: $cl-color-primary` 之类错误
- **AND** 不出现 `@import rules are deprecated` 警告

### Requirement: 样式视觉效果不变
迁移 SHALL 不改变页面渲染结果（@use 与 @import 在 CSS 输出上等价，仅模块化作用域不同）。

#### Scenario: H5 页面样式正常
- **WHEN** 浏览器访问 `http://localhost:9900`（或 vite 实际分配端口）
- **THEN** 页面能正常加载，cool-ui 组件样式（按钮、卡片、图标等）渲染正确
- **AND** 项目自有主题样式（`.wj-card`、`.wj-btn` 等）渲染正确

### Requirement: browserslist 数据更新
执行 browserslist 数据更新命令，消除 `browsers data is 17 months old` 警告。

#### Scenario: 无 browserslist 过期警告
- **WHEN** 执行 `pnpm dev:h5`
- **THEN** 日志中不出现 `Browserslist: browsers data (caniuse-lite) is ... months old`

## MODIFIED Requirements
无。

## REMOVED Requirements
无。
