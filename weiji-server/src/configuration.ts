// 应用配置（Midway.js Configuration 风格的简化实现）
// 由于采用 koa + 装饰器简化方案，此处主要提供配置数据，
// 实际控制器/服务在 bootstrap.ts 中通过路由扫描注册。
// 后续若升级到完整 Midway.js，此处可平滑迁移为 @Configuration 装饰类。
//
// 配置外置（production-readiness-backend Task 6）：
// - 所有敏感/环境相关值从 process.env 读取（由 bootstrap.ts 顶部 `import 'dotenv/config'` 加载 .env）
// - JWT_SECRET 在生产环境（NODE_ENV=production）必须显式配置，否则启动即抛错退出
// - 非 production 且未配置 JWT_SECRET 时回退开发默认值并打印警告

export interface AppConfig {
  // 监听端口
  port: number;
  // CORS 配置
  cors: {
    origin: string[];
    credentials: boolean;
    allowMethods: string[];
    allowHeaders: string[];
  };
  // AI 服务地址（Task 7 接入）
  aiServiceUrl: string;
  // JWT 密钥与有效期（Task 3 接入）
  jwt: {
    secret: string;
    expiresIn: string;
  };
  // 存储配置（production-readiness-backend Task 1-3 引入）
  // driver 决定使用哪种存储仓库实现：'memory' 内存数组（默认）/ 'mysql' 关系型数据库（Task 4 接入）
  storage: {
    driver: 'memory' | 'mysql';
    // MySQL 连接配置（driver='mysql' 时使用；driver='memory' 时忽略）
    mysql: {
      host: string;
      port: number;
      user: string;
      password: string;
      database: string;
    };
  };
}

// 解析 JWT 密钥：
// - 优先使用 process.env.JWT_SECRET
// - 生产环境（NODE_ENV=production）未配置时抛错并退出，禁止使用默认密钥
// - 非 production 未配置时回退开发默认值并 console.warn 警告
function resolveJwtSecret(): string {
  const envSecret = process.env.JWT_SECRET;
  if (envSecret && envSecret.trim().length > 0) {
    return envSecret;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET 未配置，生产环境禁止使用默认密钥');
  }
  console.warn(
    '[configuration] JWT_SECRET 未配置，使用开发默认密钥。生产环境请务必设置 JWT_SECRET 环境变量。',
  );
  return 'weiji-server-jwt-dev-secret';
}

// 应用配置实例
export const appConfig: AppConfig = {
  port: Number(process.env.PORT) || 8001,
  cors: {
    // 允许前端开发端口跨域
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    // 允许携带 Authorization header
    credentials: true,
    allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type', 'Accept'],
  },
  // weiji-ai 服务地址（FastAPI，监听 :8002）
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:8002',
  // JWT 配置（Task 3 启用）
  jwt: {
    secret: resolveJwtSecret(),
    expiresIn: '7d',
  },
  // 存储配置：driver 默认 'memory'，可通过 DB_DRIVER 环境变量切换为 'mysql'
  storage: {
    driver: (process.env.DB_DRIVER as 'memory' | 'mysql') || 'memory',
    // MySQL 连接参数从环境变量读取，各字段均有默认值（driver='mysql' 时使用）
    mysql: {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'weiji',
    },
  },
};

// Configuration 类（与 Midway @Configuration 的 onReady 钩子保持风格一致）
export class Configuration {
  // 应用就绪钩子
  async onReady(): Promise<void> {
    console.log(`[configuration] 应用配置已加载，监听端口：${appConfig.port}`);
    console.log(`[configuration] CORS 允许源：${appConfig.cors.origin.join(', ')}`);
  }
}
