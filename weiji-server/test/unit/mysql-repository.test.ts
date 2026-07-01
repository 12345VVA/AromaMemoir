// MysqlRepository 单元测试（迁移自 weiji-server/tests/unit/mysql-repository.test.ts）
//
// ⚠️ 已废弃（DEPRECATED）：新工程 cool-admin-midway 统一采用 TypeORM Repository
// 访问 MySQL，不再有手写的 MysqlRepository<T>（含 SQL 拼装、JSON 序列化/反序列化、
// 软删除拼接等逻辑）。TypeORM 内建 json 列 transformer（见 base/entity/base.ts 的
// transformerJson）与软删除（deleteTime）机制，等价行为由框架保证。
//
// 按 Task 8 要求：不硬迁移、不删除测试，整文件 describe.skip 并注明废弃原因。
describe.skip('MysqlRepository（已废弃，新工程用 TypeORM 替代）', () => {
  it('placeholder：原 11 个用例已废弃，TypeORM 接管 SQL 拼装与 JSON 转换', () => {
    // 新工程无 MysqlRepository 类可测；json 列 / 软删除行为由 TypeORM entity 装饰器声明。
    expect(true).toBe(true);
  });
});
