// 打卡端点集成测试（迁移自 weiji-server/tests/integration/checkin.test.ts）
//
// 适配说明：
// 1. 端点 /api/checkin/status → /app/checkin/status；POST /api/checkin → POST /app/checkin
// 2. 成功 code 0 → 1000；未鉴权 HTTP 401 → HTTP 200 + code:1001
// 3. C 端 token 不带 Bearer 前缀
// 4. 新工程 CheckinService.checkin 返回 { todayChecked, streak, alreadyChecked?, message? }
//    demo 种子用户已有今日打卡（streak=4），重复打卡返回
//    { todayChecked:true, streak:4, alreadyChecked:true, message:'今日已打卡' }
import { describe, it, beforeAll } from '@jest/globals';
import { createTestApp } from '../helpers/app';
import { loginAsDemo } from '../helpers/auth';

describe('Checkin 端点', () => {
  let token: string;
  let request: any;

  beforeAll(async () => {
    request = await createTestApp();
    token = await loginAsDemo();
  });

  it('GET /app/checkin/status 返回打卡状态结构', async () => {
    const res = await request
      .get('/app/checkin/status')
      .set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(1000);
    const data = res.body.data;
    expect(typeof data.todayChecked).toBe('boolean');
    expect(typeof data.streak).toBe('number');
    expect(data.streak).toBeGreaterThanOrEqual(0);
  });

  it('POST /app/checkin 重复打卡返回 todayChecked=true 与 streak', async () => {
    const res = await request
      .post('/app/checkin')
      .set('Authorization', token)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(1000);
    const data = res.body.data;
    expect(typeof data.streak).toBe('number');
    expect(data.streak).toBeGreaterThanOrEqual(0);
    // 今日已打卡或刚打卡成功，均应 todayChecked=true
    expect(data.todayChecked).toBe(true);
    // message 字段存在（"今日已打卡" 或 "打卡成功"）
    expect(res.body.message || data.message).toBeTruthy();
  });

  it('GET /app/checkin/status 无 token 返回 code:1001', async () => {
    const res = await request.get('/app/checkin/status');
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(1001);
  });

  it('POST /app/checkin 无 token 返回 code:1001', async () => {
    const res = await request.post('/app/checkin').send({});
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(1001);
  });
});
