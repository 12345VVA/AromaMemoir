# Checklist

## 后端验证

- [x] F11: `types.ts` 新增 `VoiceIntent` 类型定义
- [x] F11: `/api/ai/voice/recognize` 返回包含 `intent` 字段
- [x] F11: 测试输入"今天做什么"返回 `intent='what_to_cook'`
- [x] F11: 测试输入"红烧肉怎么做"返回 `intent='cooking_step'`
- [x] F11: 测试输入"番茄炒蛋"返回 `intent='search_recipe'`
- [x] F15: `types.ts` 新增 `ShoppingGenerateResult` 类型定义
- [x] F15: `POST /api/family/shopping/generate` 端点已注册
- [x] F15: 菜单非空时正确聚合食材并去重插入
- [x] F15: 菜单为空时返回 `{ added: 0, skipped: 0, message }` 不报错
- [x] F15: 已存在同名同单位条目跳过并累加 skipped 计数
- [x] F17: `types.ts` 新增 `FamilyDietReport` 类型定义
- [x] F17: `helpers.ts` 新增 `generateFamilyDietReport(familyId, month)` 函数
- [x] F17: `GET /api/family/report?month=YYYY-MM` 端点已注册
- [x] F17: 正确聚合当月记录（仅 isDeleted=false）
- [x] F17: 无数据时返回 `{ totalRecords: 0, ... }` 不报错
- [x] F17: 报告字段包含 totalRecords / memberContributions / topDishes / avgRating / tagDistribution

## 前端验证

- [x] F11: `api.js` 的 `recognizeVoice` 方法已更新支持 intent
- [x] F11: 占位语音图标变为可点击录音按钮
- [x] F11: 录音中显示红色脉动状态
- [x] F11: 录音结束后自动上传并处理返回
- [x] F11: intent=what_to_cook 时触发推荐
- [x] F11: intent=search_recipe 时弹出搜索结果
- [x] F11: intent=cooking_step 时显示 Toast 提示
- [x] F11: 麦克风权限拒绝时 Toast 提示并降级
- [x] F11: 识别失败时 Toast 提示"请尝试文字输入"
- [x] F11: 不支持 MediaRecorder 时 Toast 提示
- [x] F15: `api.js` 新增 `generateShoppingFromMenu()` 方法
- [x] F15: 购物清单区域有"根据菜单生成"按钮
- [x] F15: 点击按钮弹出二次确认弹窗
- [x] F15: 成功时 Toast 提示"已生成 N 条，跳过 M 条"
- [x] F15: 菜单为空时 Toast 提示"本周菜单为空"
- [x] F15: 成功后购物清单自动刷新
- [x] F17: `api.js` 新增 `getFamilyReport(month)` 方法
- [x] F17: 家庭菜谱页新增"饮食报告"Tab
- [x] F17: 报告卡片渲染（记录总数 + 环比 + 贡献榜 + Top5 + 平均评分 + 标签云）
- [x] F17: 月份选择器可切换并重新加载
- [x] F17: 无数据时显示空状态 + 跳转首页按钮
- [x] F17: `switchFamilyTab` 支持 'report' Tab

## 联调验证

- [x] 后端服务启动后 3 个新端点（/voice/recognize、/shopping/generate、/report）已注册
- [x] 前端 3 个功能 UI 在桌面端布局正常
- [x] 前端 3 个功能 UI 在移动端布局正常
- [x] 完整跑通 F11 语音搜索菜谱场景
- [x] 完整跑通 F15 根据菜单生成购物清单场景
- [x] 完整跑通 F17 查看家庭饮食月度报告场景

## PRD 文档验证

- [x] 4.2 节 F11 / F15 / F17 实现状态已更新
- [x] 8.2 节 P1 功能汇总表已更新
- [x] 11.1 节已标记新增已修复项（如有）
- [x] 11.4 节统计数量已更新
- [x] 11.5 节下一步优先事项已更新
- [x] 版本号 v1.2 → v1.3，日期已更新
