// 内存存储辅助查询方法
// 提供按 id / 字段查找、过滤、插入（自动生成 UUID）、更新、软删除等通用操作

import crypto from 'crypto';

// 按 id 查找单个元素
export function findById<T extends { id: string }>(list: T[], id: string): T | undefined {
  return list.find((item) => item.id === id);
}

// 按字段查找单个元素
export function findByField<T, K extends keyof T>(list: T[], field: K, value: T[K]): T | undefined {
  return list.find((item) => item[field] === value);
}

// 按条件过滤
export function filterBy<T>(list: T[], predicate: (item: T) => boolean): T[] {
  return list.filter(predicate);
}

// 插入新元素并自动生成 UUID
// 若 item 已含 id 则保留，否则使用 crypto.randomUUID() 生成
export function insert<T extends { id: string }>(list: T[], item: Omit<T, 'id'> & Partial<Pick<T, 'id'>>): T {
  const newItem = { ...item, id: item.id || crypto.randomUUID() } as T;
  list.push(newItem);
  return newItem;
}

// 按 id 更新元素（patch 合并），返回更新后的对象
// 找不到时返回 undefined
export function updateById<T extends { id: string }>(list: T[], id: string, patch: Partial<T>): T | undefined {
  const idx = list.findIndex((item) => item.id === id);
  if (idx === -1) return undefined;
  // 若实体有 updatedAt 字段，自动刷新
  const merged = { ...list[idx], ...patch };
  if ('updatedAt' in merged && typeof merged === 'object' && merged !== null) {
    (merged as { updatedAt: string }).updatedAt = new Date().toISOString();
  }
  list[idx] = merged;
  return list[idx];
}

// 软删除：设置 isDeleted = true
export function softDelete<T extends { id: string; isDeleted: boolean }>(list: T[], id: string): T | undefined {
  const item = findById(list, id);
  if (item) {
    item.isDeleted = true;
    return item;
  }
  return undefined;
}

// 生成 UUID（与 Midway / Node crypto.randomUUID 等价）
export function uuid(): string {
  return crypto.randomUUID();
}

// ============================================================
// 娱乐化玩法扩展聚合函数（F27-F30）
// ============================================================

import {
  records,
  pokedexCatalog,
  personalityTypes,
  blindGuessRounds,
} from './db';
import type {
  PokedexSummary,
  PokedexItem,
  PersonalityReport,
  TimemachineResult,
  TimemachineMemory,
  BlindGuessResult,
  BlindGuessRankEntry,
  Record,
  AchievementDef,
  FamilyDietReport,
} from './types';

// 肉类食材关键词（用于 meat_enthusiast 判定）
const MEAT_KEYWORDS = [
  '牛肉', '猪肉', '鸡肉', '羊肉', '鸭肉', '鹅肉',
  '鱼肉', '鱼', '虾', '蟹', '贝', '排骨', '五花肉',
  '牛腩', '里脊', '培根', '香肠', '火腿', '鸡腿', '鸡胸',
];

