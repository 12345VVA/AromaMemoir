# Tasks

- [x] Task 1: 后端菜谱 CRUD 补齐（family.controller.ts）
  - [x] SubTask 1.1: 新增 `GET /api/family/recipes/:id` 菜谱详情端点（找不到/已删除返回 404）
  - [x] SubTask 1.2: 新增 `PUT /api/family/recipes/:id` 菜谱编辑端点（作者校验，非作者返回 403；支持 name/category/ingredients/steps/coverUrl/difficulty/cookTime/visibility 字段更新）
  - [x] SubTask 1.3: 新增 `DELETE /api/family/recipes/:id` 菜谱删除端点（软删除 isDeleted=true，作者校验）
  - [x] SubTask 1.4: `GET /api/family/recipes` 新增 keyword 查询参数（按 name 模糊匹配）

- [x] Task 2: 后端记录搜索与用户资料补齐
  - [x] SubTask 2.1: `GET /api/record/list` 新增 keyword 查询参数（按 dishName 模糊匹配）
  - [x] SubTask 2.2: user.controller.ts 新增 `PATCH /api/user/profile` 端点（更新 nickname/avatar，返回更新后资料）

- [x] Task 3: admin-web API 客户端补齐（client.ts）
  - [x] SubTask 3.1: 新增菜谱方法 createRecipe、updateRecipe、deleteRecipe、getRecipeDetail、getRecipesFiltered
  - [x] SubTask 3.2: 新增菜单方法 addToMenu、voteMenuItem
  - [x] SubTask 3.3: 新增购物清单方法 addShoppingItem、toggleShoppingItem、deleteShoppingItem、generateShoppingFromMenu
  - [x] SubTask 3.4: 新增家庭方法 createFamily、updateMemberRole、removeMember
  - [x] SubTask 3.5: 新增用户方法 updateProfile、uploadAvatar
  - [x] SubTask 3.6: 新增家庭动态方法 getFamilyRecords、toggleRecordLike、addRecordComment、getFamilyReport

- [x] Task 4: admin-web 菜谱详情与表单页
  - [x] SubTask 4.1: 新增 RecipeDetail.vue（展示菜名/封面/食材/步骤/难度/烹饪时间/作者；编辑/删除/加入菜单按钮，作者鉴权显示）
  - [x] SubTask 4.2: 新增 RecipeForm.vue（创建/编辑模式检测；动态食材/步骤列表增删；表单校验：菜名+至少1食材必填）
  - [x] SubTask 4.3: router/index.ts 新增 /recipe/:id、/recipe/create、/recipe/edit/:id 路由
  - [x] SubTask 4.4: FamilyRecipes.vue 菜谱卡片点击跳转详情页 + "添加菜谱"按钮跳转创建页

- [x] Task 5: admin-web 家庭菜谱页增强（FamilyRecipes.vue）
  - [x] SubTask 5.1: 菜谱分类 Tab（全部/家常菜/面食/烘焙等，接入 category 过滤）
  - [x] SubTask 5.2: 本周菜单 Tab（按周一至周日分组，每项展示菜名+投票赞踩按钮，调用 voteMenuItem）
  - [x] SubTask 5.3: "加入菜单"弹窗（选择日期+餐次，调用 addToMenu）
  - [x] SubTask 5.4: 购物清单区域（按品类分组，勾选/取消调用 toggleShoppingItem，添加/删除，自动生成调用 generateShoppingFromMenu）
  - [x] SubTask 5.5: 家庭动态 Tab（展示成员记录列表，点赞/评论，调用 getFamilyRecords/toggleRecordLike/addRecordComment）

- [x] Task 6: admin-web AI 记录页增强（AiRecord.vue）
  - [x] SubTask 6.1: 营养信息改为 4 格卡片展示（热量/蛋白质/脂肪/碳水）
  - [x] SubTask 6.2: 原图/美化图切换器（el-radio-group 切换预览）
  - [x] SubTask 6.3: 食材标签可点击切换选中状态（el-tag）
  - [x] SubTask 6.4: 烹饪方式字段展示（el-tag）
  - [x] SubTask 6.5: 保存表单包含标签选择和餐次选择

