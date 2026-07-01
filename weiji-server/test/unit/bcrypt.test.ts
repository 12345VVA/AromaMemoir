// bcrypt 工具 单元测试（迁移自 weiji-server/tests/unit/bcrypt.test.ts）
//
// 适配说明：
// 新工程仍用 bcryptjs（@types/bcryptjs + bcryptjs 依赖），account/service/auth
// 直接调用 bcrypt.hashSync/compareSync，无独立包装函数。故直接 import bcryptjs
// 验证 hash/compare 往返行为。
//
// 旧工程额外校验「种子用户密码哈希一致性」依赖内存 store（src/store/db.ts），
// 新工程改为 TypeORM + MySQL，种子密码一致性已由 integration/auth.test.ts 的
// demo/123456 登录用例覆盖，此处不再重复。
import * as bcrypt from 'bcryptjs';

describe('bcryptjs hash + compare 往返', () => {
  it('hash 后 compare 原密码返回 true', () => {
    const hash = bcrypt.hashSync('password123', 10);
    expect(bcrypt.compareSync('password123', hash)).toBe(true);
  });

  it('错误密码 compare 返回 false', () => {
    const hash = bcrypt.hashSync('password123', 10);
    expect(bcrypt.compareSync('wrong-password', hash)).toBe(false);
  });

  it('空字符串密码 compare 返回 false', () => {
    const hash = bcrypt.hashSync('password123', 10);
    expect(bcrypt.compareSync('', hash)).toBe(false);
  });

  it('两次 hash 同一密码生成不同哈希（含随机盐）但均可 compare 通过', () => {
    const h1 = bcrypt.hashSync('same-pass', 10);
    const h2 = bcrypt.hashSync('same-pass', 10);
    expect(h1).not.toBe(h2);
    expect(bcrypt.compareSync('same-pass', h1)).toBe(true);
    expect(bcrypt.compareSync('same-pass', h2)).toBe(true);
  });

  it('hash 结果以 $2a$ / $2b$ 前缀开头（bcrypt 格式）', () => {
    const hash = bcrypt.hashSync('abc', 10);
    expect(hash).toMatch(/^\$2[ab]\$/);
  });

  it('salt rounds 影响哈希成本（hash 不同 salt 轮数仍可 compare）', () => {
    const low = bcrypt.hashSync('pw', 8);
    const high = bcrypt.hashSync('pw', 12);
    expect(bcrypt.compareSync('pw', low)).toBe(true);
    expect(bcrypt.compareSync('pw', high)).toBe(true);
  });
});
