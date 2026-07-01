// 内存数据存储层 + 种子数据 单元测试（迁移自 weiji-server/tests/unit/store.test.ts）
//
// ⚠️ 已废弃（DEPRECATED）：旧工程 src/store/db.ts 用自研内存 Repository<T> 暴露
// users / families / family_members / family_recipes / records 等集合，并内置种子数据。
// 新工程改为 TypeORM entity + MySQL + 各模块 db.json 初始化（cool-admin initDB），
// 不再有内存 store 概念。原测试对种子数据完整性、内存分页、insert 往返的断言已无对应组件。
//
// 等价覆盖见 integration 测试（对真实 MySQL + db.json 种子的端到端验证）：
//   - test/integration/auth.test.ts（demo 用户存在、密码哈希一致）
//   - test/integration/record.test.ts（种子记录可查、分页）
//   - test/integration/family.test.ts（种子家庭组/成员/菜谱）
//
// 按 Task 8 要求：不硬迁移、不删除测试，整文件 describe.skip 并注明废弃原因。
describe.skip('store/db 种子数据（已废弃，新工程用 TypeORM + MySQL + db.json 替代）', () => {
  it('placeholder：原 7 个用例已废弃，种子数据完整性改由 integration 测试端到端验证', () => {
    expect(true).toBe(true);
  });
});
