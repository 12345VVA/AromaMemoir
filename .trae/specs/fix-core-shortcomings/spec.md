# 核心短板修复 Spec

## Why
项目评审发现三类结构性短板，导致核心功能闭环断裂：
1. **成就自动解锁机制缺失**（P0）：成就仅在 `GET /api/achievement/list` 被动查询时读取 `user_achievements` 表，但没有任何代码在用户完成行为后写入解锁记录。
2. **记录 CRUD 不完整**（P0）：`record.controller.ts` 仅有 Create 和 Read，缺少 Update（PATCH）和 Delete（DELETE）。
3. **玩法与核心系统未联动**（P1）：F27-F30 娱乐化玩法与成就系统完全隔离。
