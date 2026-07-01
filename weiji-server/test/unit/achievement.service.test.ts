// AchievementService 单元测试（迁移自 weiji-server/tests/unit/achievement.service.test.ts）
//
// 适配说明：
// 1. 旧 AchievementService 为静态方法 + 内存 store（user_achievements），
//    直接调用并断言解锁/幂等。新工程 AchievementService（achievement/service/
//    achievement.ts）为 cool-admin BaseService，依赖 TypeORM Repository
//    （achievementEntity / userAchievementEntity），主键为 bigint 自增，
//    成就用 code（first_record / streak_7 等）标识。
// 2. 本文件通过手动 new AchievementService() 并注入 jest.fn() mock repository，
//    覆盖 list / level / checkAndUnlock 的核心逻辑与幂等行为，不依赖 MySQL。
import { AchievementService } from '../../src/modules/achievement/service/achievement';

function mockRepo() {
  return {
    find: jest.fn(),
    findOneBy: jest.fn(),
    save: jest.fn(),
  };
}

function makeService() {
  const svc = new AchievementService();
  const achievementEntity = mockRepo();
  const userAchievementEntity = mockRepo();
  (svc as any).achievementEntity = achievementEntity;
  (svc as any).userAchievementEntity = userAchievementEntity;
  return { svc, achievementEntity, userAchievementEntity };
}

describe('AchievementService.list', () => {
  it('返回徽章列表并补充 unlocked/earnedAt', async () => {
    const { svc, achievementEntity, userAchievementEntity } = makeService();
    achievementEntity.find.mockResolvedValue([
      { id: 1, code: 'first_record', name: '美食初体验', exp: 50 },
      { id: 2, code: 'streak_7', name: '一周全勤', exp: 200 },
    ]);
    userAchievementEntity.find.mockResolvedValue([
      { achievementId: 1, earnedAt: '2026-07-01 08:00:00' },
    ]);

    const list = await svc.list(1);
    expect(list.length).toBe(2);
    expect(list[0].unlocked).toBe(true);
    expect(list[0].earnedAt).toBe('2026-07-01 08:00:00');
    expect(list[1].unlocked).toBe(false);
    expect(list[1].earnedAt).toBeNull();
  });

  it('无徽章定义时返回空数组', async () => {
    const { svc, achievementEntity } = makeService();
    achievementEntity.find.mockResolvedValue([]);
    const list = await svc.list(1);
    expect(list).toEqual([]);
  });
});

describe('AchievementService.level', () => {
  it('exp=250 → level=3, nextLevelExp=300, progress=50', async () => {
    const { svc, userAchievementEntity, achievementEntity } = makeService();
    userAchievementEntity.find.mockResolvedValue([
      { achievementId: 1 },
      { achievementId: 2 },
    ]);
    achievementEntity.find.mockResolvedValue([
      { id: 1, exp: 50 },
      { id: 2, exp: 200 },
    ]);

    const data = await svc.level(1);
    expect(data.exp).toBe(250);
    expect(data.level).toBe(Math.floor(250 / 100) + 1); // 3
    expect(data.level).toBe(3);
    expect(data.nextLevelExp).toBe(300);
    expect(data.progress).toBe(50);
  });

  it('exp=0 → level=1, progress=0', async () => {
    const { svc, userAchievementEntity } = makeService();
    userAchievementEntity.find.mockResolvedValue([]);
    const data = await svc.level(1);
    expect(data.exp).toBe(0);
    expect(data.level).toBe(1);
    expect(data.progress).toBe(0);
  });
});

describe('AchievementService.checkAndUnlock', () => {
  it('满足 streak_7 条件且未解锁 → 解锁并返回 1 条', async () => {
    const { svc, achievementEntity, userAchievementEntity } = makeService();
    achievementEntity.find.mockResolvedValue([
      {
        id: 2,
        code: 'streak_7',
        name: '一周全勤',
        type: 'streak',
        isActive: true,
        exp: 200,
        condition: { streakDays: 7 },
      },
    ]);
    userAchievementEntity.find.mockResolvedValue([]); // 未解锁
    userAchievementEntity.save.mockResolvedValue({});

    const unlocked = await svc.checkAndUnlock(1, {
      type: 'checkin_streak',
      value: 7,
    });
    expect(unlocked.length).toBe(1);
    expect(unlocked[0].code).toBe('streak_7');
    expect(unlocked[0].unlocked).toBe(true);
    expect(userAchievementEntity.save).toHaveBeenCalledTimes(1);
  });

  it('已解锁过的成就幂等返回空数组（不重复 save）', async () => {
    const { svc, achievementEntity, userAchievementEntity } = makeService();
    achievementEntity.find.mockResolvedValue([
      {
        id: 2,
        code: 'streak_7',
        type: 'streak',
        isActive: true,
        exp: 200,
        condition: { streakDays: 7 },
      },
    ]);
    userAchievementEntity.find.mockResolvedValue([{ achievementId: 2 }]); // 已解锁

    const unlocked = await svc.checkAndUnlock(1, {
      type: 'checkin_streak',
      value: 7,
    });
    expect(unlocked).toEqual([]);
    expect(userAchievementEntity.save).not.toHaveBeenCalled();
  });

  it('未达 streakDays 不解锁', async () => {
    const { svc, achievementEntity, userAchievementEntity } = makeService();
    achievementEntity.find.mockResolvedValue([
      {
        id: 3,
        code: 'streak_30',
        type: 'streak',
        isActive: true,
        exp: 500,
        condition: { streakDays: 30 },
      },
    ]);
    // checkAndUnlock 内部会读取已解锁集合（earned.map），需 mock 避免抛 TypeError
    userAchievementEntity.find.mockResolvedValue([]);
    const unlocked = await svc.checkAndUnlock(1, {
      type: 'checkin_streak',
      value: 7,
    });
    expect(unlocked).toEqual([]);
    expect(userAchievementEntity.save).not.toHaveBeenCalled();
  });

  it('family_created 类型条件 familyCreated=true 时解锁', async () => {
    const { svc, achievementEntity, userAchievementEntity } = makeService();
    achievementEntity.find.mockResolvedValue([
      {
        id: 6,
        code: 'family_create',
        type: 'family',
        isActive: true,
        exp: 100,
        condition: { familyCreated: true },
      },
    ]);
    userAchievementEntity.find.mockResolvedValue([]);
    userAchievementEntity.save.mockResolvedValue({});

    const unlocked = await svc.checkAndUnlock(1, {
      type: 'family_created',
      value: true,
    });
    expect(unlocked.length).toBe(1);
    expect(unlocked[0].code).toBe('family_create');
  });

  it('未知的 condition.type 返回空数组', async () => {
    const { svc } = makeService();
    const unlocked = await svc.checkAndUnlock(1, {
      type: 'unknown_type',
      value: 1,
    });
    expect(unlocked).toEqual([]);
  });
});
