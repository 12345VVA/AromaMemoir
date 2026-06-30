// MySQL 存储仓库实现（production-readiness-backend Task 4.3）
// ------------------------------------------------------------
// MysqlRepository<T> 与 InMemoryRepository<T> 实现同一 Repository 接口语义，
// 底层走 mysql2 异步 SQL。Repository 接口已整体提升为 async（各方法返回 Promise），
// 与 InMemoryRepository 一致，故本类挂 `implements Repository<T>` 子句，
// db.ts 工厂在 mysql 模式下可直接返回本类实例，无需 `as unknown as Repository<T>` 桥接。
//
// SQL 安全：全部值用 ? 占位符参数化，禁止字符串拼接值；表名/字段名用反引号包裹（来自代码常量非用户输入）。
//
// 构造参数：
//   tableName        表名（对齐 init.sql，如 'users'）
//   jsonFields       需要 JSON 序列化的字段名（如 achievements.condition、family_recipes.ingredients）
//   softDeleteEnabled 是否软删除表；true 时 findById/findByField/findAll/count 自动追加 `isDeleted=0`
//   pool             可选，测试注入 mock pool；默认走 mysql-pool.ts 的 getPool() 单例

import crypto from 'crypto';
import { getPool } from './mysql-pool';
import type { Repository } from './repository';

// 行类型：mysql2 返回的 camelCase 列名 → 值
type Row = Record<string, unknown>;

// 可执行接口（仅依赖 execute），解耦 mysql2 Pool 类型，便于测试注入 mock
interface Executable {
  execute(sql: string, params?: unknown[]): Promise<[unknown, unknown]>;
}

export class MysqlRepository<T extends { id: string }> implements Repository<T> {
  constructor(
    private tableName: string,
    private jsonFields: string[] = [],
    private softDeleteEnabled: boolean = false,
    private pool?: Executable,
  ) {}

  // 获取可执行对象：优先注入的测试 pool，否则走全局单例
  private exec(): Executable {
    return this.pool ?? (getPool() as unknown as Executable);
  }

  private isJsonField(field: string): boolean {
    return this.jsonFields.includes(field);
  }

  // 软删除过滤子句：软删除表返回 `isDeleted`=0，否则 1=1 占位
  private softDeleteClause(): string {
    return this.softDeleteEnabled ? '`isDeleted` = 0' : '1 = 1';
  }

  // 实体值 → DB 写入值：JSON 字段 stringify，isDeleted 布尔 → 0/1
  private toDbValue(field: string, value: unknown): unknown {
    if (this.isJsonField(field) && value !== undefined && value !== null) {
      return JSON.stringify(value);
    }
    if (field === 'isDeleted' && typeof value === 'boolean') {
      return value ? 1 : 0;
    }
    return value;
  }

  // DB 行 → 实体对象：JSON 字段还原为对象（mysql2 可能已解析为对象，仅对字符串再 parse），isDeleted → boolean
  private mapRow(row: Row | undefined | null): T | undefined {
    if (!row) return undefined;
    const obj: Row = { ...row };
    for (const f of this.jsonFields) {
      if (f in obj && typeof obj[f] === 'string') {
        try {
          obj[f] = JSON.parse(obj[f] as string);
        } catch {
          // 非 JSON 字符串则保留原值
        }
      }
    }
    if ('isDeleted' in obj) {
      obj.isDeleted = Boolean(obj.isDeleted);
    }
    return obj as T;
  }

  // 按 id 查询（不带软删除过滤，供 insert/updateById/softDelete 写后回读使用）
  private async findByIdRaw(id: string): Promise<T | undefined> {
    const sql = `SELECT * FROM \`${this.tableName}\` WHERE \`id\` = ?`;
    const [rows] = await this.exec().execute(sql, [id]);
    return this.mapRow((rows as Row[])[0]);
  }

  // 按 id 查找单个元素（软删除表自动过滤已删除行）
  async findById(id: string): Promise<T | undefined> {
    const sql = `SELECT * FROM \`${this.tableName}\` WHERE \`id\` = ? AND ${this.softDeleteClause()}`;
    const [rows] = await this.exec().execute(sql, [id]);
    return this.mapRow((rows as Row[])[0]);
  }

  // 按字段查找单个元素（参数化占位，LIMIT 1，软删除表自动过滤）
  async findByField<K extends keyof T>(field: K, value: T[K]): Promise<T | undefined> {
    const fieldName = String(field);
    const sql = `SELECT * FROM \`${this.tableName}\` WHERE \`${fieldName}\` = ? AND ${this.softDeleteClause()} LIMIT 1`;
    const [rows] = await this.exec().execute(sql, [this.toDbValue(fieldName, value)]);
    return this.mapRow((rows as Row[])[0]);
  }