- [x] Task 7: admin-web 其他页面优化
  - [x] SubTask 7.1: Home.vue 搜索框接入 getRecords({keyword})，推荐区域展示难度/烹饪时间/匹配度
  - [x] SubTask 7.2: Achievements.vue "参与挑战"按钮接入真实逻辑（本地状态追踪）
  - [x] SubTask 7.3: Profile.vue 头像点击弹出上传选择器（调用 uploadAvatar），资料编辑（调用 updateProfile）
  - [x] SubTask 7.4: Profile.vue 功能菜单项均可跳转真实页面
  - [x] SubTask 7.5: 全部页面错误处理显示 ElMessage.error，无静默吞错

- [x] Task 8: weiji-web 占位消除
  - [x] SubTask 8.1: 替换 index.html 中挑战交互 showToast（接入 joinChallenge 逻辑）
  - [x] SubTask 8.2: 替换 index.html 中头像设置 showToast（接入上传功能）
  - [x] SubTask 8.3: 替换 index.html 中邀请家人/购物清单/推荐菜谱 showToast（接入真实跳转/弹窗）
  - [x] SubTask 8.4: 替换 app.js 中搜索/菜谱步骤详情等占位为真实功能

- [x] Task 9: uni-app 工程骨架
  - [x] SubTask 9.1: 创建 /workspace/weiji-app/ 目录，初始化 package.json、vite.config.ts、tsconfig.json、index.html、env.d.ts
  - [x] SubTask 9.2: 配置 src/main.ts（createSSRApp + Pinia）、src/App.vue（全局样式）
  - [x] SubTask 9.3: 配置 src/pages.json（8 页面 + tabBar）、src/manifest.json（H5 + mp-weixin）
  - [x] SubTask 9.4: 实现 src/api/client.ts（uni.request 封装 + JWT 拦截器 + 条件编译 BASE_URL）
  - [x] SubTask 9.5: 实现 src/stores/auth.ts（Pinia auth store + uni storage）

- [x] Task 10: uni-app 页面实现
  - [x] SubTask 10.1: 登录页（登录/注册切换）
  - [x] SubTask 10.2: 首页（打卡卡片、美食日记列表、搜索、AI 推荐）
  - [x] SubTask 10.3: AI 记录页（uni.chooseImage 上传、识别、美化、营养卡片、保存）
  - [x] SubTask 10.4: 家庭菜谱页（菜谱网格、分类筛选、可见性切换、成员栏、邀请弹窗）
  - [x] SubTask 10.5: 菜谱详情页（完整信息 + 编辑/删除/加入菜单）
  - [x] SubTask 10.6: 菜谱创建/编辑表单页
  - [x] SubTask 10.7: 成就页（等级、徽章、挑战）
  - [x] SubTask 10.8: 个人中心（用户信息、统计、头像上传、退出登录）

- [x] Task 11: uni-app 小程序适配
  - [x] SubTask 11.1: 图片上传统一使用 uni.chooseImage
  - [x] SubTask 11.2: 复制邀请码使用 uni.setClipboardData
  - [x] SubTask 11.3: tabBar 配置符合小程序规范
  - [x] SubTask 11.4: 网络请求域名白名单配置说明（manifest.json mp-weixin）

- [x] Task 12: 联调验证
  - [x] SubTask 12.1: 启动 weiji-server（memory 驱动），验证菜谱 CRUD 端点（详情/编辑/删除/关键词搜索）
  - [x] SubTask 12.2: 验证记录关键词搜索与用户资料更新端点
  - [x] SubTask 12.3: admin-web 构建（vite build）通过，无 TS 错误
  - [x] SubTask 12.4: admin-web 全部页面无占位功能、无静默错误
  - [x] SubTask 12.5: weiji-web 全部占位 showToast 已替换为真实功能
  - [x] SubTask 12.6: uni-app H5 编译产物所有页面可用
  - [x] SubTask 12.7: 核心闭环：登录→菜谱创建→查看详情→编辑→加入菜单→删除→退出

# Task Dependencies
- Task 3 依赖 Task 1、Task 2（API 客户端方法需对应后端端点）
- Task 4、Task 5、Task 6、Task 7 依赖 Task 3（页面调用 API 客户端）
- Task 10 依赖 Task 9（页面依赖工程骨架）
- Task 11 依赖 Task 10（适配依赖页面实现）
- Task 12 依赖 Task 1-11 全部完成
- Task 1、Task 2 可并行（后端独立控制器文件）
- Task 8 可与 Task 3-7 并行（weiji-web 独立项目）
- Task 9、Task 10、Task 11 可与 Task 3-7 并行（uni-app 独立项目）
