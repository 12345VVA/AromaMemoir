// 娱乐化玩法聚合函数单元测试
// 覆盖 src/store/helpers.ts 末尾新增的 4 个聚合函数：
//   - aggregatePokedex        美食图鉴聚合
//   - buildPersonalityReport   食物人格测试（30 天 ≥ 3 条记录才生成）
//   - queryTimemachine         往年今日回忆
//   - scoreBlindGuess          盲猜得分排名
// 直接 import 函数测试，不走 HTTP；按需操作内存数组（blindGuessRounds）并清理。
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert';
import {
  aggregatePokedex,
  buildPersonalityReport,
  persistPersonality,
  queryTimemachine,
  scoreBlindGuess,
} from '../../src/store/helpers';
import {
  blindGuessRounds,
  pokedexCatalog,
  user_personalities,
  user_achievements,
} from '../../src/store/db';
import type { BlindGuessRound } from '../../src/store/types';

const DEMO_USER_ID = 'user-demo-0001';
const NON_EXIST_USER_ID = 'user-not-exist-9999';
// F30 厨神徽章 achievementId（与 db.ts 种子一致）
const CHEF_BADGE_ID = 'ach-blindguess-chef';

// 测试期间临时插入到 blindGuessRounds 的 mock 轮次 id，afterEach 统一清理，避免状态污染
const mockRoundIds: string[] = [];

function cleanupMockRounds(): void {
  for (const id of mockRoundIds) {
    const idx = blindGuessRounds.findIndex((r) => r.id === id);
    if (idx >= 0) blindGuessRounds.splice(idx, 1);
  }
  mockRoundIds.length = 0;
}

// 清理测试期间 scoreBlindGuess 写入的厨神徽章（种子数据无此徽章，全量移除即恢复初态）
function cleanupChefBadges(): void {
  for (let i = user_achievements.length - 1; i >= 0; i--) {
    if (user_achievements[i].achievementId === CHEF_BADGE_ID) {
      user_achievements.splice(i, 1);
    }
  }
}

afterEach(() => {
  cleanupMockRounds();
  cleanupChefBadges();
});

describe('aggregatePokedex', () => {
  it('demo 用户返回非空 categories 数组', () => {
    const summary = aggregatePokedex(DEMO_USER_ID);
    assert.ok(Array.isArray(summary.categories), 'categories 应为数组');
    assert.ok(summary.categories.length > 0, 'categories 应非空');
  });

  it('totalSlots 等于 pokedexCatalog 长度', () => {
    const summary = aggregatePokedex(DEMO_USER_ID);
    assert.strictEqual(summary.totalSlots, pokedexCatalog.length);
  });

  it('demo 用户 unlockedSlots >= 1（3 条种子记录均命中 catalog）', () => {
    const summary = aggregatePokedex(DEMO_USER_ID);
    assert.ok(summary.unlockedSlots >= 1, 'unlockedSlots 应 >= 1');
    // 种子记录 dishName：红烧牛肉面 / 番茄炒蛋 / 清炒西兰花，三者均在 catalog 中
    assert.strictEqual(summary.unlockedSlots, 3);
  });

  it('completionRate 在 0-1 之间', () => {
    const summary = aggregatePokedex(DEMO_USER_ID);
    assert.ok(
      summary.completionRate >= 0 && summary.completionRate <= 1,
      'completionRate 应在 0-1 之间',
    );
  });

  it('不存在的用户返回 unlockedSlots=0、completionRate=0、categories 非空且 items 全部未解锁', () => {
    const summary = aggregatePokedex(NON_EXIST_USER_ID);
    assert.strictEqual(summary.unlockedSlots, 0);
    assert.strictEqual(summary.completionRate, 0);
    assert.ok(Array.isArray(summary.categories), 'categories 应为数组');
    assert.ok(summary.categories.length > 0, 'catalog 非空时 categories 应非空');
    for (const cat of summary.categories) {
      assert.strictEqual(cat.unlockedSlots, 0, '每个分类 unlockedSlots 应为 0');
      for (const item of cat.items) {
        assert.strictEqual(item.unlocked, false, '所有 item 应未解锁');
        assert.strictEqual(item.firstRecordedAt, null);
        assert.strictEqual(item.recordCount, 0);
      }
    }
  });
});

