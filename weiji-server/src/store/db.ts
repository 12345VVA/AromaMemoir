// 内存数据存储层 + 种子数据
// 预填充与设计稿一致的种子数据，保证前端首次启动即可看到完整数据
// 实体字段参考 /workspace/MVP开发速查手册.md 第 2.2 节
//
// 存储驱动（production-readiness-backend Task 5）：
// - driver=memory（默认）：12 个实体走 InMemoryRepository + 种子数据
// - driver=mysql：12 个实体走 MysqlRepository 直接读写数据库（init.sql 自带种子，代码层不注入）
//   pokedexCatalog / personalityTypes（无 id 的裸数组）与 blindGuessRounds / record_likes /
//   record_comments（不在 init.sql 12 表内）在任何驱动下均保持内存实现。

import bcrypt from 'bcryptjs';
import { appConfig } from '../configuration';
import { InMemoryRepository } from './in-memory-repository';
import { MysqlRepository } from './mysql-repository';
import type { Repository } from './repository';
import type {
  User,
  Family,
  FamilyMember,
  FamilyRecipe,
  Invitation,
  Record,
  WeeklyMenuItem,
  ShoppingItem,
  AchievementDef,
  UserAchievement,
  CheckIn,
  Challenge,
  MealType,
  ShoppingCategory,
  PokedexCatalogEntry,
  PersonalityTypeDef,
  BlindGuessRound,
  RecordLike,
  RecordComment,
} from './types';

// ============================================================
// 存储驱动工厂
// ============================================================

const isMysql = appConfig.storage.driver === 'mysql';

// 工厂：根据驱动选择 Repository 实现
// - memory 模式：InMemoryRepository + 种子数据
// - mysql 模式：MysqlRepository 直接读写数据库（不注入种子，由 init.sql 提供）
//   Repository 接口已统一为 async，MysqlRepository 与 InMemoryRepository 均 implements Repository<T>，
//   故 mysql 分支可直接返回 MysqlRepository 实例，无需类型桥接。
function createRepo<T extends { id: string }>(
  tableName: string,
  jsonFields: string[],
  softDelete: boolean,
  seed: T[],
): Repository<T> {
  if (isMysql) {
    return new MysqlRepository<T>(tableName, jsonFields, softDelete);
  }
  return new InMemoryRepository<T>(seed);
}

// ============================================================
// 工具函数：日期计算
// ============================================================

const NOW = new Date();
const ISO_NOW = NOW.toISOString();

// 返回今天的 YYYY-MM-DD
function todayStr(): string {
  return NOW.toISOString().split('T')[0];
}

// 返回 N 天前的 YYYY-MM-DD（用于 recordDate / checkDate）
function daysAgo(n: number): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

// 返回 N 天前的 ISO 字符串（用于 earnedAt 等精确时间戳）
function daysAgoIso(n: number): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

// 返回 N 天后的 ISO 字符串（用于 invitation.expiresAt 等）
function daysFromNow(n: number): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