// 聚合用户图鉴：将 pokedexCatalog 与用户实际记录交叉对比
// - 取 records 中 userId 匹配且 isDeleted=false 的所有记录
// - 按 dishName 聚合得到用户已记录的菜品 + 各自首次记录时间 + 记录次数
// - 遍历 pokedexCatalog，匹配 dishName（大小写不敏感）则 unlocked=true
// - 按 category 分组，统计 totalSlots / unlockedSlots / completionRate（0-1）
export async function aggregatePokedex(userId: string): Promise<PokedexSummary> {
  // 聚合用户已记录的菜品（按 dishName 小写做 key，保留首次记录时间与计数）
  interface DishAgg {
    dishName: string;
    firstRecordedAt: string;
    recordCount: number;
  }
  const dishMap = new Map<string, DishAgg>();
  for (const r of await records.toArray()) {
    if (r.userId !== userId || r.isDeleted) continue;
    const key = r.dishName.toLowerCase();
    const existing = dishMap.get(key);
    if (existing) {
      existing.recordCount += 1;
      // 首次记录时间取最小（更早）
      if (r.recordDate < existing.firstRecordedAt) {
        existing.firstRecordedAt = r.recordDate;
      }
    } else {
      dishMap.set(key, {
        dishName: r.dishName,
        firstRecordedAt: r.recordDate,
        recordCount: 1,
      });
    }
  }

  // 遍历 catalog 构建 PokedexItem，并按 category 分组
  const categoryMap = new Map<
    string,
    { totalSlots: number; unlockedSlots: number; items: PokedexItem[] }
  >();

  let totalSlots = 0;
  let unlockedSlots = 0;

  for (const entry of pokedexCatalog) {
    const matched = dishMap.get(entry.dishName.toLowerCase());
    const item: PokedexItem = {
      dishName: entry.dishName,
      category: entry.category,
      rarity: entry.rarity,
      unlocked: !!matched,
      firstRecordedAt: matched ? matched.firstRecordedAt : null,
      recordCount: matched ? matched.recordCount : 0,
    };

    totalSlots += 1;
    if (item.unlocked) unlockedSlots += 1;

    let bucket = categoryMap.get(entry.category);
    if (!bucket) {
      bucket = { totalSlots: 0, unlockedSlots: 0, items: [] };
      categoryMap.set(entry.category, bucket);
    }
    bucket.totalSlots += 1;
    if (item.unlocked) bucket.unlockedSlots += 1;
    bucket.items.push(item);
  }

  const categories = Array.from(categoryMap.entries()).map(([category, bucket]) => ({
    category,
    totalSlots: bucket.totalSlots,
    unlockedSlots: bucket.unlockedSlots,
    items: bucket.items,
  }));

  return {
    totalSlots,
    unlockedSlots,
    completionRate: totalSlots > 0 ? unlockedSlots / totalSlots : 0,
    categories,
  };
}

// 基于近 30 天记录生成人格报告
// - 取 records 中 userId 匹配且 recordDate 在最近 30 天内且 isDeleted=false 的记录
// - 记录数 < 3 时返回 available:false
// - 基于简单关键词规则推断人格类型，按 spec 顺序优先匹配
export async function buildPersonalityReport(userId: string): Promise<PersonalityReport> {
  const now = new Date();
  const thirtyAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const cutoff = thirtyAgo.toISOString().split('T')[0]; // YYYY-MM-DD

  const recent = await records.findAll(
    (r) => r.userId === userId && !r.isDeleted && r.recordDate >= cutoff
  );

  const recordCount = recent.length;

  if (recordCount < 3) {
    return {
      available: false,
      personalityType: null,
      description: '记录不足 3 条，暂无法生成人格报告，再记录几餐试试吧',
      traits: [],
      shareText: '',
      coverImage: '',
      recordCount,
    };
  }

  // 统计各种指标
  let hasSpice = false;       // tags 含 "辣"/"重口"
  let hasSweet = false;        // tags 含 "甜品"/"甜"
  let hasHealth = false;       // tags 含 "健康"/"轻食"
  let meatRecordCount = 0;    // 含肉类食材的记录数
  let carbsSum = 0;
  let carbsCount = 0;
  let caloriesSum = 0;
  let caloriesCount = 0;

  for (const r of recent) {
    // tag 检测
    for (const tag of r.tags || []) {
      if (tag.includes('辣') || tag.includes('重口')) hasSpice = true;
      if (tag.includes('甜品') || tag.includes('甜')) hasSweet = true;
      if (tag.includes('健康') || tag.includes('轻食')) hasHealth = true;
    }
    // 食材肉类检测
    const ingredientNames = (r.ingredients || []).map((i) => i.name);
    const hasMeat = ingredientNames.some((name) =>
      MEAT_KEYWORDS.some((kw) => name.includes(kw))
    );
    if (hasMeat) meatRecordCount += 1;

    // 营养统计
    if (r.nutrition) {
      if (typeof r.nutrition.carbs === 'number') {
        carbsSum += r.nutrition.carbs;
        carbsCount += 1;
      }
      if (typeof r.nutrition.calories === 'number') {
        caloriesSum += r.nutrition.calories;
        caloriesCount += 1;
      }
    }
  }

  const meatRatio = meatRecordCount / recordCount;
  const avgCarbs = carbsCount > 0 ? carbsSum / carbsCount : 0;
  const avgCalories = caloriesCount > 0 ? caloriesSum / caloriesCount : 0;

  // 按 spec 顺序判定
  let code = 'adventurer';
  if (hasSpice) {
    code = 'spice_explorer';
  } else if (meatRatio > 0.5) {
    code = 'meat_enthusiast';
  } else if (avgCarbs > 50) {
    code = 'carb_lover';
  } else if (avgCalories > 0 && avgCalories < 300) {
    code = 'light_eater';
  } else if (hasSweet) {
    code = 'sweet_tooth';
  } else if (hasHealth) {
    code = 'health_guru';
  }

  const typeDef = personalityTypes.find((p) => p.code === code)
    || personalityTypes.find((p) => p.code === 'adventurer');

  if (!typeDef) {
    // 兜底：理论上不会走到，personalityTypes 至少包含 adventurer
    return {
      available: false,
      personalityType: null,
      description: '人格类型生成失败',
      traits: [],
      shareText: '',
      coverImage: '',
      recordCount,
    };
  }

  const shareText = `我是「${typeDef.name}」——${typeDef.description}。来味记测测你的美食人格！`;

  return {
    available: true,
    personalityType: typeDef.name,
    description: typeDef.description,
    traits: typeDef.traits,
    shareText,
    coverImage: '',
    recordCount,
  };
}

