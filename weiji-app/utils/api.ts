/**
 * C 端 API 服务（对接 weiji-server / cool-admin-midway）
 * - 适配 uni.request / uni.uploadFile（uni-app 不支持 axios）
 * - 路径前缀：H5 走 vite 代理（/app、/open），小程序/App 直连 http://localhost:8001
 * - token 从 uni.getStorageSync('token') 读取，注入 Authorization header（不带 Bearer 前缀，
 *   cool-admin-midway 的 UserMiddleware 会用裸 token 直接 jwt.verify）
 * - 统一响应体 { code, data, message }，code === 1000 表示成功，返回 data
 * - 401 自动清 token + reLaunch 到 /pages/user/login
 * - 失败 uni.showToast 提示
 * - login 成功后写入 cool-uni 内置 user store，保持与内置登录页兼容
 *
 * 仅走 /app/*（C 端）与 /open/*（公开），不复用 /admin/*（B 端）。
 */

import { useUserStore } from "/@/cool/store/user";

// 条件编译：H5 使用 vite 代理（路径前缀 /app、/open 由 proxy.ts 转发），其余端直连后端
// #ifdef H5
const HOST = "";
// #endif
// #ifndef H5
const HOST = "http://localhost:8001";
// #endif

const LOGIN_PAGE = "/pages/user/login";
const TOKEN_EXPIRE = 30 * 24 * 3600; // 30 天（秒），写入 cool store 时使用

export interface ApiResult<T = any> {
	code: number;
	data: T;
	message: string;
}

/** 从本地存储读取 token（与 cool-uni user store 共享 key "token"） */
function getToken(): string {
	try {
		return uni.getStorageSync("token") || "";
	} catch {
		return "";
	}
}

/** 清除本地鉴权信息 */
function clearAuthStorage(): void {
	try {
		uni.removeStorageSync("token");
		uni.removeStorageSync("userInfo");
		uni.removeStorageSync("refreshToken");
		uni.removeStorageSync("token_deadtime");
		uni.removeStorageSync("refreshToken_deadtime");
	} catch {
		// ignore
	}
}

/** 401 未授权处理：清除 token 并跳转登录页 */
function handleUnauthorized(): void {
	clearAuthStorage();
	// 避免在登录页重复跳转
	try {
		const pages = getCurrentPages();
		const current = pages.length ? pages[pages.length - 1] : null;
		const route = current ? `/${(current as any).route || ""}` : "";
		if (route === LOGIN_PAGE) return;
	} catch {
		// ignore
	}
	uni.reLaunch({ url: LOGIN_PAGE });
}

/** 展示错误提示 */
function showError(msg: string): void {
	uni.showToast({ title: msg || "请求失败", icon: "none", duration: 2500 });
}

