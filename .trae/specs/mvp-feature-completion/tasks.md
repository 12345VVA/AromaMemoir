# Tasks

- [x] Task 1: 后端新增协作菜单与购物清单端点
  - [x] SubTask 1.1: 创建周菜单种子数据（周一至周日，含早午晚餐、菜谱引用、投票数据）
  - [x] SubTask 1.2: 实现 `GET /api/family/menu` — 返回本周菜单列表，按天/餐次分组
  - [x] SubTask 1.3: 实现 `POST /api/family/menu` — 添加菜谱到指定日期和餐次
  - [x] SubTask 1.4: 实现 `POST /api/family/menu/{id}/vote` — 对菜单项投票（赞/踩），返回更新后的投票数
  - [x] SubTask 1.5: 创建购物清单种子数据（按品类分组，含已勾选/未勾选项）
  - [x] SubTask 1.6: 实现 `GET /api/family/shopping` — 返回购物清单，按品类分组
  - [x] SubTask 1.7: 实现 `POST /api/family/shopping` — 添加购物项
  - [x] SubTask 1.8: 实现 `PATCH /api/family/shopping/{id}` — 勾选/取消勾选购物项
  - [x] SubTask 1.9: 实现 `DELETE /api/family/shopping/{id}` — 删除购物项

- [x] Task 2: 前端API客户端扩展（api.js）
  - [x] SubTask 2.1: 新增 `beautifyImage(file)` 方法调用 `/api/ai/beautify`
  - [x] SubTask 2.2: 新增 `getRecommendations(dishName)` 方法调用 `/api/ai/recommend`
  - [x] SubTask 2.3: 新增 `getWeeklyMenu()`、`addToMenu(data)`、`voteMenuItem(id, vote)` 方法
  - [x] SubTask 2.4: 新增 `getShoppingList()`、`addShoppingItem(data)`、`toggleShoppingItem(id)`、`deleteShoppingItem(id)` 方法

- [x] Task 3: AI记录页集成美化与营养展示（app.js + index.html）
  - [x] SubTask 3.1: 识别完成后自动调用美化接口，展示原图/美化图对比切换器
  - [x] SubTask 3.2: 美化失败时降级为仅显示原图，Toast提示不阻塞流程
  - [x] SubTask 3.3: 在识别结果区域渲染营养卡片（热量/蛋白质/脂肪/碳水）
  - [x] SubTask 3.4: 保存记录时根据用户选择使用美化图或原图URL

- [x] Task 4: 首页菜谱推荐区域（app.js + index.html）
  - [x] SubTask 4.1: 在首页美食日记列表下方新增"为你推荐"区域容器
  - [x] SubTask 4.2: `loadHomeData()` 中并行调用推荐接口，渲染推荐菜谱卡片（菜名/难度/时间/匹配度）
  - [x] SubTask 4.3: 推荐卡片点击展示详情弹窗（食材/步骤摘要）

- [x] Task 5: 家庭菜谱页协作菜单Tab（app.js + index.html）
  - [x] SubTask 5.1: 家庭菜谱页顶部新增"菜谱"/"本周菜单"Tab切换
  - [x] SubTask 5.2: "本周菜单"视图渲染周一至周日的早/午/晚餐列表
  - [x] SubTask 5.3: 菜谱卡片新增"加入菜单"按钮，点击弹出日期+餐次选择器
  - [x] SubTask 5.4: 菜单项支持投票（赞/踩），显示投票计数和分布

- [x] Task 6: 购物清单功能（app.js + index.html）
  - [x] SubTask 6.1: "本周菜单"Tab下方新增购物清单区域
  - [x] SubTask 6.2: 购物清单按品类分组展示（蔬菜/肉类/调料等），支持勾选
  - [x] SubTask 6.3: 新增"添加物品"按钮，弹出输入框（名称/品类/数量）
  - [x] SubTask 6.4: 购物项支持左滑/点击删除

- [x] Task 7: 联调验证
  - [x] SubTask 7.1: 验证AI记录页：拍照→识别→美化预览→营养展示→保存闭环
  - [x] SubTask 7.2: 验证首页推荐区域正常加载展示
  - [x] SubTask 7.3: 验证协作菜单：查看周菜单→添加菜谱→投票
  - [x] SubTask 7.4: 验证购物清单：查看清单→勾选→添加→删除
  - [x] SubTask 7.5: 验证多端适配（移动端/桌面端）新功能区域布局正常

# Task Dependencies
- Task 2 依赖 Task 1（API客户端需要后端端点定义）
- Task 3 依赖 Task 2（记录页美化需要beautifyImage方法）
- Task 4 依赖 Task 2（推荐区域需要getRecommendations方法）
- Task 5 依赖 Task 1 + Task 2（菜单功能需要后端端点+API客户端）
- Task 6 依赖 Task 1 + Task 2（购物清单需要后端端点+API客户端）
- Task 7 依赖 Task 3 + Task 4 + Task 5 + Task 6
- Task 1 可独立先行
