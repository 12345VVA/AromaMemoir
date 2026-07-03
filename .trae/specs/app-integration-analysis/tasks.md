# Tasks

- [x] Task 1: 账号/用户体系排查与修复
  - [x] SubTask 1.1: 验证 JWT secret 一致性 ✓ 两个 secret 一致
  - [x] SubTask 1.2: 排查 cool-uni user store 兼容性 ✓ C端不触发 B端路径，无需修复
  - [x] SubTask 1.3: 验证 syncUserStore 桥接逻辑 ✓ 字段映射正确
  - [x] SubTask 1.4: 验证登录/注册/退出/401 链路 ✓ 修复 set.vue 头像字段名 + api.ts code=1001 处理

- [x] Task 2: 前后端 API 端点路径对齐验证
  - [x] SubTask 2.1: 逐模块对比 ✓ 创建 family/controller/app/record.ts 补齐 3 个缺失端点
  - [x] SubTask 2.2: 验证响应格式一致性 ✓ code: 1000 一致
  - [x] SubTask 2.3: 验证模块注册 ✓ 所有模块正确注册

- [x] Task 3: 前端页面功能分析与数据流审查
  - [x] SubTask 3.1: 审查 home.vue ✓ 推荐基于最近记录菜名
  - [x] SubTask 3.2: 审查 my.vue ✓ 不 spread data 到 user.info
  - [x] SubTask 3.3: 审查 login.vue ✓ 注册成功直接跳转首页
  - [x] SubTask 3.4: 审查 ai-record.vue ✓ 识别后更新 imageUrl
  - [x] SubTask 3.5: 审查 family/index.vue ✓ 可见性 private↔family 两态
  - [x] SubTask 3.6: 审查 achievement/index.vue ✓ 无问题
  - [x] SubTask 3.7: 审查 gamification/index.vue ✓ 无问题
  - [x] SubTask 3.8: 审查 router/index.ts ✓ 移除无效白名单路径

- [x] Task 4: 后端用户资料统计字段补全
  - [x] SubTask 4.1: 修改 profile.ts ✓ 从 record/recipe/checkin/achievement 表查询真实统计
  - [x] SubTask 4.2: 处理新用户无数据场景 ✓ try-catch 返回 0

- [x] Task 5: 联调验证
  - [x] SubTask 5.1: 启动 weiji-server ✓ 服务运行在 8001，所有端点 code=1000
  - [x] SubTask 5.2: 启动 weiji-app H5 ✓ 后端 API 验证通过
  - [x] SubTask 5.3: 端到端流程测试 ✓ 注册→登录→profile→打卡→退出 全部通过
  - [x] SubTask 5.4: 记录并修复问题 ✓ 修复 code=1001 未授权处理