// JWT 工具与中间件 单元测试
// 项目未独立导出 sign/verify（封装在 jwtMiddleware 内部、AuthService.signToken 为私有），
// 故用 jsonwebtoken + appConfig.jwt.secret 直接测试签发/校验往返，
// 并构造最小 koa Context mock 验证 jwtMiddleware 的鉴权行为。
import { describe, it } from 'node:test';
import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import { appConfig } from '../../src/configuration';
import { jwtMiddleware } from '../../src/middleware/jwt.middleware';

const SECRET = appConfig.jwt.secret;

describe('JWT sign + verify 往返', () => {
  it('sign 的 token verify 后字段一致', () => {
    const payload = { userId: 'user-demo-0001', username: 'demo' };
    const token = jwt.sign(payload, SECRET);
    const decoded = jwt.verify(token, SECRET) as { userId: string; username: string };
    assert.strictEqual(decoded.userId, 'user-demo-0001');
    assert.strictEqual(decoded.username, 'demo');
  });

  it('sign 携带 expiresIn 后 verify 仍能解出 payload', () => {
    const token = jwt.sign({ userId: 'u-2', username: 'mom' }, SECRET, {
      expiresIn: '7d',
    } as jwt.SignOptions);
    const decoded = jwt.verify(token, SECRET) as { userId: string; username: string };
    assert.strictEqual(decoded.userId, 'u-2');
    assert.strictEqual(decoded.username, 'mom');
  });

  it('用错误 secret verify 抛错', () => {
    const token = jwt.sign({ userId: 'x', username: 'y' }, SECRET);
    assert.throws(() => jwt.verify(token, 'wrong-secret'));
  });
});

describe('JWT 过期 token 验证失败', () => {
  it('exp 已过期的 token verify 抛 jwt expired', () => {
    // 直接在 payload 内置 exp 为 60 秒前，sign 时不传 expiresIn，
    // jsonwebtoken 会沿用 payload 的 exp，签出的 token 即刻过期。
    const payload = {
      userId: 'u-1',
      username: 'demo',
      exp: Math.floor(Date.now() / 1000) - 60,
    };
    const expiredToken = jwt.sign(payload, SECRET);
    assert.throws(
      () => jwt.verify(expiredToken, SECRET),
      /jwt expired/i,
    );
  });
});

describe('JWT 无效 token 验证失败', () => {
  it('verify 非法字符串抛错', () => {
    assert.throws(() => jwt.verify('not-a-valid-token', SECRET));
  });

  it('verify 空字符串抛错', () => {
    assert.throws(() => jwt.verify('', SECRET));
  });

  it('verify 篡改后的 token 抛错', () => {
    const token = jwt.sign({ userId: 'u', username: 'd' }, SECRET);
    const tampered = token.slice(0, -2) + (token.endsWith('A') ? 'B' : 'A') + token.slice(-1);
    assert.throws(() => jwt.verify(tampered, SECRET));
  });
});

describe('jwtMiddleware 鉴权行为', () => {
  // 最小化 koa Context mock：仅覆盖中间件用到的字段
  function mockCtx(opts: { method?: string; path?: string; authorization?: string }) {
    return {
      method: opts.method ?? 'GET',
      path: opts.path ?? '/api/records',
      header: opts.authorization ? { authorization: opts.authorization } : {},
      status: 0,
      body: null as unknown,
      state: {} as { user?: { userId: string; username: string } },
    } as unknown as Parameters<typeof jwtMiddleware>[0];
  }

  it('白名单路径（POST /api/auth/login）直接放行并调用 next', async () => {
    const ctx = mockCtx({ method: 'POST', path: '/api/auth/login' });
    let nextCalled = false;
    await jwtMiddleware(ctx, async () => {
      nextCalled = true;
    });
    assert.strictEqual(nextCalled, true);
    assert.strictEqual(ctx.status, 0); // 未被中间件改写
  });

  it('GET /health 健康检查在白名单中', async () => {
    const ctx = mockCtx({ method: 'GET', path: '/health' });
    let nextCalled = false;
    await jwtMiddleware(ctx, async () => {
      nextCalled = true;
    });
    assert.strictEqual(nextCalled, true);
  });

  it('OPTIONS 预检请求一律放行', async () => {
    const ctx = mockCtx({ method: 'OPTIONS', path: '/api/records' });
    let nextCalled = false;
    await jwtMiddleware(ctx, async () => {
      nextCalled = true;
    });
    assert.strictEqual(nextCalled, true);
  });

  it('缺少 Authorization header 返回 401 且不调用 next', async () => {
    const ctx = mockCtx({});
    let nextCalled = false;
    await jwtMiddleware(ctx, async () => {
      nextCalled = true;
    });
    assert.strictEqual(ctx.status, 401);
    assert.strictEqual(nextCalled, false);
    assert.strictEqual((ctx.body as { code: number }).code, 401);
  });

  it('格式错误的 Authorization（非 Bearer）返回 401', async () => {
    const ctx = mockCtx({ authorization: 'Token abc.def.ghi' });
    let nextCalled = false;
    await jwtMiddleware(ctx, async () => {
      nextCalled = true;
    });
    assert.strictEqual(ctx.status, 401);
    assert.strictEqual(nextCalled, false);
  });

  it('Bearer 后为空 token 返回 401', async () => {
    const ctx = mockCtx({ authorization: 'Bearer ' });
    let nextCalled = false;
    await jwtMiddleware(ctx, async () => {
      nextCalled = true;
    });
    assert.strictEqual(ctx.status, 401);
    assert.strictEqual(nextCalled, false);
  });

  it('合法 token 将 user 挂到 ctx.state 并调用 next', async () => {
    const token = jwt.sign({ userId: 'user-demo-0001', username: 'demo' }, SECRET);
    const ctx = mockCtx({ authorization: `Bearer ${token}` });
    let nextCalled = false;
    await jwtMiddleware(ctx, async () => {
      nextCalled = true;
    });
    assert.strictEqual(nextCalled, true);
    assert.strictEqual(ctx.state.user?.userId, 'user-demo-0001');
    assert.strictEqual(ctx.state.user?.username, 'demo');
  });

  it('过期 token 返回 401 且不调用 next', async () => {
    const token = jwt.sign(
      { userId: 'u-1', username: 'demo', exp: Math.floor(Date.now() / 1000) - 60 },
      SECRET,
    );
    const ctx = mockCtx({ authorization: `Bearer ${token}` });
    let nextCalled = false;
    await jwtMiddleware(ctx, async () => {
      nextCalled = true;
    });
    assert.strictEqual(ctx.status, 401);
    assert.strictEqual(nextCalled, false);
  });

  it('用错误 secret 签发的 token 返回 401', async () => {
    const token = jwt.sign({ userId: 'u-1', username: 'demo' }, 'another-secret');
    const ctx = mockCtx({ authorization: `Bearer ${token}` });
    let nextCalled = false;
    await jwtMiddleware(ctx, async () => {
      nextCalled = true;
    });
    assert.strictEqual(ctx.status, 401);
    assert.strictEqual(nextCalled, false);
  });
});
