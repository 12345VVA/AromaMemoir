-- ============================================================
-- 味记（weiji）MySQL 初始化脚本
-- ------------------------------------------------------------
-- 说明：
--   当前 weiji-server 业务后端默认使用「内存存储层」运行 MVP 闭环，
--   本脚本作为后续启用 MySQL 持久化时的「接口预留」，本 spec 不强制落地连接。
--   执行后可一次性创建 12 张业务表并填充与设计稿/内存种子数据一致的初始数据。
--
-- 适用：MySQL 8.0+
-- 字符集：utf8mb4
-- 主键：统一 uuid（CHAR(36)）
-- 软删除：isDeleted tinyint default 0
-- 字段命名：与 TypeScript 内存存储层保持一致（camelCase），已用反引号包裹
-- ============================================================

CREATE DATABASE IF NOT EXISTS `weiji`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `weiji`;

SET FOREIGN_KEY_CHECKS = 0;

-- 便于幂等执行，先清理旧表
DROP TABLE IF EXISTS `user_achievements`;
DROP TABLE IF EXISTS `check_ins`;
DROP TABLE IF EXISTS `achievements`;
DROP TABLE IF EXISTS `challenges`;
DROP TABLE IF EXISTS `shopping_items`;
DROP TABLE IF EXISTS `weekly_menu`;
DROP TABLE IF EXISTS `records`;
DROP TABLE IF EXISTS `invitations`;
DROP TABLE IF EXISTS `family_recipes`;
DROP TABLE IF EXISTS `family_members`;
DROP TABLE IF EXISTS `families`;
DROP TABLE IF EXISTS `users`;

