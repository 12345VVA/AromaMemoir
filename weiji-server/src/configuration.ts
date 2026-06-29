// 应用配置（Midway.js Configuration 风格的简化实现）
// 由于采用 koa + 装饰器简化方案，此处主要提供配置数据，
// 实际控制器/服务在 bootstrap.ts 中通过路由扫描注册。
// 后续若升级到完整 Midway.js，此处可平滑迁移为 @Configuration 装饰类。

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
}

// 应用配置实例
export const appConfig: AppConfig = {
  port: 8001,
  cors: {
    // 允许前端开发端口跨域
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000', 'http://127.0.0.1:3000'],
    // 允许携带 Authorization header
    credentials: true,
    allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type', 'Accept'],
  },
  // weiji-ai 服务地址（FastAPI，监听 :8002）
  aiServiceUrl: 'http://localhost:8002',
  // JWT 配置（Task 3 启用）
  jwt: {
    secret: 'weiji-server-jwt-secret-2026',
    expiresIn: '7d',
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
