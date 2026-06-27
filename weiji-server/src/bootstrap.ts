// 应用启动入口
// 简化方案：koa + 装饰器扫描，规避 Midway.js DI 容器复杂性，保证 dev 命令可稳定启动
// 与 Midway 风格保持兼容：装饰器 API（@Controller/@Get/@Post）一致，后续可平滑迁移

import Koa from 'koa';
import Router from '@koa/router';
import cors from '@koa/cors';
import bodyParser from 'koa-bodyparser';
import { appConfig, Configuration } from './configuration';
import { HealthController } from './controller/health.controller';
import { AuthController } from './controller/auth.controller';
import { RecordController } from './controller/record.controller';
import { FamilyController } from './controller/family.controller';
import { AchievementController } from './controller/achievement.controller';
import { CheckinController } from './controller/checkin.controller';
import { UserController } from './controller/user.controller';
import { ChallengeController } from './controller/challenge.controller';
import { AiController } from './controller/ai.controller';
import { GamificationController } from './controller/gamification.controller';
import { AnalyticsController } from './controller/analytics.controller';
import { getControllerPrefix, getRouteDefinitions, RouteDefinition } from './common/decorators';
import { jwtMiddleware } from './middleware/jwt.middleware';
import { AiProxyService } from './service/ai-proxy.service';
// 引入 db.ts 以在启动时初始化种子数据并打印统计日志
import './store/db';

// 待挂载的控制器列表（Task 1-7 全部控制器已就绪）
const controllers: Array<{ new (...args: unknown[]): unknown }> = [
  HealthController,
  AuthController,
  RecordController,
  FamilyController,
  AchievementController,
  CheckinController,
  UserController,
  ChallengeController,
  AiController,
  GamificationController,
  AnalyticsController,
];

// 将控制器内的路由元数据注册到 koa-router
function registerController(router: Router, ControllerClass: { new (...args: unknown[]): unknown }): void {
  // 实例化控制器（DI 简化版：直接 new）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const instance = new (ControllerClass as unknown as { new (): any })();
  const prefix = getControllerPrefix(ControllerClass);
  const routes: RouteDefinition[] = getRouteDefinitions(ControllerClass);

  for (const route of routes) {
    // 拼接完整路径：前缀 + 路由路径，去重多余斜杠
    const fullPath = (prefix + route.path).replace(/\/{2,}/g, '/') || '/';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (instance as any)[route.handler].bind(instance);

    // 注册到 koa-router
    router[route.method](fullPath, async (ctx) => {
      try {
        const result = await handler(ctx);
        ctx.body = result;
      } catch (err) {
        const message = err instanceof Error ? err.message : '服务器内部错误';
        ctx.status = 500;
        ctx.body = { code: 500, data: null, message };
        console.error(`[route error] ${route.method.toUpperCase()} ${fullPath}:`, err);
      }
    });

    console.log(`[route] ${route.method.toUpperCase().padEnd(7)} ${fullPath}`);
  }
}

// 构建并返回 Koa 应用实例（装配中间件 + 注册控制器 + onReady 钩子）
// 不启动 HTTP 服务、不启动 AI 健康检查定时任务，供 bootstrap 启动与测试复用：
// supertest 通过 app.callback() 直接调用 Node http handler，无需占用真实端口。
export async function createApp(): Promise<Koa> {
  const app = new Koa();
  const router = new Router();

  // 1. CORS 中间件（允许前端 5173 跨域 + 携带 Authorization）
  // @koa/cors 的 origin 只接受 string 或 function，需将数组转换为回调
  const allowedOrigins = appConfig.cors.origin;
  app.use(
    cors({
      origin: (ctx): string => {
        const requestOrigin = ctx.request.header.origin || '';
        // 命中允许列表则回显 Origin（带 credentials 时必须回显，不能用 *）
        if (allowedOrigins.includes(requestOrigin)) {
          return requestOrigin;
        }
        // 兜底回退到第一个允许源
        return allowedOrigins[0] || '';
      },
      credentials: appConfig.cors.credentials,
      allowMethods: appConfig.cors.allowMethods,
      allowHeaders: appConfig.cors.allowHeaders,
    })
  );

  // 2. body parser（解析 JSON / form / multipart 文本部分）
  app.use(bodyParser({ jsonLimit: '20mb', formLimit: '10mb' }));

  // 3. JWT 认证中间件（白名单：/health、/api/auth/login、/api/auth/register、OPTIONS 预检）
  // 顺序：cors → bodyParser → jwtMiddleware → router.routes()
  app.use(jwtMiddleware);

  // 4. 全局错误兜底
  app.on('error', (err, ctx) => {
    console.error('[koa error]', err.message, ctx?.request?.url);
  });

  // 5. 注册所有控制器
  for (const ControllerClass of controllers) {
    registerController(router, ControllerClass);
  }

  // 6. 挂载路由
  app.use(router.routes());
  app.use(router.allowedMethods());

  // 7. 触发 Configuration onReady 钩子
  const configuration = new Configuration();
  await configuration.onReady();

  return app;
}

// 启动 HTTP 服务（含 AI 健康检查定时任务）
async function bootstrap(): Promise<void> {
  const app = await createApp();

  // AI 服务健康检查：启动时立即检查一次，之后每 60 秒定时检查
  // 维护 AiProxyService.aiStatus 供 /health 端点动态暴露
  AiProxyService.checkHealth().catch(() => {
    // 忽略：checkHealth 内部已记录日志并更新状态
  });
  setInterval(() => {
    AiProxyService.checkHealth().catch(() => {
      // 忽略：checkHealth 内部已记录日志并更新状态
    });
  }, 60_000);

  // 启动 HTTP 服务
  app.listen(appConfig.port, () => {
    console.log(`[weiji-server] 业务后端已启动：http://localhost:${appConfig.port}`);
    console.log(`[weiji-server] 健康检查：curl http://localhost:${appConfig.port}/health`);
  });
}

// 仅在直接执行本文件时启动（ts-node src/bootstrap.ts 或 node dist/bootstrap.js）。
// 被 require/import 时（如单元/集成测试）只暴露 createApp，不启动服务、不占端口、不挂定时任务。
if (require.main === module) {
  bootstrap().catch((err) => {
    console.error('[weiji-server] 启动失败：', err);
    process.exit(1);
  });
}