// 查询往年今日记录
// - 取今天的月-日（如 06-26）
// - 在 records 中找 userId 匹配且 isDeleted=false 且 recordDate 月-日相同、年份小于今年的记录
// - 按年份分组，每年组装成 TimemachineMemory
export async function queryTimemachine(userId: string): Promise<TimemachineResult> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const todayDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const todayMonthDay = todayDate.slice(5); // MM-DD

  // 找出往年今日的记录
  const pastRecords: Record[] = await records.findAll((r) => {
    if (r.userId !== userId || r.isDeleted) return false;
    if (!r.recordDate || r.recordDate.length < 10) return false;
    const recordYear = parseInt(r.recordDate.slice(0, 4), 10);
    const recordMonthDay = r.recordDate.slice(5, 10);
    return recordYear < currentYear && recordMonthDay === todayMonthDay;
  });

  // 按年份分组
  const yearMap = new Map<number, Record[]>();
  for (const r of pastRecords) {
    const year = parseInt(r.recordDate.slice(0, 4), 10);
    const arr = yearMap.get(year);
    if (arr) {
      arr.push(r);
    } else {
      yearMap.set(year, [r]);
    }
  }

  // 组装 TimemachineMemory，按年份降序（更近的年份在前）
  const memories: TimemachineMemory[] = Array.from(yearMap.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([year, recs]) => {
      const first = recs[0];
      const coverImage = first.imageUrl || first.beautifiedUrl || '';
      const yearsAgo = currentYear - year;
      const caption =
        yearsAgo >= 1
          ? `${yearsAgo} 年前的今天，你吃了${first.dishName}`
          : `今天的回忆，你吃了${first.dishName}`;
      return {
        year,
        date: first.recordDate,
        records: recs,
        coverImage,
        caption,
      };
    });

  return {
    memories,
    todayDate,
  };
}

