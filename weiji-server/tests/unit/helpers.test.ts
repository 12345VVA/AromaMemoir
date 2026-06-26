// 内存存储辅助查询方法 单元测试
// helpers.ts 实际导出：findById / findByField / filterBy / insert / updateById / softDelete / uuid
// 响应包装函数位于 src/common/response.ts（ok / fail / unauthorized），按要求一并覆盖。
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  findById,
  findByField,
  filterBy,
  insert,
  updateById,
  softDelete,
  uuid,
} from '../../src/store/helpers';
import { ok, fail, unauthorized, forbidden } from '../../src/common/response';

describe('helpers.findById / findByField / filterBy', () => {
  const list = [
    { id: 'a', name: 'Alice', age: 30 },
    { id: 'b', name: 'Bob', age: 20 },
    { id: 'c', name: 'Carol', age: 30 },
  ];

  it('findById 命中返回元素', () => {
    assert.strictEqual(findById(list, 'b')?.name, 'Bob');
  });

  it('findById 未命中返回 undefined', () => {
    assert.strictEqual(findById(list, 'zzz'), undefined);
  });

  it('findByField 按 name 查找命中', () => {
    assert.strictEqual(findByField(list, 'name', 'Carol')?.id, 'c');
  });

  it('findByField 未命中返回 undefined', () => {
    assert.strictEqual(findByField(list, 'name', 'Nobody'), undefined);
  });

  it('filterBy 按条件过滤返回全部匹配项', () => {
    const age30 = filterBy(list, (x) => x.age === 30);
    assert.strictEqual(age30.length, 2);
    assert.deepStrictEqual(age30.map((x) => x.id), ['a', 'c']);
  });

  it('filterBy 无匹配返回空数组', () => {
    const none = filterBy(list, (x) => x.age === 999);
    assert.deepStrictEqual(none, []);
  });
});

describe('helpers.insert', () => {
  it('未提供 id 时自动生成 UUID', () => {
    const list: Array<{ id: string; name: string }> = [];
    const item = insert(list, { name: 'X' });
    assert.ok(item.id, '应生成 id');
    assert.match(
      item.id,
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      '应为合法 UUID 格式',
    );
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0], item);
  });

  it('提供 id 时保留原 id', () => {
    const list: Array<{ id: string; name: string }> = [];
    const item = insert(list, { id: 'custom-1', name: 'Y' });
    assert.strictEqual(item.id, 'custom-1');
    assert.strictEqual(list[0].id, 'custom-1');
  });

  it('连续插入多个元素均入列', () => {
    const list: Array<{ id: string; name: string }> = [];
    insert(list, { name: 'p1' });
    insert(list, { name: 'p2' });
    assert.strictEqual(list.length, 2);
  });
});

describe('helpers.updateById', () => {
  it('patch 合并并返回更新后对象', () => {
    const list = [{ id: 'a', name: 'A', age: 1 }];
    const updated = updateById(list, 'a', { age: 2 });
    assert.strictEqual(updated?.age, 2);
    assert.strictEqual(updated?.name, 'A'); // 未改字段保留
    assert.strictEqual(list[0].age, 2); // 原数组被就地更新
  });

  it('未命中返回 undefined 且不修改数组', () => {
    const list = [{ id: 'a', name: 'A' }];
    assert.strictEqual(updateById(list, 'nope', { name: 'Z' }), undefined);
    assert.strictEqual(list[0].name, 'A');
  });

  it('存在 updatedAt 字段时自动刷新时间戳', () => {
    const list = [{ id: 'a', name: 'A', updatedAt: 'old' }];
    const updated = updateById(list, 'a', { name: 'B' });
    assert.notStrictEqual(updated?.updatedAt, 'old');
    assert.ok(updated!.updatedAt.length > 0);
  });
});

describe('helpers.softDelete', () => {
  it('设置 isDeleted=true 并返回元素', () => {
    const list = [{ id: 'a', name: 'A', isDeleted: false }];
    const item = softDelete(list, 'a');
    assert.strictEqual(item?.isDeleted, true);
    assert.strictEqual(list[0].isDeleted, true);
  });

  it('未命中返回 undefined', () => {
    const list = [{ id: 'a', name: 'A', isDeleted: false }];
    assert.strictEqual(softDelete(list, 'nope'), undefined);
    assert.strictEqual(list[0].isDeleted, false);
  });
});

describe('helpers.uuid', () => {
  it('返回合法 UUID v4 格式', () => {
    const id = uuid();
    assert.match(
      id,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('两次调用生成不同值', () => {
    assert.notStrictEqual(uuid(), uuid());
  });
});

describe('common/response 响应包装', () => {
  it('ok 返回 {code:0, data, message}', () => {
    const r = ok({ x: 1 }, 'done');
    assert.strictEqual(r.code, 0);
    assert.deepStrictEqual(r.data, { x: 1 });
    assert.strictEqual(r.message, 'done');
  });

  it('ok 默认 message 为空字符串', () => {
    const r = ok(123);
    assert.strictEqual(r.code, 0);
    assert.strictEqual(r.message, '');
    assert.strictEqual(r.data, 123);
  });

  it('fail 返回 {code:1, message, data:null}', () => {
    const r = fail('出错了');
    assert.strictEqual(r.code, 1);
    assert.strictEqual(r.message, '出错了');
    assert.strictEqual(r.data, null);
  });

  it('fail 支持自定义 code 与 data', () => {
    const r = fail('禁止', 403, { reason: 'no-perm' });
    assert.strictEqual(r.code, 403);
    assert.strictEqual(r.message, '禁止');
    assert.deepStrictEqual(r.data, { reason: 'no-perm' });
  });

  it('unauthorized 返回 code 401 且 data 为 null', () => {
    const r = unauthorized();
    assert.strictEqual(r.code, 401);
    assert.strictEqual(r.data, null);
    assert.ok(r.message.length > 0);
  });

  it('forbidden 返回 code 403', () => {
    const r = forbidden();
    assert.strictEqual(r.code, 403);
    assert.strictEqual(r.data, null);
  });
});
