# 合并功能至 main 架构 Spec

## Why

上一会话基于 SQLite + TypeORM 实现的"多平台+菜谱完整 CRUD"工作在环境重置后丢失。当前 main 分支采用 Repository 抽象层（in-memory/mysql）架构，已具备完整的家庭组/成员/邀请/菜谱上传/可见性切换/周菜单/购物清单/家庭动态/饮食报告等能力，但菜谱 CRUD 缺少详情/编辑/删除端点，admin-web 缺少菜谱详情与表单页、周菜单与购物清单 UI、营养卡片，weiji-web 残留多处占位，uni-app 跨端项目完全缺失。需在 main 架构基础上补齐这些功能差距，使各页面操作完备、无占位，并补建跨端工程。

## What Changes

### 后端补齐（weiji-server，沿用 main 的 Repository 抽象层架构）
- 新增 `GET /api/family/recipes/:id` 菜谱详情端点
- 新增 `PUT /api/family/recipes/:id` 菜谱编辑端点（含作者权限校验，非作者返回 403）
- 新增 `DELETE /api/family/recipes/:id` 菜谱删除端点（软删除，含作者权限校验）
- `GET /api/family/recipes` 新增 `keyword` 查询参数，按菜名模糊搜索
- `GET /api/record/list` 新增 `keyword` 查询参数，按 dishName 模糊搜索
- 新增 `PATCH /api/user/profile` 端点，支持更新 nickname 与 avatar

### admin-web 补齐（Vue3 + Vite，沿用现有架构）
- API 客户端 `client.ts` 补齐：createRecipe、updateRecipe、deleteRecipe、getRecipeDetail、getRecipesFiltered、addToMenu、voteMenuItem、addShoppingItem、toggleShoppingItem、deleteShoppingItem、generateShoppingFromMenu、createFamily、updateMemberRole、removeMember、updateProfile、uploadAvatar、getFamilyRecords、toggleRecordLike、addRecordComment、getFamilyReport
- 新增 `RecipeDetail.vue` 菜谱详情页（完整信息展示 + 编辑/删除/加入菜单按钮，作者鉴权）
- 新增 `RecipeForm.vue` 菜谱创建/编辑表单页（动态食材/步骤列表，表单校验）
- 路由新增 `/recipe/:id`、`/recipe/create`、`/recipe/edit/:id`
- `FamilyRecipes.vue` 增强：分类 Tab、本周菜单 Tab（按日分组+投票）、购物清单区域（分组+勾选+增删+自动生成）、家庭动态 Tab
- `AiRecord.vue` 增强：营养四指标卡片（热量/蛋白质/脂肪/碳水）、原图/美化图切换器、食材标签可点选、烹饪方式展示
- `Home.vue` 增强：搜索框接入 keyword 搜索、推荐区域展示难度/烹饪时间/匹配度
- `Achievements.vue` 增强：挑战"参与"按钮接入真实逻辑
- `Profile.vue` 增强：头像上传、资料编辑（nickname/avatar）、功能菜单项跳转真实页面

### weiji-web 占位消除（原生 HTML）
- 替换 `index.html` 中 5 处 showToast 占位（挑战交互/头像设置/邀请家人/购物清单入口/推荐菜谱入口）
- 替换 `app.js` 中约 5 处占位（徽章详情/挑战卡片/搜索/菜谱步骤详情）

### uni-app 跨端工程新建
- 新建 `/workspace/weiji-app/` uni-app Vue3 工程，支持 H5 与微信小程序编译
- 配置 pages.json（8 页面 + tabBar）、manifest.json（H5 + mp-weixin）、vite.config.ts
- API 客户端封装 uni.request（含 JWT 拦截器、条件编译 BASE_URL）
- Pinia 状态管理
- 8 个页面：登录、首页、AI 记录、家庭菜谱、菜谱详情、菜谱表单、成就、个人中心
- 小程序适配：uni.chooseImage 替代 input file、uni.setClipboardData 复制邀请码、tabBar 符合小程序规范

## Impact

- Affected specs: mvp-feature-completion、family-system-backend、frontend-backend-integration、enhance-mvp-experience（均为补齐未完成部分，不破坏已有契约）
- Affected code:
  - 后端：`weiji-server/src/controller/family.controller.ts`、`record.controller.ts`、`user.controller.ts`
  - admin-web：`src/api/client.ts`、`src/router/index.ts`、`src/views/*.vue`、新增 `RecipeDetail.vue`/`RecipeForm.vue`
  - weiji-web：`index.html`、`app.js`、`api.js`
  - 新建：`weiji-app/` 整个工程目录

