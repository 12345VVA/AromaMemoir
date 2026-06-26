import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createTestApp } from '../helpers/app';

describe('认证端点', () => {
  it('POST /api/auth/login demo/123456 成功返回 token', async () => {
    const request = await createTestApp();
    const res = await request.post('/api/auth/login').send({ username: 'demo', password: '123456' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.code, 0);
    assert.ok(res.body.data.token);
    assert.ok(res.body.data.user);
  });

  it('POST /api/auth/login 错误密码失败', async () => {
    const request = await createTestApp();
    const res = await request.post('/api/auth/login').send({ username: 'demo', password: 'wrong' });
    // 控制器 catch 后返回 fail(message, 400)：HTTP 200 但 code=400
    assert.ok(res.body.code !== 0 || res.status === 401);
  });

  it('POST /api/auth/register 重复用户名失败', async () => {
    const request = await createTestApp();
    const res = await request.post('/api/auth/register').send({ username: 'demo', password: 'any', nickname: 'dup' });
    assert.ok(res.body.code !== 0 || res.status === 400 || res.status === 409);
  });

  it('POST /api/auth/register 新用户成功', async () => {
    const request = await createTestApp();
    // AuthService.register 要求 username/password/nickname 均非空，故需带 nickname
    const res = await request
      .post('/api/auth/register')
      .send({ username: 'newuser_test_' + Date.now(), password: 'pass123', nickname: 'tester' });
    assert.strictEqual(res.body.code, 0);
    assert.ok(res.body.data.token || res.body.data);
  });

  it('POST /api/auth/logout 带 token 成功', async () => {
    const request = await createTestApp();
    const loginRes = await request.post('/api/auth/login').send({ username: 'demo', password: '123456' });
    const token = loginRes.body.data.token;
    const res = await request.post('/api/auth/logout').set('Authorization', `Bearer ${token}`);
    assert.strictEqual(res.body.code, 0);
  });
});
