// 趣味玩法端点集成测试（迁移自 weiji-server/tests/integration/gamification.test.ts）
//
// 适配说明：
// 1. 端点 /api/gamification/* → /app/gamification/*
// 2. 成功 code 0 → 1000；未鉴权 HTTP 401 → HTTP 200 + code:1001
// 3. C 端 token 不带 Bearer 前缀
// 4. 旧工程 recordIds 为字符串数组（'recipe-0001' 等）；新工程为数字数组（weiji_record.id）
// 5. 旧工程 pokedex 返回 { categories, totalSlots, completionRate }；
//    新工程返回 { totalSlots, unlockedSlots, completionRate, categories }，totalSlots=36
// 6. 旧工程盲猜 itemId 为字符串；新工程 itemId === recordId（数字）
// 7. demo 种子有 3 条记录（红烧牛肉面/番茄炒蛋/清炒西兰花，id=1/2/3），
//    createRound 传 recordIds=[1,2,3] 时全部存在，items 长度=3；recordIds 长度校验按传入数组 3-10
// 8. reveal 返回 { roundId, roundName, status:'revealed', items, ranking, chefWinner }
import { describe, it, beforeAll } from '@jest/globals';
import { createTestApp } from '../helpers/app';
import { loginAsDemo } from '../helpers/auth';

