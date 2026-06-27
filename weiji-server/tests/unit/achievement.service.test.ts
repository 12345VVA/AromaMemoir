// AchievementService 单元测试
// 直接调用静态方法，验证各类成就的解锁与幂等行为
// 注意：本文件名 achievement.service.test.ts 在 unit 目录中字母序最靠前，先于 store.test.ts 执行，
// 因此 db.ts 处于种子数据初始状态（demo 已解锁 ach-0001/ach-0002，records 3 条，check_ins 7 条）
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { AchievementService } from '../../src/service/achievement.service';
import { user_achievements } from '../../src/store/db';

const DEMO_USER_ID = 'user-demo-0001';

describe('AchievementService.checkAndUnlockRecordAchievements', () => {
  it('demo 用户 first_record 已解锁、其余 record/variety 未达标 → 返回空数组', () => {
    // 种子数据：demo 已解锁 ach-0001(first_record)，3 条记录，2 种 cookingMethod（炖/炒）
    // first_record(>=1)：已解锁，跳过
    // record_100(>=100)：3 < 100，不解锁
    // cuisine_10(>=10)：仅 2 种 cookingMethod，不解锁
    const unlocked = AchievementService.checkAndUnlockRecordAchievements(DEMO_USER_ID);
    assert.ok(Array.isArray(unlocked));
    assert.strictEqual(unlocked.length, 0, '应返回空数组');
  });
});

describe('AchievementService.checkAndUnlockStreakAchievements', () => {
  it('streak=7 时 streak_7 已解锁、streak_30 未达标 → 返回空数组', () => {
    // 种子数据：demo 已解锁 ach-0002(streak_7)
    const unlocked = AchievementService.checkAndUnlockStreakAchievements(DEMO_USER_ID, 7);
    assert.ok(Array.isArray(unlocked));
    assert.strictEqual(unlocked.length, 0, '应返回空数组');
  });

  it('streak=30 时 streak_30 达标 → 返回 1 条 ach-0003', () => {
    const unlocked = AchievementService.checkAndUnlockStreakAchievements(DEMO_USER_ID, 30);
    assert.ok(Array.isArray(unlocked));
    assert.strictEqual(unlocked.length, 1, '应解锁 1 条');
    assert.strictEqual(unlocked[0].achievementId, 'ach-0003');
    assert.strictEqual(unlocked[0].userId, DEMO_USER_ID);
  });
});

describe('AchievementService.checkAndUnlockFamilyAchievements', () => {
  it('demo 是 family-0001 owner → family_create 解锁 ach-0006', () => {
    const unlocked = AchievementService.checkAndUnlockFamilyAchievements(DEMO_USER_ID);
    assert.ok(Array.isArray(unlocked));
    assert.strictEqual(unlocked.length, 1, '应解锁 1 条');
    assert.strictEqual(unlocked[0].achievementId, 'ach-0006');
    assert.strictEqual(unlocked[0].userId, DEMO_USER_ID);
  });

  it('再次调用 family 类检查 → 幂等返回空数组', () => {
    // 上一次已解锁 family_create，重复调用不应再产生记录
    const beforeCount = user_achievements.filter(
      (ua) => ua.userId === DEMO_USER_ID && ua.achievementId === 'ach-0006',
    ).length;
    const unlocked = AchievementService.checkAndUnlockFamilyAchievements(DEMO_USER_ID);
    assert.ok(Array.isArray(unlocked));
    assert.strictEqual(unlocked.length, 0, '幂等：应返回空数组');
    const afterCount = user_achievements.filter(
      (ua) => ua.userId === DEMO_USER_ID && ua.achievementId === 'ach-0006',
    ).length;
    assert.strictEqual(afterCount, beforeCount, 'user_achievements 中 ach-0006 数量不应增加');
  });
});

describe('AchievementService.checkAndUnlockGameplayAchievements', () => {
  it('blindguess_chef 直接解锁 → 返回 1 条 ach-0007', () => {
    const unlocked = AchievementService.checkAndUnlockGameplayAchievements(DEMO_USER_ID);
    assert.ok(Array.isArray(unlocked));
    assert.strictEqual(unlocked.length, 1, '应解锁 1 条');
    assert.strictEqual(unlocked[0].achievementId, 'ach-0007');
    assert.strictEqual(unlocked[0].userId, DEMO_USER_ID);
  });
});
