// 测试用应用工厂
// 通过 supertest 直接调用 Koa 的 app.callback()（Node http handler）发起请求，
// 不经过 app.listen()，因此不占用真实端口，也不触发 AI 健康检查定时任务。
// createApp 复用与生产一致的中间件装配 + 控制器注册 + onReady 钩子。
import request from 'supertest';
import { createApp } from '../../src/bootstrap';

export async function createTestApp() {
  const app = await createApp();
  return request(app.callback());
}