// 计算盲猜轮次的得分排名（揭晓时调用）
// - 对每个 guess：guessAuthorId === item.realAuthorId → +1 分
//                 guessDishName === item.dishName（大小写不敏感） → +1 分
//                 单个 guess 最高 2 分；correct = 任一项命中即为 true
// - 按 userId 聚合 totalScore 与 correctCount
// - 排序：totalScore 降序 → correctCount 降序；rank 1-based，相同分同 rank（competition ranking）
// - 最高分者（rank=1）标记 isChef=true
// - 不修改数据库中的 status，由控制器负责更新
export async function scoreBlindGuess(roundId: string): Promise<BlindGuessResult | null> {
  const round = await blindGuessRounds.findById(roundId);
  if (!round) return null;

  // 计算每个 guess 的得分
  for (const guess of round.guesses) {
    const item = round.items.find((it) => it.recordId === guess.itemId);
    let score = 0;
    let correct = false;

    if (item) {
      // 作者命中
      if (guess.guessAuthorId && guess.guessAuthorId === item.realAuthorId) {
        score += 1;
        correct = true;
      }
      // 菜名命中（大小写不敏感）
      if (
        guess.guessDishName &&
        guess.guessDishName.toLowerCase() === item.dishName.toLowerCase()
      ) {
        score += 1;
        correct = true;
      }
    }

    guess.score = score;
    guess.correct = correct;
  }

  // 按 userId 聚合
  const userMap = new Map<
    string,
    { userId: string; userNickname: string; totalScore: number; correctCount: number }
  >();
  for (const guess of round.guesses) {
    let entry = userMap.get(guess.userId);
    if (!entry) {
      entry = {
        userId: guess.userId,
        userNickname: guess.userNickname,
        totalScore: 0,
        correctCount: 0,
      };
      userMap.set(guess.userId, entry);
    }
    entry.totalScore += guess.score;
    if (guess.correct) entry.correctCount += 1;
  }

  // 排序：totalScore 降序 → correctCount 降序
  const sorted = Array.from(userMap.values()).sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    return b.correctCount - a.correctCount;
  });

  // 赋 rank（competition ranking：相同分同 rank，下一名跳号）
  const ranking: BlindGuessRankEntry[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];
    let rank = i + 1;
    if (i > 0) {
      const prev = sorted[i - 1];
      if (prev.totalScore === entry.totalScore && prev.correctCount === entry.correctCount) {
        rank = ranking[i - 1].rank;
      }
    }
    ranking.push({
      userId: entry.userId,
      userNickname: entry.userNickname,
      totalScore: entry.totalScore,
      correctCount: entry.correctCount,
      rank,
      isChef: rank === 1,
    });
  }

  const chefWinner = ranking.find((r) => r.isChef) || null;

  const items = round.items.map((it) => ({
    recordId: it.recordId,
    dishName: it.dishName,
    realAuthorName: it.realAuthorName,
    coverUrl: it.coverUrl,
  }));

  return {
    roundId: round.id,
    roundName: round.roundName,
    status: round.status,
    items,
    ranking,
    chefWinner,
  };
}

// ============================================================
// 成就自动解锁检查
// ============================================================

import { achievements, user_achievements, check_ins, families, family_members, users } from './db';
import { CheckinService } from '../service/checkin.service';

// 检查并解锁满足条件的成就
// 在用户创建记录或打卡后调用
// 返回新解锁的成就列表
export async function checkAndUnlockAchievements(userId: string): Promise<AchievementDef[]> {
  const newlyUnlocked: AchievementDef[] = [];

  // 获取用户已解锁的成就ID集合
  const unlockedIds = new Set<string>();
  for (const ua of await user_achievements.toArray()) {
    if (ua.userId === userId) {
      unlockedIds.add(ua.achievementId);
    }
  }

  // 统计用户数据
  // 记录数
  const recordCount = await records.count((r) => r.userId === userId && !r.isDeleted);
  // 连续打卡天数
  const streak = await CheckinService.calculateStreak(userId);
  // 是否创建过家庭组
  const familyCreated = (await families.count((f) => f.ownerId === userId && !f.isDeleted)) > 0;

  // 遍历成就定义，检查解锁条件
  for (const ach of await achievements.toArray()) {
    // 跳过已解锁的
    if (unlockedIds.has(ach.id)) continue;

    let shouldUnlock = false;
    const cond = ach.condition;

    switch (ach.code) {
      case 'first_record':
        shouldUnlock = recordCount >= 1;
        break;
      case 'streak_7':
        shouldUnlock = streak >= 7;
        break;
      case 'streak_30':
        shouldUnlock = streak >= 30;
        break;
      case 'record_100':
        shouldUnlock = recordCount >= 100;
        break;
      case 'family_create':
        shouldUnlock = familyCreated;
        break;
      // cuisine_10 暂不实现自动解锁（需要菜系统计）
      default:
        break;
    }

    if (shouldUnlock) {
      // 创建用户成就记录
      const now = new Date().toISOString();
      await user_achievements.insert({
        id: crypto.randomUUID(),
        userId,
        achievementId: ach.id,
        earnedAt: now,
      });
      newlyUnlocked.push(ach);
    }
  }

  return newlyUnlocked;
}

// ============================================================
// 家庭饮食月度报告（F17）
// ============================================================

