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
    const res = await request.post('/api/auth/register').send({ username: 'demo', password: 'test1234', nickname: 'dup' });
    assert.ok(res.body.code !== 0 || res.status === 400 || res.status === 409);
  });

  it('POST /api/auth/register 新用户成功', async () => {
    const request = await createTestApp();
    // AuthService.register 要求 username/password/nickname 均非空，故需带 nickname
    const res = await request
      .post('/api/auth/register')
      .send({ username: 'newuser_test_' + Date.now(), password: 'pass1234', nickname: 'tester' });
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

  it('POST /api/auth/register 弱密码被拒绝（含密码强度提示）', async () => {
    const request = await createTestApp();
    // '123456'：长度不足 + 无字母
    const res1 = await request
      .post('/api/auth/register')
      .send({ username: 'weak1_' + Date.now(), password: '123456', nickname: '弱密码1' });
    assert.ok(res1.body.code !== 0);
    assert.ok(res1.body.message.includes('密码强度'), `应提示密码强度，实际：${res1.body.message}`);
    // 'abcdefg'：7 字符 + 仅字母（无数字）
    const res2 = await request
      .post('/api/auth/register')
      .send({ username: 'weak2_' + Date.now(), password: 'abcdefg', nickname: '弱密码2' });
    assert.ok(res2.body.code !== 0);
    assert.ok(res2.body.message.includes('密码强度'), `应提示密码强度，实际：${res2.body.message}`);
    // 'password'：弱密码黑名单 + 无数字
    const res3 = await request
      .post('/api/auth/register')
      .send({ username: 'weak3_' + Date.now(), password: 'password', nickname: '弱密码3' });
    assert.ok(res3.body.code !== 0);
    assert.ok(res3.body.message.includes('密码强度'), `应提示密码强度，实际：${res3.body.message}`);
  });

  it('POST /api/auth/register 强密码注册成功', async () => {
    const request = await createTestApp();
    const res = await request
      .post('/api/auth/register')
      .send({ username: 'strong_' + Date.now(), password: 'demo1234', nickname: '强密码用户' });
    assert.strictEqual(res.body.code, 0);
    assert.ok(res.body.data.token || res.body.data);
  });

  it('POST /api/auth/register 重复用户名返回通用错误（不泄露已存在）', async () => {
    const request = await createTestApp();
    const res = await request
      .post('/api/auth/register')
      .send({ username: 'demo', password: 'test1234', nickname: '重复用户' });
    assert.ok(res.body.code !== 0);
    assert.ok(!res.body.message.includes('已存在'), `不应泄露"已存在"，实际：${res.body.message}`);
    assert.ok(res.body.message.includes('注册失败'), `应包含"注册失败"，实际：${res.body.message}`);
  });

  it('POST /api/auth/login 连续 6 次失败后第 6 次返回 429', async () => {
    const request = await createTestApp();
    // 前 5 次错误密码：返回正常错误（code !== 0），未触发限流
    for (let i = 0; i < 5; i++) {
      const res = await request
        .post('/api/auth/login')
        .send({ username: 'demo', password: 'wrong' });
      assert.ok(res.body.code !== 0 || res.status === 401, `第 ${i + 1} 次应返回正常错误`);
    }
    // 第 6 次：触发限流，返回 429 + 文案提示（body 为纯文本，非 JSON）
    const res6 = await request
      .post('/api/auth/login')
      .send({ username: 'demo', password: 'wrong' });
    assert.strictEqual(res6.status, 429);
    assert.ok(res6.text.includes('频繁'), `应包含限流提示，实际：${res6.text}`);
  });
});
