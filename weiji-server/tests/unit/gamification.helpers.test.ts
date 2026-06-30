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
  queryTimemachine,
  scoreBlindGuess,
} from '../../src/store/helpers';
import { blindGuessRounds, pokedexCatalog } from '../../src/store/db';
import type { BlindGuessRound } from '../../src/store/types';

const DEMO_USER_ID = 'user-demo-0001';
const NON_EXIST_USER_ID = 'user-not-exist-9999';

// 测试期间临时插入到 blindGuessRounds 的 mock 轮次 id，afterEach 统一清理，避免状态污染
const mockRoundIds: string[] = [];

async function cleanupMockRounds(): Promise<void> {
  const arr = await blindGuessRounds.toArray();
  for (const id of mockRoundIds) {
    const idx = arr.findIndex((r) => r.id === id);
    if (idx >= 0) arr.splice(idx, 1);
  }
  mockRoundIds.length = 0;
}

afterEach(async () => {
  await cleanupMockRounds();
});

describe('aggregatePokedex', () => {
  it('demo 用户返回非空 categories 数组', async () => {
    const summary = await aggregatePokedex(DEMO_USER_ID);
    assert.ok(Array.isArray(summary.categories), 'categories 应为数组');
    assert.ok(summary.categories.length > 0, 'categories 应非空');
  });

  it('totalSlots 等于 pokedexCatalog 长度', async () => {
    const summary = await aggregatePokedex(DEMO_USER_ID);
    assert.strictEqual(summary.totalSlots, pokedexCatalog.length);
  });

  it('demo 用户 unlockedSlots >= 1（3 条种子记录均命中 catalog）', async () => {
    const summary = await aggregatePokedex(DEMO_USER_ID);
    assert.ok(summary.unlockedSlots >= 1, 'unlockedSlots 应 >= 1');
    // 种子记录 dishName：红烧牛肉面 / 番茄炒蛋 / 清炒西兰花，三者均在 catalog 中
    assert.strictEqual(summary.unlockedSlots, 3);
  });

  it('completionRate 在 0-1 之间', async () => {
    const summary = await aggregatePokedex(DEMO_USER_ID);
    assert.ok(
      summary.completionRate >= 0 && summary.completionRate <= 1,
      'completionRate 应在 0-1 之间',
    );
  });

  it('不存在的用户返回 unlockedSlots=0、completionRate=0、categories 非空且 items 全部未解锁', async () => {
    const summary = await aggregatePokedex(NON_EXIST_USER_ID);
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
  it('demo 用户近 30 天 >= 3 条记录，available=true 且 recordCount=3', async () => {
    const report = await buildPersonalityReport(DEMO_USER_ID);
    assert.strictEqual(report.available, true);
    assert.strictEqual(report.recordCount, 3);
  });

  it('available=true 时 personalityType / description / traits 字段存在', async () => {
    const report = await buildPersonalityReport(DEMO_USER_ID);
    assert.ok(report.personalityType, 'personalityType 应为非空字符串');
    assert.strictEqual(typeof report.personalityType, 'string');
    assert.ok(report.description, 'description 应非空');
    assert.ok(Array.isArray(report.traits), 'traits 应为数组');
  });

  it('shareText 包含人格名', async () => {
    const report = await buildPersonalityReport(DEMO_USER_ID);
    assert.ok(report.personalityType, '前置：personalityType 应非空');
    assert.ok(
      report.shareText.includes(report.personalityType!),
      'shareText 应包含人格名',
    );
  });

  it('不存在的用户 available=false、recordCount=0、description 含"记录不足"', async () => {
    const report = await buildPersonalityReport(NON_EXIST_USER_ID);
    assert.strictEqual(report.available, false);
    assert.strictEqual(report.recordCount, 0);
    assert.ok(
      report.description.includes('记录不足'),
      'description 应含"记录不足"',
    );
  });
});

describe('queryTimemachine', () => {
  it('demo 用户种子记录均为今年，memories 为空数组、todayDate 非空', async () => {
    const result = await queryTimemachine(DEMO_USER_ID);
    assert.ok(Array.isArray(result.memories), 'memories 应为数组');
    assert.strictEqual(result.memories.length, 0, '种子记录均为今年，应无往年回忆');
    assert.ok(
      typeof result.todayDate === 'string' && result.todayDate.length > 0,
      'todayDate 应为非空字符串',
    );
  });

  it('不存在的用户返回空 memories', async () => {
    const result = await queryTimemachine(NON_EXIST_USER_ID);
    assert.ok(Array.isArray(result.memories));
    assert.strictEqual(result.memories.length, 0);
    assert.ok(typeof result.todayDate === 'string');
  });
});

describe('scoreBlindGuess', () => {
  it('不存在的 roundId 返回 null', async () => {
    const result = await scoreBlindGuess('round-not-exist-9999');
    assert.strictEqual(result, null);
  });

  it('mock 轮次：ranking 按 totalScore 降序、rank 1-based、最高分者 isChef=true', async () => {
    // 构造一个 mock 轮次直接 insert 到 blindGuessRounds
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
    await blindGuessRounds.insert(mockRound);
    mockRoundIds.push(mockRound.id);

    const result = await scoreBlindGuess(mockRound.id);
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
});
