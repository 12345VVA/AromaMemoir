// InMemoryRepository 单元测试
// 覆盖 Repository<T> 接口各方法：insert 自动生成 UUID、updateById 刷新 updatedAt、
// softDelete 置位、findAll 带/不带 predicate、findByField、count、toArray 返回内部引用。
// 风格参考 tests/unit/store.test.ts（node:test + node:assert）。
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { InMemoryRepository } from '../../src/store/in-memory-repository';

// 测试用实体：含 id / 可选 updatedAt / 可选 isDeleted，覆盖三类字段刷新场景
interface TestItem {
  id: string;
  name: string;
  updatedAt?: string;
  isDeleted?: boolean;
}

describe('InMemoryRepository.insert', () => {
  it('未提供 id 时自动生成合法 UUID 并 push 进数组', async () => {
    const repo = new InMemoryRepository<TestItem>();
    const item = await repo.insert({ name: 'A' });
    assert.ok(item.id, '应自动生成 id');
    assert.match(
      item.id,
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      '应为合法 UUID 格式',
    );
    assert.strictEqual(await repo.count(), 1);
    assert.strictEqual((await repo.toArray())[0], item, 'toArray 应返回内部引用中的同一对象');
  });

  it('提供 id 时保留原 id', async () => {
    const repo = new InMemoryRepository<TestItem>();
    const item = await repo.insert({ id: 'custom-1', name: 'B' });
    assert.strictEqual(item.id, 'custom-1');
    assert.strictEqual((await repo.toArray())[0].id, 'custom-1');
  });

  it('连续 insert 生成不同 id 且均入列', async () => {
    const repo = new InMemoryRepository<TestItem>();
    const a = await repo.insert({ name: 'p1' });
    const b = await repo.insert({ name: 'p2' });
    assert.notStrictEqual(a.id, b.id);
    assert.strictEqual(await repo.count(), 2);
  });

  it('构造时接收初始数组作为种子', async () => {
    const seed: TestItem[] = [{ id: 's1', name: 'seed' }];
    const repo = new InMemoryRepository<TestItem>(seed);
    assert.strictEqual(await repo.count(), 1);
    assert.strictEqual((await repo.toArray())[0].name, 'seed');
  });
});

describe('InMemoryRepository.updateById', () => {
  it('patch 合并并返回更新后对象，原数组就地更新', async () => {
    const repo = new InMemoryRepository<TestItem>([{ id: 'a', name: 'A' }]);
    const updated = await repo.updateById('a', { name: 'A2' });
    assert.strictEqual(updated?.name, 'A2');
    assert.strictEqual((await repo.toArray())[0].name, 'A2');
  });

  it('未命中返回 undefined 且不修改数组', async () => {
    const repo = new InMemoryRepository<TestItem>([{ id: 'a', name: 'A' }]);
    assert.strictEqual(await repo.updateById('nope', { name: 'Z' }), undefined);
    assert.strictEqual((await repo.toArray())[0].name, 'A');
  });

  it('存在 updatedAt 字段时自动刷新时间戳', async () => {
    const repo = new InMemoryRepository<TestItem>([
      { id: 'a', name: 'A', updatedAt: 'old' },
    ]);
    const updated = await repo.updateById('a', { name: 'B' });
    assert.notStrictEqual(updated?.updatedAt, 'old');
    assert.ok(updated!.updatedAt!.length > 0);
  });
});

describe('InMemoryRepository.softDelete', () => {
  it('对含 isDeleted 的实体置 isDeleted=true 并返回元素', async () => {
    const repo = new InMemoryRepository<TestItem>([
      { id: 'a', name: 'A', isDeleted: false },
    ]);
    const item = await repo.softDelete('a');
    assert.strictEqual(item?.isDeleted, true);
    assert.strictEqual((await repo.toArray())[0].isDeleted, true);
  });

  it('未命中返回 undefined', async () => {
    const repo = new InMemoryRepository<TestItem>([
      { id: 'a', name: 'A', isDeleted: false },
    ]);
    assert.strictEqual(await repo.softDelete('nope'), undefined);
    assert.strictEqual((await repo.toArray())[0].isDeleted, false);
  });
});

describe('InMemoryRepository.findAll', () => {
  const seed: TestItem[] = [
    { id: 'a', name: 'Alice', isDeleted: false },
    { id: 'b', name: 'Bob', isDeleted: true },
    { id: 'c', name: 'Carol', isDeleted: false },
  ];

  it('不带 predicate 返回全部元素的副本', async () => {
    const repo = new InMemoryRepository<TestItem>(seed);
    const all = await repo.findAll();
    assert.strictEqual(all.length, 3);
    assert.deepStrictEqual(all.map((x) => x.id), ['a', 'b', 'c']);
    // 副本不影响内部数组
    all.push({ id: 'x', name: 'X' });
    assert.strictEqual(await repo.count(), 3, '副本修改不应影响仓库内部');
  });

  it('带 predicate 返回匹配项的新数组', async () => {
    const repo = new InMemoryRepository<TestItem>(seed);
    const active = await repo.findAll((x) => !x.isDeleted);
    assert.strictEqual(active.length, 2);
    assert.deepStrictEqual(active.map((x) => x.id), ['a', 'c']);
  });

  it('带 predicate 无匹配返回空数组', async () => {
    const repo = new InMemoryRepository<TestItem>(seed);
    const none = await repo.findAll((x) => x.name === 'Nobody');
    assert.deepStrictEqual(none, []);
  });
});

describe('InMemoryRepository.findByField', () => {
  it('按字段查找命中', async () => {
    const repo = new InMemoryRepository<TestItem>([
      { id: 'a', name: 'Alice' },
      { id: 'b', name: 'Bob' },
    ]);
    assert.strictEqual((await repo.findByField('name', 'Bob'))?.id, 'b');
  });

  it('未命中返回 undefined', async () => {
    const repo = new InMemoryRepository<TestItem>([{ id: 'a', name: 'Alice' }]);
    assert.strictEqual(await repo.findByField('name', 'Nobody'), undefined);
  });
});

describe('InMemoryRepository.findById / count / toArray', () => {
  it('findById 按 id 命中/未命中', async () => {
    const repo = new InMemoryRepository<TestItem>([{ id: 'a', name: 'A' }]);
    assert.strictEqual((await repo.findById('a'))?.name, 'A');
    assert.strictEqual(await repo.findById('zzz'), undefined);
  });

  it('count 不带 predicate 返回总数', async () => {
    const repo = new InMemoryRepository<TestItem>(seed());
    assert.strictEqual(await repo.count(), 3);
  });

  it('count 带 predicate 返回匹配数', async () => {
    const repo = new InMemoryRepository<TestItem>(seed());
    assert.strictEqual(await repo.count((x) => x.isDeleted === false), 2);
    assert.strictEqual(await repo.count((x) => x.name.startsWith('B')), 1);
  });

  it('toArray 返回内部数组引用，push 反映到仓库', async () => {
    const repo = new InMemoryRepository<TestItem>(seed());
    const ref = await repo.toArray();
    ref.push({ id: 'd', name: 'Dan' });
    assert.strictEqual(await repo.count(), 4, 'toArray 返回引用，push 应反映到仓库');
    assert.ok(await repo.findById('d'));
  });
});

function seed(): TestItem[] {
  return [
    { id: 'a', name: 'Alice', isDeleted: false },
    { id: 'b', name: 'Bob', isDeleted: true },
    { id: 'c', name: 'Carol', isDeleted: false },
  ];
}
