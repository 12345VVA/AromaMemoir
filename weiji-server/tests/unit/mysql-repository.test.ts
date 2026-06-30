// MysqlRepository 单元测试
// ------------------------------------------------------------
// 用 mock pool（拦截 execute 调用）验证 SQL 拼装与 JSON 序列化/反序列化逻辑，
// 不依赖真实 MySQL，CI 无需数据库即可运行。
// 风格参考 tests/unit/in-memory-repository.test.ts（node:test + node:assert）。
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { MysqlRepository } from '../../src/store/mysql-repository';

// 测试用实体：含 id / 可选 meta(jsonField) / 可选 updatedAt / 可选 isDeleted
interface Item {
  id: string;
  name: string;
  meta?: { k: number };
  updatedAt?: string;
  isDeleted?: boolean;
}

// mock pool：记录所有 execute 调用，并按 setRows 预设返回行
interface MockCall {
  sql: string;
  params: unknown[];
}

function createMockPool() {
  const calls: MockCall[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let nextRows: any[] = [];
  const instance = {
    async execute(
      sql: string,
      params: unknown[] = [],
    ): Promise<[unknown, unknown]> {
      calls.push({ sql, params });
      return [nextRows, []];
    },
  };
  return {
    instance,
    calls,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setRows: (rows: any[]) => {
      nextRows = rows;
    },
    reset: () => {
      calls.length = 0;
    },
  };
}

// 软删除表（isDeleted=0 过滤）+ meta 为 JSON 字段
function createRepo(mock: ReturnType<typeof createMockPool>) {
  return new MysqlRepository<Item>('items', ['meta'], true, mock.instance);
}

describe('MysqlRepository.insert', () => {
  it('jsonFields 被 JSON.stringify，isDeleted 布尔转为 0', async () => {
    const mock = createMockPool();
    const repo = createRepo(mock);
    mock.setRows([{ id: 'x', name: 'A', meta: '{"k":1}', isDeleted: 0 }]);

    const item = await repo.insert({ name: 'A', meta: { k: 1 }, isDeleted: false });

    const insertCall = mock.calls.find((c) => c.sql.startsWith('INSERT INTO'));
    assert.ok(insertCall, '应生成 INSERT 语句');
    assert.match(insertCall.sql, /INSERT INTO `items` \(/);
    // meta 对象被序列化为字符串
    assert.ok(
      insertCall.params.includes('{"k":1}'),
      'meta 应被 JSON.stringify 为 \'{"k":1}\'',
    );
    // isDeleted false 被转为数字 0
    assert.ok(insertCall.params.includes(0), 'isDeleted=false 应转为 0');
    // 回读后 meta 被 parse 回对象、isDeleted 转为 boolean
    assert.deepStrictEqual(item.meta, { k: 1 });
    assert.strictEqual(item.isDeleted, false);
  });

  it('未提供 id 时自动生成 UUID 占位参数', async () => {
    const mock = createMockPool();
    const repo = createRepo(mock);
    mock.setRows([{ id: 'gen', name: 'A', isDeleted: 0 }]);
    await repo.insert({ name: 'A' });
    const insertCall = mock.calls.find((c) => c.sql.startsWith('INSERT INTO'));
    assert.ok(insertCall);
    // INSERT 参数中应包含一个 UUID 形态的 id 值
    const idParam = insertCall.params.find(
      (p) => typeof p === 'string' && /^[0-9a-f-]{36}$/i.test(p),
    );
    assert.ok(idParam, '应自动生成 UUID 作为 id 参数');
  });
});

describe('MysqlRepository.findById', () => {
  it('软删除表 SQL 含 `isDeleted` = 0 且参数化', async () => {
    const mock = createMockPool();
    const repo = createRepo(mock);
    mock.setRows([{ id: 'a', name: 'A', isDeleted: 0 }]);

    const item = await repo.findById('a');
    const call = mock.calls[mock.calls.length - 1];
    assert.match(
      call.sql,
      /SELECT \* FROM `items` WHERE `id` = \? AND `isDeleted` = 0/,
    );
    assert.deepStrictEqual(call.params, ['a']);
    assert.strictEqual(item?.id, 'a');
  });

  it('非软删除表 SQL 用 1 = 1 占位', async () => {
    const mock = createMockPool();
    const repo = new MysqlRepository<Item>('items2', ['meta'], false, mock.instance);
    mock.setRows([]);
    await repo.findById('a');
    assert.match(mock.calls[0].sql, /WHERE `id` = \? AND 1 = 1/);
  });

  it('读取时 jsonFields 被 parse、isDeleted 转为 boolean', async () => {
    const mock = createMockPool();
    const repo = createRepo(mock);
    mock.setRows([{ id: 'a', name: 'A', meta: '{"k":1}', isDeleted: 1 }]);
    const item = await repo.findById('a');
    assert.deepStrictEqual(item?.meta, { k: 1 });
    assert.strictEqual(item?.isDeleted, true);
    assert.strictEqual(typeof item?.isDeleted, 'boolean');
  });

  it('查询无结果返回 undefined', async () => {
    const mock = createMockPool();
    const repo = createRepo(mock);
    mock.setRows([]);
    const item = await repo.findById('missing');
    assert.strictEqual(item, undefined);
  });
});

describe('MysqlRepository.findByField', () => {
  it('参数化占位、LIMIT 1、软删除过滤', async () => {
    const mock = createMockPool();
    const repo = createRepo(mock);
    mock.setRows([{ id: 'a', name: 'Alice', isDeleted: 0 }]);

    const found = await repo.findByField('name', 'Alice');
    const call = mock.calls[mock.calls.length - 1];
    assert.match(
      call.sql,
      /WHERE `name` = \? AND `isDeleted` = 0 LIMIT 1/,
    );
    assert.deepStrictEqual(call.params, ['Alice']);
    assert.strictEqual(found?.id, 'a');
  });
});

describe('MysqlRepository.updateById', () => {
  it('仅更新 patch 字段并自动刷新 updatedAt', async () => {
    const mock = createMockPool();
    const repo = createRepo(mock);
    mock.setRows([
      { id: 'a', name: 'old', meta: '{"k":1}', updatedAt: 'old-ts', isDeleted: 0 },
    ]);

    const updated = await repo.updateById('a', { name: 'new' });

    const updateCall = mock.calls.find((c) => c.sql.startsWith('UPDATE'));
    assert.ok(updateCall, '应生成 UPDATE 语句');
    // SET 仅含 patch 的 name 与自动刷新的 updatedAt，不应包含 meta/isDeleted/id
    assert.match(
      updateCall.sql,
      /UPDATE `items` SET `name` = \?, `updatedAt` = \? WHERE `id` = \?/,
    );
    assert.deepStrictEqual(updateCall.params, ['new', updated?.updatedAt, 'a']);
    assert.strictEqual(updated?.name, 'new');
    assert.notStrictEqual(updated?.updatedAt, 'old-ts');
    assert.ok(updated!.updatedAt!.length > 0);
  });

  it('未命中返回 undefined 且不发起 UPDATE', async () => {
    const mock = createMockPool();
    const repo = createRepo(mock);
    mock.setRows([]); // findByIdRaw 无结果
    const result = await repo.updateById('nope', { name: 'x' });
    assert.strictEqual(result, undefined);
    assert.ok(
      !mock.calls.some((c) => c.sql.startsWith('UPDATE')),
      '未命中时不应发起 UPDATE',
    );
  });

  it('无 updatedAt 字段的表不刷新 updatedAt', async () => {
    const mock = createMockPool();
    // 无 updatedAt 列的表
    const repo = new MysqlRepository<Item>('items3', ['meta'], false, mock.instance);
    mock.setRows([{ id: 'a', name: 'old' }]);
    await repo.updateById('a', { name: 'new' });
    const updateCall = mock.calls.find((c) => c.sql.startsWith('UPDATE'));
    assert.ok(updateCall);
    assert.match(updateCall.sql, /UPDATE `items3` SET `name` = \? WHERE `id` = \?/);
    // 不应出现 updatedAt
    assert.ok(!/updatedAt/.test(updateCall.sql), '无 updatedAt 的表不应刷新 updatedAt');
  });
});

describe('MysqlRepository.softDelete', () => {
  it('软删除表生成 UPDATE SET isDeleted=1 并返回 isDeleted=true', async () => {
    const mock = createMockPool();
    const repo = createRepo(mock);
    mock.setRows([{ id: 'a', name: 'A', isDeleted: 0 }]);

    const result = await repo.softDelete('a');
    const updateCall = mock.calls.find((c) => c.sql.startsWith('UPDATE'));
    assert.ok(updateCall);
    assert.match(
      updateCall.sql,
      /UPDATE `items` SET `isDeleted` = 1 WHERE `id` = \?/,
    );
    assert.deepStrictEqual(updateCall.params, ['a']);
    assert.strictEqual(result?.isDeleted, true);
  });

  it('softDelete=false 的表返回 undefined 且不发起 SQL', async () => {
    const mock = createMockPool();
    const repo = new MysqlRepository<Item>('items2', [], false, mock.instance);
    const result = await repo.softDelete('a');
    assert.strictEqual(result, undefined);
    assert.strictEqual(mock.calls.length, 0, '非软删除表不应发起任何 SQL');
  });
});

describe('MysqlRepository.count / findAll', () => {
  it('count 无 predicate 走 SELECT COUNT(*)', async () => {
    const mock = createMockPool();
    const repo = createRepo(mock);
    mock.setRows([{ c: 5 }]);
    const n = await repo.count();
    const call = mock.calls[mock.calls.length - 1];
    assert.match(
      call.sql,
      /SELECT COUNT\(\*\) AS c FROM `items` WHERE `isDeleted` = 0/,
    );
    assert.strictEqual(n, 5);
  });

  it('count 带 predicate 取全部行后内存计数', async () => {
    const mock = createMockPool();
    const repo = createRepo(mock);
    mock.setRows([
      { id: 'a', name: 'A', isDeleted: 0 },
      { id: 'b', name: 'B', isDeleted: 0 },
      { id: 'c', name: 'A', isDeleted: 0 },
    ]);
    const n = await repo.count((x) => x.name === 'A');
    assert.strictEqual(n, 2);
  });

  it('findAll 带 predicate 在内存过滤', async () => {
    const mock = createMockPool();
    const repo = createRepo(mock);
    mock.setRows([
      { id: 'a', name: 'A', isDeleted: 0 },
      { id: 'b', name: 'B', isDeleted: 0 },
    ]);
    const result = await repo.findAll((x) => x.name === 'B');
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 'b');
  });

  it('toArray 等价 findAll，发起同一 SELECT', async () => {
    const mock = createMockPool();
    const repo = createRepo(mock);
    mock.setRows([
      { id: 'a', name: 'A', isDeleted: 0 },
      { id: 'b', name: 'B', isDeleted: 0 },
    ]);
    const result = await repo.toArray();
    assert.strictEqual(result.length, 2);
    assert.match(mock.calls[0].sql, /SELECT \* FROM `items` WHERE `isDeleted` = 0/);
  });
});
