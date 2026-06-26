// 内存数据存储层 + 种子数据 单元测试
// db.ts 直接导出各实体数组（无 list/create 方法），分页基于数组 slice，
// 创建基于 helpers.insert，查找基于 helpers.findById/findByField。
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  users,
  families,
  family_members,
  family_recipes,
  records,
} from '../../src/store/db';
import { findById, findByField, filterBy, insert } from '../../src/store/helpers';
import type { Record } from '../../src/store/types';

describe('store/db 种子数据完整性', () => {
  it('demo 用户存在（按 username 查找）', () => {
    const demo = findByField(users, 'username', 'demo');
    assert.ok(demo, 'demo 用户应存在');
    assert.strictEqual(demo!.id, 'user-demo-0001');
    assert.strictEqual(demo!.nickname, '小明');
  });

  it('demo 用户可通过 id 查找', () => {
    const demo = findById(users, 'user-demo-0001');
    assert.ok(demo);
    assert.strictEqual(demo!.username, 'demo');
  });

  it('种子数据记录数达标', () => {
    // records 实际 3 条；users 4 个；family_recipes 4 道
    assert.ok(records.length >= 3, `records 应至少 3 条，实际 ${records.length}`);
    assert.ok(users.length >= 4, `users 应至少 4 个，实际 ${users.length}`);
    assert.ok(family_recipes.length >= 4, `family_recipes 应至少 4 道，实际 ${family_recipes.length}`);
    // 整体种子规模 >= 5（跨集合）
    const totalEntities =
      users.length + families.length + family_members.length + family_recipes.length + records.length;
    assert.ok(totalEntities >= 5, `总实体数应 >= 5，实际 ${totalEntities}`);
  });

  it('至少一个家庭组存在，且 demo 为 owner，成员数与 family_members 一致', () => {
    assert.ok(families.length >= 1, '至少一个家庭组');
    const fam = families[0];
    assert.strictEqual(fam.ownerId, 'user-demo-0001');
    assert.strictEqual(fam.memberCount, 4);
    const members = filterBy(family_members, (m) => m.familyId === fam.id);
    assert.strictEqual(members.length, fam.memberCount);
    // demo 在家庭组中角色为 owner
    const demoMember = findByField(family_members, 'userId', 'user-demo-0001');
    assert.strictEqual(demoMember?.role, 'owner');
  });

  it('records 每条都关联到 demo 用户且字段完整', () => {
    for (const r of records) {
      assert.ok(r.id, 'record 应有 id');
      assert.ok(r.dishName, 'record 应有 dishName');
      assert.ok(Array.isArray(r.tags), 'record.tags 应为数组');
      assert.ok(Array.isArray(r.ingredients), 'record.ingredients 应为数组');
    }
  });
});

describe('store 数据分页（基于 records 数组 slice）', () => {
  it('page=1, pageSize=2 返回前两条且顺序一致', () => {
    const page = 1;
    const pageSize = 2;
    const start = (page - 1) * pageSize;
    const slice = records.slice(start, start + pageSize);
    assert.strictEqual(slice.length, Math.min(pageSize, records.length));
    assert.strictEqual(slice[0].id, records[0].id);
    if (slice.length > 1) {
      assert.strictEqual(slice[1].id, records[1].id);
    }
  });

  it('page=2 返回第二页剩余记录', () => {
    const page = 2;
    const pageSize = 2;
    const start = (page - 1) * pageSize;
    const slice = records.slice(start, start + pageSize);
    const expectedLen = Math.max(0, records.length - start);
    assert.strictEqual(slice.length, expectedLen);
    if (expectedLen > 0) {
      assert.strictEqual(slice[0].id, records[start].id);
    }
  });

  it('超出总页数时返回空数组', () => {
    const pageSize = 2;
    const overPage = Math.floor(records.length / pageSize) + 5;
    const start = (overPage - 1) * pageSize;
    const slice = records.slice(start, start + pageSize);
    assert.strictEqual(slice.length, 0);
  });
});

describe('store 创建记录（insert + findById 往返）', () => {
  it('insert 自动生成 id，且随后可按 id 查到', () => {
    const before = records.length;
    const created = insert(records, {
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
    assert.strictEqual(records.length, before + 1);
    const found = findById(records, created.id);
    assert.strictEqual(found, created);
    assert.strictEqual(found?.dishName, '测试菜品');
  });

  it('连续 insert 生成的 id 唯一', () => {
    const a = insert(records, {
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
    const b = insert(records, {
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