// 返回本周一日期 YYYY-MM-DD（用于 weekly_menu.weekStart）
// 周日视为上周最后一天
function thisMonday(): string {
  const d = new Date(NOW);
  const day = d.getDay(); // 0=Sunday, 1=Monday...
  const diff = day === 0 ? -6 : 1 - day; // 回到本周一
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

// ============================================================
// 用户密码：所有 demo 用户密码统一为 "123456"，使用 bcrypt 哈希
// 启动时动态生成（避免硬编码哈希值）
// ============================================================
const PASSWORD_HASH = bcrypt.hashSync('123456', 10);

// ============================================================
// 种子数据：users
// 4 名用户：demo + 妈妈 + 爸爸 + 奶奶
// demo 用户昵称"小明"，为家庭组 owner
// ============================================================
const usersSeed: User[] = [
  {
    id: 'user-demo-0001',
    username: 'demo',
    password: PASSWORD_HASH,
    nickname: '小明',
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=demo',
    email: 'demo@weiji.com',
    phone: '13800000001',
    createdAt: ISO_NOW,
    updatedAt: ISO_NOW,
  },
  {
    id: 'user-mom-0002',
    username: 'mom',
    password: PASSWORD_HASH,
    nickname: '妈妈',
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=mom',
    email: 'mom@weiji.com',
    phone: '13800000002',
    createdAt: ISO_NOW,
    updatedAt: ISO_NOW,
  },
  {
    id: 'user-dad-0003',
    username: 'dad',
    password: PASSWORD_HASH,
    nickname: '爸爸',
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=dad',
    email: 'dad@weiji.com',
    phone: '13800000003',
    createdAt: ISO_NOW,
    updatedAt: ISO_NOW,
  },
  {
    id: 'user-grandma-0004',
    username: 'grandma',
    password: PASSWORD_HASH,
    nickname: '奶奶',
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=grandma',
    email: 'grandma@weiji.com',
    phone: '13800000004',
    createdAt: ISO_NOW,
    updatedAt: ISO_NOW,
  },
];
export const users = createRepo<User>('users', [], false, usersSeed);

// ============================================================
// 种子数据：families
// 1 个家庭组："王家厨房"，demo 用户为 owner，4 名成员
// ============================================================
const familiesSeed: Family[] = [
  {
    id: 'family-0001',
    name: '王家厨房',
    ownerId: 'user-demo-0001',
    memberCount: 4,
    inviteCode: 'WJ1234',
    isDeleted: false,
    createdAt: ISO_NOW,
    updatedAt: ISO_NOW,
  },
];
export const families = createRepo<Family>('families', [], true, familiesSeed);

// ============================================================
// 种子数据：family_members
// 4 条记录：demo(owner) + 妈妈(admin) + 爸爸(member) + 奶奶(member)
// ============================================================
const family_membersSeed: FamilyMember[] = [
  {
    id: 'fm-0001',
    familyId: 'family-0001',
    userId: 'user-demo-0001',
    role: 'owner',
    joinedAt: ISO_NOW,
  },
  {
    id: 'fm-0002',
    familyId: 'family-0001',
    userId: 'user-mom-0002',
    role: 'admin',
    joinedAt: ISO_NOW,
  },
  {
    id: 'fm-0003',
    familyId: 'family-0001',
    userId: 'user-dad-0003',
    role: 'member',
    joinedAt: ISO_NOW,
  },
  {
    id: 'fm-0004',
    familyId: 'family-0001',
    userId: 'user-grandma-0004',
    role: 'member',
    joinedAt: ISO_NOW,
  },
];
export const family_members = createRepo<FamilyMember>('family_members', [], false, family_membersSeed);

// ============================================================
// 种子数据：family_recipes
// 4 道菜谱：红烧牛肉面、番茄炒蛋、清炒西兰花、桂花糕
// 3 道 family 可见，1 道 private（桂花糕）
// coverUrl 使用 /workspace/weiji-web/assets/ 下的图片 URL
// ============================================================
const family_recipesSeed: FamilyRecipe[] = [
  {
    id: 'recipe-0001',
    familyId: 'family-0001',
    name: '红烧牛肉面',
    category: '面食',
    ingredients: [
      { name: '牛腩', amount: '500', unit: 'g' },
      { name: '面条', amount: '300', unit: 'g' },
      { name: '生姜', amount: '20', unit: 'g' },
      { name: '大葱', amount: '1', unit: '根' },
      { name: '八角', amount: '2', unit: '颗' },
    ],
    steps: [
      { stepNum: 1, text: '牛腩切块焯水去血沫，捞出备用' },
      { stepNum: 2, text: '热锅下油，爆香葱姜八角' },
      { stepNum: 3, text: '加入牛腩翻炒上色，淋酱油、料酒' },
      { stepNum: 4, text: '加水没过牛腩，小火炖煮 90 分钟至软烂' },
      { stepNum: 5, text: '另起锅煮面，盛入碗中浇上牛肉汤和牛肉块' },
    ],
    coverUrl: 'assets/food-hongshaorou.jpg',
    difficulty: '中等',
    cookTime: 120,
    uploaderId: 'user-demo-0001',
    visibility: 'family',
    versionCount: 1,
    isDeleted: false,
    createdAt: ISO_NOW,
    updatedAt: ISO_NOW,
  },
  {
    id: 'recipe-0002',
    familyId: 'family-0001',
    name: '番茄炒蛋',
    category: '家常菜',
    ingredients: [
      { name: '番茄', amount: '2', unit: '个' },
      { name: '鸡蛋', amount: '3', unit: '个' },
      { name: '盐', amount: '3', unit: 'g' },
      { name: '白糖', amount: '5', unit: 'g' },
    ],
    steps: [
      { stepNum: 1, text: '番茄顶部划十字，烫水去皮切块' },
      { stepNum: 2, text: '鸡蛋打散，热锅下油炒至半熟盛出' },
      { stepNum: 3, text: '下番茄炒出汁水，加盐糖调味' },
      { stepNum: 4, text: '倒回鸡蛋翻炒均匀即可出锅' },
    ],
    coverUrl: 'assets/food-tomato-noodle.jpg',
    difficulty: '简单',
    cookTime: 15,
    uploaderId: 'user-mom-0002',
    visibility: 'family',
    versionCount: 1,
    isDeleted: false,
    createdAt: ISO_NOW,
    updatedAt: ISO_NOW,
  },
  {
    id: 'recipe-0003',
    familyId: 'family-0001',
    name: '清炒西兰花',
    category: '家常菜',
    ingredients: [
      { name: '西兰花', amount: '1', unit: '颗' },
      { name: '蒜', amount: '3', unit: '瓣' },
      { name: '盐', amount: '2', unit: 'g' },
      { name: '食用油', amount: '15', unit: 'ml' },
    ],
    steps: [
      { stepNum: 1, text: '西兰花掰小朵，淡盐水浸泡 10 分钟' },
      { stepNum: 2, text: '沸水焯水 30 秒捞出过冷水' },
      { stepNum: 3, text: '热锅下油，爆香蒜片' },
      { stepNum: 4, text: '下西兰花大火翻炒 2 分钟，加盐出锅' },
    ],
    coverUrl: 'assets/recipe-broccoli.jpg',
    difficulty: '简单',
    cookTime: 10,
    uploaderId: 'user-dad-0003',
    visibility: 'family',
    versionCount: 1,
    isDeleted: false,
    createdAt: ISO_NOW,
    updatedAt: ISO_NOW,
  },
  {
    id: 'recipe-0004',
    familyId: 'family-0001',
    name: '桂花糕',
    category: '烘焙',
    ingredients: [
      { name: '糯米粉', amount: '200', unit: 'g' },
      { name: '干桂花', amount: '30', unit: 'g' },
      { name: '白糖', amount: '50', unit: 'g' },
      { name: '清水', amount: '150', unit: 'ml' },
    ],
    steps: [
      { stepNum: 1, text: '糯米粉加糖水调成糊状' },
      { stepNum: 2, text: '拌入干桂花搅匀' },
      { stepNum: 3, text: '倒入模具上锅蒸 30 分钟' },
      { stepNum: 4, text: '冷却后切块装盘' },
    ],
    coverUrl: 'assets/recipe-guihua-gao.jpg',
    difficulty: '中等',
    cookTime: 45,
    uploaderId: 'user-grandma-0004',
    visibility: 'private',
    versionCount: 1,
    isDeleted: false,
    createdAt: ISO_NOW,
    updatedAt: ISO_NOW,
  },
];
export const family_recipes = createRepo<FamilyRecipe>('family_recipes', ['ingredients', 'steps'], true, family_recipesSeed);

// ============================================================
// 种子数据：invitations
// 1 条有效邀请码：WJ1234，24 小时后过期
// ============================================================
const invitationsSeed: Invitation[] = [
  {
    id: 'inv-0001',
    code: 'WJ1234',
    familyId: 'family-0001',
    createdBy: 'user-demo-0001',
    expiresAt: daysFromNow(1), // 24 小时后
    used: false,
    createdAt: ISO_NOW,
  },
];
export const invitations = createRepo<Invitation>('invitations', [], false, invitationsSeed);

// ============================================================
// 种子数据：records
// 3 条美食记录（demo 用户的）
// ============================================================
const recordsSeed: Record[] = [
  {
    id: 'record-0001',
    userId: 'user-demo-0001',
    dishName: '红烧牛肉面',
    cookingMethod: '炖',
    rating: 5,
    note: '家的味道，妈妈做的最好吃',
    aiConfidence: 0.96,
    nutrition: { calories: 520, protein: 28.5, fat: 18.2, carbs: 62.0 },
    ingredients: [
      { name: '牛肉', confidence: 0.95 },
      { name: '面条', confidence: 0.92 },
      { name: '青菜', confidence: 0.88 },
    ],
    tags: ['家的味道', '值得复刻'],
    mealType: '午餐',
    recordDate: daysAgo(0),
    imageUrl: 'assets/food-hongshaorou.jpg',
    beautifiedUrl: 'assets/food-hongshaorou.jpg',
    source: 'camera',
    isDeleted: false,
    createdAt: ISO_NOW,
    updatedAt: ISO_NOW,
  },
  {
    id: 'record-0002',
    userId: 'user-demo-0001',
    dishName: '番茄炒蛋',
    cookingMethod: '炒',
    rating: 4,
    note: '简单快手，下饭神器',
    aiConfidence: 0.93,
    nutrition: { calories: 280, protein: 12.0, fat: 18.0, carbs: 15.0 },
    ingredients: [
      { name: '番茄', confidence: 0.97 },
      { name: '鸡蛋', confidence: 0.95 },
    ],
    tags: ['快手菜', '下饭神器'],
    mealType: '晚餐',
    recordDate: daysAgo(1),
    imageUrl: 'assets/food-tomato-noodle.jpg',
    beautifiedUrl: 'assets/food-tomato-noodle.jpg',
    source: 'camera',
    isDeleted: false,
    createdAt: ISO_NOW,
    updatedAt: ISO_NOW,
  },
  {
    id: 'record-0003',
    userId: 'user-demo-0001',
    dishName: '清炒西兰花',
    cookingMethod: '炒',
    rating: 4,
    note: '健康轻食，健身党友好',
    aiConfidence: 0.9,
    nutrition: { calories: 120, protein: 6.0, fat: 5.0, carbs: 12.0 },
    ingredients: [{ name: '西兰花', confidence: 0.96 }],
    tags: ['健康轻食'],
    mealType: '午餐',
    recordDate: daysAgo(2),
    imageUrl: 'assets/recipe-broccoli.jpg',
    beautifiedUrl: 'assets/recipe-broccoli.jpg',
    source: 'gallery',
    isDeleted: false,
    createdAt: ISO_NOW,
    updatedAt: ISO_NOW,
  },
];
export const records = createRepo<Record>('records', ['nutrition', 'ingredients', 'tags'], true, recordsSeed);

// ============================================================
// 种子数据：weekly_menu
// 7天 × 3餐 = 21 条
// weekStart 为本周一日期；按天/餐次预填充，循环使用 4 道菜谱
// ============================================================
const MONDAY = thisMonday();
const RECIPE_POOL = [
  { id: 'recipe-0001', name: '红烧牛肉面' },
  { id: 'recipe-0002', name: '番茄炒蛋' },
  { id: 'recipe-0003', name: '清炒西兰花' },
  { id: 'recipe-0004', name: '桂花糕' },
];

interface WeekRecipeSeed {
  day: number;
  meal: MealType;
  recipeId: string;
  recipeName: string;
}

const WEEK_RECIPES: WeekRecipeSeed[] = [];
const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner'];
for (let day = 1; day <= 7; day++) {
  MEAL_TYPES.forEach((meal, idx) => {
    // 按 day * 3 + idx 在 4 道菜谱中循环挑选（注意括号保证模运算作用于整个索引）
    const recipe = RECIPE_POOL[((day - 1) * 3 + idx + day) % RECIPE_POOL.length];
    WEEK_RECIPES.push({ day, meal, recipeId: recipe.id, recipeName: recipe.name });
  });
}

const weekly_menuSeed: WeeklyMenuItem[] = WEEK_RECIPES.map((item, i) => ({
  id: `menu-${String(i + 1).padStart(4, '0')}`,
  familyId: 'family-0001',
  weekStart: MONDAY,
  dayOfWeek: item.day,
  mealType: item.meal,
  recipeId: item.recipeId,
  recipeName: item.recipeName,
  votes: { likes: 0, dislikes: 0 },
}));
export const weekly_menu = createRepo<WeeklyMenuItem>('weekly_menu', ['votes'], false, weekly_menuSeed);

// ============================================================
// 种子数据：shopping_items
// 7 条，按品类分组（蔬菜/肉类/水产/调料/乳制品）
// 2 条已勾选（演示效果）
// ============================================================
const SHOP_BASE: Array<{
  name: string;
  category: ShoppingCategory;
  quantity: string;
  checked: boolean;
  checkedBy?: string;
  sort: number;
}> = [
  // 蔬菜
  { name: '番茄', category: '蔬菜', quantity: '500g', checked: false, sort: 1 },
  { name: '西兰花', category: '蔬菜', quantity: '2颗', checked: false, sort: 2 },
  // 肉类
  { name: '牛腩', category: '肉类', quantity: '500g', checked: true, checkedBy: 'user-mom-0002', sort: 3 },
  // 水产
  { name: '鲈鱼', category: '水产', quantity: '1条', checked: false, sort: 4 },
  // 调料
  { name: '生抽', category: '调料', quantity: '1瓶', checked: false, sort: 5 },
  { name: '白糖', category: '调料', quantity: '500g', checked: false, sort: 6 },
  // 乳制品
  { name: '牛奶', category: '乳制品', quantity: '1L', checked: true, checkedBy: 'user-dad-0003', sort: 7 },
];

const shopping_itemsSeed: ShoppingItem[] = SHOP_BASE.map((item, i) => ({
  id: `shop-${String(i + 1).padStart(4, '0')}`,
  familyId: 'family-0001',
  name: item.name,
  category: item.category,
  quantity: item.quantity,
  checked: item.checked,
  checkedBy: item.checkedBy,
  checkedAt: item.checked ? ISO_NOW : undefined,
  sort: item.sort,
  createdAt: ISO_NOW,
  updatedAt: ISO_NOW,
}));
export const shopping_items = createRepo<ShoppingItem>('shopping_items', [], false, shopping_itemsSeed);

// ============================================================
// 种子数据：achievements
// 6 枚徽章（与 MVP 速查手册表 2.2 一致）
// ============================================================
const achievementsSeed: AchievementDef[] = [
  {
    id: 'ach-0001',
    code: 'first_record',
    name: '美食初体验',
    description: '记录你的第一道美食',
    icon: '🌱',
    type: 'record',
    condition: { recordCount: 1 },
    expReward: 50,
  },
  {
    id: 'ach-0002',
    code: 'streak_7',
    name: '一周全勤',
    description: '连续打卡 7 天',
    icon: '🔥',
    type: 'streak',
    condition: { streakDays: 7 },
    expReward: 200,
  },
  {
    id: 'ach-0003',
    code: 'streak_30',
    name: '月度达人',
    description: '连续打卡 30 天',
    icon: '🏆',
    type: 'streak',
    condition: { streakDays: 30 },
    expReward: 500,
  },
  {
    id: 'ach-0004',
    code: 'record_100',
    name: '百道美食家',
    description: '记录 100 道美食',
    icon: '🍱',
    type: 'record',
    condition: { recordCount: 100 },
    expReward: 1000,
  },
  {
    id: 'ach-0005',
    code: 'cuisine_10',
    name: '菜系探险家',
    description: '尝试 10 种不同菜系',
    icon: '🌍',
    type: 'variety',
    condition: { cuisineCount: 10 },
    expReward: 500,
  },
  {
    id: 'ach-0006',
    code: 'family_create',
    name: '家的味道',
    description: '创建你的第一个家庭组',
    icon: '👨‍👩‍👧',
    type: 'family',
    condition: { familyCreated: true },
    expReward: 100,
  },
];
export const achievements = createRepo<AchievementDef>('achievements', ['condition'], false, achievementsSeed);

// ============================================================
// 种子数据：user_achievements
// 2 条：demo 用户已解锁 first_record 和 streak_7
// ============================================================
const user_achievementsSeed: UserAchievement[] = [
  {
    id: 'ua-0001',
    userId: 'user-demo-0001',
    achievementId: 'ach-0001',
    earnedAt: daysAgoIso(7),
  },
  {
    id: 'ua-0002',
    userId: 'user-demo-0001',
    achievementId: 'ach-0002',
    earnedAt: daysAgoIso(1),
  },
];
export const user_achievements = createRepo<UserAchievement>('user_achievements', [], false, user_achievementsSeed);

// ============================================================
// 种子数据：check_ins
// 演示账号最近 7 天的打卡记录（7 条），用于连续天数计算
// ============================================================
const check_insSeed: CheckIn[] = [];
const DEMO_CHECKIN_COUNTS = [1, 2, 1, 3, 2, 1, 1]; // 固定值，避免随机性带来的不可重现
for (let i = 6; i >= 0; i--) {
  const seq = 7 - i; // 1..7
  check_insSeed.push({
    id: `ci-${String(seq).padStart(4, '0')}`,
    userId: 'user-demo-0001',
    checkDate: daysAgo(i),
    recordCount: DEMO_CHECKIN_COUNTS[seq - 1],
    isReplenish: false,
    createdAt: daysAgoIso(i),
  });
}
export const check_ins = createRepo<CheckIn>('check_ins', [], false, check_insSeed);

// ============================================================
// 种子数据：challenges
// 3 个挑战：一周素食挑战 / 环球美食月 / 家庭厨艺大赛
// ============================================================
const challengesSeed: Challenge[] = [
  {
    id: 'chal-0001',
    title: '一周素食挑战',
    description: '连续 7 天只记录素食美食，体验清新生活',
    rules: {
      description: '7 天内每天至少记录 1 道素食菜品',
      duration: '7 天',
      goal: '记录 7 道素食',
      reward: '解锁素食徽章 + 200 经验值',
    },
    startDate: daysAgo(3),
    endDate: daysFromNow(4).split('T')[0],
    badgeCode: 'veg_week',
    isActive: true,
    createdAt: ISO_NOW,
  },
  {
    id: 'chal-0002',
    title: '环球美食月',
    description: '一个月内挑战 8 国菜系，开启味蕾环球之旅',
    rules: {
      description: '30 天内记录 8 种不同国家菜系',
      duration: '30 天',
      goal: '记录 8 国菜系',
      reward: '解锁环球徽章 + 500 经验值',
    },
    startDate: daysAgo(10),
    endDate: daysFromNow(20).split('T')[0],
    badgeCode: 'global_food',
    isActive: true,
    createdAt: ISO_NOW,
  },
  {
    id: 'chal-0003',
    title: '家庭厨艺大赛',
    description: '全家一起参与，本周累计记录 20 道家庭菜',
    rules: {
      description: '7 天内家庭成员累计记录 20 道菜',
      duration: '7 天',
      goal: '家庭累计 20 道菜',
      reward: '解锁家庭徽章 + 300 经验值',
    },
    startDate: daysAgo(2),
    endDate: daysFromNow(5).split('T')[0],
    badgeCode: 'family_chef',
    isActive: true,
    createdAt: ISO_NOW,
  },
];
export const challenges = createRepo<Challenge>('challenges', ['rules'], false, challengesSeed);

// ============================================================
// 种子数据：pokedexCatalog（美食图鉴全量目录）
// 覆盖 6 个菜系分类，每个分类 5-7 道菜，含稀有度等级
// 这些是"图鉴全部格子"，与用户是否记录过无关；运行时由 aggregatePokedex 与用户记录交叉对比
// 稀有度分布约 60% common / 25% rare / 10% epic / 5% legendary
// ============================================================
const pokedexCatalogSeed: PokedexCatalogEntry[] = [
  // 家常菜（6 道）
  { dishName: '番茄炒蛋', category: '家常菜', rarity: 'common' },
  { dishName: '红烧肉', category: '家常菜', rarity: 'common' },
  { dishName: '清炒西兰花', category: '家常菜', rarity: 'common' },
  { dishName: '蒸蛋羹', category: '家常菜', rarity: 'common' },
  { dishName: '糖醋里脊', category: '家常菜', rarity: 'rare' },
  { dishName: '板栗烧鸡', category: '家常菜', rarity: 'rare' },
  { dishName: '八宝鸭', category: '家常菜', rarity: 'epic' },
  // 川菜（6 道）
  { dishName: '麻婆豆腐', category: '川菜', rarity: 'common' },
  { dishName: '宫保鸡丁', category: '川菜', rarity: 'common' },
  { dishName: '回锅肉', category: '川菜', rarity: 'common' },
  { dishName: '辣子鸡', category: '川菜', rarity: 'common' },
  { dishName: '水煮鱼', category: '川菜', rarity: 'rare' },
  { dishName: '夫妻肺片', category: '川菜', rarity: 'rare' },
  // 粤菜（6 道）
  { dishName: '白切鸡', category: '粤菜', rarity: 'common' },
  { dishName: '蒸排骨', category: '粤菜', rarity: 'common' },
  { dishName: '叉烧', category: '粤菜', rarity: 'common' },
  { dishName: '虾饺', category: '粤菜', rarity: 'rare' },
  { dishName: '烧鹅', category: '粤菜', rarity: 'rare' },
  { dishName: '老火靓汤', category: '粤菜', rarity: 'epic' },
  // 面食（6 道）
  { dishName: '红烧牛肉面', category: '面食', rarity: 'common' },
  { dishName: '阳春面', category: '面食', rarity: 'common' },
  { dishName: '担担面', category: '面食', rarity: 'common' },
  { dishName: '兰州拉面', category: '面食', rarity: 'rare' },
  { dishName: '重庆小面', category: '面食', rarity: 'rare' },
  { dishName: '意大利面', category: '面食', rarity: 'epic' },
  // 烘焙（6 道）
  { dishName: '桂花糕', category: '烘焙', rarity: 'common' },
  { dishName: '戚风蛋糕', category: '烘焙', rarity: 'common' },
  { dishName: '曲奇饼干', category: '烘焙', rarity: 'common' },
  { dishName: '蛋挞', category: '烘焙', rarity: 'rare' },
  { dishName: '法棍面包', category: '烘焙', rarity: 'rare' },
  { dishName: '马卡龙', category: '烘焙', rarity: 'legendary' },
  // 日料（6 道）
  { dishName: '寿司', category: '日料', rarity: 'common' },
  { dishName: '刺身', category: '日料', rarity: 'common' },
  { dishName: '天妇罗', category: '日料', rarity: 'common' },
  { dishName: '日式拉面', category: '日料', rarity: 'common' },
  { dishName: '寿喜烧', category: '日料', rarity: 'rare' },
  { dishName: '怀石料理', category: '日料', rarity: 'legendary' },
];
// 注：pokedexCatalog / personalityTypes 为无 id 的目录/映射表数据，
// 不符合 Repository<T extends { id: string }> 约束，保持裸数组导出（与 spec Task 5 列出的 12 个实体一致）
export const pokedexCatalog: PokedexCatalogEntry[] = pokedexCatalogSeed;

// ============================================================
// 种子数据：personalityTypes（人格类型映射表）
// 8 种美食人格，含 code/name/description/traits[]/shareText
// shareText 为预格式化的社交分享文案；buildPersonalityReport 也可使用模板动态生成
// ============================================================
const personalityTypesSeed: PersonalityTypeDef[] = [
  {
    code: 'carb_lover',
    name: '碳水爱好者',
    description: '你是碳水的忠实粉丝，每一口米饭与面条都是幸福的味道',
    traits: ['米饭党', '面条控', '能量满载'],
    shareText: '我是「碳水爱好者」——你是碳水的忠实粉丝，每一口米饭与面条都是幸福的味道。来味记测测你的美食人格！',
  },
  {
    code: 'spice_explorer',
    name: '辣味探险家',
    description: '无辣不欢的你，用每一次舌尖的刺激探索美食的边界',
    traits: ['无辣不欢', '重口偏好', '味蕾冒险'],
    shareText: '我是「辣味探险家」——无辣不欢的你，用每一次舌尖的刺激探索美食的边界。来味记测测你的美食人格！',
  },
  {
    code: 'health_guru',
    name: '健康达人',
    description: '你追求轻盈与营养的平衡，每一餐都是对身体最好的告白',
    traits: ['轻食主义', '营养均衡', '自律人生'],
    shareText: '我是「健康达人」——你追求轻盈与营养的平衡，每一餐都是对身体最好的告白。来味记测测你的美食人格！',
  },
  {
    code: 'meat_enthusiast',
    name: '肉食主义者',
    description: '肉食是你的信仰，每一块鲜嫩的肉类都是无法抗拒的诱惑',
    traits: ['无肉不欢', '高蛋白', '能量爆炸'],
    shareText: '我是「肉食主义者」——肉食是你的信仰，每一块鲜嫩的肉类都是无法抗拒的诱惑。来味记测测你的美食人格！',
  },
  {
    code: 'sweet_tooth',
    name: '甜品控',
    description: '甜食是你的快乐源泉，每一口甜品都是治愈心灵的良药',
    traits: ['甜品爱好', '甜味至上', '快乐源泉'],
    shareText: '我是「甜品控」——甜食是你的快乐源泉，每一口甜品都是治愈心灵的良药。来味记测测你的美食人格！',
  },
  {
    code: 'light_eater',
    name: '清淡派',
    description: '你崇尚清淡饮食，用最简单的烹饪还原食材本真的味道',
    traits: ['清淡饮食', '少油少盐', '本味追求'],
    shareText: '我是「清淡派」——你崇尚清淡饮食，用最简单的烹饪还原食材本真的味道。来味记测测你的美食人格！',
  },
  {
    code: 'family_chef',
    name: '家庭厨神',
    description: '你是家里的掌勺大厨，用一道道家常菜温暖整个家庭的胃',
    traits: ['家常菜大师', '温暖厨艺', '家的味道'],
    shareText: '我是「家庭厨神」——你是家里的掌勺大厨，用一道道家常菜温暖整个家庭的胃。来味记测测你的美食人格！',
  },
  {
    code: 'adventurer',
    name: '美食冒险家',
    description: '你的味蕾永远在路上，乐于尝试各种风格与新颖的菜品',
    traits: ['多元尝试', '美食探险', '不设边界'],
    shareText: '我是「美食冒险家」——你的味蕾永远在路上，乐于尝试各种风格与新颖的菜品。来味记测测你的美食人格！',
  },
];
export const personalityTypes: PersonalityTypeDef[] = personalityTypesSeed;

// ============================================================
// 种子数据：blindGuessRounds（盲猜轮次内存表）
// 初始为空数组，运行时由控制器动态创建
// ============================================================
export const blindGuessRounds = new InMemoryRepository<BlindGuessRound>([]);

// ============================================================
// 种子数据：record_likes（记录点赞）
// ============================================================
const record_likesSeed: RecordLike[] = [
  {
    id: 'rl-0001',
    recordId: 'rec-0001',
    userId: 'user-demo-0002',
    createdAt: daysAgoIso(2),
  },
  {
    id: 'rl-0002',
    recordId: 'rec-0001',
    userId: 'user-demo-0003',
    createdAt: daysAgoIso(1),
  },
];
export const record_likes = new InMemoryRepository<RecordLike>(record_likesSeed);

// ============================================================
// 种子数据：record_comments（记录评论）
// ============================================================
const record_commentsSeed: RecordComment[] = [
  {
    id: 'rc-0001',
    recordId: 'rec-0001',
    userId: 'user-demo-0002',
    userNickname: '妈妈',
    content: '看起来好好吃！下次回家也做给我尝尝',
    createdAt: daysAgoIso(2),
  },
  {
    id: 'rc-0002',
    recordId: 'rec-0001',
    userId: 'user-demo-0003',
    userNickname: '爸爸',
    content: '记录得很详细，赞一个',
    createdAt: daysAgoIso(1),
  },
];
export const record_comments = new InMemoryRepository<RecordComment>(record_commentsSeed);

// ============================================================
// 启动时打印存储统计（验证可见）
// - memory 模式：打印各仓库种子数据条数（Repository.count 已为 async，db.ts 顶层不能 await，
//   故直接用种子数组的 .length，与内存种子条数等价）
// - mysql 模式：12 个实体走 MysqlRepository，跳过内存统计，仅打印驱动信息
// ============================================================
if (!isMysql) {
  console.log('[store] 种子数据加载完成:');
  console.log(`  - users count: ${usersSeed.length}`);
  console.log(`  - families count: ${familiesSeed.length}`);
  console.log(`  - family_members count: ${family_membersSeed.length}`);
  console.log(`  - family_recipes count: ${family_recipesSeed.length}`);
  console.log(`  - invitations count: ${invitationsSeed.length}`);
  console.log(`  - records count: ${recordsSeed.length}`);
  console.log(`  - weekly_menu count: ${weekly_menuSeed.length}`);
  console.log(`  - shopping_items count: ${shopping_itemsSeed.length}`);
  console.log(`  - achievements count: ${achievementsSeed.length}`);
  console.log(`  - user_achievements count: ${user_achievementsSeed.length}`);
  console.log(`  - check_ins count: ${check_insSeed.length}`);
  console.log(`  - challenges count: ${challengesSeed.length}`);
  console.log(`  - pokedexCatalog count: ${pokedexCatalog.length}`);
  console.log(`  - personalityTypes count: ${personalityTypes.length}`);
  console.log(`  - blindGuessRounds count: 0`);
  console.log(`  - record_likes count: ${record_likesSeed.length}`);
  console.log(`  - record_comments count: ${record_commentsSeed.length}`);
  console.log(`[store] 演示账号：demo / 123456`);
} else {
  const m = appConfig.storage.mysql;
  console.log(
    `[store] 存储驱动：mysql（${m.host}:${m.port}/${m.database}），12 个实体走 MysqlRepository，数据由 db/init.sql 提供`,
  );
  console.log(`[store] pokedexCatalog / personalityTypes / blindGuessRounds / record_likes / record_comments 保持内存实现`);
}
