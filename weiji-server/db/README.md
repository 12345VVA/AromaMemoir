# 味记 MySQL 初始化脚本

> 当前 `weiji-server` 业务后端默认使用「内存存储层」运行 MVP 闭环，本目录下的 `init.sql` 仅作为**后续启用 MySQL 持久化时的接口预留**，本阶段不强制落地数据库连接。

## 目录说明

| 文件 | 说明 |
|------|------|
| `init.sql` | MySQL 8.0+ 初始化脚本：建库 + 12 张业务表 + 种子数据 |

## 启用 MySQL 持久化的步骤

1. **初始化数据库（执行脚本）**

   ```bash
   mysql -u root -p < init.sql
   ```

   脚本会自动创建 `weiji` 库（若不存在）、12 张业务表，并填充与内存种子数据一致的初始数据。脚本幂等可重复执行（内部已 `DROP TABLE IF EXISTS`）。

2. **切换 weiji-server 存储实现**

   修改 `weiji-server` 配置，将 store 实现从「内存存储」切换为「MySQL 存储」，并配置连接信息（host/port/user/password/database）。具体切换逻辑由后续 spec 处理，本脚本仅保证表结构与种子数据就绪。

3. **验证**

   执行后可执行 `SELECT COUNT(*) FROM <表名>;` 校验各表种子数据条数。

## 表清单速查（共 12 张，与内存存储层 12 个列表一一对应）

| # | 表名 | 说明 | 软删除 |
|---|------|------|--------|
| 1 | `users` | 用户表 | - |
| 2 | `families` | 家庭组表 | `isDeleted` |
| 3 | `family_members` | 家庭成员表（角色 owner/admin/member） | - |
| 4 | `family_recipes` | 家庭菜谱表（visibility: family/private） | `isDeleted` |
| 5 | `invitations` | 邀请码表 | - |
| 6 | `records` | 饮食记录表（核心表，索引 `idx_user_date`） | `isDeleted` |
| 7 | `weekly_menu` | 周菜单表（7天 × 3餐） | - |
| 8 | `shopping_items` | 购物清单表 | - |
| 9 | `achievements` | 成就定义表（`condition` 为 JSON，反引号包裹保留字） | - |
| 10 | `user_achievements` | 用户成就记录表 | - |
| 11 | `check_ins` | 打卡记录表 | - |
| 12 | `challenges` | 挑战赛表 | - |

## 设计约定

- **字符集**：`utf8mb4` / `utf8mb4_unicode_ci`
- **主键**：统一 `uuid`，存储为 `CHAR(36)`
- **软删除**：`isDeleted TINYINT NOT NULL DEFAULT 0`（0 否 / 1 是）
- **字段命名**：与 TypeScript 内存存储层保持一致（camelCase），已用反引号包裹
- **JSON 字段**：原生 `JSON` 类型，写入时用单引号字符串包裹，如 `'{"recordCount":1}'`
- **外键**：均已建立约束；脚本头部 `SET FOREIGN_KEY_CHECKS=0` 保证幂等删除

## 种子数据概览

| 表 | 条数 | 备注 |
|----|------|------|
| `users` | 4 | 演示账号 `demo` / `123456`（密码为 bcrypt 占位哈希，部署时用 `bcryptjs.hashSync('123456', 10)` 替换） |
| `families` | 1 | 王家厨房 |
| `family_members` | 4 | owner / admin / member / member 齐全 |
| `family_recipes` | 4 | 红烧牛肉面、番茄炒蛋、清炒西兰花、桂花糕（family/private 混合） |
| `invitations` | 1 | code=`WJ1234`，expiresAt = `NOW() + INTERVAL 24 HOUR` |
| `records` | 3 | demo 用户美食记录 |
| `weekly_menu` | 21 | 7 天 × 3 餐 |
| `shopping_items` | 7 | 蔬菜 / 肉类 / 水产 / 调料 / 干货 品类齐全 |
| `achievements` | 6 | first_record / streak_7 / streak_30 / record_100 / cuisine_10 / family_create |
| `user_achievements` | 2 | demo 解锁 first_record + streak_7 |
| `check_ins` | 7 | demo 最近 7 天（含 1 次补签） |
| `challenges` | 3 | 夏日轻食挑战 / 家庭菜谱大赏 / 连续打卡30天 |

## 字段说明

各表字段含义详见 `/workspace/MVP开发速查手册.md` 第 **2.2 节「核心表字段清单」**。

## 注意事项

- 脚本顶部 `CREATE DATABASE IF NOT EXISTS weiji`，如需自定义库名请同步修改 `USE` 语句与应用配置。
- 演示账号密码字段为占位符 `$2a$10$PLACEHOLDER_HASH_FOR_123456`，**非真实可用哈希**，正式启用前务必替换为真实 bcrypt 哈希。
- 本脚本为接口预留产物，执行与否不影响当前内存存储模式下 MVP 闭环运行。