describe('buildPersonalityReport', () => {
  it('demo 用户近 30 天 >= 3 条记录，available=true 且 recordCount=3', () => {
    const report = buildPersonalityReport(DEMO_USER_ID);
    assert.strictEqual(report.available, true);
    assert.strictEqual(report.recordCount, 3);
  });

  it('available=true 时 personalityType / description / traits 字段存在', () => {
    const report = buildPersonalityReport(DEMO_USER_ID);
    assert.ok(report.personalityType, 'personalityType 应为非空字符串');
    assert.strictEqual(typeof report.personalityType, 'string');
    assert.ok(report.description, 'description 应非空');
    assert.ok(Array.isArray(report.traits), 'traits 应为数组');
  });

  it('shareText 包含人格名', () => {
    const report = buildPersonalityReport(DEMO_USER_ID);
    assert.ok(report.personalityType, '前置：personalityType 应非空');
    assert.ok(
      report.shareText.includes(report.personalityType!),
      'shareText 应包含人格名',
    );
  });

  it('available=true 时 coverImage 非空且以 data:image/svg 开头（F28 分享卡片）', () => {
    const report = buildPersonalityReport(DEMO_USER_ID);
    assert.strictEqual(report.available, true, '前置：demo 应 available=true');
    assert.ok(report.coverImage, 'coverImage 应非空');
    assert.ok(
      report.coverImage.startsWith('data:image/svg'),
      'coverImage 应以 data:image/svg 开头',
    );
  });

  it('不存在的用户 available=false、recordCount=0、description 含"记录不足"', () => {
    const report = buildPersonalityReport(NON_EXIST_USER_ID);
    assert.strictEqual(report.available, false);
    assert.strictEqual(report.recordCount, 0);
    assert.ok(
      report.description.includes('记录不足'),
      'description 应含"记录不足"',
    );
  });
});

describe('persistPersonality', () => {
  it('available=true 时写入 user_personalities，长度 +1 且字段完整', () => {
    const report = buildPersonalityReport(DEMO_USER_ID);
    assert.strictEqual(report.available, true, '前置：demo 应 available=true');

    const before = user_personalities.length;
    const entry = persistPersonality(DEMO_USER_ID, report);
    assert.ok(entry, '应返回写入的记录');
    assert.strictEqual(user_personalities.length, before + 1, '长度应 +1');
    assert.strictEqual(entry!.userId, DEMO_USER_ID);
    assert.ok(entry!.personalityType, 'personalityType 应非空');
    assert.ok(entry!.personalityName, 'personalityName 应非空');
    assert.ok(entry!.description, 'description 应非空');
    // personalityName 应等于报告中的 personalityType（人格名）
    assert.strictEqual(entry!.personalityName, report.personalityType);
    // 恢复初态，避免污染其他用例
    user_personalities.pop();
    assert.strictEqual(user_personalities.length, before, '清理后长度应恢复');
  });

  it('available=false 时不写入（返回 null，长度不变）', () => {
    const report = buildPersonalityReport(NON_EXIST_USER_ID);
    assert.strictEqual(report.available, false);
    const before = user_personalities.length;
    const entry = persistPersonality(NON_EXIST_USER_ID, report);
    assert.strictEqual(entry, null);
    assert.strictEqual(user_personalities.length, before, 'available=false 不应写入');
  });
});

