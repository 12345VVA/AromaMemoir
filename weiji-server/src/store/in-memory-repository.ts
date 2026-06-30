// 内存存储仓库实现
// 持有内部数组引用，各方法内联实现与 src/store/helpers.ts 函数式 API 完全等价的逻辑，
// 确保"裸数组 + helper 函数"与"Repository 对象 + 方法调用"行为一致：
// - insert 自动生成 UUID（已含 id 则保留）
// - updateById 自动刷新 updatedAt
// - softDelete 置 isDeleted=true（运行时判断实体是否含 isDeleted 字段）
//
// 方法统一为 async（返回 Promise），与 Repository 接口及 MysqlRepository 一致，
// 便于 db.ts 工厂在 memory / mysql 驱动间无类型桥接切换。
//
// 注：此处不复用 helpers.ts 的函数，以避免 db.ts → in-memory-repository.ts → helpers.ts → db.ts
// 的循环依赖导致 class InMemoryRepository 在 db.ts 顶层求值时仍处于 TDZ。

import crypto from 'crypto';
import type { Repository } from './repository';

export class InMemoryRepository<T extends { id: string }> implements Repository<T> {
  // 内部数组引用；构造时接收初始数组（默认空数组）
  // toArray() 返回此引用，供测试与种子数据就地访问（push/splice 反映到仓库内部）
  private items: T[];

  constructor(initial: T[] = []) {
    this.items = initial;
  }

  async findById(id: string): Promise<T | undefined> {
    return this.items.find((item) => item.id === id);
  }

  async findByField<K extends keyof T>(field: K, value: T[K]): Promise<T | undefined> {
    return this.items.find((item) => item[field] === value);
  }

  async findAll(predicate?: (item: T) => boolean): Promise<T[]> {
    // 与 filterBy 一致：传 predicate 时返回过滤后的新数组；
    // 未传 predicate 时返回内部数组的浅拷贝，避免调用方意外污染内部状态
    return predicate ? this.items.filter(predicate) : [...this.items];
  }

  async insert(item: Omit<T, 'id'> & Partial<Pick<T, 'id'>>): Promise<T> {
    const newItem = { ...item, id: item.id || crypto.randomUUID() } as T;
    this.items.push(newItem);
    return newItem;
  }

  async updateById(id: string, patch: Partial<T>): Promise<T | undefined> {
    const idx = this.items.findIndex((item) => item.id === id);
    if (idx === -1) return undefined;
    // 若实体有 updatedAt 字段，自动刷新
    const merged = { ...this.items[idx], ...patch };
    if ('updatedAt' in merged && typeof merged === 'object' && merged !== null) {
      (merged as { updatedAt: string }).updatedAt = new Date().toISOString();
    }
    this.items[idx] = merged;
    return this.items[idx];
  }

  async softDelete(id: string): Promise<T | undefined> {
    // 对含 isDeleted 字段的实体置位，与 helpers.softDelete 行为一致
    // 实体不含 isDeleted 字段时返回 undefined（softDelete 仅对可软删实体有意义）
    const item = this.items.find((item) => item.id === id);
    if (item && 'isDeleted' in item) {
      (item as { isDeleted: boolean }).isDeleted = true;
      return item;
    }
    return undefined;
  }

  async count(predicate?: (item: T) => boolean): Promise<number> {
    return predicate ? this.items.filter(predicate).length : this.items.length;
  }

  async toArray(): Promise<T[]> {
    return this.items;
  }
}
