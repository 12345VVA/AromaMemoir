// 娱乐化玩法聚合函数单元测试（迁移自 weiji-server/tests/unit/gamification.helpers.test.ts）
//
// 适配说明：
// 1. 旧工程聚合函数（aggregatePokedex / buildPersonalityReport / queryTimemachine /
//    scoreBlindGuess）位于 src/store/helpers.ts，直接 import 调用。
// 2. 新工程这些逻辑内聚为 GamificationService（gamification/service/gamification.ts）
//    的实例方法 pokedex / personality / timemachine，以及私有方法 scoreBlindGuess
//    （由 reveal 调用）。pokedexCatalog / personalityTypes 改为 service 内私有静态常量。
// 3. 本文件通过手动 new GamificationService() + jest.fn() mock repository 覆盖：
//    pokedex 聚合、personality 记录不足分支、timemachine 空回忆、scoreBlindGuess 计分排名。
import { GamificationService } from '../../src/modules/gamification/service/gamification';

function makeService() {
  const svc = new GamificationService();
  const recordEntity: any = {
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const appUserEntity: any = { findOneBy: jest.fn(), find: jest.fn() };
  const blindGuessRoundEntity: any = {
    findOneBy: jest.fn(),
    save: jest.fn(),
  };
  const familyMemberEntity: any = { findOneBy: jest.fn() };
  (svc as any).recordEntity = recordEntity;
  (svc as any).appUserEntity = appUserEntity;
  (svc as any).blindGuessRoundEntity = blindGuessRoundEntity;
  (svc as any).familyMemberEntity = familyMemberEntity;
  return { svc, recordEntity, appUserEntity, blindGuessRoundEntity, familyMemberEntity };
}

describe('GamificationService.pokedex', () => {
  it('用户有 1 条命中 catalog 的记录 → unlockedSlots=1, completionRate=1/36', async () => {
    const { svc, recordEntity } = makeService();
    recordEntity.find.mockResolvedValue([
      { dishName: '红烧牛肉面', recordDate: '2026-06-30', userId: 1 },
    ]);
    const summary = await svc.pokedex(1);
    expect(Array.isArray(summary.categories)).toBe(true);
    expect(summary.totalSlots).toBe(36);
    expect(summary.unlockedSlots).toBe(1);
    expect(summary.completionRate).toBeCloseTo(1 / 36, 5);
  });

  it('无记录的用户 → unlockedSlots=0, completionRate=0', async () => {
    const { svc, recordEntity } = makeService();
    recordEntity.find.mockResolvedValue([]);
    const summary = await svc.pokedex(999);
    expect(summary.unlockedSlots).toBe(0);
    expect(summary.completionRate).toBe(0);
    for (const cat of summary.categories) {
      expect(cat.unlockedSlots).toBe(0);
      for (const item of cat.items) {
        expect(item.unlocked).toBe(false);
        expect(item.recordCount).toBe(0);
      }
    }
  });
});

describe('GamificationService.personality', () => {
  it('近 30 天 < 3 条记录 → available=false 且 description 含「记录不足」', async () => {
    const { svc, recordEntity } = makeService();
    const qb: any = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    recordEntity.createQueryBuilder.mockReturnValue(qb);
    const report = await svc.personality(999);
    expect(report.available).toBe(false);
    expect(report.recordCount).toBe(0);
    expect(report.description).toContain('记录不足');
  });

  it('近 30 天 >= 3 条记录 → available=true 且 personalityType 非空', async () => {
    const { svc, recordEntity } = makeService();
    const qb: any = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        { dishName: 'A', tags: ['辣'], ingredients: [], nutrition: {} },
        { dishName: 'B', tags: ['重口'], ingredients: [], nutrition: {} },
        { dishName: 'C', tags: [], ingredients: [], nutrition: {} },
      ]),
    };
    recordEntity.createQueryBuilder.mockReturnValue(qb);
    const report = await svc.personality(1);
    expect(report.available).toBe(true);
    expect(report.recordCount).toBe(3);
    expect(report.personalityType).toBeTruthy();
    expect(Array.isArray(report.traits)).toBe(true);
    expect(report.shareText).toContain(report.personalityType);
  });
});

