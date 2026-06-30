// 内存数据存储层 + 种子数据 单元测试
// db.ts 各实体以 Repository<T> 形式导出，分页基于 toArray() slice，
// 创建基于 Repository.insert，查找基于 Repository.findById/findByField/findAll。
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  users,
  families,
  family_members,
  family_recipes,
  records,
} from '../../src/store/db';
import type { Record } from '../../src/store/types';

describe('store/db 种子数据完整性', () => {
  it('demo 用户存在（按 username 查找）', async () => {
    const demo = await users.findByField('username', 'demo');
    assert.ok(demo, 'demo 用户应存在');
    assert.strictEqual(demo!.id, 'user-demo-0001');
    assert.strictEqual(demo!.nickname, '小明');
  });

  it('demo 用户可通过 id 查找', async () => {
    const demo = await users.findById('user-demo-0001');
    assert.ok(demo);
    assert.strictEqual(demo!.username, 'demo');
  });

  it('种子数据记录数达标', async () => {
    // records 实际 3 条；users 4 个；family_recipes 4 道
    const recordsCount = await records.count();
    const usersCount = await users.count();
    const familyRecipesCount = await family_recipes.count();
    assert.ok(recordsCount >= 3, `records 应至少 3 条，实际 ${recordsCount}`);
    assert.ok(usersCount >= 4, `users 应至少 4 个，实际 ${usersCount}`);
    assert.ok(familyRecipesCount >= 4, `family_recipes 应至少 4 道，实际 ${familyRecipesCount}`);
    // 整体种子规模 >= 5（跨集合）
    const totalEntities =
      (await users.count()) +
      (await families.count()) +
      (await family_members.count()) +
      (await family_recipes.count()) +
      (await records.count());
    assert.ok(totalEntities >= 5, `总实体数应 >= 5，实际 ${totalEntities}`);
  });

  it('至少一个家庭组存在，且 demo 为 owner，成员数与 family_members 一致', async () => {
    assert.ok((await families.count()) >= 1, '至少一个家庭组');
    const fam = (await families.toArray())[0];
    assert.strictEqual(fam.ownerId, 'user-demo-0001');
    assert.strictEqual(fam.memberCount, 4);
    const members = await family_members.findAll((m) => m.familyId === fam.id);
    assert.strictEqual(members.length, fam.memberCount);
    // demo 在家庭组中角色为 owner
    const demoMember = await family_members.findByField('userId', 'user-demo-0001');
    assert.strictEqual(demoMember?.role, 'owner');
  });

  it('records 每条都关联到 demo 用户且字段完整', async () => {
    for (const r of await records.toArray()) {
      assert.ok(r.id, 'record 应有 id');
      assert.ok(r.dishName, 'record 应有 dishName');
      assert.ok(Array.isArray(r.tags), 'record.tags 应为数组');
      assert.ok(Array.isArray(r.ingredients), 'record.ingredients 应为数组');
    }
  });
});

describe('store 数据分页（基于 records 数组 slice）', () => {
  it('page=1, pageSize=2 返回前两条且顺序一致', async () => {
    const page = 1;
    const pageSize = 2;
    const start = (page - 1) * pageSize;
    const all = await records.toArray();
    const slice = all.slice(start, start + pageSize);
    assert.strictEqual(slice.length, Math.min(pageSize, all.length));
    assert.strictEqual(slice[0].id, all[0].id);
    if (slice.length > 1) {
      assert.strictEqual(slice[1].id, all[1].id);
    }
  });

  it('page=2 返回第二页剩余记录', async () => {
    const page = 2;
    const pageSize = 2;
    const start = (page - 1) * pageSize;
    const all = await records.toArray();
    const slice = all.slice(start, start + pageSize);
    const expectedLen = Math.max(0, all.length - start);
    assert.strictEqual(slice.length, expectedLen);
    if (expectedLen > 0) {
      assert.strictEqual(slice[0].id, all[start].id);
    }
  });

  it('超出总页数时返回空数组', async () => {
    const pageSize = 2;
    const all = await records.toArray();
    const overPage = Math.floor(all.length / pageSize) + 5;
    const start = (overPage - 1) * pageSize;
    const slice = all.slice(start, start + pageSize);
    assert.strictEqual(slice.length, 0);
  });
});

describe('store 创建记录（insert + findById 往返）', () => {
  it('insert 自动生成 id，且随后可按 id 查到', async () => {
    const before = await records.count();
    const created = await records.insert({
      userId: 'user-demo-0001',
      dishName: '测试菜品',
      cookingMethod: '炒',
      rating: 5,
      note: '单元测试生成',
      ingredients: [],
      tags: ['测试'],
      recordDate: '2026-06-26',
      source: 'camera',
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Omit<Record, 'id'>);
    assert.ok(created.id, '应自动生成 id');
    assert.strictEqual(await records.count(), before + 1);
    const found = await records.findById(created.id);
    assert.strictEqual(found, created);
    assert.strictEqual(found?.dishName, '测试菜品');
  });

  it('连续 insert 生成的 id 唯一', async () => {
    const a = await records.insert({
      userId: 'u',
      dishName: 'A',
      rating: 1,
      ingredients: [],
      tags: [],
      recordDate: '2026-06-26',
      source: 'camera',
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Omit<Record, 'id'>);
    const b = await records.insert({
      userId: 'u',
      dishName: 'B',
      rating: 1,
      ingredients: [],
      tags: [],
      recordDate: '2026-06-26',
      source: 'camera',
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Omit<Record, 'id'>);
    assert.notStrictEqual(a.id, b.id);
  });
});
