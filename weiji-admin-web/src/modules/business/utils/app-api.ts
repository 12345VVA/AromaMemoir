import axios from 'axios';
import { storage } from '/@/cool/utils';

/**
 * C 端 App API 服务（独立于 B 端 cool-admin request）
 *
 * B 端管理员（base_sys_user）与 C 端 App 用户（weiji_app_user）是两套独立用户体系，
 * token 互不通用。本服务专门调用 /app/* 端点，使用 C 端 App JWT，
 * token 存储在 localStorage 的 "appToken" key（与 B 端 token 隔离）。
 *
 * 响应拦截器统一处理 { code, data, message }，code=1000 成功返回 data。
 */
const instance = axios.create({
	baseURL: '/app',
	timeout: 30000
});

// 请求拦截器：注入 C 端 App JWT
instance.interceptors.request.use(config => {
	const token = storage.get('appToken');
	if (token) {
		config.headers.Authorization = token;
	}
	return config;
});

// 响应拦截器：统一处理 { code, data, message }
instance.interceptors.response.use(
	response => {
		const res = response.data;
		if (res.code === 1000) {
			return res.data;
		}
		return Promise.reject(new Error(res.message || '请求失败'));
	},
	error => {
		if (error.response?.status === 401) {
			storage.remove('appToken');
		}
		const msg = error.response?.data?.message || error.message;
		return Promise.reject(new Error(msg));
	}
);