-- ============================================================
-- 1. users 用户表
-- ============================================================
CREATE TABLE `users` (
  `id` CHAR(36) NOT NULL COMMENT '用户ID(uuid)',
  `username` VARCHAR(50) NOT NULL COMMENT '登录账号',
  `password` VARCHAR(100) NOT NULL COMMENT '密码(bcrypt 哈希)',
  `nickname` VARCHAR(50) NOT NULL DEFAULT '' COMMENT '昵称',
  `avatar` VARCHAR(500) NOT NULL DEFAULT '' COMMENT '头像URL',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- ============================================================
-- 2. families 家庭组表
-- ============================================================
CREATE TABLE `families` (
  `id` CHAR(36) NOT NULL COMMENT '家庭组ID(uuid)',
  `name` VARCHAR(50) NOT NULL COMMENT '家庭组名称',
  `ownerId` CHAR(36) NOT NULL COMMENT '创建者ID',
  `memberCount` INT NOT NULL DEFAULT 0 COMMENT '成员数',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `isDeleted` TINYINT NOT NULL DEFAULT 0 COMMENT '软删除：0否 1是',
  PRIMARY KEY (`id`),
  KEY `idx_families_owner` (`ownerId`),
  CONSTRAINT `fk_families_owner` FOREIGN KEY (`ownerId`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='家庭组表';

-- ============================================================
-- 3. family_members 家庭成员表
-- ============================================================
CREATE TABLE `family_members` (
  `id` CHAR(36) NOT NULL COMMENT '成员记录ID(uuid)',
  `familyId` CHAR(36) NOT NULL COMMENT '家庭组ID',
  `userId` CHAR(36) NOT NULL COMMENT '用户ID',
  `role` ENUM('owner','admin','member') NOT NULL DEFAULT 'member' COMMENT '角色',
  `joinedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '加入时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_family_user` (`familyId`, `userId`),
  KEY `idx_family_members_user` (`userId`),
  CONSTRAINT `fk_fm_family` FOREIGN KEY (`familyId`) REFERENCES `families` (`id`),
  CONSTRAINT `fk_fm_user` FOREIGN KEY (`userId`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='家庭成员表';

-- ============================================================
-- 4. family_recipes 家庭菜谱表
-- ============================================================
CREATE TABLE `family_recipes` (
  `id` CHAR(36) NOT NULL COMMENT '菜谱ID(uuid)',
  `familyId` CHAR(36) NOT NULL COMMENT '所属家庭组ID',
  `name` VARCHAR(100) NOT NULL COMMENT '菜谱名称',
  `category` VARCHAR(30) NOT NULL DEFAULT '家常菜' COMMENT '分类：家常菜/面食/烘焙/汤羹/自定义',
  `ingredients` JSON NOT NULL COMMENT '食材清单JSON：[{name, amount, unit}]',
  `steps` JSON NOT NULL COMMENT '步骤JSON：[{stepNum, text, imageUrl}]',
  `coverUrl` VARCHAR(500) NOT NULL DEFAULT '' COMMENT '封面图URL',
  `difficulty` VARCHAR(10) NOT NULL DEFAULT '' COMMENT '难度：简单/中等/困难',
  `cookTime` INT NOT NULL DEFAULT 0 COMMENT '烹饪时间(分钟)',
  `uploaderId` CHAR(36) NOT NULL COMMENT '上传者ID',
  `visibility` ENUM('family','private') NOT NULL DEFAULT 'family' COMMENT '可见性：family家庭共享 private私厨',
  `versionCount` INT NOT NULL DEFAULT 1 COMMENT '版本迭代次数',
  `isDeleted` TINYINT NOT NULL DEFAULT 0 COMMENT '软删除：0否 1是',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_recipes_family` (`familyId`),
  KEY `idx_recipes_uploader` (`uploaderId`),
  CONSTRAINT `fk_fr_family` FOREIGN KEY (`familyId`) REFERENCES `families` (`id`),
  CONSTRAINT `fk_fr_uploader` FOREIGN KEY (`uploaderId`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='家庭菜谱表';

-- ============================================================
-- 5. invitations 邀请码表
-- ============================================================
CREATE TABLE `invitations` (
  `id` CHAR(36) NOT NULL COMMENT '邀请记录ID(uuid)',
  `code` VARCHAR(10) NOT NULL COMMENT '邀请码',
  `familyId` CHAR(36) NOT NULL COMMENT '目标家庭组ID',
  `createdBy` CHAR(36) NOT NULL COMMENT '创建人ID',
  `expiresAt` DATETIME NULL DEFAULT NULL COMMENT '过期时间',
  `used` TINYINT NOT NULL DEFAULT 0 COMMENT '是否已使用：0否 1是',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_invitations_code` (`code`),
  KEY `idx_invitations_family` (`familyId`),
  CONSTRAINT `fk_inv_family` FOREIGN KEY (`familyId`) REFERENCES `families` (`id`),
  CONSTRAINT `fk_inv_creator` FOREIGN KEY (`createdBy`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='邀请码表';

-- ============================================================
-- 6. records 饮食记录表（核心表）
-- ============================================================
CREATE TABLE `records` (
  `id` CHAR(36) NOT NULL COMMENT '记录ID(uuid)',
  `userId` CHAR(36) NOT NULL COMMENT '用户ID',
  `dishName` VARCHAR(100) NOT NULL COMMENT '菜品名称',
  `cookingMethod` VARCHAR(20) NOT NULL DEFAULT '' COMMENT '烹饪方式：炒/蒸/煮/烤/炸/炖/凉拌/其他',
  `rating` TINYINT NOT NULL DEFAULT 3 COMMENT '评分1-5，默认3',
  `note` VARCHAR(500) NOT NULL DEFAULT '' COMMENT '备注',
  `aiConfidence` DECIMAL(5,2) NULL DEFAULT NULL COMMENT 'AI识别置信度0-1',
  `nutritionJson` JSON NULL DEFAULT NULL COMMENT '营养分析JSON：{calories,protein,fat,carbs}',
  `mealType` VARCHAR(20) NOT NULL DEFAULT '' COMMENT '餐次：早餐/午餐/晚餐/加餐/夜宵',
  `recordDate` DATE NOT NULL COMMENT '记录日期(非创建时间)',
  `source` VARCHAR(20) NOT NULL DEFAULT 'manual' COMMENT '来源：camera/gallery/manual',
  `isDeleted` TINYINT NOT NULL DEFAULT 0 COMMENT '软删除：0否 1是',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_date` (`userId`, `recordDate`),
  KEY `idx_records_date` (`recordDate`),
  KEY `idx_records_rating` (`rating`),
  CONSTRAINT `fk_records_user` FOREIGN KEY (`userId`) REFERENCES `users` (`id`),
  CONSTRAINT `chk_records_rating` CHECK (`rating` BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='饮食记录表';

-- ============================================================
-- 7. weekly_menu 周菜单表
-- ============================================================
CREATE TABLE `weekly_menu` (
  `id` CHAR(36) NOT NULL COMMENT '菜单项ID(uuid)',
  `familyId` CHAR(36) NOT NULL COMMENT '家庭组ID',
  `weekStart` DATE NOT NULL COMMENT '本周周一日期',
  `dayOfWeek` TINYINT NOT NULL COMMENT '星期几1-7',
  `mealType` ENUM('breakfast','lunch','dinner') NOT NULL COMMENT '餐次：早餐/午餐/晚餐',
  `recipeId` CHAR(36) NULL DEFAULT NULL COMMENT '关联菜谱ID(可空)',
  `recipeName` VARCHAR(100) NOT NULL DEFAULT '' COMMENT '冗余菜名',
  `likes` INT NOT NULL DEFAULT 0 COMMENT '点赞数',
  `dislikes` INT NOT NULL DEFAULT 0 COMMENT '踩数',
  PRIMARY KEY (`id`),
  KEY `idx_menu_family_week` (`familyId`, `weekStart`),
  KEY `idx_menu_recipe` (`recipeId`),
  CONSTRAINT `fk_wm_family` FOREIGN KEY (`familyId`) REFERENCES `families` (`id`),
  CONSTRAINT `fk_wm_recipe` FOREIGN KEY (`recipeId`) REFERENCES `family_recipes` (`id`),
  CONSTRAINT `chk_wm_dayofweek` CHECK (`dayOfWeek` BETWEEN 1 AND 7)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='周菜单表';

-- ============================================================
-- 8. shopping_items 购物清单表
-- ============================================================
CREATE TABLE `shopping_items` (
  `id` CHAR(36) NOT NULL COMMENT '购物项ID(uuid)',
  `familyId` CHAR(36) NOT NULL COMMENT '家庭组ID',
  `name` VARCHAR(50) NOT NULL COMMENT '物品名称',
  `category` VARCHAR(20) NOT NULL DEFAULT '其他' COMMENT '分类：蔬菜/肉类/水产/调料/乳制品/干货/其他',
  `quantity` VARCHAR(20) NOT NULL DEFAULT '' COMMENT '数量：500g/2个/1瓶',
  `checked` TINYINT NOT NULL DEFAULT 0 COMMENT '是否已购买：0否 1是',
  `checkedBy` CHAR(36) NULL DEFAULT NULL COMMENT '勾选人ID(可空)',
  `checkedAt` DATETIME NULL DEFAULT NULL COMMENT '勾选时间(可空)',
  `sort` INT NOT NULL DEFAULT 0 COMMENT '排序',
  PRIMARY KEY (`id`),
  KEY `idx_shopping_family` (`familyId`),
  KEY `idx_shopping_checkedby` (`checkedBy`),
  CONSTRAINT `fk_si_family` FOREIGN KEY (`familyId`) REFERENCES `families` (`id`),
  CONSTRAINT `fk_si_checkedby` FOREIGN KEY (`checkedBy`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='购物清单表';

-- ============================================================
-- 9. achievements 成就定义表
--    注意：condition 为 MySQL 保留字，已用反引号包裹
-- ============================================================
CREATE TABLE `achievements` (
  `id` CHAR(36) NOT NULL COMMENT '成就ID(uuid)',
  `code` VARCHAR(50) NOT NULL COMMENT '唯一标识码',
  `name` VARCHAR(50) NOT NULL COMMENT '成就名称',
  `description` VARCHAR(200) NOT NULL DEFAULT '' COMMENT '成就描述',
  `icon` VARCHAR(100) NOT NULL DEFAULT '' COMMENT '图标标识',
  `type` VARCHAR(20) NOT NULL DEFAULT 'record' COMMENT '类型：record/streak/variety/family',
  `condition` JSON NOT NULL COMMENT '触发条件JSON',
  `expReward` INT NOT NULL DEFAULT 0 COMMENT '经验值奖励',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_achievements_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='成就定义表';

-- ============================================================
-- 10. user_achievements 用户成就记录表
-- ============================================================
CREATE TABLE `user_achievements` (
  `id` CHAR(36) NOT NULL COMMENT '记录ID(uuid)',
  `userId` CHAR(36) NOT NULL COMMENT '用户ID',
  `achievementId` CHAR(36) NOT NULL COMMENT '成就ID',
  `earnedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '获得时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_achievement` (`userId`, `achievementId`),
  KEY `idx_ua_achievement` (`achievementId`),
  CONSTRAINT `fk_ua_user` FOREIGN KEY (`userId`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_ua_achievement` FOREIGN KEY (`achievementId`) REFERENCES `achievements` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户成就记录表';

-- ============================================================
-- 11. check_ins 打卡记录表
-- ============================================================
CREATE TABLE `check_ins` (
  `id` CHAR(36) NOT NULL COMMENT '打卡记录ID(uuid)',
  `userId` CHAR(36) NOT NULL COMMENT '用户ID',
  `checkDate` DATE NOT NULL COMMENT '打卡日期',
  `recordCount` INT NOT NULL DEFAULT 0 COMMENT '当日记录数',
  `isReplenish` TINYINT NOT NULL DEFAULT 0 COMMENT '是否补签：0否 1是',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_date` (`userId`, `checkDate`),
  KEY `idx_checkins_user` (`userId`),
  CONSTRAINT `fk_ci_user` FOREIGN KEY (`userId`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='打卡记录表';

-- ============================================================
-- 12. challenges 挑战赛表
-- ============================================================
CREATE TABLE `challenges` (
  `id` CHAR(36) NOT NULL COMMENT '挑战ID(uuid)',
  `title` VARCHAR(100) NOT NULL COMMENT '挑战名称',
  `description` VARCHAR(500) NOT NULL DEFAULT '' COMMENT '挑战描述',
  `rules` JSON NOT NULL COMMENT '挑战规则JSON',
  `startDate` DATE NOT NULL COMMENT '开始日期',
  `endDate` DATE NOT NULL COMMENT '结束日期',
  `badgeCode` VARCHAR(50) NOT NULL DEFAULT '' COMMENT '完成奖励徽章码',
  `isActive` TINYINT NOT NULL DEFAULT 1 COMMENT '是否激活：0否 1是',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='挑战赛表';

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- 种子数据
-- ------------------------------------------------------------
-- 与内存存储层(Task 2)保持一致，前端首次启动即可看到完整数据。
-- 固定 UUID 便于跨表关联引用，便于排查。
--   用户  ...0001~...0004
--   家庭  ...0101
--   菜谱  ...0201~...0204
--   邀请  ...0301
--   记录  ...0401~...0403
--   菜单  ...0501~...0521
--   购物  ...0601~...0607
--   成就  ...0701~...0706
--   用户成就 ...0801~...0802
--   打卡  ...0901~...0907
--   挑战  ...1001~...1003
-- ============================================================

-- 周一日期变量(供 weekly_menu 复用)
SET @week_start = DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY);

-- ---------- users 用户(4) ----------
-- 注意：password 字段为 bcrypt 哈希占位符，
--   实际部署时请用 Node 执行 bcryptjs.hashSync('123456', 10) 生成真实哈希后替换。
INSERT INTO `users` (`id`,`username`,`password`,`nickname`,`avatar`,`createdAt`) VALUES
('00000000-0000-0000-0000-000000000001','demo','$2a$10$PLACEHOLDER_HASH_FOR_123456','味记达人','https://cdn.weiji.app/avatar/demo.png',NOW() - INTERVAL 30 DAY),
('00000000-0000-0000-0000-000000000002','wang_mama','$2a$10$PLACEHOLDER_HASH_FOR_123456','王妈妈','https://cdn.weiji.app/avatar/mama.png',NOW() - INTERVAL 28 DAY),
('00000000-0000-0000-0000-000000000003','wang_baba','$2a$10$PLACEHOLDER_HASH_FOR_123456','王爸爸','https://cdn.weiji.app/avatar/baba.png',NOW() - INTERVAL 28 DAY),
('00000000-0000-0000-0000-000000000004','wang_kid','$2a$10$PLACEHOLDER_HASH_FOR_123456','王小宝','https://cdn.weiji.app/avatar/kid.png',NOW() - INTERVAL 20 DAY);

-- ---------- families 家庭组(1) ----------
INSERT INTO `families` (`id`,`name`,`ownerId`,`memberCount`,`createdAt`) VALUES
('00000000-0000-0000-0000-000000000101','王家厨房','00000000-0000-0000-0000-000000000001',4,NOW() - INTERVAL 30 DAY);

-- ---------- family_members 家庭成员(4，角色齐全 owner/admin/member/member) ----------
INSERT INTO `family_members` (`id`,`familyId`,`userId`,`role`,`joinedAt`) VALUES
('00000000-0000-0000-0000-fm0000000001','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000001','owner', NOW() - INTERVAL 30 DAY),
('00000000-0000-0000-0000-fm0000000002','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000002','admin', NOW() - INTERVAL 28 DAY),
('00000000-0000-0000-0000-fm0000000003','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000003','member',NOW() - INTERVAL 28 DAY),
('00000000-0000-0000-0000-fm0000000004','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000004','member',NOW() - INTERVAL 20 DAY);

-- ---------- family_recipes 家庭菜谱(4，visibility family/private 混合) ----------
INSERT INTO `family_recipes` (`id`,`familyId`,`name`,`category`,`ingredients`,`steps`,`coverUrl`,`difficulty`,`cookTime`,`uploaderId`,`visibility`,`versionCount`,`createdAt`) VALUES
('00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000101','红烧牛肉面','面食',
 '[{"name":"牛腩","amount":"300g","unit":"g"},{"name":"面条","amount":"200g","unit":"g"},{"name":"青菜","amount":"100g","unit":"g"},{"name":"八角","amount":"2个","unit":"个"}]',
 '[{"stepNum":1,"text":"牛腩切块冷水下锅焯水去血沫","imageUrl":""},{"stepNum":2,"text":"热锅冷油爆香葱姜八角，下牛腩翻炒上色","imageUrl":""},{"stepNum":3,"text":"加开水没过牛肉，小火炖煮90分钟","imageUrl":""},{"stepNum":4,"text":"另锅煮面，出锅前烫青菜，浇上牛肉汤","imageUrl":""}]',
 'https://cdn.weiji.app/recipe/beef-noodle.jpg','中等',90,'00000000-0000-0000-0000-000000000001','family',2,NOW() - INTERVAL 25 DAY),
('00000000-0000-0000-0000-000000000202','00000000-0000-0000-0000-000000000101','番茄炒蛋','家常菜',
 '[{"name":"番茄","amount":"2个","unit":"个"},{"name":"鸡蛋","amount":"3个","unit":"个"},{"name":"白糖","amount":"5g","unit":"g"}]',
 '[{"stepNum":1,"text":"番茄顶部划十字，开水烫后去皮切块","imageUrl":""},{"stepNum":2,"text":"鸡蛋打散，热油下锅炒散盛出","imageUrl":""},{"stepNum":3,"text":"另起锅炒番茄出汁，回锅鸡蛋，加糖盐翻匀","imageUrl":""}]',
 'https://cdn.weiji.app/recipe/tomato-egg.jpg','简单',15,'00000000-0000-0000-0000-000000000002','family',1,NOW() - INTERVAL 20 DAY),
('00000000-0000-0000-0000-000000000203','00000000-0000-0000-0000-000000000101','清炒西兰花','家常菜',
 '[{"name":"西兰花","amount":"1颗","unit":"颗"},{"name":"蒜","amount":"3瓣","unit":"瓣"},{"name":"盐","amount":"2g","unit":"g"}]',
 '[{"stepNum":1,"text":"西兰花掰小朵，盐水浸泡10分钟","imageUrl":""},{"stepNum":2,"text":"沸水焯烫30秒捞出过凉","imageUrl":""},{"stepNum":3,"text":"热油爆香蒜末，下西兰花大火快炒，加盐出锅","imageUrl":""}]',
 'https://cdn.weiji.app/recipe/broccoli.jpg','简单',10,'00000000-0000-0000-0000-000000000003','private',1,NOW() - INTERVAL 15 DAY),
('00000000-0000-0000-0000-000000000204','00000000-0000-0000-0000-000000000101','桂花糕','烘焙',
 '[{"name":"糯米粉","amount":"150g","unit":"g"},{"name":"桂花","amount":"20g","unit":"g"},{"name":"白糖","amount":"40g","unit":"g"},{"name":"水","amount":"120ml","unit":"ml"}]',
 '[{"stepNum":1,"text":"糯米粉加糖桂花加水和成软面团","imageUrl":""},{"stepNum":2,"text":"模具抹油，倒入面糊震出气泡","imageUrl":""},{"stepNum":3,"text":"上锅大火蒸25分钟，晾凉脱模切块","imageUrl":""}]',
 'https://cdn.weiji.app/recipe/osmanthus-cake.jpg','中等',40,'00000000-0000-0000-0000-000000000001','family',1,NOW() - INTERVAL 10 DAY);

-- ---------- invitations 邀请码(1，expiresAt = NOW + 24h) ----------
INSERT INTO `invitations` (`id`,`code`,`familyId`,`createdBy`,`expiresAt`,`used`,`createdAt`) VALUES
('00000000-0000-0000-0000-000000000301','WJ1234','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000001',NOW() + INTERVAL 24 HOUR,0,NOW() - INTERVAL 1 DAY);

-- ---------- records 饮食记录(3，demo 用户) ----------
INSERT INTO `records` (`id`,`userId`,`dishName`,`cookingMethod`,`rating`,`note`,`aiConfidence`,`nutritionJson`,`mealType`,`recordDate`,`source`,`createdAt`) VALUES
('00000000-0000-0000-0000-000000000401','00000000-0000-0000-0000-000000000001','红烧牛肉面','炖',5,'汤浓肉烂，家传做法',
 0.96,'{"calories":520,"protein":28.5,"fat":18.2,"carbs":62.0}','午餐',CURDATE(),'camera',NOW()),
('00000000-0000-0000-0000-000000000402','00000000-0000-0000-0000-000000000001','番茄炒蛋','炒',4,'酸甜下饭',
 0.92,'{"calories":220,"protein":12.0,"fat":14.5,"carbs":10.0}','晚餐',CURDATE() - INTERVAL 1 DAY,'gallery',NOW() - INTERVAL 1 DAY),
('00000000-0000-0000-0000-000000000403','00000000-0000-0000-0000-000000000001','清炒西兰花','炒',4,'清爽健康',
 NULL,'{"calories":90,"protein":5.0,"fat":3.5,"carbs":11.0}','早餐',CURDATE() - INTERVAL 2 DAY,'manual',NOW() - INTERVAL 2 DAY);

-- ---------- weekly_menu 周菜单(21，7天 x 3餐) ----------
-- recipeId 部分置 NULL 演示可空，对应"待定"菜
INSERT INTO `weekly_menu` (`id`,`familyId`,`weekStart`,`dayOfWeek`,`mealType`,`recipeId`,`recipeName`,`likes`,`dislikes`) VALUES
('00000000-0000-0000-0000-000000000501','00000000-0000-0000-0000-000000000101',@week_start,1,'breakfast','00000000-0000-0000-0000-000000000204','桂花糕',2,0),
('00000000-0000-0000-0000-000000000502','00000000-0000-0000-0000-000000000101',@week_start,1,'lunch',  '00000000-0000-0000-0000-000000000201','红烧牛肉面',3,0),
('00000000-0000-0000-0000-000000000503','00000000-0000-0000-0000-000000000101',@week_start,1,'dinner', '00000000-0000-0000-0000-000000000202','番茄炒蛋',2,1),
('00000000-0000-0000-0000-000000000504','00000000-0000-0000-0000-000000000101',@week_start,2,'breakfast',NULL,'待定',0,0),
('00000000-0000-0000-0000-000000000505','00000000-0000-0000-0000-000000000101',@week_start,2,'lunch',  '00000000-0000-0000-0000-000000000203','清炒西兰花',1,0),
('00000000-0000-0000-0000-000000000506','00000000-0000-0000-0000-000000000101',@week_start,2,'dinner', '00000000-0000-0000-0000-000000000201','红烧牛肉面',2,0),
('00000000-0000-0000-0000-000000000507','00000000-0000-0000-0000-000000000101',@week_start,3,'breakfast','00000000-0000-0000-0000-000000000204','桂花糕',1,0),
('00000000-0000-0000-0000-000000000508','00000000-0000-0000-0000-000000000101',@week_start,3,'lunch',  '00000000-0000-0000-0000-000000000202','番茄炒蛋',3,0),
('00000000-0000-0000-0000-000000000509','00000000-0000-0000-0000-000000000101',@week_start,3,'dinner', '00000000-0000-0000-0000-000000000203','清炒西兰花',2,0),
('00000000-0000-0000-0000-000000000510','00000000-0000-0000-0000-000000000101',@week_start,4,'breakfast',NULL,'待定',0,0),
('00000000-0000-0000-0000-000000000511','00000000-0000-0000-0000-000000000101',@week_start,4,'lunch',  '00000000-0000-0000-0000-000000000201','红烧牛肉面',2,1),
('00000000-0000-0000-0000-000000000512','00000000-0000-0000-0000-000000000101',@week_start,4,'dinner', '00000000-0000-0000-0000-000000000202','番茄炒蛋',1,0),
('00000000-0000-0000-0000-000000000513','00000000-0000-0000-0000-000000000101',@week_start,5,'breakfast','00000000-0000-0000-0000-000000000204','桂花糕',2,0),
('00000000-0000-0000-0000-000000000514','00000000-0000-0000-0000-000000000101',@week_start,5,'lunch',  '00000000-0000-0000-0000-000000000203','清炒西兰花',1,0),
('00000000-0000-0000-0000-000000000515','00000000-0000-0000-0000-000000000101',@week_start,5,'dinner', '00000000-0000-0000-0000-000000000201','红烧牛肉面',3,0),
('00000000-0000-0000-0000-000000000516','00000000-0000-0000-0000-000000000101',@week_start,6,'breakfast',NULL,'待定',0,0),
('00000000-0000-0000-0000-000000000517','00000000-0000-0000-0000-000000000101',@week_start,6,'lunch',  '00000000-0000-0000-0000-000000000202','番茄炒蛋',2,0),
('00000000-0000-0000-0000-000000000518','00000000-0000-0000-0000-000000000101',@week_start,6,'dinner', '00000000-0000-0000-0000-000000000203','清炒西兰花',1,0),
('00000000-0000-0000-0000-000000000519','00000000-0000-0000-0000-000000000101',@week_start,7,'breakfast','00000000-0000-0000-0000-000000000204','桂花糕',2,0),
('00000000-0000-0000-0000-000000000520','00000000-0000-0000-0000-000000000101',@week_start,7,'lunch',  '00000000-0000-0000-0000-000000000201','红烧牛肉面',3,0),
('00000000-0000-0000-0000-000000000521','00000000-0000-0000-0000-000000000101',@week_start,7,'dinner', '00000000-0000-0000-0000-000000000202','番茄炒蛋',2,1);

-- ---------- shopping_items 购物清单(7，蔬菜/肉类/水产/调料/干货 品类齐全) ----------
INSERT INTO `shopping_items` (`id`,`familyId`,`name`,`category`,`quantity`,`checked`,`checkedBy`,`checkedAt`,`sort`) VALUES
('00000000-0000-0000-0000-000000000601','00000000-0000-0000-0000-000000000101','牛腩','肉类','300g',0,NULL,NULL,1),
('00000000-0000-0000-0000-000000000602','00000000-0000-0000-0000-000000000101','番茄','蔬菜','5个',0,NULL,NULL,2),
('00000000-0000-0000-0000-000000000603','00000000-0000-0000-0000-000000000101','西兰花','蔬菜','2颗',0,NULL,NULL,3),
('00000000-0000-0000-0000-000000000604','00000000-0000-0000-0000-000000000101','鲈鱼','水产','1条',1,'00000000-0000-0000-0000-000000000002',NOW() - INTERVAL 1 DAY,4),
('00000000-0000-0000-0000-000000000605','00000000-0000-0000-0000-000000000101','生抽','调料','1瓶',0,NULL,NULL,5),
('00000000-0000-0000-0000-000000000606','00000000-0000-0000-0000-000000000101','八角','调料','1包',0,NULL,NULL,6),
('00000000-0000-0000-0000-000000000607','00000000-0000-0000-0000-000000000101','干桂花','干货','50g',0,NULL,NULL,7);

-- ---------- achievements 成就定义(6) ----------
INSERT INTO `achievements` (`id`,`code`,`name`,`description`,`icon`,`type`,`condition`,`expReward`) VALUES
('00000000-0000-0000-0000-000000000701','first_record','美食初体验','记录第一道美食，开启味记之旅','utensils','record','{"recordCount":1}',50),
('00000000-0000-0000-0000-000000000702','streak_7','一周全勤','连续打卡7天，养成记录习惯','flame','streak','{"streakDays":7}',200),
('00000000-0000-0000-0000-000000000703','streak_30','月度达人','连续打卡30天，月度全勤','trophy','streak','{"streakDays":30}',500),
('00000000-0000-0000-0000-000000000704','record_100','百道美食家','记录满100道美食，资深吃货','medal','record','{"recordCount":100}',1000),
('00000000-0000-0000-0000-000000000705','cuisine_10','菜系探险家','尝试10种以上菜系，味觉探索者','compass','variety','{"cuisineCount":10}',500),
('00000000-0000-0000-0000-000000000706','family_create','家的味道','创建第一个家庭组，开启协作','users','family','{"familyCreated":true}',100);

-- ---------- user_achievements 用户成就(2，demo 解锁 first_record + streak_7) ----------
INSERT INTO `user_achievements` (`id`,`userId`,`achievementId`,`earnedAt`) VALUES
('00000000-0000-0000-0000-000000000801','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000701',NOW() - INTERVAL 6 DAY),
('00000000-0000-0000-0000-000000000802','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000702',NOW());

-- ---------- check_ins 打卡(7，demo 最近7天，含1次补签) ----------
INSERT INTO `check_ins` (`id`,`userId`,`checkDate`,`recordCount`,`isReplenish`) VALUES
('00000000-0000-0000-0000-000000000901','00000000-0000-0000-0000-000000000001',CURDATE() - INTERVAL 6 DAY,1,1),
('00000000-0000-0000-0000-000000000902','00000000-0000-0000-0000-000000000001',CURDATE() - INTERVAL 5 DAY,1,0),
('00000000-0000-0000-0000-000000000903','00000000-0000-0000-0000-000000000001',CURDATE() - INTERVAL 4 DAY,1,0),
('00000000-0000-0000-0000-000000000904','00000000-0000-0000-0000-000000000001',CURDATE() - INTERVAL 3 DAY,2,0),
('00000000-0000-0000-0000-000000000905','00000000-0000-0000-0000-000000000001',CURDATE() - INTERVAL 2 DAY,1,0),
('00000000-0000-0000-0000-000000000906','00000000-0000-0000-0000-000000000001',CURDATE() - INTERVAL 1 DAY,1,0),
('00000000-0000-0000-0000-000000000907','00000000-0000-0000-0000-000000000001',CURDATE(),1,0);

-- ---------- challenges 挑战赛(3) ----------
INSERT INTO `challenges` (`id`,`title`,`description`,`rules`,`startDate`,`endDate`,`badgeCode`,`isActive`) VALUES
('00000000-0000-0000-0000-000000000a01','夏日轻食挑战','30天内记录10道低卡轻食，健康过夏','{"type":"record_count","target":10,"maxCalories":300,"category":"light"}',CURDATE(),CURDATE() + INTERVAL 30 DAY,'summer_light_eater',1),
('00000000-0000-0000-0000-000000000a02','家庭菜谱大赏','与家人共创5道家庭菜谱，传承家的味道','{"type":"family_recipe","target":5,"requireFamily":true}',CURDATE() - INTERVAL 7 DAY,CURDATE() + INTERVAL 23 DAY,'family_recipe_master',1),
('00000000-0000-0000-0000-000000000a03','连续打卡30天','坚持每日打卡30天，养成记录习惯','{"type":"streak","target":30}',CURDATE() - INTERVAL 10 DAY,CURDATE() + INTERVAL 20 DAY,'streak_30_master',0);

-- ============================================================
-- 初始化完成
-- ============================================================
