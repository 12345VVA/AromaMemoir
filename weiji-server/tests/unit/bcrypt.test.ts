// bcrypt 工具 单元测试
// 项目使用 bcryptjs（非 bcrypt），无独立包装函数（db.ts/auth.service.ts 直接调用 bcrypt.hashSync/compareSync），
// 故直接 import bcryptjs 验证 hash/compare 行为，并校验种子用户密码哈希一致性。
import { describe, it } from 'node:test';
import assert from 'node:assert';
import bcrypt from 'bcryptjs';
import { findByField } from '../../src/store/helpers';
import { users } from '../../src/store/db';

describe('bcryptjs hash + compare 往返', () => {
  it('hash 后 compare 原密码返回 true', () => {
    const hash = bcrypt.hashSync('password123', 10);
    assert.strictEqual(bcrypt.compareSync('password123', hash), true);
  });

  it('错误密码 compare 返回 false', () => {
    const hash = bcrypt.hashSync('password123', 10);
    assert.strictEqual(bcrypt.compareSync('wrong-password', hash), false);
  });

  it('空字符串密码 compare 返回 false', () => {
    const hash = bcrypt.hashSync('password123', 10);
    assert.strictEqual(bcrypt.compareSync('', hash), false);
  });

  it('两次 hash 同一密码生成不同哈希（含随机盐）但均可 compare 通过', () => {
    const h1 = bcrypt.hashSync('same-pass', 10);
    const h2 = bcrypt.hashSync('same-pass', 10);
    assert.notStrictEqual(h1, h2);
    assert.strictEqual(bcrypt.compareSync('same-pass', h1), true);
    assert.strictEqual(bcrypt.compareSync('same-pass', h2), true);
  });

  it('hash 结果以 $2a$ / $2b$ 前缀开头（bcrypt 格式）', () => {
    const hash = bcrypt.hashSync('abc', 10);
    assert.match(hash, /^\$2[ab]\$/);
  });
});

describe('种子数据密码哈希一致性', () => {
  it('demo 用户密码哈希与 123456 匹配', () => {
    const demo = findByField(users, 'username', 'demo');
    assert.ok(demo, 'demo 用户应存在');
    assert.strictEqual(bcrypt.compareSync('123456', demo!.password), true);
  });

  it('错误密码与 demo 用户哈希不匹配', () => {
    const demo = findByField(users, 'username', 'demo');
    assert.ok(demo);
    assert.strictEqual(bcrypt.compareSync('000000', demo!.password), false);
  });

  it('所有种子用户密码均为 123456', () => {
    assert.ok(users.length >= 4);
    for (const u of users) {
      assert.strictEqual(
        bcrypt.compareSync('123456', u.password),
        true,
        `用户 ${u.username} 的密码应为 123456`,
      );
    }
  });

  it('种子用户密码字段为 bcrypt 哈希而非明文', () => {
    for (const u of users) {
      assert.match(u.password, /^\$2[ab]\$/, `用户 ${u.username} 密码应为 bcrypt 哈希`);
      assert.notStrictEqual(u.password, '123456');
    }
  });
});
