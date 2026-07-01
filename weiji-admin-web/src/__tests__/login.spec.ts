/**
 * 迁移自旧工程 weiji-admin-web/src/views/__tests__/Login.spec.ts
 *
 * 【迁移说明：整体 skip】
 * 旧工程有独立的 C 端 Login.vue（表单提交 → api.login → auth.setAuth → 跳转首页）。
 * 新工程 weiji-admin-web 采用 cool-admin-vue 脚手架：
 * - 后台复用 cool-admin 内置登录页 src/modules/base/pages/login/index.vue（B 端管理员登录，
 *   admin/123456 → /admin/base/open/login，含图形验证码、useCool/useBase/service/i18n 依赖）。
 *   该页强依赖 cool-admin 整体 bootstrap（/@/cool 的 service+router+eps），组件级单测需 mock
 *   整个生态，脆弱且偏离原测试意图，故不单独测。
 * - C 端 App 用户登录由 app-api.ts 的 login() → setAppToken() 完成（无独立 C 端登录页），
 *   该路径已在 app-api.spec.ts 中覆盖（login 调用 /account/login、token 注入与 401 清除）。
 *
 * 按 migrate spec 指引："如果新工程没有独立 C 端登录页（复用 cool-admin 登录），可 skip 此测试并注明"。
 * 以下用例保留旧测试结构作为文档，整体 describe.skip。
 */
import { describe, it } from 'vitest';

describe.skip('Login 页面（已迁移：复用 cool-admin 内置登录，C 端登录由 app-api 覆盖）', () => {
	it('登录表单提交调用 api.login 并写入 auth、跳转首页', () => {
		// 旧 Login.vue：表单提交 → api.login → auth.setAuth → router.push('/')
		// 新工程：B 端由 cool-admin 登录页（service.base.open.login → user.setToken）处理；
		// C 端由 app-api.login → setAppToken 处理，已在 app-api.spec.ts 覆盖。
	});

	it('支持兼容 accessToken / user 缺失的返回结构', () => {
		// 旧页面兼容多种 token 返回字段；新工程 app-api 响应拦截器统一解包 code=1000 的 data，
		// 不再在登录页做字段兼容，故此用例不再适用。
	});

	it('切换到注册模式提交调用 api.register', () => {
		// 新工程后台无独立注册入口；C 端注册由 app-api.register(/account/register) 提供，
		// 调用契约已在 app-api.spec.ts 覆盖。
	});

	it('登录失败时调用 ElMessage.error 且不写入 auth/跳转', () => {
		// 新工程 app-api 响应拦截器在 code !== 1000 时 reject(new Error(message))，
		// 由各业务页 catch 后自行 ElMessage.error，已在 app-api.spec.ts 覆盖错误处理。
	});
});
