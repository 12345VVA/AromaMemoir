// InMemoryRepository 单元测试（迁移自 weiji-server/tests/unit/in-memory-repository.test.ts）
//
// ⚠️ 已废弃（DEPRECATED）：新工程 cool-admin-midway 统一采用 TypeORM Repository +
// MySQL 持久化，不再有自研的 InMemoryRepository<T>。原测试对内存仓库的
// insert/updateById/softDelete/findAll/findByField/count/toArray 行为已无对应组件，
// 等价能力改由 TypeORM repository 提供，相关覆盖见：
//   - test/unit/achievement.service.test.ts（mock TypeORM Repository 行为）
//   - test/unit/gamification.helpers.test.ts（mock TypeORM Repository 行为）
//
// 按 Task 8 要求：不硬迁移、不删除测试，整文件 describe.skip 并注明废弃原因。
describe.skip('InMemoryRepository（已废弃，新工程用 TypeORM 替代）', () => {
  it('placeholder：原 13 个用例已废弃，等价覆盖见 achievement/gamification service 单测', () => {
    // 保留文件占位，避免迁移清单缺项；新工程无 InMemoryRepository 类可测。
    expect(true).toBe(true);
  });
});