  // 按条件过滤；未传 predicate 时返回全部行（软删除表自动过滤）
  // predicate 在内存中过滤，保持与内存模式一致的过滤语义（DB 无法表达任意 JS 谓词）
  async findAll(predicate?: (item: T) => boolean): Promise<T[]> {
    const sql = `SELECT * FROM \`${this.tableName}\` WHERE ${this.softDeleteClause()}`;
    const [rows] = await this.exec().execute(sql);
    const items = (rows as Row[]).map((r) => this.mapRow(r) as T);
    return predicate ? items.filter(predicate) : items;
  }

  // 插入新元素并自动生成 UUID（item 已含 id 则保留）；jsonFields 序列化；执行后回读返回完整对象
  async insert(item: Omit<T, 'id'> & Partial<Pick<T, 'id'>>): Promise<T> {
    const id = (item as { id?: string }).id || crypto.randomUUID();
    const itemWithId: Row = { ...(item as Row), id };
    // 过滤 undefined 字段，让其走 DB 默认值
    const fields = Object.keys(itemWithId).filter((f) => itemWithId[f] !== undefined);
    const columns = fields.map((f) => `\`${f}\``).join(', ');
    const placeholders = fields.map(() => '?').join(', ');
    const values = fields.map((f) => this.toDbValue(f, itemWithId[f]));
    const sql = `INSERT INTO \`${this.tableName}\` (${columns}) VALUES (${placeholders})`;
    await this.exec().execute(sql, values);
    const created = await this.findByIdRaw(id);
    return created ?? (itemWithId as T);
  }

  // 按 id 更新元素：仅更新 patch 中的字段（jsonFields 序列化）；若实体含 updatedAt 自动刷新；返回更新后对象
  async updateById(id: string, patch: Partial<T>): Promise<T | undefined> {
    const existing = await this.findByIdRaw(id);
    if (!existing) return undefined;
    const existingObj = existing as Row;
    const patchObj = patch as Row;
    const merged: Row = { ...existingObj, ...patchObj };
    // 若实体含 updatedAt 字段，自动刷新（与 InMemoryRepository.updateById 行为一致）
    let refreshUpdatedAt = false;
    if ('updatedAt' in existingObj) {
      merged.updatedAt = new Date().toISOString();
      refreshUpdatedAt = true;
    }
    const setFields: string[] = [];
    const setValues: unknown[] = [];
    for (const f of Object.keys(patchObj)) {
      if (patchObj[f] === undefined) continue;
      setFields.push(f);
      setValues.push(this.toDbValue(f, patchObj[f]));
    }
    if (refreshUpdatedAt) {
      setFields.push('updatedAt');
      setValues.push(merged.updatedAt);
    }
    if (setFields.length === 0) {
      return merged as T;
    }
    const setClause = setFields.map((f) => `\`${f}\` = ?`).join(', ');
    const sql = `UPDATE \`${this.tableName}\` SET ${setClause} WHERE \`id\` = ?`;
    setValues.push(id);
    await this.exec().execute(sql, setValues);
    return merged as T;
  }

  // 软删除：UPDATE SET isDeleted=1；仅对 softDeleteEnabled=true 的表生效（其余返回 undefined，与 InMemoryRepository 一致）
  async softDelete(id: string): Promise<T | undefined> {
    if (!this.softDeleteEnabled) return undefined;
    const existing = await this.findByIdRaw(id);
    if (!existing) return undefined;
    const sql = `UPDATE \`${this.tableName}\` SET \`isDeleted\` = 1 WHERE \`id\` = ?`;
    await this.exec().execute(sql, [id]);
    return { ...(existing as object), isDeleted: true } as unknown as T;
  }

  // 统计元素数量；无 predicate 时走 SELECT COUNT(*)；有 predicate 时取全部行后内存计数
  async count(predicate?: (item: T) => boolean): Promise<number> {
    if (predicate) {
      const items = await this.findAll();
      return items.filter(predicate).length;
    }
    const sql = `SELECT COUNT(*) AS c FROM \`${this.tableName}\` WHERE ${this.softDeleteClause()}`;
    const [rows] = await this.exec().execute(sql);
    const arr = rows as Row[];
    return Number(arr[0]?.c ?? 0);
  }

  // 返回全部行数组（等价 findAll()）
  async toArray(): Promise<T[]> {
    return this.findAll();
  }
}
