# Checklist

## 后端菜谱 CRUD 补齐
- [x] `GET /api/family/recipes/:id` 返回菜谱完整信息（含 ingredients/steps 数组）
- [x] 菜谱不存在或已删除时返回 code=404
- [x] `PUT /api/family/recipes/:id` 可编辑菜谱，非作者返回 403
- [x] `DELETE /api/family/recipes/:id` 软删除（isDeleted=true），非作者返回 403
- [x] `GET /api/family/recipes?keyword=xxx` 支持按菜名模糊搜索
- [x] 编辑端点支持 name/category/ingredients/steps/coverUrl/difficulty/cookTime/visibility 字段更新

## 后端记录搜索与用户资料
- [x] `GET /api/record/list?keyword=xxx` 支持按 dishName 模糊搜索
- [x] `PATCH /api/user/profile` 可更新 nickname 和 avatar
- [x] 用户资料更新后返回完整 profile（含 stats）

## admin-web API 客户端
- [x] client.ts 包含 createRecipe、updateRecipe、deleteRecipe、getRecipeDetail、getRecipesFiltered
- [x] client.ts 包含 addToMenu、voteMenuItem
- [x] client.ts 包含 addShoppingItem、toggleShoppingItem、deleteShoppingItem、generateShoppingFromMenu
- [x] client.ts 包含 createFamily、updateMemberRole、removeMember
- [x] client.ts 包含 updateProfile、uploadAvatar
- [x] client.ts 包含 getFamilyRecords、toggleRecordLike、addRecordComment、getFamilyReport

## admin-web 菜谱页面
- [x] RecipeDetail.vue 展示菜谱完整信息（菜名、封面、食材、步骤、难度、时间、作者）
- [x] RecipeDetail.vue 包含编辑、删除、加入菜单按钮（仅作者可见编辑/删除）
- [x] RecipeForm.vue 包含菜名、分类、难度、烹饪时间、食材、步骤、封面 URL 表单
- [x] RecipeForm.vue 表单校验（菜名和食材必填）
- [x] RecipeForm.vue 创建/编辑模式自动检测（路由参数）
- [x] router/index.ts 包含 /recipe/:id、/recipe/create、/recipe/edit/:id 路由
- [x] FamilyRecipes.vue 包含"添加菜谱"按钮跳转创建页
- [x] FamilyRecipes.vue 菜谱卡片点击跳转详情页

## admin-web 家庭菜谱页增强
- [x] 菜谱分类 Tab 支持全部/家常菜/面食/烘焙等切换（接入 category 过滤）
- [x] "本周菜单" Tab 渲染周一至周日早午晚餐列表
- [x] 菜单项支持投票（赞/踩），显示投票计数
- [x] "加入菜单"弹窗可选择日期和餐次，调用 addToMenu
- [x] 购物清单按品类分组展示，支持勾选、添加、删除
- [x] 购物清单支持"按菜单自动生成"按钮
- [x] 家庭动态 Tab 展示成员记录，支持点赞/评论

## admin-web AI 记录页增强
- [x] 营养信息以 4 格卡片展示（热量/蛋白质/脂肪/碳水）
- [x] 原图/美化图切换器可切换预览
- [x] 食材标签可点击切换选中状态
- [x] 烹饪方式字段已展示
- [x] 保存表单包含标签选择和餐次选择

## admin-web 其他页面优化
- [x] Home.vue 搜索框接入 getRecords({keyword})
- [x] Home.vue 推荐区域展示难度/烹饪时间/匹配度
- [x] Achievements.vue "参与挑战"按钮接入真实逻辑
- [x] Profile.vue 头像点击弹出上传选择器
- [x] Profile.vue 支持资料编辑（nickname/avatar）
- [x] Profile.vue 功能菜单项均可跳转真实页面
- [x] 全部页面错误处理显示 ElMessage.error，无静默吞错

## weiji-web 占位消除
- [x] index.html 挑战交互 showToast 已替换为真实逻辑
- [x] index.html 头像设置 showToast 已替换为上传功能
- [x] index.html 邀请家人/购物清单/推荐菜谱 showToast 已替换为真实跳转/弹窗
- [x] app.js 搜索占位已替换为真实搜索
- [x] app.js 菜谱步骤详情占位已替换为真实功能
- [x] 头像字段名修正（avatarUrl → avatar，与后端契约一致）

## uni-app 跨端项目
- [x] /workspace/weiji-app/ 目录已创建，包含 uni-app Vue3 项目骨架
- [x] 配置 H5 编译（npm run dev:h5 / build:h5）
- [x] 配置微信小程序编译（npm run dev:mp-weixin / build:mp-weixin）
- [x] API 客户端封装 uni.request，含 JWT token 拦截器
- [x] Pinia 状态管理已配置
- [x] pages.json 配置全部页面路由和 tabBar

## uni-app 页面
- [x] 登录页支持登录/注册切换
- [x] 首页含打卡卡片、美食日记列表、搜索、AI 推荐
- [x] AI 记录页含拍照/相册上传、识别、美化、营养卡片、保存
- [x] 家庭菜谱页含菜谱网格、分类筛选、可见性切换、成员栏、邀请弹窗
- [x] 菜谱详情页含完整信息 + 编辑/删除/加入菜单
- [x] 菜谱创建/编辑表单页
- [x] 成就页含等级、徽章、挑战
- [x] 个人中心含用户信息、统计、头像上传、退出登录

## uni-app 小程序适配
- [x] 图片上传使用 uni.chooseImage 替代 input file
- [x] 复制邀请码使用 uni.setClipboardData
- [x] tabBar 配置符合小程序规范
- [x] manifest.json mp-weixin 含网络请求域名白名单配置说明

## 联调验证
- [x] 后端菜谱 CRUD 端点全部通过验证（详情/编辑/删除/关键词搜索）
- [x] 后端记录关键词搜索与用户资料更新端点通过验证
- [x] admin-web 构建（vite build）通过，无 TS 错误
- [x] admin-web 全部页面无占位功能、无静默错误
- [x] weiji-web 全部占位 showToast 已替换为真实功能
- [x] uni-app H5 编译产物所有页面可用
- [x] 核心闭环：登录→菜谱创建→查看详情→编辑→加入菜单→删除→退出