describe('GamificationService.timemachine', () => {
  it('无往年记录 → memories 为空数组、todayDate 为字符串', async () => {
    const { svc, recordEntity } = makeService();
    recordEntity.find.mockResolvedValue([]);
    const result = await svc.timemachine(1);
    expect(Array.isArray(result.memories)).toBe(true);
    expect(result.memories.length).toBe(0);
    expect(typeof result.todayDate).toBe('string');
    expect(result.todayDate.length).toBeGreaterThan(0);
  });
});

describe('GamificationService.scoreBlindGuess（经 reveal 触发）', () => {
  it('按 totalScore 降序排名，rank 1-based，最高分者 isChef=true', async () => {
    const { svc, blindGuessRoundEntity } = makeService();
    const round = {
      id: 10,
      familyId: 1,
      roundName: '单元测试轮次',
      creatorId: 1,
      status: 'active',
      items: [
        {
          recordId: 1,
          dishName: '红烧牛肉面',
          coverUrl: '',
          realAuthorId: 1,
          realAuthorName: 'demo',
        },
        {
          recordId: 2,
          dishName: '番茄炒蛋',
          coverUrl: '',
          realAuthorId: 2,
          realAuthorName: 'mom',
        },
      ],
      guesses: [
        // userId=3 猜 item1：作者命中 + 菜名命中 → 2 分
        {
          userId: 3,
          userNickname: 'dad',
          itemId: 1,
          guessAuthorId: 1,
          guessDishName: '红烧牛肉面',
          correct: false,
          score: 0,
          createdAt: '',
        },
        // userId=4 猜 item2：作者不命中、菜名命中 → 1 分
        {
          userId: 4,
          userNickname: 'baby',
          itemId: 2,
          guessAuthorId: 1,
          guessDishName: '番茄炒蛋',
          correct: false,
          score: 0,
          createdAt: '',
        },
      ],
      rankings: null,
    };
    blindGuessRoundEntity.findOneBy.mockResolvedValue(round);
    blindGuessRoundEntity.save.mockResolvedValue(round);

    const result = await svc.reveal(1, 10);
    expect(result.status).toBe('revealed');
    expect(Array.isArray(result.ranking)).toBe(true);
    expect(result.ranking.length).toBe(2);

    // ranking 按 totalScore 降序
    for (let i = 1; i < result.ranking.length; i++) {
      expect(result.ranking[i - 1].totalScore).toBeGreaterThanOrEqual(
        result.ranking[i].totalScore,
      );
    }
    // 最高分者 rank=1 且 isChef=true
    const top = result.ranking[0];
    expect(top.rank).toBe(1);
    expect(top.isChef).toBe(true);
    expect(top.userId).toBe(3); // dad 得 2 分
    expect(top.totalScore).toBe(2);
    expect(top.correctCount).toBe(1);

    // chefWinner 指向最高分者
    expect(result.chefWinner).not.toBeNull();
    expect(result.chefWinner.userId).toBe(top.userId);
  });

  it('非 creator 调用 reveal 抛 403', async () => {
    const { svc, blindGuessRoundEntity } = makeService();
    blindGuessRoundEntity.findOneBy.mockResolvedValue({
      id: 10,
      creatorId: 1,
      status: 'active',
      items: [],
      guesses: [],
    });
    await expect(svc.reveal(999, 10)).rejects.toThrow(/仅轮次发起人/);
  });

  it('轮次不存在抛错', async () => {
    const { svc, blindGuessRoundEntity } = makeService();
    blindGuessRoundEntity.findOneBy.mockResolvedValue(null);
    await expect(svc.reveal(1, 9999)).rejects.toThrow(/轮次不存在/);
  });
});
