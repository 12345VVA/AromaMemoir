/**
 * 统一 API 客户端：封装 uni.request / uni.uploadFile
 * - 统一返回 { code, data, message }：业务层直接拿到 data
 * - JWT 拦截器：从 uni.getStorageSync('token') 读取并注入 Authorization header
 * - 条件编译 BASE_URL：H5 走代理 /api，小程序直连后端
 */

// 条件编译：H5 环境使用 /api（由 vite 代理转发），其余环境（小程序）直连后端
// #ifdef H5
const BASE_URL = '/api';
// #endif
// #ifndef H5
const BASE_URL = 'http://localhost:8001/api';
// #endif

export interface ApiResult<T = any> {
  code: number;
  data: T;
  message: string;
}

/** 从本地存储读取 token */
function getToken(): string {
  try {
    return uni.getStorageSync('token') || '';
  } catch {
    return '';
  }
}

/** 401 未授权处理：清除 token 并跳转登录页 */
function handleUnauthorized(): void {
  try {
    uni.removeStorageSync('token');
    uni.removeStorageSync('user');
  } catch {
    // ignore
  }
  // 避免在登录页重复跳转
  const pages = getCurrentPages();
  const current = pages.length ? pages[pages.length - 1] : null;
  // #ifdef H5
  const route = current ? `/${(current as any).route || ''}` : '';
  if (route !== '/pages/login') {
    uni.reLaunch({ url: '/pages/login' });
  }
  // #endif
  // #ifndef H5
  uni.reLaunch({ url: '/pages/login' });
  // #endif
}

/** 展示错误提示 */
function showError(msg: string): void {
  uni.showToast({ title: msg || '请求失败', icon: 'none', duration: 2500 });
}

interface RequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  data?: any;
  params?: Record<string, any>;
  /** 是否在失败时自动 toast 提示，默认 true */
  showError?: boolean;
  /** 是否在 401 时自动跳转登录页，默认 true */
  redirectOn401?: boolean;
}

