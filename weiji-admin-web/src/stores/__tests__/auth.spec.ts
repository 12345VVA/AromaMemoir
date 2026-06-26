import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore } from '../auth';

describe('auth store', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('初始状态：从 localStorage 读取 token 与 user', () => {
    localStorage.setItem('token', 'stored-token');
    localStorage.setItem('user', JSON.stringify({ id: 1, name: 'Alice' }));
    const store = useAuthStore();
    expect(store.token).toBe('stored-token');
    expect(store.user).toEqual({ id: 1, name: 'Alice' });
  });

  it('初始状态：localStorage 为空时 token 为空字符串、user 为 null', () => {
    const store = useAuthStore();
    expect(store.token).toBe('');
    expect(store.user).toBeNull();
  });

  it('setAuth 设置 token/user 并持久化到 localStorage', () => {
    const store = useAuthStore();
    store.setAuth('new-token', { id: 2, name: 'Bob' });
    expect(store.token).toBe('new-token');
    expect(store.user).toEqual({ id: 2, name: 'Bob' });
    expect(localStorage.getItem('token')).toBe('new-token');
    expect(localStorage.getItem('user')).toBe(JSON.stringify({ id: 2, name: 'Bob' }));
  });

  it('clearAuth 清空状态并移除 localStorage', () => {
    const store = useAuthStore();
    store.setAuth('t', { id: 1 });
    expect(store.token).toBe('t');
    store.clearAuth();
    expect(store.token).toBe('');
    expect(store.user).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('isLoggedIn：有 token 返回 true，无 token 返回 false', () => {
    const store = useAuthStore();
    expect(store.isLoggedIn()).toBe(false);
    store.setAuth('abc', { id: 1 });
    expect(store.isLoggedIn()).toBe(true);
    store.clearAuth();
    expect(store.isLoggedIn()).toBe(false);
  });
});
