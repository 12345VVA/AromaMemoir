// JWT 工具 单元测试（迁移自 weiji-server/tests/unit/jwt.test.ts）
//
// 适配说明：
// 1. 新工程 C 端 token 由 account/service/auth.ts 的 generateToken 签发，
//    secret 为 module.account.jwt.secret（与 module.user.jwt.secret 一致）：
//    'cae15566-a72b-4bf2-b89a-54fb1391d83fx'
// 2. token payload 形如 { isRefresh, userId, username, passwordVersion, tenantId }
// 3. 旧工程 jwtMiddleware（Koa 中间件）在新工程由 user/middleware/app.ts 的
//    UserMiddleware（Midway 中间件）替代，签名与 ctx 处理方式不同，故中间件
//    专用断言不再适用——鉴权行为改由 integration/* 测试覆盖。此处仅保留
//    jsonwebtoken sign/verify 往返、过期、篡改、无效 token 等纯函数用例。
import * as jwt from 'jsonwebtoken';

// 与 src/modules/account/config.ts / src/modules/user/config.ts 中 jwt.secret 一致
const SECRET = 'cae15566-a72b-4bf2-b89a-54fb1391d83fx';

describe('JWT sign + verify 往返', () => {
  it('sign 的 token verify 后字段一致', () => {
    const payload = {
      isRefresh: false,
      userId: 1,
      username: 'demo',
      passwordVersion: 1,
      tenantId: null,
    };
    const token = jwt.sign(payload, SECRET);
    const decoded = jwt.verify(token, SECRET) as typeof payload & {
      iat: number;
      exp: number;
    };
    expect(decoded.userId).toBe(1);
    expect(decoded.username).toBe('demo');
    expect(decoded.isRefresh).toBe(false);
  });

  it('sign 携带 expiresIn 后 verify 仍能解出 payload', () => {
    const token = jwt.sign(
      { isRefresh: false, userId: 2, username: 'mom' },
      SECRET,
      { expiresIn: '7d' } as jwt.SignOptions,
    );
    const decoded = jwt.verify(token, SECRET) as { userId: number; username: string };
    expect(decoded.userId).toBe(2);
    expect(decoded.username).toBe('mom');
  });

  it('用错误 secret verify 抛错', () => {
    const token = jwt.sign({ userId: 1, username: 'demo' }, SECRET);
    expect(() => jwt.verify(token, 'wrong-secret')).toThrow();
  });
});

describe('JWT 过期 token 验证失败', () => {
  it('exp 已过期的 token verify 抛 jwt expired', () => {
    // 直接在 payload 内置 exp 为 60 秒前，sign 时不传 expiresIn，
    // jsonwebtoken 会沿用 payload 的 exp，签出的 token 即刻过期。
    const payload = {
      userId: 1,
      username: 'demo',
      exp: Math.floor(Date.now() / 1000) - 60,
    };
    const expiredToken = jwt.sign(payload, SECRET);
    expect(() => jwt.verify(expiredToken, SECRET)).toThrow(/jwt expired/i);
  });
});

describe('JWT 无效 token 验证失败', () => {
  it('verify 非法字符串抛错', () => {
    expect(() => jwt.verify('not-a-valid-token', SECRET)).toThrow();
  });

  it('verify 空字符串抛错', () => {
    expect(() => jwt.verify('', SECRET)).toThrow();
  });

  it('verify 篡改后的 token 抛错', () => {
    const token = jwt.sign({ userId: 1, username: 'demo' }, SECRET);
    const tampered =
      token.slice(0, -2) + (token.endsWith('A') ? 'B' : 'A') + token.slice(-1);
    expect(() => jwt.verify(tampered, SECRET)).toThrow();
  });
});

describe('JWT payload 还原语义', () => {
  it('isRefresh:true 的 refresh token 仍可 verify（业务层拒绝由中间件处理）', () => {
    const token = jwt.sign(
      { isRefresh: true, userId: 1, username: 'demo' },
      SECRET,
    );
    const decoded = jwt.verify(token, SECRET) as { isRefresh: boolean };
    expect(decoded.isRefresh).toBe(true);
  });
});
