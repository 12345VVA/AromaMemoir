// 娱乐化玩法控制器集成测试
// 覆盖端点：
//   - GET  /api/gamification/pokedex                   美食图鉴
//   - GET  /api/gamification/personality                食物人格测试
//   - GET  /api/gamification/timemachine                美食时光机
//   - POST /api/gamification/blindguess/round            发起盲猜轮次
//   - GET  /api/gamification/blindguess/round/:id        查看轮次详情
//   - POST /api/gamification/blindguess/round/:id/guess  提交猜测
//   - POST /api/gamification/blindguess/round/:id/reveal 揭晓结果
import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { createTestApp } from '../helpers/app';
import { loginAsDemo } from '../helpers/auth';

describe('Gamification 控制器', () => {
  let token: string;
  let request: any;
  // 跨用例共享：第 4 步创建的轮次 id 与首个 item 的 recordId
  let createdRoundId: string;
  let createdItemId: string;

  before(async () => {
    request = await createTestApp();
    token = await loginAsDemo();
  });

  // 1. GET /api/gamification/pokedex
  it('GET /api/gamification/pokedex 带 JWT 返回图鉴聚合', async () => {
    const res = await request
      .get('/api/gamification/pokedex')
      .set('Authorization', `Bearer ${token}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.code, 0);
    assert.ok(Array.isArray(res.body.data.categories), 'categories 应为数组');
    assert.ok(res.body.data.totalSlots > 0, 'totalSlots 应 > 0');
    assert.ok(
      res.body.data.completionRate >= 0 && res.body.data.completionRate <= 1,
      'completionRate 应在 0-1 之间',
    );
  });

  it('GET /api/gamification/pokedex 无 JWT 返回 401', async () => {
    const res = await request.get('/api/gamification/pokedex');
    assert.strictEqual(res.status, 401);
  });

  // 2. GET /api/gamification/personality
  it('GET /api/gamification/personality 带 JWT 返回人格报告', async () => {
    const res = await request
      .get('/api/gamification/personality')
      .set('Authorization', `Bearer ${token}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.code, 0);
    assert.strictEqual(typeof res.body.data.available, 'boolean');

    // demo 有 3 条近 30 天记录，应为 available=true
    if (res.body.data.available) {
      assert.ok(res.body.data.personalityType, 'personalityType 应非空');
      assert.ok(res.body.data.description, 'description 应非空');
      assert.ok(Array.isArray(res.body.data.traits), 'traits 应为数组');
      assert.ok(res.body.data.shareText, 'shareText 应存在');
    }
  });

  it('GET /api/gamification/personality 无 JWT 返回 401', async () => {
    const res = await request.get('/api/gamification/personality');
    assert.strictEqual(res.status, 401);
  });

  // 3. GET /api/gamification/timemachine
  it('GET /api/gamification/timemachine 带 JWT 返回时光机结果', async () => {
    const res = await request
      .get('/api/gamification/timemachine')
      .set('Authorization', `Bearer ${token}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.code, 0);
    assert.ok(Array.isArray(res.body.data.memories), 'memories 应为数组');
    assert.strictEqual(
      typeof res.body.data.todayDate,
      'string',
      'todayDate 应为字符串',
    );
  });

  it('GET /api/gamification/timemachine 无 JWT 返回 401', async () => {
    const res = await request.get('/api/gamification/timemachine');
    assert.strictEqual(res.status, 401);
  });

  // 4. POST /api/gamification/blindguess/round 创建有效轮次
  it('POST /api/gamification/blindguess/round 创建有效轮次', async () => {
    const res = await request
      .post('/api/gamification/blindguess/round')
      .set('Authorization', `Bearer ${token}`)
      .send({
        familyId: 'family-0001',
        roundName: '测试轮次',
        recordIds: ['recipe-0001', 'recipe-0002', 'recipe-0003'],
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.code, 0);
    assert.ok(res.body.data.id, '应返回轮次 id');
    assert.strictEqual(res.body.data.status, 'active');
    assert.strictEqual(res.body.data.items.length, 3);
    // 校验公共字段存在（recordId / dishName / coverUrl）
    assert.ok(res.body.data.items[0].recordId, 'items[0] 应有 recordId');
    assert.ok(res.body.data.items[0].dishName, 'items[0] 应有 dishName');
    assert.ok(res.body.data.items[0].coverUrl, 'items[0] 应有 coverUrl');
    // 校验脱敏：active 状态下不应包含真实作者信息（防止破坏盲猜玩法）
    assert.strictEqual(res.body.data.items[0].realAuthorId, undefined, 'active 轮次不应暴露 realAuthorId');
    assert.strictEqual(res.body.data.items[0].realAuthorName, undefined, 'active 轮次不应暴露 realAuthorName');
    // 保存供后续用例使用
    createdRoundId = res.body.data.id;
    createdItemId = res.body.data.items[0].recordId;
  });

  it('POST /api/gamification/blindguess/round 无 JWT 返回 401', async () => {
    const res = await request
      .post('/api/gamification/blindguess/round')
      .send({
        familyId: 'family-0001',
        roundName: '测试轮次',
        recordIds: ['recipe-0001', 'recipe-0002', 'recipe-0003'],
      });
    assert.strictEqual(res.status, 401);
  });

  // 5. POST /api/gamification/blindguess/round 边界校验
  it('POST /api/gamification/blindguess/round recordIds 长度 < 3 应失败', async () => {
    const res = await request
      .post('/api/gamification/blindguess/round')
      .set('Authorization', `Bearer ${token}`)
      .send({
        familyId: 'family-0001',
        roundName: '测试轮次',
        recordIds: ['recipe-0001', 'recipe-0002'],
      });
    assert.notStrictEqual(res.body.code, 0, '应返回业务错误');
  });

  it('POST /api/gamification/blindguess/round recordIds 长度 > 10 应失败', async () => {
    const ids = Array.from({ length: 11 }, (_, i) => `recipe-${String(i).padStart(4, '0')}`);
    const res = await request
      .post('/api/gamification/blindguess/round')
      .set('Authorization', `Bearer ${token}`)
      .send({
        familyId: 'family-0001',
        roundName: '测试轮次',
        recordIds: ids,
      });
    assert.notStrictEqual(res.body.code, 0, '应返回业务错误');
  });

  it('POST /api/gamification/blindguess/round 缺少 familyId 应失败', async () => {
    const res = await request
      .post('/api/gamification/blindguess/round')
      .set('Authorization', `Bearer ${token}`)
      .send({
        roundName: '测试轮次',
        recordIds: ['recipe-0001', 'recipe-0002', 'recipe-0003'],
      });
    assert.notStrictEqual(res.body.code, 0, '应返回业务错误');
  });

  // 6. GET /api/gamification/blindguess/round/:id
  it('GET /api/gamification/blindguess/round/:id 查看轮次详情（active 状态 items 已脱敏）', async () => {
    const res = await request
      .get(`/api/gamification/blindguess/round/${createdRoundId}`)
      .set('Authorization', `Bearer ${token}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.code, 0);
    assert.strictEqual(res.body.data.id, createdRoundId);
    assert.strictEqual(res.body.data.status, 'active');
    assert.ok(Array.isArray(res.body.data.items), 'items 应为数组');
    // active 状态下 items 应已脱敏：不含 realAuthorId / realAuthorName
    for (const item of res.body.data.items) {
      assert.strictEqual(
        item.realAuthorId,
        undefined,
        'active 状态 items 不应含 realAuthorId',
      );
      assert.strictEqual(
        item.realAuthorName,
        undefined,
        'active 状态 items 不应含 realAuthorName',
      );
    }
  });

  it('GET /api/gamification/blindguess/round/:id 不存在的 id 返回业务错误', async () => {
    const res = await request
      .get('/api/gamification/blindguess/round/round-not-exist-9999')
      .set('Authorization', `Bearer ${token}`);
    assert.notStrictEqual(res.body.code, 0, '不存在的 id 应返回业务错误');
  });

  // 7. POST /api/gamification/blindguess/round/:id/guess
  it('POST /api/gamification/blindguess/round/:id/guess 提交猜测', async () => {
    const res = await request
      .post(`/api/gamification/blindguess/round/${createdRoundId}/guess`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        itemId: createdItemId,
        guessAuthorId: 'user-mom-0002',
        guessDishName: '红烧牛肉面',
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.code, 0);
    assert.strictEqual(res.body.data.userId, 'user-demo-0001');
    assert.strictEqual(res.body.data.itemId, createdItemId);
  });

  it('POST /api/gamification/blindguess/round/:id/guess 重复提交同一 itemId 应失败', async () => {
    const res = await request
      .post(`/api/gamification/blindguess/round/${createdRoundId}/guess`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        itemId: createdItemId,
        guessAuthorId: 'user-mom-0002',
        guessDishName: '红烧牛肉面',
      });
    assert.notStrictEqual(res.body.code, 0, '重复提交应失败');
  });

  // 8. POST /api/gamification/blindguess/round/:id/reveal
  it('POST /api/gamification/blindguess/round/:id/reveal 揭晓结果', async () => {
    const res = await request
      .post(`/api/gamification/blindguess/round/${createdRoundId}/reveal`)
      .set('Authorization', `Bearer ${token}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.code, 0);
    assert.strictEqual(res.body.data.status, 'revealed');
    assert.ok(Array.isArray(res.body.data.ranking), 'ranking 应为数组');

    const ranking = res.body.data.ranking;
    assert.ok(ranking.length >= 1, '至少一名参与者');

    // ranking 按 totalScore 降序
    for (let i = 1; i < ranking.length; i++) {
      assert.ok(
        ranking[i - 1].totalScore >= ranking[i].totalScore,
        'ranking 应按 totalScore 降序',
      );
    }
    // rank 1-based
    for (const entry of ranking) {
      assert.ok(entry.rank >= 1, 'rank 应 1-based');
    }
  });

  it('POST /api/gamification/blindguess/round/:id/reveal 再次揭晓应失败', async () => {
    const res = await request
      .post(`/api/gamification/blindguess/round/${createdRoundId}/reveal`)
      .set('Authorization', `Bearer ${token}`);
    assert.notStrictEqual(res.body.code, 0, '再次揭晓应失败');
  });
});
