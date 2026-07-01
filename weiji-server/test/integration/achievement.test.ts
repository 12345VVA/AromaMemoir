// 成就端点集成测试（迁移自 weiji-server/tests/integration/achievement.test.ts）
//
// 适配说明：
// 1. 端点 /api/achievement/{list,level} → /app/achievement/{list,level}
// 2. 成功 code 0 → 1000；未鉴权 HTTP 401 → HTTP 200 + code:1001
// 3. C 端 token 不带 Bearer 前缀
// 4. 旧工程 demo 种子已解锁 ach-0001/ach-0002，exp=250 level=3；
//    新工程 demo 种子成就**全部 unlocked:false**，level=1 exp=0 nextLevelExp=100 progress=0
//    （achievement/db.json 仅插 6 条成就定义，未插 user_achievement 解锁记录）
//    故旧用例对"已解锁成就 unlocked=true / exp=250 level=3"的精确断言改为：
//      - list：长度 >= 6 且每项含 unlocked 字段
//      - level：字段类型 + level>=1 + progress 在 0-100 + exp>=0
import { describe, it, beforeAll } from '@jest/globals';
import { createTestApp } from '../helpers/app';
import { loginAsDemo } from '../helpers/auth';

describe('Achievement 端点', () => {
  let token: string;
  let request: any;

  beforeAll(async () => {
    request = await createTestApp();
    token = await loginAsDemo();
  });

  it('GET /app/achievement/list 返回徽章列表且含 unlocked 字段', async () => {
    const res = await request
      .get('/app/achievement/list')
      .set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(1000);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(6);

    // 每项应含 unlocked 字段；demo 种子成就全部未解锁
    for (const a of res.body.data) {
      expect(typeof a.unlocked).toBe('boolean');
    }
    // demo 种子全部 unlocked:false，无 earnedAt
    const anyUnlocked = res.body.data.some((a: any) => a.unlocked === true);
    expect(anyUnlocked).toBe(false);
  });

  it('GET /app/achievement/level 返回等级与进度数据', async () => {
    const res = await request
      .get('/app/achievement/level')
      .set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(1000);
    const data = res.body.data;
    expect(typeof data.level).toBe('number');
    expect(typeof data.exp).toBe('number');
    expect(typeof data.nextLevelExp).toBe('number');
    expect(typeof data.progress).toBe('number');
    expect(data.level).toBeGreaterThanOrEqual(1);
    expect(data.exp).toBeGreaterThanOrEqual(0);
    expect(data.progress).toBeGreaterThanOrEqual(0);
    expect(data.progress).toBeLessThanOrEqual(100);

    // demo 种子未解锁任何成就，exp=0 level=1 nextLevelExp=100 progress=0
    expect(data.exp).toBe(0);
    expect(data.level).toBe(1);
    expect(data.nextLevelExp).toBe(100);
    expect(data.progress).toBe(0);
  });

  it('GET /app/achievement/list 无 token 返回 code:1001', async () => {
    const res = await request.get('/app/achievement/list');
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(1001);
  });
});
