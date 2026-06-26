import { describe, it, expect, vi, beforeEach } from 'vitest';

// 用 vi.hoisted 在 vi.mock 工厂执行前就准备好共享容器，捕获注册的拦截器回调。
const captured = vi.hoisted(() => ({
  request: [] as Array<(c: any) => any>,
  responseSuccess: [] as Array<(r: any) => any>,
  responseError: [] as Array<(e: any) => any>,
  instance: null as any,
}));

vi.mock('axios', () => {
  const instance = {
    interceptors: {
      request: { use: (cb: any) => { captured.request.push(cb); } },
      response: {
        use: (s: any, e: any) => {
          captured.responseSuccess.push(s);
          captured.responseError.push(e);
        },
      },
    },
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    create: vi.fn(),
  };
  captured.instance = instance;
  return {
    default: {
      create: vi.fn(() => instance),
    },
  };
});

import { api } from '../client';

describe('axios client 拦截器', () => {
  beforeEach(() => {
    localStorage.clear();
    captured.instance.get.mockClear();
    captured.instance.post.mockClear();
  });

  it('请求拦截器：有 token 时注入 Authorization header', () => {
    localStorage.setItem('token', 'test-jwt-token');
    const config: any = { headers: {} };
    const result = captured.request[0](config);
    expect(result.headers.Authorization).toBe('Bearer test-jwt-token');
  });

  it('请求拦截器：无 token 时不设置 Authorization header', () => {
    const config: any = { headers: {} };
    const result = captured.request[0](config);
    expect(result.headers.Authorization).toBeUndefined();
  });

  it('响应拦截器：code=0 时解包并返回 res.data', async () => {
    const response = {
      data: { code: 0, data: { id: 1, name: 'foo' }, message: 'ok' },
    };
    const result = await captured.responseSuccess[0](response);
    expect(result).toEqual({ id: 1, name: 'foo' });
  });

  it('响应拦截器：无 code 字段时返回 res 本身', async () => {
    const response = { data: { foo: 'bar' } };
    const result = await captured.responseSuccess[0](response);
    expect(result).toEqual({ foo: 'bar' });
  });

  it('响应拦截器：code !== 0 时 reject 业务错误（带 message）', async () => {
    const response = { data: { code: 1001, message: '用户名或密码错误' } };
    await expect(captured.responseSuccess[0](response)).rejects.toThrow(
      '用户名或密码错误'
    );
  });

  it('响应拦截器：code !== 0 且无 message 时使用默认提示', async () => {
    const response = { data: { code: 500 } };
    await expect(captured.responseSuccess[0](response)).rejects.toThrow('请求失败');
  });

  it('响应错误拦截器：网络错误时 reject 原始 error', async () => {
    const error = new Error('Network Error');
    await expect(captured.responseError[0](error)).rejects.toBe(error);
  });

  it('401 时清除 token 并重定向到 /login', async () => {
    localStorage.setItem('token', 'will-be-cleared');
    // jsdom 中 location.href 是原型上不可配置的访问器，
    // 这里在 window 实例上覆盖 location 为可写对象以便断言
    const originalLocation = window.location;
    const mockLocation: any = { href: '' };
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: mockLocation,
    });

    const error = { response: { status: 401 } };
    await expect(captured.responseError[0](error)).rejects.toBe(error);
    expect(localStorage.getItem('token')).toBeNull();
    expect(window.location.href).toBe('/login');

    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
  });

  it('401 以外的错误码不触发清除 token 与重定向', async () => {
    localStorage.setItem('token', 'keep-me');
    const originalLocation = window.location;
    const mockLocation: any = { href: '' };
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: mockLocation,
    });

    const error = { response: { status: 500 } };
    await expect(captured.responseError[0](error)).rejects.toBe(error);
    expect(localStorage.getItem('token')).toBe('keep-me');
    expect(window.location.href).toBe('');

    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
  });

  it('api.login 以 POST /auth/login 提交账号密码', async () => {
    await api.login('demo', '123456');
    expect(captured.instance.post).toHaveBeenCalledWith('/auth/login', {
      username: 'demo',
      password: '123456',
    });
  });

  it('api.recognizeFood 以 FormData 发送 POST /ai/recognize', async () => {
    const file = new File(['x'], 'food.png', { type: 'image/png' });
    await api.recognizeFood(file);
    expect(captured.instance.post).toHaveBeenCalledWith(
      '/ai/recognize',
      expect.any(FormData),
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  });
});
