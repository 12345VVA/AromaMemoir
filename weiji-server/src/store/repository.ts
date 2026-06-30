// 存储抽象层：Repository 接口
// 对齐现有 src/store/helpers.ts 的函数式 API（findById/findByField/filterBy/insert/updateById/softDelete），
// 将"裸数组 + helper 函数"统一为"Repository 对象 + 方法调用"，为接入 MySQL 等持久化驱动做准备。
//
// 设计说明：
// - 泛型 T 约束为 { id: string }，与 helpers.findById/insert/updateById 的约束一致
// - softDelete 仅对含 isDeleted 字段的实体有意义；接口统一暴露该方法，
//   实现层做运行时判断（实体不含 isDeleted 时返回 undefined），保持单一接口简单性
// - 接口方法统一为 async（返回 Promise）：内存实现与 MySQL 实现共用同一签名，
//   MySQL I/O 本质异步，统一 async 后 mysql 模式可端到端运行（调用点 await）

// 通用存储仓库接口
export interface Repository<T extends { id: string }> {
  // 按 id 查找单个元素
  findById(id: string): Promise<T | undefined>;

  // 按字段查找单个元素
  findByField<K extends keyof T>(field: K, value: T[K]): Promise<T | undefined>;

  // 按条件过滤；未传 predicate 时返回全部元素的副本
  findAll(predicate?: (item: T) => boolean): Promise<T[]>;

  // 插入新元素并自动生成 UUID（item 已含 id 则保留）
  insert(item: Omit<T, 'id'> & Partial<Pick<T, 'id'>>): Promise<T>;

  // 按 id 更新元素（patch 合并），返回更新后的对象；找不到时返回 undefined
  // 若实体含 updatedAt 字段，自动刷新
  updateById(id: string, patch: Partial<T>): Promise<T | undefined>;

  // 软删除：设置 isDeleted = true（仅对含 isDeleted 的实体生效）
  // 找不到或实体无 isDeleted 字段时返回 undefined
  softDelete(id: string): Promise<T | undefined>;

  // 统计元素数量；可按条件统计
  count(predicate?: (item: T) => boolean): Promise<number>;

  // 返回内部数组引用，供测试与种子访问（push/splice 等就地操作会反映到仓库内部）
  toArray(): Promise<T[]>;
}