// 计算给定月份（YYYY-MM）的上一月 YYYY-MM
// 1 月的上一月为上年 12 月
function computePrevMonth(month: string): string {
  const parts = month.split('-');
  if (parts.length < 2) return month;
  const year = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (Number.isNaN(year) || Number.isNaN(m)) return month;
  let prevYear = year;
  let prevMonthNum = m - 1;
  if (prevMonthNum < 1) {
    prevMonthNum = 12;
    prevYear -= 1;
  }
  return `${prevYear}-${String(prevMonthNum).padStart(2, '0')}`;
}

// 生成家庭饮食月度报告
// 流程：
// 1. 通过 family_members 找出该家庭的所有 userIds
// 2. 过滤 records：userId 在家庭组内 + isDeleted=false + recordDate 月份匹配
// 3. 计算 prevMonthRecords：上一月同条件记录数
// 4. memberContributions：按 userId 分组聚合，关联 users 表取昵称头像，按记录数倒序
// 5. topDishes：按 dishName 分组，统计 count + 平均 rating，取 Top 5
// 6. avgRating：所有记录的平均 rating（无记录时为 0）
// 7. tagDistribution：展开所有 tags 数组，按频次排序，最多 10 个
// 8. 无数据时返回 totalRecords=0 等空结构
export async function generateFamilyDietReport(familyId: string, month: string): Promise<FamilyDietReport> {
  // 通过 family_members 找出该家庭的所有 userIds
  const memberUserIds = (await family_members
    .findAll((m) => m.familyId === familyId))
    .map((m) => m.userId);
  const userIdSet = new Set(memberUserIds);

  const prevMonth = computePrevMonth(month);

  // 过滤当月记录：userId 在家庭组内 + 未删除 + recordDate 月份匹配
  const monthRecords = await records.findAll(
    (r) => userIdSet.has(r.userId) && !r.isDeleted && r.recordDate.startsWith(month)
  );

  // 过滤上月记录（用于环比）
  const prevMonthRecords = await records.count(
    (r) => userIdSet.has(r.userId) && !r.isDeleted && r.recordDate.startsWith(prevMonth)
  );

  // memberContributions：按 userId 分组聚合，关联 users 表取昵称头像，按记录数倒序
  const memberMap = new Map<string, number>();
  for (const r of monthRecords) {
    memberMap.set(r.userId, (memberMap.get(r.userId) || 0) + 1);
  }
  const memberContributions: Array<{
    userId: string;
    userNickname: string;
    userAvatar: string;
    recordCount: number;
  }> = [];
  for (const [userId, recordCount] of Array.from(memberMap.entries())) {
    const user = await users.findById(userId);
    memberContributions.push({
      userId,
      userNickname: user?.nickname ?? '',
      userAvatar: user?.avatar ?? '',
      recordCount,
    });
  }
  memberContributions.sort((a, b) => b.recordCount - a.recordCount);

  // topDishes：按 dishName 分组，统计 count + 平均 rating，取 Top 5
  const dishMap = new Map<string, { dishName: string; count: number; ratingSum: number }>();
  for (const r of monthRecords) {
    const existing = dishMap.get(r.dishName);
    if (existing) {
      existing.count += 1;
      existing.ratingSum += r.rating;
    } else {
      dishMap.set(r.dishName, { dishName: r.dishName, count: 1, ratingSum: r.rating });
    }
  }
  const topDishes = Array.from(dishMap.values())
    .map((d) => ({
      dishName: d.dishName,
      count: d.count,
      avgRating: d.count > 0 ? d.ratingSum / d.count : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // avgRating：所有记录的平均 rating（无记录时为 0）
  const avgRating =
    monthRecords.length > 0
      ? monthRecords.reduce((sum, r) => sum + r.rating, 0) / monthRecords.length
      : 0;

  // tagDistribution：展开所有 tags 数组，按频次排序，最多 10 个
  const tagMap = new Map<string, number>();
  for (const r of monthRecords) {
    for (const tag of r.tags || []) {
      tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
    }
  }
  const tagDistribution = Array.from(tagMap.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    month,
    totalRecords: monthRecords.length,
    prevMonthRecords,
    memberContributions,
    topDishes,
    avgRating,
    tagDistribution,
  };
}
