// 业务实体类型定义
// 参考 MVP开发速查手册.md 第 2.2 节核心表字段清单

// ============================================================
// 通用类型
// ============================================================

// 家庭成员角色
export type UserRole = 'owner' | 'admin' | 'member';

// 菜谱可见性
export type RecipeVisibility = 'family' | 'private';

// 购物清单分类
export type ShoppingCategory = '蔬菜' | '肉类' | '水产' | '调料' | '乳制品' | '干货' | '其他';

// 成就类型
export type AchievementType = 'record' | 'streak' | 'variety' | 'family';

// 餐次类型
export type MealType = 'breakfast' | 'lunch' | 'dinner';

// 投票类型
export type VoteType = 'like' | 'dislike';

// ============================================================
// 用户与家庭
// ============================================================

// 用户实体
export interface User {
  id: string;
  username: string;
  password: string; // bcrypt 哈希
  nickname: string;
  avatar: string;
  email?: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
}

// 家庭组实体
export interface Family {
  id: string;
  name: string;
  ownerId: string;
  memberCount: number;
  inviteCode: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

// 家庭成员实体
export interface FamilyMember {
  id: string;
  familyId: string;
  userId: string;
  role: UserRole;
  joinedAt: string;
}

// 邀请码实体
export interface Invitation {
  id: string;
  code: string;
  familyId: string;
  createdBy: string;
  expiresAt: string;
  used: boolean;
  createdAt: string;
}

// ============================================================
// 家庭菜谱
// ============================================================

// 菜谱食材
export interface RecipeIngredient {
  name: string;
  amount: string;
  unit: string;
}

// 菜谱步骤
export interface RecipeStep {
  stepNum: number;
  text: string;
  imageUrl?: string;
}

// 家庭菜谱实体
export interface FamilyRecipe {
  id: string;
  familyId: string;
  name: string;
  category: string;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  coverUrl: string;
  difficulty: string;
  cookTime: number;
  uploaderId: string;
  visibility: RecipeVisibility;
  versionCount: number;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// 饮食记录
// ============================================================

// 营养信息
export interface Nutrition {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

// 食材（带 AI 识别置信度）
export interface IngredientWithConfidence {
  name: string;
  confidence: number;
}

// 饮食记录实体
export interface Record {
  id: string;
  userId: string;
  dishName: string;
  cookingMethod?: string;
  rating: number;
  note?: string;
  aiConfidence?: number;
  nutrition?: Nutrition;
  ingredients: IngredientWithConfidence[];
  tags: string[];
  mealType?: string;
  recordDate: string;
  imageUrl?: string;
  beautifiedUrl?: string;
  source: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// 协作菜单与购物清单
// ============================================================

// 菜单投票计数
export interface MenuVotes {
  likes: number;
  dislikes: number;
  // userId -> voteType；使用索引签名避免与同文件内 Record 实体接口遮蔽内置 Record<K,V> 工具类型
  voters?: { [key: string]: VoteType };
}

// 周菜单项
export interface WeeklyMenuItem {
  id: string;
  familyId: string;
  weekStart: string; // 本周一日期 YYYY-MM-DD
  dayOfWeek: number; // 1-7
  mealType: MealType;
  recipeId: string;
  recipeName: string;
  votes: MenuVotes;
}

// 购物清单项
export interface ShoppingItem {
  id: string;
  familyId: string;
  name: string;
  category: ShoppingCategory;
  quantity: string;
  checked: boolean;
  checkedBy?: string;
  checkedAt?: string;
  sort: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// 成就、打卡、挑战
// ============================================================

// 成就定义实体
export interface AchievementDef {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  type: AchievementType;
  // 使用索引签名避免与同文件内 Record 实体接口遮蔽内置 Record<K,V> 工具类型
  condition: { [key: string]: unknown };
  expReward: number;
}

// 用户成就记录
export interface UserAchievement {
  id: string;
  userId: string;
  achievementId: string;
  earnedAt: string;
}

// 打卡记录
export interface CheckIn {
  id: string;
  userId: string;
  checkDate: string; // YYYY-MM-DD
  recordCount: number;
  isReplenish: boolean;
  createdAt: string;
}

// 挑战赛规则
export interface ChallengeRules {
  description: string;
  duration: string;
  goal: string;
  reward: string;
}

// 挑战赛实体
export interface Challenge {
  id: string;
  title: string;
  description: string;
  rules: ChallengeRules;
  startDate: string;
  endDate: string;
  badgeCode: string;
  isActive: boolean;
  createdAt: string;
}

// ============================================================
// 娱乐化玩法扩展（F27-F30）
// ============================================================

// 稀有度等级
export type PokedexRarity = 'common' | 'rare' | 'epic' | 'legendary';

// 美食图鉴条目
export interface PokedexItem {
  dishName: string;
  category: string;          // 菜系/食材/地域分类
  rarity: PokedexRarity;
  unlocked: boolean;
  firstRecordedAt: string | null;
  recordCount: number;
}

// 美食图鉴汇总
export interface PokedexSummary {
  totalSlots: number;
  unlockedSlots: number;
  completionRate: number;   // 0-1
  categories: Array<{
    category: string;
    totalSlots: number;
    unlockedSlots: number;
    items: PokedexItem[];
  }>;
}

// 人格报告
export interface PersonalityReport {
  available: boolean;
  personalityType: string | null;
  description: string;
  traits: string[];
  shareText: string;
  coverImage: string;
  recordCount: number;
}

// 时光机回忆条目
export interface TimemachineMemory {
  year: number;
  date: string;             // YYYY-MM-DD
  records: Record[];        // 复用已有 Record 类型
  coverImage: string;
  caption: string;
}

// 时光机结果
export interface TimemachineResult {
  memories: TimemachineMemory[];
  todayDate: string;
}

// 盲猜轮次状态
export type BlindGuessRoundStatus = 'active' | 'revealed';

// 盲猜轮次条目（一条家庭菜谱记录 + 真实作者信息）
export interface BlindGuessItem {
  recordId: string;
  recipeId: string;
  dishName: string;
  coverUrl: string;
  realAuthorId: string;
  realAuthorName: string;
}

// 盲猜轮次
export interface BlindGuessRound {
  id: string;
  familyId: string;
  roundName: string;
  creatorId: string;
  items: BlindGuessItem[];
  guesses: BlindGuessGuess[];   // 所有成员的猜测
  status: BlindGuessRoundStatus;
  createdAt: string;
  revealedAt: string | null;
}

// 盲猜猜测
export interface BlindGuessGuess {
  userId: string;
  userNickname: string;
  itemId: string;               // 对应 BlindGuessItem.recordId
  guessAuthorId: string;
  guessAuthorName: string;
  guessDishName: string;
  correct: boolean;             // 揭晓后填充
  score: number;                // 揭晓后填充
  createdAt: string;
}

// 盲猜结果排名
export interface BlindGuessRankEntry {
  userId: string;
  userNickname: string;
  totalScore: number;
  correctCount: number;
  rank: number;
  isChef: boolean;              // 是否为本周厨神
}

// 盲猜揭晓结果
export interface BlindGuessResult {
  roundId: string;
  roundName: string;
  status: BlindGuessRoundStatus;
  items: Array<{
    recordId: string;
    dishName: string;
    realAuthorName: string;
    coverUrl: string;
  }>;
  ranking: BlindGuessRankEntry[];
  chefWinner: BlindGuessRankEntry | null;
}

// 人格类型映射表条目（DB 种子数据结构）
export interface PersonalityTypeDef {
  code: string;
  name: string;
  description: string;
  traits: string[];
  shareText: string;
}

// 图鉴目录条目（DB 种子数据结构）
export interface PokedexCatalogEntry {
  dishName: string;
  category: string;
  rarity: PokedexRarity;
}
