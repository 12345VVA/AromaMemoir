/**
 * 迁移自旧工程 weiji-admin-web/src/api/__tests__/client.spec.ts
 *
 * 适配要点（旧 client.ts → 新 app-api.ts）：
 * - baseURL: /api → /app（C 端独立端点，与 B 端 /admin 隔离）
 * - token key: localStorage 'token' → storage 'appToken'（cool-admin storage 工具）
 * - Authorization header: `Bearer ${token}` → 原始 token（无 Bearer 前缀，C 端 JWT 直接传递）
 * - 响应成功码: code === 0 → code === 1000（且无 code 字段时由旧版"返回 res 本身"改为 reject）
 * - 401 处理: 清 token + 跳转 /login → 仅清 appToken（新工程不再由 app-api 跳转，由各业务页自行处理）
 * - 错误拦截器: reject 原始 error → reject new Error(msg)
 * - 导出名: api → appApi；路径: /auth/login → /account/login，/record → /record/save 等
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// 用 vi.hoisted 在 vi.mock 工厂执行前就准备好共享容器，捕获注册的拦截器回调与 create 入参。
const captured = vi.hoisted(() => ({
	request: [] as Array<(c: any) => any>,
	responseSuccess: [] as Array<(r: any) => any>,
	responseError: [] as Array<(e: any) => any>,
	instance: null as any,
	createCalls: [] as any[]
}));

// 内存 storage：替代 cool-admin 的 storage（基于 store 包 + localStorage）。
// 用 vi.hoisted 暴露数据容器，便于 beforeEach 重置。
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

vi.mock('axios', () => {
	const instance = {
		interceptors: {
			request: { use: (cb: any) => { captured.request.push(cb); } },
			response: {
				use: (s: any, e: any) => {
					captured.responseSuccess.push(s);
					captured.responseError.push(e);
				}
			}
		},
		get: vi.fn(),
		post: vi.fn(),
		put: vi.fn(),
		patch: vi.fn(),
		delete: vi.fn(),
		create: vi.fn()
	};
	captured.instance = instance;
	return {
		default: {
			create: vi.fn((cfg?: any) => {
				captured.createCalls.push(cfg);
				return instance;
			})
		}
	};
});

import { appApi } from '/@/modules/business/utils/app-api';
import { storage } from '/@/cool/utils';

describe('C 端 app-api axios 实例拦截器', () => {
	beforeEach(() => {
		for (const k in storageData) delete storageData[k];
		captured.instance.get.mockClear();
		captured.instance.post.mockClear();
	});

	it('axios 实例以 /app 作为 baseURL（C 端独立于 B 端 /admin）', () => {
		expect(captured.createCalls[0].baseURL).toBe('/app');
	});

	it('请求拦截器：有 appToken 时注入 Authorization header（原始 token，无 Bearer 前缀）', () => {
		storage.set('appToken', 'test-jwt-token');
		const config: any = { headers: {} };
		const result = captured.request[0](config);
		expect(result.headers.Authorization).toBe('test-jwt-token');
	});

	it('请求拦截器：无 appToken 时不设置 Authorization header', () => {
		const config: any = { headers: {} };
		const result = captured.request[0](config);
		expect(result.headers.Authorization).toBeUndefined();
	});

	it('响应拦截器：code=1000 时解包并返回 res.data', async () => {
		const response = {
			data: { code: 1000, data: { id: 1, name: 'foo' }, message: 'ok' }
		};
		const result = await captured.responseSuccess[0](response);
		expect(result).toEqual({ id: 1, name: 'foo' });
	});

	it('响应拦截器：无 code 字段时 reject（新工程仅 code=1000 视为成功）', async () => {
		const response = { data: { foo: 'bar' } };
		await expect(captured.responseSuccess[0](response)).rejects.toThrow('请求失败');
	});

	it('响应拦截器：code !== 1000 时 reject 业务错误（带 message）', async () => {
		const response = { data: { code: 1001, message: '用户名或密码错误' } };
		await expect(captured.responseSuccess[0](response)).rejects.toThrow('用户名或密码错误');
	});

	it('响应拦截器：code !== 1000 且无 message 时使用默认提示', async () => {
		const response = { data: { code: 500 } };
		await expect(captured.responseSuccess[0](response)).rejects.toThrow('请求失败');
	});

	it('响应错误拦截器：网络错误时 reject Error（message 透传）', async () => {
		const error = new Error('Network Error');
		await expect(captured.responseError[0](error)).rejects.toThrow('Network Error');
	});

	it('401 时清除 appToken（新工程不再重定向，仅清 token）', async () => {
		storage.set('appToken', 'will-be-cleared');
		const originalHref = window.location.href;
		const error = { response: { status: 401 } };
		await expect(captured.responseError[0](error)).rejects.toThrow();
		expect(storage.get('appToken')).toBeUndefined();
		// 新工程 app-api 的 401 不再跳转登录页（由业务页/路由守卫处理）
		expect(window.location.href).toBe(originalHref);
	});

	it('401 以外的错误码不清除 appToken', async () => {
		storage.set('appToken', 'keep-me');
		const error = { response: { status: 500, data: { message: '服务器错误' } } };
		await expect(captured.responseError[0](error)).rejects.toThrow('服务器错误');
		expect(storage.get('appToken')).toBe('keep-me');
	});

	it('appApi.login 以 POST /account/login 提交账号密码', async () => {
		await appApi.login('demo', '123456');
		expect(captured.instance.post).toHaveBeenCalledWith('/account/login', {
			username: 'demo',
			password: '123456'
		});
	});

	it('appApi.register 以 POST /account/register 提交（nickName 字段）', async () => {
		await appApi.register('demo', '123456', '小明');
		expect(captured.instance.post).toHaveBeenCalledWith('/account/register', {
			username: 'demo',
			password: '123456',
			nickName: '小明'
		});
	});

	it('appApi.logout 以 POST /account/logout 退出', async () => {
		await appApi.logout();
		expect(captured.instance.post).toHaveBeenCalledWith('/account/logout');
	});

	it('appApi.getUserProfile 以 GET /user/profile 获取资料', async () => {
		await appApi.getUserProfile();
		expect(captured.instance.get).toHaveBeenCalledWith('/user/profile');
	});

	it('appApi.getRecords 以 GET /record/list 拉取记录', async () => {
		await appApi.getRecords({ page: 1, pageSize: 20 });
		expect(captured.instance.get).toHaveBeenCalledWith('/record/list', {
			params: { page: 1, pageSize: 20 }
		});
	});

	it('appApi.saveRecord 以 POST /record/save 保存记录', async () => {
		await appApi.saveRecord({ dishName: '宫保鸡丁' });
		expect(captured.instance.post).toHaveBeenCalledWith('/record/save', {
			dishName: '宫保鸡丁'
		});
	});

	it('appApi.recognizeFood 以 FormData 发送 POST /ai/recognize', async () => {
		const file = new File(['x'], 'food.png', { type: 'image/png' });
		await appApi.recognizeFood(file);
		expect(captured.instance.post).toHaveBeenCalledWith(
			'/ai/recognize',
			expect.any(FormData),
			{ headers: { 'Content-Type': 'multipart/form-data' } }
		);
	});
});
