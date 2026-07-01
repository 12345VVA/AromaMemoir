// 测试用鉴权辅助（迁移自旧 weiji-server/tests/helpers/auth.ts）
//
// 适配说明：
// 1. 登录端点 /api/auth/login → /app/account/login
// 2. cool-admin 成功响应码为 1000（旧工程为 0），data 结构为 { token, user }
// 3. C 端 token 注入 Authorization 头时 **不带 Bearer 前缀**（cool-admin
//    UserMiddleware 直接 jwt.verify(ctx.get('Authorization'))，带 Bearer 反而验签失败）
// 4. demo 种子用户：username=demo password=123456（见 account/db.json）
import { createTestApp } from './app';

export async function loginAsDemo(): Promise<string> {
  const request = await createTestApp();
  const res = await request
    .post('/app/account/login')
    .send({ username: 'demo', password: '123456' });
  return res.body.data.token;
}

export async function login(
  username: string,
  password: string,
): Promise<string> {
  const request = await createTestApp();
  const res = await request
    .post('/app/account/login')
    .send({ username, password });
  return res.body.data.token;
}
