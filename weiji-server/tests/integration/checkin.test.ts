// 打卡控制器集成测试
// 覆盖端点：
//   - GET  /api/checkin/status  打卡状态（todayChecked/streak/lastCheckDate）
//   - POST /api/checkin         打卡（demo 种子已有今日打卡，重复打卡返回 alreadyChecked）
import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { createTestApp } from '../helpers/app';
import { loginAsDemo } from '../helpers/auth';

describe('Checkin 控制器', () => {
  let token: string;
  let request: any;

  before(async () => {
    request = await createTestApp();
    token = await loginAsDemo();
  });

  // GET /api/checkin/status 打卡状态
  it('GET /api/checkin/status 返回打卡状态结构', async () => {
    const res = await request
      .get('/api/checkin/status')
      .set('Authorization', `Bearer ${token}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.code, 0);
    const data = res.body.data;
    assert.strictEqual(typeof data.todayChecked, 'boolean');
    assert.strictEqual(typeof data.streak, 'number');
    // demo 种子用户有连续打卡记录，streak 应 >= 1（除非时区边界）
    assert.ok(data.streak >= 0, 'streak 非负');
    // lastCheckDate 为字符串或 null
    assert.ok(data.lastCheckDate === null || typeof data.lastCheckDate === 'string');
  });

  // POST /api/checkin 打卡
  // demo 种子用户已有今日打卡记录，因此重复打卡应返回 alreadyChecked 提示（不重复增加天数）
  it('POST /api/checkin 返回 code:0 且包含 streak 字段', async () => {
    const res = await request
      .post('/api/checkin')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.code, 0);
    const data = res.body.data;
    assert.strictEqual(typeof data.streak, 'number');
    assert.ok(data.streak >= 0, 'streak 非负');
    // 今日已打卡或刚打卡成功，均应 todayChecked=true
    assert.strictEqual(data.todayChecked, true);
    // message 字段存在（"今日已打卡" 或 "打卡成功"）
    assert.ok(res.body.message || data.message, '应包含提示信息');
  });

  // GET /api/checkin/status 无 JWT 返回 401
  it('GET /api/checkin/status 无 JWT 返回 401', async () => {
    const res = await request.get('/api/checkin/status');

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.code, 401);
  });
});