describe('Gamification 端点', () => {
  let token: string;
  let request: any;
  let createdRoundId: number;
  let createdItemId: number;

  beforeAll(async () => {
    request = await createTestApp();
    token = await loginAsDemo();
  });

  it('GET /app/gamification/pokedex 返回图鉴聚合', async () => {
    const res = await request
      .get('/app/gamification/pokedex')
      .set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(1000);
    expect(Array.isArray(res.body.data.categories)).toBe(true);
    expect(res.body.data.totalSlots).toBe(36);
    expect(res.body.data.totalSlots).toBeGreaterThan(0);
    // demo 种子记录红烧牛肉面在目录中，应解锁 >=1
    expect(res.body.data.unlockedSlots).toBeGreaterThanOrEqual(1);
    expect(res.body.data.completionRate).toBeGreaterThanOrEqual(0);
    expect(res.body.data.completionRate).toBeLessThanOrEqual(1);
  });

  it('GET /app/gamification/pokedex 无 token 返回 code:1001', async () => {
    const res = await request.get('/app/gamification/pokedex');
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(1001);
  });

  it('GET /app/gamification/personality 返回人格报告（demo 种子 3 条记录，available:true）', async () => {
    const res = await request
      .get('/app/gamification/personality')
      .set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(1000);
    expect(typeof res.body.data.available).toBe('boolean');
    // demo 种子近 30 天有 3 条记录（红烧牛肉面/番茄炒蛋/清炒西兰花）>= 3，available=true
    expect(res.body.data.available).toBe(true);
    expect(typeof res.body.data.recordCount).toBe('number');
    expect(res.body.data.recordCount).toBeGreaterThanOrEqual(3);
    // available 时应返回非空人格类型
    expect(typeof res.body.data.personalityType).toBe('string');
    expect(res.body.data.personalityType.length).toBeGreaterThan(0);
  });

  it('GET /app/gamification/personality 无 token 返回 code:1001', async () => {
    const res = await request.get('/app/gamification/personality');
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(1001);
  });

  it('GET /app/gamification/timemachine 返回时光机结果', async () => {
    const res = await request
      .get('/app/gamification/timemachine')
      .set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(1000);
    expect(Array.isArray(res.body.data.memories)).toBe(true);
    expect(typeof res.body.data.todayDate).toBe('string');
  });

  it('GET /app/gamification/timemachine 无 token 返回 code:1001', async () => {
    const res = await request.get('/app/gamification/timemachine');
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(1001);
  });

  it('POST /app/gamification/blindguess/round 创建有效轮次', async () => {
    const res = await request
      .post('/app/gamification/blindguess/round')
      .set('Authorization', token)
      .send({
        familyId: 1,
        roundName: '测试轮次',
        // recordIds 长度 3-10（校验按传入数组）；种子 3 条记录全部存在
        recordIds: [1, 2, 3],
      });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(1000);
    expect(res.body.data.id).toBeTruthy();
    expect(res.body.data.status).toBe('active');
    expect(Array.isArray(res.body.data.items)).toBe(true);
    // 种子 3 条记录全部存在 → items 长度=3
    expect(res.body.data.items.length).toBe(3);
    // 定位红烧牛肉面条目（record 1，作者 demo），后续 guess 用其 recordId
    const beefItem = res.body.data.items.find(
      (i: any) => i.dishName === '红烧牛肉面',
    );
    expect(beefItem).toBeTruthy();
    expect(beefItem.recordId).toBeTruthy();
    // 校验脱敏：active 状态下不含真实作者
    expect(beefItem.realAuthorId).toBeUndefined();
    expect(beefItem.realAuthorName).toBeUndefined();

    createdRoundId = res.body.data.id;
    createdItemId = beefItem.recordId;
  });

  it('POST /app/gamification/blindguess/round 无 token 返回 code:1001', async () => {
    const res = await request
      .post('/app/gamification/blindguess/round')
      .send({ familyId: 1, roundName: '测试', recordIds: [1, 2, 3] });
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(1001);
  });

  it('POST /app/gamification/blindguess/round recordIds 长度 < 3 失败', async () => {
    const res = await request
      .post('/app/gamification/blindguess/round')
      .set('Authorization', token)
      .send({ familyId: 1, roundName: '测试', recordIds: [1, 2] });
    expect(res.body.code).not.toBe(1000);
  });

  it('POST /app/gamification/blindguess/round recordIds 长度 > 10 失败', async () => {
    const ids = Array.from({ length: 11 }, (_, i) => i + 1);
    const res = await request
      .post('/app/gamification/blindguess/round')
      .set('Authorization', token)
      .send({ familyId: 1, roundName: '测试', recordIds: ids });
    expect(res.body.code).not.toBe(1000);
  });

  it('POST /app/gamification/blindguess/round 缺 familyId 失败', async () => {
    const res = await request
      .post('/app/gamification/blindguess/round')
      .set('Authorization', token)
      .send({ roundName: '测试', recordIds: [1, 2, 3] });
    expect(res.body.code).not.toBe(1000);
  });

  it('GET /app/gamification/blindguess/round/:id 查看轮次详情（active 状态 items 已脱敏）', async () => {
    const res = await request
      .get(`/app/gamification/blindguess/round/${createdRoundId}`)
      .set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(1000);
    expect(res.body.data.id).toBe(createdRoundId);
    expect(res.body.data.status).toBe('active');
    expect(Array.isArray(res.body.data.items)).toBe(true);
    for (const item of res.body.data.items) {
      expect(item.realAuthorId).toBeUndefined();
      expect(item.realAuthorName).toBeUndefined();
    }
  });

  it('GET /app/gamification/blindguess/round/:id 不存在的 id 返回业务错误', async () => {
    const res = await request
      .get('/app/gamification/blindguess/round/999999')
      .set('Authorization', token);
    expect(res.body.code).not.toBe(1000);
  });

  it('POST /app/gamification/blindguess/round/:id/guess 提交猜测成功', async () => {
    const res = await request
      .post(`/app/gamification/blindguess/round/${createdRoundId}/guess`)
      .set('Authorization', token)
      .send({
        itemId: createdItemId,
        // record 1 的作者是 demo（userId=1），猜对作者
        guessAuthorId: 1,
        guessDishName: '红烧牛肉面',
      });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(1000);
    expect(res.body.data.userId).toBe(1);
    expect(res.body.data.itemId).toBe(createdItemId);
  });

  it('POST /app/gamification/blindguess/round/:id/guess 重复提交同一 itemId 失败', async () => {
    const res = await request
      .post(`/app/gamification/blindguess/round/${createdRoundId}/guess`)
      .set('Authorization', token)
      .send({
        itemId: createdItemId,
        guessAuthorId: 1,
        guessDishName: '红烧牛肉面',
      });
    expect(res.body.code).not.toBe(1000);
  });

  it('POST /app/gamification/blindguess/round/:id/reveal 揭晓结果', async () => {
    const res = await request
      .post(`/app/gamification/blindguess/round/${createdRoundId}/reveal`)
      .set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(1000);
    expect(res.body.data.status).toBe('revealed');
    expect(Array.isArray(res.body.data.ranking)).toBe(true);
    expect(res.body.data.ranking.length).toBeGreaterThanOrEqual(1);

    // ranking 按 totalScore 降序
    const ranking = res.body.data.ranking;
    for (let i = 1; i < ranking.length; i++) {
      expect(ranking[i - 1].totalScore).toBeGreaterThanOrEqual(
        ranking[i].totalScore,
      );
    }
    // rank 1-based
    for (const entry of ranking) {
      expect(entry.rank).toBeGreaterThanOrEqual(1);
    }
  });

  it('POST /app/gamification/blindguess/round/:id/reveal 再次揭晓失败', async () => {
    const res = await request
      .post(`/app/gamification/blindguess/round/${createdRoundId}/reveal`)
      .set('Authorization', token);
    expect(res.body.code).not.toBe(1000);
  });
});
