// MySQL 连接池（production-readiness-backend Task 4.2）
// ------------------------------------------------------------
// 使用 mysql2/promise 创建连接池，参数从 appConfig.storage.mysql 读取。
// 采用惰性单例：首次 getPool() 调用时才创建池，避免内存模式或测试入口意外建立连接。
//
// 导出：
// - getPool()        惰性单例，返回 mysql.Pool
// - testConnection() 执行 SELECT 1，成功返回 true，失败抛错（供 bootstrap 启动校验）
// - closePool()      关闭并清空池（供测试/优雅关闭复用）

import mysql from 'mysql2/promise';
import { appConfig } from '../configuration';

let pool: mysql.Pool | null = null;

// 获取连接池单例（首次调用时按 appConfig.storage.mysql 创建）
export function getPool(): mysql.Pool {
  if (!pool) {
    const cfg = appConfig.storage.mysql;
    pool = mysql.createPool({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
      database: cfg.database,
      connectionLimit: 10,
      charset: 'utf8mb4',
      // DATETIME/DATE/TIMESTAMP 以字符串返回，与内存模式下 ISO 字符串行为对齐
      dateStrings: true,
    });
  }
  return pool;
}

// 连通性校验：执行 SELECT 1，成功返回 true，失败抛错
export async function testConnection(): Promise<boolean> {
  await getPool().execute('SELECT 1');
  return true;
}

// 关闭并清空连接池单例
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