## ADDED Requirements

### Requirement: 菜谱完整 CRUD
系统 SHALL 提供菜谱的详情查询、编辑、删除能力，并按菜名支持关键词搜索。

#### Scenario: 查看菜谱详情
- **WHEN** 用户请求 `GET /api/family/recipes/:id`
- **THEN** 返回该菜谱完整信息（含 ingredients/steps 数组）
- **AND** 菜谱不存在或已删除时返回 404

#### Scenario: 编辑菜谱（作者）
- **WHEN** 菜谱作者请求 `PUT /api/family/recipes/:id` 并提供更新字段
- **THEN** 更新成功并返回更新后的菜谱

#### Scenario: 编辑菜谱（非作者）
- **WHEN** 非菜谱作者请求 `PUT /api/family/recipes/:id`
- **THEN** 返回 403 无权操作

#### Scenario: 删除菜谱（作者）
- **WHEN** 菜谱作者请求 `DELETE /api/family/recipes/:id`
- **THEN** 软删除成功（isDeleted=true）

#### Scenario: 菜谱关键词搜索
- **WHEN** 用户请求 `GET /api/family/recipes?keyword=麻婆`
- **THEN** 返回菜名包含"麻婆"的菜谱列表

### Requirement: 记录关键词搜索
系统 SHALL 支持按菜品名称模糊搜索用户记录。

#### Scenario: 搜索记录
- **WHEN** 用户请求 `GET /api/record/list?keyword=红烧`
- **THEN** 返回 dishName 包含"红烧"的记录列表

### Requirement: 用户资料更新
系统 SHALL 支持用户更新自己的昵称与头像。

#### Scenario: 更新资料
- **WHEN** 用户请求 `PATCH /api/user/profile` 提供 nickname/avatar
- **THEN** 更新成功并返回更新后的资料

### Requirement: admin-web 菜谱详情与表单页
admin-web SHALL 提供独立的菜谱详情页与创建/编辑表单页，操作完备无占位。

#### Scenario: 查看菜谱详情
- **WHEN** 用户在菜谱列表点击某菜谱卡片
- **THEN** 跳转到 `/recipe/:id` 详情页，展示菜名/封面/食材/步骤/难度/烹饪时间/作者

#### Scenario: 创建菜谱
- **WHEN** 用户点击"添加菜谱"按钮
- **THEN** 跳转到 `/recipe/create` 表单页，填写后调用 createRecipe

#### Scenario: 编辑菜谱
- **WHEN** 菜谱作者在详情页点击"编辑"
- **THEN** 跳转到 `/recipe/edit/:id` 表单页，预填数据

### Requirement: admin-web 家庭菜谱页增强
admin-web 的 FamilyRecipes.vue SHALL 包含本周菜单与购物清单功能。

#### Scenario: 查看本周菜单
- **WHEN** 用户切换到"本周菜单"Tab
- **THEN** 按周一至周日分组展示早午晚餐，每项可投票

#### Scenario: 管理购物清单
- **WHEN** 用户在购物清单区域操作
- **THEN** 可勾选/取消勾选、添加、删除购物项，可按菜单自动生成

### Requirement: admin-web AI 记录页增强
admin-web 的 AiRecord.vue SHALL 以卡片形式展示营养信息，并支持原图/美化图切换。

#### Scenario: 查看营养信息
- **WHEN** AI 识别返回营养数据
- **THEN** 以 4 格卡片展示热量/蛋白质/脂肪/碳水

### Requirement: uni-app 跨端工程
系统 SHALL 提供 uni-app Vue3 工程，支持 H5 与微信小程序编译。

#### Scenario: H5 编译
- **WHEN** 执行 `npm run dev:h5`
- **THEN** 启动 H5 开发服务器，所有页面可访问

#### Scenario: 小程序适配
- **WHEN** 图片上传场景
- **THEN** 使用 uni.chooseImage 而非 input file

## MODIFIED Requirements

### Requirement: 菜谱列表查询
`GET /api/family/recipes` 在原有 visibility/authorId/category 过滤基础上，新增 keyword 模糊搜索参数。

### Requirement: 记录列表查询
`GET /api/record/list` 在原有 tag/rating 筛选基础上，新增 keyword 模糊搜索参数。

### Requirement: 用户档案
`/api/user/profile` 在原有 GET 查询基础上，新增 PATCH 更新能力。

## REMOVED Requirements

无移除项。本次均为增量补齐，不破坏 main 已有功能与契约。
