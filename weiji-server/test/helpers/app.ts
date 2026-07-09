// 测试用应用工厂（迁移自旧 weiji-server/tests/helpers/app.ts）
//
// 适配说明：
// 旧工程通过 `createApp()` 拿到 Koa app.callback()，用 supertest 进程内发起请求。
// 新工程 cool-admin-midway 采用基于文件目录的自动化路由，与 Midway 官方 jest
// 集成（createLightApp）不兼容（见 test/README.md 官方说明）。因此集成测试改为
// 对准已通过 `NODE_ENV=local node bootstrap-local.js` 拉起的真实 HTTP 服务
// （:17801）发起请求，不占用额外端口、不重复装配中间件，与开发环境一致。
//
// 运行前需确认服务存活：curl localhost:17801/open/health
import * as request from 'supertest';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:17801';

export async function createTestApp() {
  // supertest 传入完整 URL 字符串时，可直接 .get()/.post() 链式调用，
  // 请求会发往该 BASE_URL，无需 app.callback()。
  return request(BASE_URL);
}