interface RequestOptions {
	url: string;
	method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
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
		if (val === undefined || val === null || val === "") return;
		parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(val))}`);
	});
	if (!parts.length) return url;
	return url + (url.includes("?") ? "&" : "?") + parts.join("&");
}

/**
 * 通用 JSON 请求
 * 统一返回 res.data（即业务 data 字段）；失败抛出 Error
 */
function request<T = any>(options: RequestOptions): Promise<T> {
	const {
		method = "GET",
		data,
		params,
		showError: showErr = true,
		redirectOn401 = true,
	} = options;
	const fullUrl = appendParams(HOST + options.url, params);
	const token = getToken();
	const header: Record<string, string> = {
		"Content-Type": "application/json",
	};
	if (token) {
		// 不带 Bearer 前缀：UserMiddleware 用裸 token 直接 jwt.verify
		header["Authorization"] = token;
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
					const msg = "登录已过期，请重新登录";
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

				// 统一响应体 { code, data, message }，code === 1000 成功
				if (body && typeof body === "object" && "code" in body) {
					if (body.code === 1000) {
						resolve(body.data as T);
						return;
					}
					const msg = body.message || "请求失败";
					if (showErr) showError(msg);
					reject(new Error(msg));
					return;
				}

				// 兜底：直接返回 data
				resolve(body as unknown as T);
			},
			fail: (err) => {
				const msg = err.errMsg || "网络异常，请稍后重试";
				if (showErr) showError(msg);
				reject(new Error(msg));
			},
		});
	});
}

interface UploadOptions {
	url: string;
	filePath: string;
	name?: string;
	formData?: Record<string, any>;
	showError?: boolean;
	redirectOn401?: boolean;
}

/**
 * 文件上传（multipart/form-data）
 * @param options.filePath uni.chooseImage 返回的临时文件路径
 * @param options.name 文件字段名，默认 image
 */
function upload<T = any>(options: UploadOptions): Promise<T> {
	const {
		url,
		filePath,
		name = "image",
		formData,
		showError: showErr = true,
		redirectOn401 = true,
	} = options;
	const token = getToken();
	const header: Record<string, string> = {};
	if (token) {
		header["Authorization"] = token;
	}

	return new Promise<T>((resolve, reject) => {
		uni.uploadFile({
			url: HOST + url,
			filePath,
			name,
			formData,
			header,
			timeout: 60000,
			success: (res) => {
				const statusCode = res.statusCode || 200;
				if (statusCode === 401) {
					if (redirectOn401) handleUnauthorized();
					const msg = "登录已过期，请重新登录";
					if (showErr) showError(msg);
					reject(new Error(msg));
					return;
				}
				let body: ApiResult<T>;
				try {
					body = JSON.parse(res.data) as ApiResult<T>;
				} catch {
					const msg = "响应解析失败";
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
				if (body.code === 1000) {
					resolve(body.data as T);
					return;
				}
				const msg = body.message || "上传失败";
				if (showErr) showError(msg);
				reject(new Error(msg));
			},
			fail: (err) => {
				const msg = err.errMsg || "上传失败";
				if (showErr) showError(msg);
				reject(new Error(msg));
			},
		});
	});
}

/**
 * 将 token + user 写入 cool-uni 内置 user store（兼容内置登录页 /pages/user/login）
 * 失败时回退到直接写本地存储。
 */
function syncUserStore(token: string, user?: any): void {
	try {
		const userStore = useUserStore();
		userStore.setToken({
			token,
			expire: TOKEN_EXPIRE,
			refreshToken: token,
			refreshExpire: TOKEN_EXPIRE,
		});
		if (user) {
			userStore.set(user);
		}
	} catch {
		try {
			uni.setStorageSync("token", token);
			if (user) uni.setStorageSync("userInfo", user);
		} catch {
			// ignore
		}
	}
}

/** 清除 cool-uni user store（失败回退到直接清本地存储） */
function clearUserStore(): void {
	try {
		useUserStore().clear();
	} catch {
		clearAuthStorage();
	}
}

/**
 * API 方法集合
 *
 * 端点契约：/workspace/weiji-server/docs/api-path-mapping.md
 * family 子资源单数化（member/invitation/recipe/record）+ 集合查询补 /list 后缀；
 * gamification 拆为 pokedex/personality/timemachine/blindguess 四组；
 * analytics 拆为 events 查询 + track 上报；
 * 个人记录 like/comment 已归入家庭动态 family/record/*（与 record 模块分离）。
 */
export const api = {
	// ===== account 认证 =====
	login(username: string, password: string) {
		return request<{ token: string; user: any }>({
			url: "/app/account/login",
			method: "POST",
			data: { username, password },
		}).then((res) => {
			if (res?.token) {
				syncUserStore(res.token, res.user);
			}
			return res;
		});
	},

	register(username: string, password: string, nickName: string) {
		return request<{ token: string; user: any }>({
			url: "/app/account/register",
			method: "POST",
			data: { username, password, nickName },
		}).then((res) => {
			if (res?.token) {
				syncUserStore(res.token, res.user);
			}
			return res;
		});
	},

	logout() {
		return request<any>({
			url: "/app/account/logout",
			method: "POST",
			showError: false,
			redirectOn401: false,
		})
			.catch(() => {
				// 忽略服务端错误，仍清理本地
			})
			.then((res) => {
				clearUserStore();
				return res;
			});
	},

	// ===== user 用户资料 =====
	getUserProfile() {
		return request<any>({ url: "/app/user/profile", method: "GET" });
	},

	updateProfile(data: { nickName?: string; avatarUrl?: string }) {
		return request<any>({ url: "/app/user/profile", method: "PATCH", data });
	},

	// ===== record 个人美食记录（list/save/:id/delete） =====
	getRecords(params?: Record<string, any>) {
		return request<any>({ url: "/app/record/list", method: "GET", params });
	},

	saveRecord(data: any) {
		return request<any>({ url: "/app/record/save", method: "POST", data });
	},

	getRecord(id: string | number) {
		return request<any>({ url: `/app/record/${id}`, method: "GET" });
	},

	deleteRecord(id: string | number) {
		// server 用动作化路径 POST /app/record/delete/:id（非 RESTful DELETE）
		return request<any>({ url: `/app/record/delete/${id}`, method: "POST" });
	},

	// ===== family 家庭组基础 =====
	getFamilyInfo() {
		return request<any>({ url: "/app/family", method: "GET" });
	},

	createFamily(name: string) {
		return request<any>({ url: "/app/family", method: "POST", data: { name } });
	},

	joinFamily(code: string) {
		return request<any>({ url: "/app/family/join", method: "POST", data: { code } });
	},

	// ===== family/member 成员（单数 + /list） =====
	getFamilyMembers() {
		return request<any>({ url: "/app/family/member/list", method: "GET" });
	},

	// ===== family/recipe 菜谱（单数 + /list） =====
	getFamilyRecipes(params?: Record<string, any>) {
		return request<any>({ url: "/app/family/recipe/list", method: "GET", params });
	},

	createRecipe(data: any) {
		return request<any>({ url: "/app/family/recipe", method: "POST", data });
	},

	getRecipeDetail(id: string | number) {
		return request<any>({ url: `/app/family/recipe/${id}`, method: "GET" });
	},

	updateRecipe(id: string | number, data: any) {
		return request<any>({ url: `/app/family/recipe/${id}`, method: "PUT", data });
	},

	deleteRecipe(id: string | number) {
		return request<any>({ url: `/app/family/recipe/${id}`, method: "DELETE" });
	},

	updateRecipeVisibility(id: string | number, visibility: string) {
		// 专用可见性切换端点 PATCH /app/family/recipe/:id/visibility
		return request<any>({
			url: `/app/family/recipe/${id}/visibility`,
			method: "PATCH",
			data: { visibility },
		});
	},

	// ===== family/menu 协作菜单（集合补 /list） =====
	getWeeklyMenu(params?: Record<string, any>) {
		return request<any>({ url: "/app/family/menu/list", method: "GET", params });
	},

	addToMenu(data: { recipeId: string | number; date?: string; meal?: string }) {
		return request<any>({ url: "/app/family/menu", method: "POST", data });
	},

	voteMenuItem(id: string | number, vote?: string) {
		return request<any>({
			url: `/app/family/menu/${id}/vote`,
			method: "POST",
			data: vote ? { vote } : undefined,
		});
	},

	// ===== family/shopping 购物清单（集合补 /list） =====
	getShoppingList() {
		return request<any>({ url: "/app/family/shopping/list", method: "GET" });
	},

	addShoppingItem(data: { name: string; amount?: string; category?: string }) {
		return request<any>({ url: "/app/family/shopping", method: "POST", data });
	},

	toggleShoppingItem(id: string | number, checked?: boolean) {
		return request<any>({
			url: `/app/family/shopping/${id}`,
			method: "PATCH",
			data: checked === undefined ? undefined : { checked },
		});
	},

	deleteShoppingItem(id: string | number) {
		return request<any>({ url: `/app/family/shopping/${id}`, method: "DELETE" });
	},

	generateShoppingList() {
		return request<any>({ url: "/app/family/shopping/generate", method: "POST" });
	},

	// ===== family/invitation 邀请（单数 + /list） =====
	getInvitations() {
		return request<any>({ url: "/app/family/invitation/list", method: "GET" });
	},

	createInvitation() {
		return request<any>({ url: "/app/family/invitation", method: "POST" });
	},

	// ===== family/record 家庭动态（点赞/评论归此，非个人 record） =====
	getFamilyFeed(params?: Record<string, any>) {
		return request<any>({ url: "/app/family/record/list", method: "GET", params });
	},

	likeFamilyRecord(id: string | number) {
		return request<any>({ url: `/app/family/record/${id}/like`, method: "POST" });
	},

	commentFamilyRecord(id: string | number, content: string) {
		return request<any>({
			url: `/app/family/record/${id}/comment`,
			method: "POST",
			data: { content },
		});
	},

	// ===== family/report 月度报告 =====
	getFamilyReport(params?: Record<string, any>) {
		return request<any>({ url: "/app/family/report", method: "GET", params });
	},

	// ===== achievement 成就 =====
	getAchievements() {
		return request<any>({ url: "/app/achievement/list", method: "GET" });
	},

	getLevel() {
		return request<any>({ url: "/app/achievement/level", method: "GET" });
	},

	// ===== challenge 挑战（server 仅提供列表查询，无 join 端点） =====
	getChallenges() {
		return request<any>({ url: "/app/challenge/list", method: "GET" });
	},

	// ===== checkin 打卡 =====
	getCheckinStatus() {
		return request<any>({ url: "/app/checkin/status", method: "GET" });
	},

	doCheckin() {
		return request<any>({ url: "/app/checkin", method: "POST" });
	},

	checkinReplenish() {
		// 补签昨日（每周限 1 次）
		return request<any>({ url: "/app/checkin/replenish", method: "POST" });
	},

	// ===== gamification 趣味玩法（图鉴/人格/时光机/盲猜） =====
	getPokedex() {
		return request<any>({ url: "/app/gamification/pokedex", method: "GET" });
	},

	getPersonality() {
		return request<any>({ url: "/app/gamification/personality", method: "GET" });
	},

	getTimemachine() {
		return request<any>({ url: "/app/gamification/timemachine", method: "GET" });
	},

	createBlindGuessRound(data: {
		familyId: number | string;
		roundName: string;
		recordIds: (number | string)[];
	}) {
		return request<any>({
			url: "/app/gamification/blindguess/round",
			method: "POST",
			data,
		});
	},

	getBlindGuessRoundDetail(id: string | number) {
		return request<any>({
			url: `/app/gamification/blindguess/round/${id}`,
			method: "GET",
		});
	},

	submitBlindGuess(
		id: string | number,
		data: {
			itemId: number | string;
			guessAuthorId: number | string;
			guessAuthorName?: string;
			guessDishName: string;
		}
	) {
		return request<any>({
			url: `/app/gamification/blindguess/round/${id}/guess`,
			method: "POST",
			data,
		});
	},

	revealBlindGuessRound(id: string | number) {
		return request<any>({
			url: `/app/gamification/blindguess/round/${id}/reveal`,
			method: "POST",
		});
	},

	// ===== analytics 埋点（events 查询 + track 上报） =====
	getAnalyticsEvents(type?: string) {
		return request<any>({
			url: "/app/analytics/events",
			method: "GET",
			params: type ? { type } : undefined,
		});
	},

	trackAnalyticsEvent(
		type: string,
		payload?: Record<string, any>,
		familyId?: number | string
	) {
		return request<any>({
			url: "/app/analytics/track",
			method: "POST",
			data: { type, payload, familyId },
		});
	},

	// ===== ai（文件走 multipart；voice 字段名为 audio，其余为 image） =====
	recognizeFood(filePath: string) {
		return upload<any>({ url: "/app/ai/recognize", filePath, name: "image" });
	},

	beautifyImage(filePath: string) {
		return upload<any>({ url: "/app/ai/beautify", filePath, name: "image" });
	},

	getRecommendations(dishName: string) {
		return request<any>({
			url: "/app/ai/recommend",
			method: "POST",
			data: { dishName },
		});
	},

	voiceRecognize(filePath: string) {
		// 语音识别：multipart 字段名为 audio（非 image）
		return upload<any>({ url: "/app/ai/voice/recognize", filePath, name: "audio" });
	},

	generateSticker(filePath: string) {
		return upload<any>({ url: "/app/ai/sticker", filePath, name: "image" });
	},

	// ===== open 公开 =====
	health() {
		return request<{ status: any; ai: any }>({
			url: "/open/health",
			method: "GET",
			redirectOn401: false,
		});
	},
};

export default api;
