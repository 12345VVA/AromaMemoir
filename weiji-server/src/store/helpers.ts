// 内存存储辅助查询方法
// 提供按 id / 字段查找、过滤、插入（自动生成 UUID）、更新、软删除等通用操作

import crypto from 'crypto';

// 按 id 查找单个元素
export function findById<T extends { id: string }>(list: T[], id: string): T | undefined {
  return list.find((item) => item.id === id);
}

// 按字段查找单个元素
export function findByField<T, K extends keyof T>(list: T[], field: K, value: T[K]): T | undefined {
  return list.find((item) => item[field] === value);
}

// 按条件过滤
export function filterBy<T>(list: T[], predicate: (item: T) => boolean): T[] {
  return list.filter(predicate);
}

// 插入新元素并自动生成 UUID
// 若 item 已含 id 则保留，否则使用 crypto.randomUUID() 生成
export function insert<T extends { id: string }>(list: T[], item: Omit<T, 'id'> & Partial<Pick<T, 'id'>>): T {
  const newItem = { ...item, id: item.id || crypto.randomUUID() } as T;
  list.push(newItem);
  return newItem;
}

// 按 id 更新元素（patch 合并），返回更新后的对象
// 找不到时返回 undefined
export function updateById<T extends { id: string }>(list: T[], id: string, patch: Partial<T>): T | undefined {
  const idx = list.findIndex((item) => item.id === id);
  if (idx === -1) return undefined;
  // 若实体有 updatedAt 字段，自动刷新
  const merged = { ...list[idx], ...patch };
  if ('updatedAt' in merged && typeof merged === 'object' && merged !== null) {
    (merged as { updatedAt: string }).updatedAt = new Date().toISOString();
  }
  list[idx] = merged;
  return list[idx];
}

// 软删除：设置 isDeleted = true
export function softDelete<T extends { id: string; isDeleted: boolean }>(list: T[], id: string): T | undefined {
  const item = findById(list, id);
  if (item) {
    item.isDeleted = true;
    return item;
  }
  return undefined;
}

// 生成 UUID（与 Midway / Node crypto.randomUUID 等价）
export function uuid(): string {
  return crypto.randomUUID();
}
