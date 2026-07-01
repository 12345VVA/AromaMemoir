/**
 * 迁移自旧工程 weiji-admin-web/src/stores/__tests__/auth.spec.ts
 *
 * 旧工程用自研 pinia auth store（token/user + setAuth/clearAuth/isLoggedIn）。
 * 新工程 weiji-admin-web 采用 cool-admin-vue 脚手架：
 * - B 端管理员登录态由 cool-admin 内置 user store（src/modules/base/store/user.ts）管理，
 *   其 token 字段名/签名（setToken({token,expire,refreshToken,...})）与旧 store 差异较大，
 *   且强依赖 /@/cool 的 service+router bootstrap，组件级单测代价过高。
 * - C 端 App 用户登录态由 app-api.ts 的 token 管理函数管理（setAppToken/getAppToken/
 *   clearAppToken/isAppLoggedIn），token 存 storage 'appToken' key，与 B 端 token 隔离。
 *
 * 按 migrate spec 指引："如果新工程的 store 与旧差异太大，可改为测试 app-api.ts 的 token
 * 管理函数"。本文件即测试 C 端 App token 管理（对应旧 store 的 setAuth/clearAuth/isLoggedIn）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// 内存 storage：替代 cool-admin storage，便于断言 token 持久化与隔离
const storageData = vi.hoisted(() => ({} as Record<string, any>));

vi.mock('/@/cool/utils', () => ({
	storage: {
		get: (k: string) => storageData[k],
		set: (k: string, v: any) => {
			storageData[k] = v;
		},
		remove: (k: string) => {
			delete storageData[k];
		},
		clearAll: () => {
			for (const k in storageData) delete storageData[k];
		}
	}
}));

// axios 需 mock，避免 app-api.ts 顶层 axios.create 真实执行
vi.mock('axios', () => ({
	default: {
		create: () => ({
			interceptors: {
				request: { use: () => {} },
				response: { use: () => {} }
			},
			get: vi.fn(),
			post: vi.fn(),
			put: vi.fn(),
			patch: vi.fn(),
			delete: vi.fn()
		})
	}
}));

import {
	setAppToken,
	getAppToken,
	clearAppToken,
	isAppLoggedIn
} from '/@/modules/business/utils/app-api';

describe('C 端 App token 管理（替代旧自研 auth store）', () => {
	beforeEach(() => {
		for (const k in storageData) delete storageData[k];
	});

	it('初始状态：storage 为空时 getAppToken 返回空字符串', () => {
		expect(getAppToken()).toBe('');
	});

	it('setAppToken 写入后 getAppToken 可读取并持久化', () => {
		setAppToken('app-jwt-abc');
		expect(getAppToken()).toBe('app-jwt-abc');
		// 持久化到 storage
		expect(storageData['appToken']).toBe('app-jwt-abc');
	});

	it('clearAppToken 清除后 getAppToken 返回空字符串', () => {
		setAppToken('app-jwt-abc');
		expect(getAppToken()).toBe('app-jwt-abc');
		clearAppToken();
		expect(getAppToken()).toBe('');
		expect(storageData['appToken']).toBeUndefined();
	});

	it('isAppLoggedIn：有 token 返回 true，无 token 返回 false', () => {
		expect(isAppLoggedIn()).toBe(false);
		setAppToken('app-jwt-abc');
		expect(isAppLoggedIn()).toBe(true);
		clearAppToken();
		expect(isAppLoggedIn()).toBe(false);
	});

	it('token 存储在 appToken key（与 B 端 token 隔离）', () => {
		setAppToken('c-end-token');
		// appToken key 中存在 C 端 token，且不会写入 B 端 token key
		expect(storageData['appToken']).toBe('c-end-token');
		expect(storageData['token']).toBeUndefined();
	});
});
