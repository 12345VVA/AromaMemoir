// 用户资料端点集成测试（迁移自 weiji-server/tests/integration/user.test.ts）
//
// 适配说明：
// 1. 端点 /api/user/profile → /app/user/profile
// 2. 成功 code 0 → 1000；未鉴权 HTTP 401 → HTTP 200 + { code:1001, message:'登录失效~' }
// 3. C 端 token 不带 Bearer 前缀
// 4. 新工程 profile 控制器返回 { ...user, recordCount:0, recipeCount:0, streak:0,
//    achievementCount:0 }（统计占位，待后续模块补全），故旧用例对 stats 子对象与
//    种子统计下限的断言不再适用——改为断言顶层字段存在 + 安全性（无 password）
// 5. 新工程用户主键为 bigint 自增（demo 种子 id=1），非旧工程 'user-demo-0001' 字符串
// 6. 新工程用户昵称字段名为 nickName（驼峰），非 nickname
import { describe, it, beforeAll } from '@jest/globals';
import { createTestApp } from '../helpers/app';
import { loginAsDemo } from '../helpers/auth';

describe('GET /app/user/profile', () => {
  let token: string;
  let request: any;

  beforeAll(async () => {
    request = await createTestApp();
    token = await loginAsDemo();
  });

  it('带 token 返回用户资料且不含 password', async () => {
    const res = await request
      .get('/app/user/profile')
      .set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(1000);
    const data = res.body.data;

    // 基本档案字段
    expect(data.id).toBe(1);
    expect(data.username).toBe('demo');
    expect(typeof data.nickName).toBe('string');
    // 安全性：响应中不应包含 password 字段
    expect(data.password).toBeUndefined();

    // 统计占位字段（控制器返回 recordCount/recipeCount/streak/achievementCount 顶层字段）
    expect(typeof data.recordCount).toBe('number');
    expect(typeof data.recipeCount).toBe('number');
    expect(typeof data.streak).toBe('number');
    expect(typeof data.achievementCount).toBe('number');
  });

  it('不带 token 返回 code:1001 登录失效', async () => {
    const res = await request.get('/app/user/profile');
    // 新工程 cool-admin 未鉴权返回 HTTP 200 + { code:1001, message:'登录失效~' }
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(1001);
  });

  it('带 Bearer 前缀的 token 验签失败返回 code:1001', async () => {
    // UserMiddleware 直接 jwt.verify(ctx.get('Authorization'))，
    // 带 Bearer 前缀会被当作 token 一部分验签失败
    const res = await request
      .get('/app/user/profile')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(1001);
  });
});
