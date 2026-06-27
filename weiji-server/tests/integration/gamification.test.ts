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
import { blindGuessRounds, family_members } from '../../src/store/db';
import type { BlindGuessRound, FamilyMember } from '../../src/store/types';

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

  // 9. 揭晓后再猜测应返回业务错误（code != 0）
  it('POST /api/gamification/blindguess/round/:id/guess 揭晓后再猜测应返回业务错误', async () => {
    const res = await request
      .post(`/api/gamification/blindguess/round/${createdRoundId}/guess`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        itemId: createdItemId,
        guessAuthorId: 'user-mom-0002',
        guessDishName: '红烧牛肉面',
      });
    assert.notStrictEqual(res.body.code, 0, '已揭晓轮次不应再接受猜测');
    assert.strictEqual(res.body.code, 400);
  });

  // 10. POST /api/gamification/blindguess/round 家庭组不存在返回 403
  it('POST /api/gamification/blindguess/round 家庭组不存在返回 403', async () => {
    const res = await request
      .post('/api/gamification/blindguess/round')
      .set('Authorization', `Bearer ${token}`)
      .send({
        familyId: 'family-not-exist-9999',
        roundName: '不存在的家庭',
        recordIds: ['recipe-0001', 'recipe-0002', 'recipe-0003'],
      });
    assert.strictEqual(res.body.code, 403, '家庭组不存在应返回 403');
  });

  // 11. POST /api/gamification/blindguess/round/:id/reveal 非 creator 返回 403
  it('POST /api/gamification/blindguess/round/:id/reveal 非 creator 用户揭晓返回 403', async () => {
    // 直接构造一个 creatorId 为 mom 的 active 轮次，demo 尝试揭晓应 403
    const otherRound: BlindGuessRound = {
      id: 'integ-round-mom-creator-001',
      familyId: 'family-0001',
      roundName: '妈妈发起的轮次',
      creatorId: 'user-mom-0002',
      items: [
        {
          recordId: 'recipe-0001',
          recipeId: 'recipe-0001',
          dishName: '红烧牛肉面',
          coverUrl: 'assets/food-hongshaorou.jpg',
          realAuthorId: 'user-demo-0001',
          realAuthorName: '小明',
        },
      ],
      guesses: [],
      status: 'active',
      createdAt: new Date().toISOString(),
      revealedAt: null,
    };
    blindGuessRounds.push(otherRound);
    try {
      const res = await request
        .post(`/api/gamification/blindguess/round/${otherRound.id}/reveal`)
        .set('Authorization', `Bearer ${token}`);
      assert.strictEqual(res.body.code, 403, '非 creator 揭晓应返回 403');
    } finally {
      const idx = blindGuessRounds.findIndex((r) => r.id === otherRound.id);
      if (idx >= 0) blindGuessRounds.splice(idx, 1);
    }
  });

  // 12. GET /api/gamification/blindguess/rounds 缺少 familyId 返回 400
  it('GET /api/gamification/blindguess/rounds 缺少 familyId 返回 400', async () => {
    const res = await request
      .get('/api/gamification/blindguess/rounds')
      .set('Authorization', `Bearer ${token}`);
    assert.strictEqual(res.body.code, 400, '缺少 familyId 应返回 400');
  });

  // 13. GET /api/gamification/blindguess/rounds 非家庭成员返回 403
  it('GET /api/gamification/blindguess/rounds 非家庭成员返回 403', async () => {
    const res = await request
      .get('/api/gamification/blindguess/rounds?familyId=family-not-exist-9999')
      .set('Authorization', `Bearer ${token}`);
    assert.strictEqual(res.body.code, 403, '非家庭成员应返回 403');
  });

  // 14. GET /api/gamification/blindguess/rounds 返回当前家庭轮次：active 脱敏、revealed 原样
  it('GET /api/gamification/blindguess/rounds 返回当前家庭轮次（active 脱敏、revealed 原样）', async () => {
    // 新建一个 active 轮次用于校验脱敏
    const createRes = await request
      .post('/api/gamification/blindguess/round')
      .set('Authorization', `Bearer ${token}`)
      .send({
        familyId: 'family-0001',
        roundName: '列表脱敏测试轮次',
        recordIds: ['recipe-0001', 'recipe-0002', 'recipe-0003'],
      });
    assert.strictEqual(createRes.body.code, 0);
    const activeRoundId = createRes.body.data.id;

    const res = await request
      .get('/api/gamification/blindguess/rounds?familyId=family-0001')
      .set('Authorization', `Bearer ${token}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.code, 0);
    assert.ok(Array.isArray(res.body.data), '返回应为数组');
    assert.ok(res.body.data.length >= 1, '至少包含已创建的轮次');

    // active 轮次应已脱敏（items 不含 realAuthorId / realAuthorName）
    const active = res.body.data.find((r: any) => r.id === activeRoundId);
    assert.ok(active, '应包含刚创建的 active 轮次');
    assert.strictEqual(active.status, 'active');
    for (const item of active.items) {
      assert.strictEqual(item.realAuthorId, undefined, 'active items 不应含 realAuthorId');
      assert.strictEqual(item.realAuthorName, undefined, 'active items 不应含 realAuthorName');
    }

    // revealed 轮次应原样返回（items 含 realAuthorId / realAuthorName）
    const revealed = res.body.data.find((r: any) => r.id === createdRoundId);
    assert.ok(revealed, '应包含已揭晓的 revealed 轮次');
    assert.strictEqual(revealed.status, 'revealed');
    assert.ok(
      revealed.items[0].realAuthorId !== undefined,
      'revealed items 应保留 realAuthorId',
    );
    assert.ok(
      revealed.items[0].realAuthorName !== undefined,
      'revealed items 应保留 realAuthorName',
    );

    // 列表应按 createdAt 降序
    for (let i = 1; i < res.body.data.length; i++) {
      assert.ok(
        res.body.data[i - 1].createdAt >= res.body.data[i].createdAt,
        '列表应按 createdAt 降序',
      );
    }
  });

  // 15. GET /api/gamification/blindguess/rounds 跨家庭隔离：不返回其他家庭轮次
  it('GET /api/gamification/blindguess/rounds 跨家庭隔离：不返回其他家庭轮次', async () => {
    // 直接塞入一个其他家庭的轮次，列表查询 family-0001 时不应包含它
    const otherRound: BlindGuessRound = {
      id: 'integ-round-other-family-002',
      familyId: 'family-other-9999',
      roundName: '其他家庭的轮次',
      creatorId: 'user-demo-0001',
      items: [],
      guesses: [],
      status: 'active',
      createdAt: new Date().toISOString(),
      revealedAt: null,
    };
    blindGuessRounds.push(otherRound);
    try {
      const res = await request
        .get('/api/gamification/blindguess/rounds?familyId=family-0001')
        .set('Authorization', `Bearer ${token}`);
      assert.strictEqual(res.body.code, 0);
      const ids = res.body.data.map((r: any) => r.id);
      assert.ok(!ids.includes(otherRound.id), '不应包含其他家庭的轮次');
    } finally {
      const idx = blindGuessRounds.findIndex((r) => r.id === otherRound.id);
      if (idx >= 0) blindGuessRounds.splice(idx, 1);
    }
  });

  // 16. GET /api/gamification/blindguess/rounds 空列表：无轮次的家庭返回空数组
  it('GET /api/gamification/blindguess/rounds 空列表：无轮次的家庭返回空数组', async () => {
    // 临时给 demo 加一个空家庭的成员关系
    const membership: FamilyMember = {
      id: 'fm-integ-empty-0002',
      familyId: 'family-empty-0002',
      userId: 'user-demo-0001',
      role: 'member',
      joinedAt: new Date().toISOString(),
    };
    family_members.push(membership);
    try {
      const res = await request
        .get('/api/gamification/blindguess/rounds?familyId=family-empty-0002')
        .set('Authorization', `Bearer ${token}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.code, 0);
      assert.ok(Array.isArray(res.body.data));
      assert.strictEqual(res.body.data.length, 0, '无轮次家庭应返回空数组');
    } finally {
      const idx = family_members.findIndex((m) => m.id === membership.id);
      if (idx >= 0) family_members.splice(idx, 1);
    }
  });
});
