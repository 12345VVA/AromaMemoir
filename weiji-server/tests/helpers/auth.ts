// 测试用鉴权辅助：以 demo 用户登录换取 JWT token
// 供需要鉴权头（Authorization: Bearer <token>）的集成测试复用。
// demo 种子用户：username=demo password=123456（见 src/store/db.ts）
import { createTestApp } from './app';

export async function loginAsDemo(): Promise<string> {
  const request = await createTestApp();
  const res = await request
    .post('/api/auth/login')
    .send({ username: 'demo', password: '123456' });
  // 登录响应结构：{ code: 0, data: { token, user }, message: '' }
  return res.body.data.token;
}
