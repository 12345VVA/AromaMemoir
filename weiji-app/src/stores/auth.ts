import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api } from '../api/client';

/**
 * 认证 Store
 * - state: token, user
 * - actions: login, logout, restoreFromStorage
 * - 用 uni.getStorageSync / uni.setStorageSync 持久化
 */
export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>('');
  const user = ref<any>(null);

  const isLoggedIn = computed(() => !!token.value);

  /** 设置登录态并持久化 */
  function setAuth(newToken: string, newUser: any) {
    token.value = newToken;
    user.value = newUser;
    try {
      uni.setStorageSync('token', newToken);
      uni.setStorageSync('user', JSON.stringify(newUser));
    } catch {
      // ignore storage error
    }
  }

  /** 登录：调用 API 并写入本地态 */
  async function login(credentials: { username: string; password: string }) {
    const data: any = await api.login(credentials.username, credentials.password);
    const t = data.token || data.accessToken || '';
    const u = data.user || data;
    setAuth(t, u);
    return { token: t, user: u };
  }

  /** 退出登录：清空本地态并通知后端 */
  async function logout() {
    try {
      await api.logout();
    } catch {
      // 即使后端调用失败也清空本地态
    }
    clearAuth();
  }

  /** 仅清空本地登录态（不调用后端） */
  function clearAuth() {
    token.value = '';
    user.value = null;
    try {
      uni.removeStorageSync('token');
      uni.removeStorageSync('user');
    } catch {
      // ignore
    }
  }

  /** 应用启动时从本地存储恢复登录态 */
  function restoreFromStorage() {
    try {
      const t = uni.getStorageSync('token') || '';
      const u = uni.getStorageSync('user');
      token.value = t;
      user.value = u ? (typeof u === 'string' ? JSON.parse(u) : u) : null;
    } catch {
      token.value = '';
      user.value = null;
    }
  }

  return {
    token,
    user,
    isLoggedIn,
    setAuth,
    login,
    logout,
    clearAuth,
    restoreFromStorage,
  };
});