/** 将 params 拼接到 url 的 query string */
function appendParams(url: string, params?: Record<string, any>): string {
  if (!params) return url;
  const parts: string[] = [];
  Object.keys(params).forEach((key) => {
    const val = params[key];
    if (val === undefined || val === null || val === '') return;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(val))}`);
  });
  if (!parts.length) return url;
  return url + (url.includes('?') ? '&' : '?') + parts.join('&');
}

/**
 * 通用 JSON 请求
 * 统一返回 res.data（即业务 data 字段）；失败抛出 Error
 */
function request<T = any>(options: RequestOptions): Promise<T> {
  const { method = 'GET', data, params, showError: showErr = true, redirectOn401 = true } = options;
  const fullUrl = appendParams(BASE_URL + options.url, params);
  const token = getToken();
  const header: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    header['Authorization'] = `Bearer ${token}`;
  }

  return new Promise<T>((resolve, reject) => {
    uni.request({
      url: fullUrl,
      method,
      data,
      header,
      timeout: 30000,
      success: (res) => {
        const statusCode = (res as any).statusCode || 200;
        const body = res.data as ApiResult<T> | undefined;
        // 401 未授权
        if (statusCode === 401) {
          if (redirectOn401) handleUnauthorized();
          const msg = '登录已过期，请重新登录';
          if (showErr) showError(msg);
          reject(new Error(msg));
          return;
        }
        // HTTP 错误
        if (statusCode < 200 || statusCode >= 300) {
          const msg = (body && (body as any).message) || `请求失败(${statusCode})`;
          if (showErr) showError(msg);
          reject(new Error(msg));
          return;
        }
        // 统一响应体 { code, data, message }
        if (body && typeof body === 'object' && 'code' in body) {
          if (body.code !== 0) {
            const msg = body.message || '请求失败';
            if (showErr) showError(msg);
            reject(new Error(msg));
            return;
          }
          resolve(body.data as T);
          return;
        }
        // 兜底：直接返回 data
        resolve(body as unknown as T);
      },
      fail: (err) => {
        const msg = err.errMsg || '网络异常，请稍后重试';
        if (showErr) showError(msg);
        reject(new Error(msg));
      },
    });
  });
}

/**
 * 文件上传（multipart/form-data）
 * @param url 相对路径
 * @param filePath uni.chooseImage 返回的临时文件路径
 * @param name 文件字段名，默认 image
 */
function upload<T = any>(options: {
  url: string;
  filePath: string;
  name?: string;
  formData?: Record<string, any>;
  showError?: boolean;
}): Promise<T> {
  const { url, filePath, name = 'image', formData, showError: showErr = true } = options;
  const token = getToken();
  const header: Record<string, string> = {};
  if (token) {
    header['Authorization'] = `Bearer ${token}`;
  }

  return new Promise<T>((resolve, reject) => {
    uni.uploadFile({
      url: BASE_URL + url,
      filePath,
      name,
      formData,
      header,
      timeout: 60000,
      success: (res) => {
        const statusCode = res.statusCode || 200;
        if (statusCode === 401) {
          handleUnauthorized();
          const msg = '登录已过期，请重新登录';
          if (showErr) showError(msg);
          reject(new Error(msg));
          return;
        }
        let body: ApiResult<T>;
        try {
          body = JSON.parse(res.data) as ApiResult<T>;
        } catch {
          const msg = '响应解析失败';
          if (showErr) showError(msg);
          reject(new Error(msg));
          return;
        }
        if (statusCode < 200 || statusCode >= 300) {
          const msg = (body && (body as any).message) || `上传失败(${statusCode})`;
          if (showErr) showError(msg);
          reject(new Error(msg));
          return;
        }
        if (body.code !== 0) {
          const msg = body.message || '上传失败';
          if (showErr) showError(msg);
          reject(new Error(msg));
          return;
        }
        resolve(body.data as T);
      },
      fail: (err) => {
        const msg = err.errMsg || '上传失败';
        if (showErr) showError(msg);
        reject(new Error(msg));
      },
    });
  });
}

/** API 方法集合 */
export const api = {
  // ===== 认证 =====
  login(username: string, password: string) {
    return request<{ token?: string; accessToken?: string; user?: any }>({
      url: '/auth/login',
      method: 'POST',
      data: { username, password },
    });
  },
  register(username: string, password: string, nickname: string) {
    return request<any>({ url: '/auth/register', method: 'POST', data: { username, password, nickname } });
  },
  logout() {
    return request<any>({ url: '/auth/logout', method: 'POST' });
  },

  // ===== 美食记录 =====
  getRecords(params?: Record<string, any>) {
    return request<any>({ url: '/record/list', method: 'GET', params });
  },
  saveRecord(data: any) {
    return request<any>({ url: '/record', method: 'POST', data });
  },

  // ===== 家庭菜谱 =====
  getFamilyRecipes(params?: Record<string, any>) {
    return request<any>({ url: '/family/recipes', method: 'GET', params });
  },
  /** 带筛选条件的菜谱查询（同 /family/recipes 接口，按 category/keyword 等过滤） */
  getRecipesFiltered(params: { category?: string; keyword?: string; visibility?: string }) {
    return request<any>({ url: '/family/recipes', method: 'GET', params });
  },
  getRecipeDetail(id: string) {
    return request<any>({ url: `/family/recipes/${id}`, method: 'GET' });
  },
  createRecipe(data: any) {
    return request<any>({ url: '/family/recipes', method: 'POST', data });
  },
  updateRecipe(id: string, data: any) {
    return request<any>({ url: `/family/recipes/${id}`, method: 'PUT', data });
  },
  deleteRecipe(id: string) {
    return request<any>({ url: `/family/recipes/${id}`, method: 'DELETE' });
  },

  // ===== 家庭菜单（周菜单） =====
  getWeeklyMenu() {
    return request<any>({ url: '/family/menu', method: 'GET' });
  },
  addToMenu(data: { recipeId: string; date?: string; meal?: string }) {
    return request<any>({ url: '/family/menu', method: 'POST', data });
  },
  voteMenuItem(menuId: string) {
    return request<any>({ url: `/family/menu/${menuId}/vote`, method: 'POST' });
  },

  // ===== 购物清单 =====
  getShoppingList() {
    return request<any>({ url: '/family/shopping', method: 'GET' });
  },
  addShoppingItem(data: { name: string; amount?: string; category?: string }) {
    return request<any>({ url: '/family/shopping', method: 'POST', data });
  },
  toggleShoppingItem(itemId: string) {
    return request<any>({ url: `/family/shopping/${itemId}`, method: 'PATCH' });
  },
  deleteShoppingItem(itemId: string) {
    return request<any>({ url: `/family/shopping/${itemId}`, method: 'DELETE' });
  },

  // ===== 成就 / 挑战 =====
  getAchievements() {
    return request<any>({ url: '/achievement/list', method: 'GET' });
  },
  getLevel() {
    return request<any>({ url: '/achievement/level', method: 'GET' });
  },
  getChallenges() {
    return request<any>({ url: '/challenge/list', method: 'GET' });
  },

  // ===== 打卡 =====
  getCheckinStatus() {
    return request<any>({ url: '/checkin/status', method: 'GET' });
  },
  doCheckin() {
    return request<any>({ url: '/checkin', method: 'POST' });
  },

  // ===== 用户 =====
  getUserProfile() {
    return request<any>({ url: '/user/profile', method: 'GET' });
  },
  updateProfile(data: { nickname?: string; avatar?: string }) {
    return request<any>({ url: '/user/profile', method: 'PATCH', data });
  },

  // ===== AI（通过后端代理，文件走 multipart） =====
  recognizeFood(filePath: string) {
    return upload<any>({ url: '/ai/recognize', filePath, name: 'image' });
  },
  beautifyImage(filePath: string) {
    return upload<any>({ url: '/ai/beautify', filePath, name: 'image' });
  },
  getRecommendations(dishName: string) {
    return request<any>({ url: '/ai/recommend', method: 'POST', data: { dishName } });
  },

  // ===== 家庭成员 / 邀请 =====
  getFamilyMembers() {
    return request<any>({ url: '/family/members', method: 'GET' });
  },
  createInvitation() {
    return request<any>({ url: '/family/invitations', method: 'POST' });
  },
  joinFamily(code: string) {
    return request<any>({ url: '/family/join', method: 'POST', data: { code } });
  },
  getFamilyInfo() {
    return request<any>({ url: '/family', method: 'GET' });
  },
};

export default api;