describe('queryTimemachine', () => {
  it('demo 用户种子记录均为今年，memories 为空数组、todayDate 非空', () => {
    const result = queryTimemachine(DEMO_USER_ID);
    assert.ok(Array.isArray(result.memories), 'memories 应为数组');
    assert.strictEqual(result.memories.length, 0, '种子记录均为今年，应无往年回忆');
    assert.ok(
      typeof result.todayDate === 'string' && result.todayDate.length > 0,
      'todayDate 应为非空字符串',
    );
  });

  it('不存在的用户返回空 memories', () => {
    const result = queryTimemachine(NON_EXIST_USER_ID);
    assert.ok(Array.isArray(result.memories));
    assert.strictEqual(result.memories.length, 0);
    assert.ok(typeof result.todayDate === 'string');
  });

  it('命中春节（02-10）时 festival 非空且 isFamilyFeast=true（F29 节日家宴）', () => {
    const result = queryTimemachine(DEMO_USER_ID, new Date('2026-02-10'));
    assert.ok(result.festival, '春节命中时 festival 应非空');
    assert.strictEqual(result.festival!.name, '春节');
    assert.strictEqual(result.festival!.isFamilyFeast, true);
  });

  it('非节日（06-27）时 festival 为 undefined', () => {
    const result = queryTimemachine(DEMO_USER_ID, new Date('2026-06-27'));
    assert.strictEqual(result.festival, undefined, '非节日 festival 应为 undefined');
  });
});

