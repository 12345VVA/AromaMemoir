# 家庭体系后端完善 Spec

## Why
当前后端的"家庭"概念仅是静态的 `family_members` 列表和 `family_recipes` 列表，没有家庭组实体，无法支持创建家庭、邀请成员、成员角色管理、菜谱可见性控制等核心协作场景。需要引入家庭组数据模型和完整的管理端点，使家庭协作真正可用。

## What Changes
- 引入"家庭组"实体：包含 id、名称、创建者、成员列表、创建时间
- 引入"成员-家庭"关系：成员有角色（owner/admin/member）、加入时间、在线状态
- 新增家庭成员管理端点：查询成员详情、更新成员角色、移除成员
- 新增成员邀请端点：生成邀请码、通过邀请码加入家庭、查询待处理邀请
- 新增菜谱可见性控制：菜谱增加 `visibility` 字段（family/private）、按可见性筛选
- 新增菜谱归属：菜谱增加 `familyId` 和 `authorId`，支持按家庭和作者筛选
- 现有 `GET /api/family/members` 和 `GET /api/family/recipes` 兼容性升级，返回新字段

## Impact
- Affected specs: mvp-feature-completion（协作菜单和购物清单依赖家庭组上下文）
- Affected code:
  - [main.py](file:///workspace/weiji-ai/main.py) — 新增家庭组数据模型、成员管理端点、邀请端点、菜谱可见性逻辑
  - [api.js](file:///workspace/weiji-web/api.js) — 新增家庭管理、邀请、菜谱筛选 API 方法
  - [app.js](file:///workspace/weiji-web/app.js) — 家庭菜谱页展示成员角色、邀请入口、可见性筛选
  - [index.html](file:///workspace/weiji-web/index.html) — 成员卡片展示角色标签、邀请弹窗、可见性切换

## ADDED Requirements

### Requirement: 家庭组实体
系统 SHALL 维护家庭组实体，每个家庭组包含唯一 id、名称、创建者 userId、成员列表和创建时间。

#### Scenario: 查询当前家庭
- **WHEN** 用户请求 `GET /api/family`
- **THEN** 返回用户所属家庭组信息（id、名称、成员数、创建时间）

#### Scenario: 创建家庭
- **WHEN** 用户请求 `POST /api/family`，提供家庭名称
- **THEN** 创建家庭组，创建者自动成为 owner 角色，返回家庭组信息

### Requirement: 成员管理
系统 SHALL 支持查询家庭成员详情、更新成员角色和移除成员。

#### Scenario: 查询成员详情
- **WHEN** 用户请求 `GET /api/family/members`
- **THEN** 返回成员列表，每项包含 id、名称、头像、角色（owner/admin/member）、加入时间、在线状态

#### Scenario: 更新成员角色
- **WHEN** owner 或 admin 请求 `PATCH /api/family/members/{memberId}`，提供新角色
- **THEN** 更新成员角色，返回更新后的成员信息
- **WHEN** 非 owner/admin 用户请求
- **THEN** 返回 403 权限不足

#### Scenario: 移除成员
- **WHEN** owner 请求 `DELETE /api/family/members/{memberId}`
- **THEN** 从家庭组移除该成员，返回成功
- **WHEN** 被移除的是 owner 自己
- **THEN** 返回 400 错误，owner 不能移除自己

### Requirement: 成员邀请
系统 SHALL 支持生成邀请码、通过邀请码加入家庭、查询待处理邀请。

#### Scenario: 生成邀请码
- **WHEN** owner 或 admin 请求 `POST /api/family/invitations`
- **THEN** 生成 6 位邀请码，有效期 24 小时，返回邀请码和过期时间

#### Scenario: 通过邀请码加入
- **WHEN** 用户请求 `POST /api/family/join`，提供邀请码
- **THEN** 校验邀请码有效性和过期时间，将用户加入家庭组为 member 角色，返回家庭组信息
- **WHEN** 邀请码无效或已过期
- **THEN** 返回 400 错误

#### Scenario: 查询待处理邀请
- **WHEN** owner 或 admin 请求 `GET /api/family/invitations`
- **THEN** 返回未过期的邀请列表，每项包含邀请码、创建时间、过期时间、是否已使用

### Requirement: 菜谱可见性
系统 SHALL 支持菜谱的可见性控制，菜谱可设为 family（家庭可见）或 private（仅作者可见）。

#### Scenario: 查询菜谱按可见性筛选
- **WHEN** 用户请求 `GET /api/family/recipes?visibility=family`
- **THEN** 仅返回 visibility 为 family 的菜谱
- **WHEN** 用户请求 `GET /api/family/recipes?visibility=private`
- **THEN** 仅返回当前用户创建的 private 菜谱

#### Scenario: 设置菜谱可见性
- **WHEN** 菜谱作者请求 `PATCH /api/family/recipes/{recipeId}/visibility`，提供 visibility 值
- **THEN** 更新菜谱可见性，返回更新后的菜谱信息
- **WHEN** 非作者用户请求
- **THEN** 返回 403 权限不足

## MODIFIED Requirements

### Requirement: 家庭菜谱查询
现有 `GET /api/family/recipes` 返回所有菜谱。修改为支持按 visibility、authorId 筛选，且菜谱数据新增 visibility、familyId、authorId 字段。