/** C 端 App API（路径依据 /workspace/weiji-server/docs/api-path-mapping.md） */
export const appApi = {
	// ===== account 账户认证 =====
	login(username: string, password: string) {
		return instance.post('/account/login', { username, password });
	},
	register(username: string, password: string, nickName: string) {
		return instance.post('/account/register', { username, password, nickName });
	},
	logout() {
		return instance.post('/account/logout');
	},

	// ===== user 用户资料 =====
	getUserProfile() {
		return instance.get('/user/profile');
	},
	updateProfile(data: { nickName?: string; avatarUrl?: string }) {
		return instance.patch('/user/profile', data);
	},
	uploadAvatar(file: File): Promise<any> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = async e => {
				const dataUrl = e.target?.result as string;
				try {
					resolve(await instance.patch('/user/profile', { avatarUrl: dataUrl }));
				} catch (err) {
					reject(err);
				}
			};
			reader.onerror = () => reject(new Error('图片读取失败'));
			reader.readAsDataURL(file);
		});
	},

	// ===== record 美食记录 =====
	getRecords(params?: any) {
		return instance.get('/record/list', { params });
	},
	saveRecord(data: any) {
		return instance.post('/record/save', data);
	},
	getRecordDetail(id: number | string) {
		return instance.get(`/record/${id}`);
	},

	// ===== family 家庭组 =====
	getFamilyInfo() {
		return instance.get('/family');
	},
	createFamily(name: string) {
		return instance.post('/family', { name });
	},
	// 成员
	getFamilyMembers() {
		return instance.get('/family/member/list');
	},
	updateMemberRole(memberId: number | string, role: 'admin' | 'member') {
		return instance.patch(`/family/member/${memberId}`, { role });
	},
	removeMember(memberId: number | string) {
		return instance.delete(`/family/member/${memberId}`);
	},
	// 邀请
	createInvitation() {
		return instance.post('/family/invitation');
	},
	getInvitations() {
		return instance.get('/family/invitation/list');
	},
	joinFamily(code: string) {
		return instance.post('/family/join', { code });
	},
	// 菜谱
	getFamilyRecipes(params?: any) {
		return instance.get('/family/recipe/list', { params });
	},
	getRecipeDetail(recipeId: number | string) {
		return instance.get(`/family/recipe/${recipeId}`);
	},
	createRecipe(data: any) {
		return instance.post('/family/recipe', data);
	},
	updateRecipe(recipeId: number | string, data: any) {
		return instance.put(`/family/recipe/${recipeId}`, data);
	},
	deleteRecipe(recipeId: number | string) {
		return instance.delete(`/family/recipe/${recipeId}`);
	},
	updateRecipeVisibility(recipeId: number | string, visibility: string) {
		return instance.patch(`/family/recipe/${recipeId}/visibility`, { visibility });
	},
	// 协作菜单
	getWeeklyMenu() {
		return instance.get('/family/menu/list');
	},
	addToMenu(data: { dayOfWeek: number; mealType: 'breakfast' | 'lunch' | 'dinner'; recipeId: number; recipeName: string }) {
		return instance.post('/family/menu', data);
	},
	voteMenuItem(menuItemId: number | string, vote: 'like' | 'dislike') {
		return instance.post(`/family/menu/${menuItemId}/vote`, { vote });
	},
	// 购物清单
	getShoppingList() {
		return instance.get('/family/shopping/list');
	},
	addShoppingItem(data: { name: string; category?: string; quantity?: string }) {
		return instance.post('/family/shopping', data);
	},
	toggleShoppingItem(itemId: number | string, checked?: boolean) {
		return instance.patch(`/family/shopping/${itemId}`, { checked });
	},
	deleteShoppingItem(itemId: number | string) {
		return instance.delete(`/family/shopping/${itemId}`);
	},
	generateShoppingFromMenu() {
		return instance.post('/family/shopping/generate');
	},
	// 家庭动态
	getFamilyRecords(params?: { page?: number; pageSize?: number }) {
		return instance.get('/family/record/list', { params });
	},
	toggleRecordLike(recordId: number | string) {
		return instance.post(`/family/record/${recordId}/like`);
	},
	addRecordComment(recordId: number | string, content: string) {
		return instance.post(`/family/record/${recordId}/comment`, { content });
	},
	// 家庭报告
	getFamilyReport() {
		return instance.get('/family/report');
	},

	// ===== achievement 成就 =====
	getAchievements() {
		return instance.get('/achievement/list');
	},
	getLevel() {
		return instance.get('/achievement/level');
	},

	// ===== checkin 打卡 =====
	getCheckinStatus() {
		return instance.get('/checkin/status');
	},
	doCheckin() {
		return instance.post('/checkin');
	},
	replenishCheckin() {
		return instance.post('/checkin/replenish');
	},

	// ===== challenge 挑战 =====
	getChallenges() {
		return instance.get('/challenge/list');
	},

	// ===== gamification 趣味玩法 =====
	getPokedex() {
		return instance.get('/gamification/pokedex');
	},
	getPersonality() {
		return instance.get('/gamification/personality');
	},
	getTimemachine() {
		return instance.get('/gamification/timemachine');
	},
	createBlindGuessRound(data: { familyId: number; roundName: string; recordIds: number[] }) {
		return instance.post('/gamification/blindguess/round', data);
	},
	getBlindGuessRound(roundId: number | string) {
		return instance.get(`/gamification/blindguess/round/${roundId}`);
	},
	submitBlindGuess(roundId: number | string, data: { itemId: number; guessAuthorId: number; guessDishName: string }) {
		return instance.post(`/gamification/blindguess/round/${roundId}/guess`, data);
	},
	revealBlindGuessRound(roundId: number | string) {
		return instance.post(`/gamification/blindguess/round/${roundId}/reveal`);
	},

	// ===== ai AI 代理 =====
	recognizeFood(file: File) {
		const formData = new FormData();
		formData.append('image', file);
		return instance.post('/ai/recognize', formData, {
			headers: { 'Content-Type': 'multipart/form-data' }
		});
	},
	beautifyImage(file: File) {
		const formData = new FormData();
		formData.append('image', file);
		return instance.post('/ai/beautify', formData, {
			headers: { 'Content-Type': 'multipart/form-data' }
		});
	},
	getRecommendations(dishName: string) {
		return instance.post('/ai/recommend', { dishName });
	},

	// ===== analytics 埋点 =====
	trackEvent(data: { type: string; payload?: any; familyId?: number }) {
		return instance.post('/analytics/track', data);
	},
	getEvents(params?: { type?: string }) {
		return instance.get('/analytics/events', { params });
	}
};

/** C 端 token 管理（与 B 端 token 隔离） */
export function setAppToken(token: string) {
	storage.set('appToken', token);
}
export function getAppToken(): string {
	return storage.get('appToken') || '';
}
export function clearAppToken() {
	storage.remove('appToken');
}
export function isAppLoggedIn(): boolean {
	return !!getAppToken();
}