describe('scoreBlindGuess', () => {
  it('不存在的 roundId 返回 null', () => {
    const result = scoreBlindGuess('round-not-exist-9999');
    assert.strictEqual(result, null);
  });

  it('mock 轮次：ranking 按 totalScore 降序、rank 1-based、最高分者 isChef=true', () => {
    // 构造一个 mock 轮次直接 push 到 blindGuessRounds
    const mockRound: BlindGuessRound = {
      id: 'test-round-mock-001',
      familyId: 'family-0001',
      roundName: '单元测试轮次',
      creatorId: DEMO_USER_ID,
      items: [
        {
          recordId: 'mock-item-a',
          recipeId: 'mock-item-a',
          dishName: '红烧牛肉面',
          coverUrl: '',
          realAuthorId: DEMO_USER_ID,
          realAuthorName: '小明',
        },
        {
          recordId: 'mock-item-b',
          recipeId: 'mock-item-b',
          dishName: '番茄炒蛋',
          coverUrl: '',
          realAuthorId: 'user-mom-0002',
          realAuthorName: '妈妈',
        },
      ],
      guesses: [
        // demo 猜 mock-item-a：作者命中 + 菜名命中 → 2 分
        {
          userId: DEMO_USER_ID,
          userNickname: '小明',
          itemId: 'mock-item-a',
          guessAuthorId: DEMO_USER_ID,
          guessAuthorName: '小明',
          guessDishName: '红烧牛肉面',
          correct: false,
          score: 0,
          createdAt: '',
        },
        // mom 猜 mock-item-b：作者不命中、菜名命中 → 1 分
        {
          userId: 'user-mom-0002',
          userNickname: '妈妈',
          itemId: 'mock-item-b',
          guessAuthorId: DEMO_USER_ID,
          guessAuthorName: '小明',
          guessDishName: '番茄炒蛋',
          correct: false,
          score: 0,
          createdAt: '',
        },
      ],
      status: 'revealed',
      createdAt: '',
      revealedAt: null,
    };
    blindGuessRounds.push(mockRound);
    mockRoundIds.push(mockRound.id);

    const result = scoreBlindGuess(mockRound.id);
    assert.ok(result, '应返回非 null 结果');
    assert.strictEqual(result!.roundId, mockRound.id);
    assert.ok(Array.isArray(result!.ranking), 'ranking 应为数组');
    assert.strictEqual(result!.ranking.length, 2);

    // rank 1-based
    for (const entry of result!.ranking) {
      assert.ok(entry.rank >= 1, 'rank 应 1-based');
    }

    // ranking 按 totalScore 降序
    for (let i = 1; i < result!.ranking.length; i++) {
      assert.ok(
        result!.ranking[i - 1].totalScore >= result!.ranking[i].totalScore,
        'ranking 应按 totalScore 降序',
      );
    }

    // 最高分者 isChef=true 且 rank=1
    const top = result!.ranking[0];
    assert.strictEqual(top.rank, 1);
    assert.strictEqual(top.isChef, true, 'rank=1 应 isChef=true');

    // demo 命中作者 + 菜名 → 2 分
    const demoEntry = result!.ranking.find((r) => r.userId === DEMO_USER_ID);
    assert.ok(demoEntry, 'demo 应出现在 ranking 中');
    assert.strictEqual(demoEntry!.totalScore, 2);
    assert.strictEqual(demoEntry!.correctCount, 1);

    // chefWinner 应指向最高分者
    assert.ok(result!.chefWinner, 'chefWinner 应非空');
    assert.strictEqual(result!.chefWinner!.userId, top.userId);
  });

  it('揭晓后厨神用户在 user_achievements 写入对应徽章且去重（F30 厨神徽章）', () => {
    // 构造 mock 轮次：mom 全对（2 分，rank 1，isChef），demo 全错（0 分）
    const mockRound: BlindGuessRound = {
      id: 'test-round-chef-002',
      familyId: 'family-0001',
      roundName: '厨神徽章测试轮次',
      creatorId: DEMO_USER_ID,
      items: [
        {
          recordId: 'chef-item-a',
          recipeId: 'chef-item-a',
          dishName: '番茄炒蛋',
          coverUrl: '',
          realAuthorId: 'user-mom-0002',
          realAuthorName: '妈妈',
        },
      ],
      guesses: [
        // mom 猜 chef-item-a：作者命中 + 菜名命中 → 2 分
        {
          userId: 'user-mom-0002',
          userNickname: '妈妈',
          itemId: 'chef-item-a',
          guessAuthorId: 'user-mom-0002',
          guessAuthorName: '妈妈',
          guessDishName: '番茄炒蛋',
          correct: false,
          score: 0,
          createdAt: '',
        },
        // demo 猜 chef-item-a：全错 → 0 分
        {
          userId: DEMO_USER_ID,
          userNickname: '小明',
          itemId: 'chef-item-a',
          guessAuthorId: DEMO_USER_ID,
          guessAuthorName: '小明',
          guessDishName: '完全不对的菜名',
          correct: false,
          score: 0,
          createdAt: '',
        },
      ],
      status: 'revealed',
      createdAt: '',
      revealedAt: null,
    };
    blindGuessRounds.push(mockRound);
    mockRoundIds.push(mockRound.id);

    const beforeCount = user_achievements.filter(
      (ua) => ua.achievementId === CHEF_BADGE_ID,
    ).length;

    const result = scoreBlindGuess(mockRound.id);
    assert.ok(result, '应返回非 null 结果');
    const chefEntry = result!.ranking.find((r) => r.isChef);
    assert.ok(chefEntry, '应存在厨神');
    assert.strictEqual(chefEntry!.userId, 'user-mom-0002', 'mom 应为厨神');

    // mom 应被写入厨神徽章
    const afterCount = user_achievements.filter(
      (ua) => ua.achievementId === CHEF_BADGE_ID,
    ).length;
    assert.strictEqual(afterCount, beforeCount + 1, '厨神徽章数量应 +1');
    const momBadge = user_achievements.find(
      (ua) => ua.userId === 'user-mom-0002' && ua.achievementId === CHEF_BADGE_ID,
    );
    assert.ok(momBadge, 'mom 应有厨神徽章记录');
    assert.ok(momBadge!.earnedAt, 'earnedAt 应非空');

    // 再次调用应去重，不重复解锁
    scoreBlindGuess(mockRound.id);
    const dedupCount = user_achievements.filter(
      (ua) => ua.achievementId === CHEF_BADGE_ID,
    ).length;
    assert.strictEqual(dedupCount, afterCount, '同一用户同一徽章不应重复解锁');
  });
});
