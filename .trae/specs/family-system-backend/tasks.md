# Tasks

- [x] Task 1: 家庭组数据模型与种子数据
  - [x] SubTask 1.1: 新增 `families` 列表，包含家庭组实体（id、名称、ownerId、创建时间）
  - [x] SubTask 1.2: 重构 `family_members`，为每个成员增加 `familyId`、`role`（owner/admin/member）、`joinedAt`、`userId` 字段
  - [x] SubTask 1.3: 为 `family_recipes` 每项增加 `visibility`（family/private）、`familyId`、`authorId` 字段
  - [x] SubTask 1.4: 新增 `invitations` 列表，预填充 1-2 条邀请记录（含邀请码、创建时间、过期时间、是否已使用）

- [x] Task 2: 家庭组与成员管理端点
  - [x] SubTask 2.1: 实现 `GET /api/family` — 返回当前用户所属家庭组信息
  - [x] SubTask 2.2: 实现 `POST /api/family` — 创建家庭组，创建者自动成为 owner
  - [x] SubTask 2.3: 修改 `GET /api/family/members` — 返回成员角色、加入时间等新字段
  - [x] SubTask 2.4: 实现 `PATCH /api/family/members/{memberId}` — 更新成员角色（仅 owner/admin 可操作）
  - [x] SubTask 2.5: 实现 `DELETE /api/family/members/{memberId}` — 移除成员（仅 owner 可操作，不能移除自己）

- [x] Task 3: 成员邀请端点
  - [x] SubTask 3.1: 实现 `POST /api/family/invitations` — 生成 6 位邀请码，有效期 24 小时
  - [x] SubTask 3.2: 实现 `GET /api/family/invitations` — 返回未过期的邀请列表
  - [x] SubTask 3.3: 实现 `POST /api/family/join` — 通过邀请码加入家庭，校验有效性和过期时间

- [x] Task 4: 菜谱可见性端点
  - [x] SubTask 4.1: 修改 `GET /api/family/recipes` — 支持 `visibility` 和 `authorId` 查询参数筛选
  - [x] SubTask 4.2: 实现 `PATCH /api/family/recipes/{recipeId}/visibility` — 更新菜谱可见性（仅作者可操作）

- [x] Task 5: 前端 API 客户端扩展（api.js）
  - [x] SubTask 5.1: 新增 `getFamilyInfo()`、`createFamily(name)` 方法
  - [x] SubTask 5.2: 新增 `updateMemberRole(memberId, role)`、`removeMember(memberId)` 方法
  - [x] SubTask 5.3: 新增 `createInvitation()`、`getInvitations()`、`joinFamily(code)` 方法
  - [x] SubTask 5.4: 新增 `getRecipes({visibility, authorId})`、`updateRecipeVisibility(recipeId, visibility)` 方法

- [x] Task 6: 前端 UI 适配（app.js + index.html）
  - [x] SubTask 6.1: 家庭菜谱页成员栏展示角色标签（owner/admin/member）
  - [x] SubTask 6.2: 新增邀请入口按钮，点击弹出邀请码弹窗（展示邀请码和复制按钮）
  - [x] SubTask 6.3: 菜谱卡片展示可见性图标（family=家庭图标，private=锁图标），点击切换可见性
  - [x] SubTask 6.4: 菜谱分类标签新增"全部/家庭共享/我的私厨"筛选切换

- [x] Task 7: 联调验证
  - [x] SubTask 7.1: 验证家庭组查询和创建
  - [x] SubTask 7.2: 验证成员角色更新和移除（含权限校验）
  - [x] SubTask 7.3: 验证邀请码生成、查询、加入家庭全流程
  - [x] SubTask 7.4: 验证菜谱可见性筛选和切换
  - [x] SubTask 7.5: 验证前端成员角色展示、邀请弹窗、可见性图标交互

# Task Dependencies
- Task 2 依赖 Task 1（端点需要数据模型）
- Task 3 依赖 Task 1（邀请需要家庭组实体）
- Task 4 依赖 Task 1（可见性需要菜谱新字段）
- Task 5 依赖 Task 2 + Task 3 + Task 4（前端方法需要后端端点定义）
- Task 6 依赖 Task 5（前端 UI 需要 API 方法）
- Task 7 依赖 Task 6
- Task 1 可独立先行
