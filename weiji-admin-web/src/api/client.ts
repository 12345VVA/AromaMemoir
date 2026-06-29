import axios from 'axios';

const instance = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

// 请求拦截器：携带 JWT token
instance.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：统一处理 { code, data, message }
instance.interceptors.response.use(
  (response) => {
    const res = response.data;
    if (res.code !== undefined && res.code !== 0) {
      return Promise.reject(new Error(res.message || '请求失败'));
    }
    return res.data !== undefined ? res.data : res;
  },
  (error) => {
    // 401 未认证：清除 token 并重定向到登录页
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      // 避免 SSR 环境无 window，加 typeof 判断
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const api = {
  // 认证
  login(username: string, password: string) {
    return instance.post('/auth/login', { username, password });
  },
  register(username: string, password: string, nickname: string) {
    return instance.post('/auth/register', { username, password, nickname });
  },
  logout() {
    return instance.post('/auth/logout');
  },
  // 记录
  getRecords(params?: any) {
    return instance.get('/record/list', { params });
  },
  saveRecord(data: any) {
    return instance.post('/record', data);
  },
  // 家庭
  getFamilyInfo() {
    return instance.get('/family');
  },
  getFamilyMembers() {
    return instance.get('/family/members');
  },
  getFamilyRecipes(params?: any) {
    return instance.get('/family/recipes', { params });
  },
  createInvitation() {
    return instance.post('/family/invitations');
  },
  getInvitations() {
    return instance.get('/family/invitations');
  },
  joinFamily(code: string) {
    return instance.post('/family/join', { code });
  },
  updateRecipeVisibility(recipeId: string, visibility: string) {
    return instance.patch(`/family/recipes/${recipeId}/visibility`, { visibility });
  },
  getWeeklyMenu() {
    return instance.get('/family/menu');
  },
  getShoppingList() {
    return instance.get('/family/shopping');
  },
  // 成就
  getAchievements() {
    return instance.get('/achievement/list');
  },
  getLevel() {
    return instance.get('/achievement/level');
  },
  // 打卡
  getCheckinStatus() {
    return instance.get('/checkin/status');
  },
  doCheckin() {
    return instance.post('/checkin');
  },
  // 用户
  getUserProfile() {
    return instance.get('/user/profile');
  },
  // 挑战
  getChallenges() {
    return instance.get('/challenge/list');
  },
  // AI（通过后端代理）
  recognizeFood(file: File) {
    const formData = new FormData();
    formData.append('image', file);
    return instance.post('/ai/recognize', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  beautifyImage(file: File) {
    const formData = new FormData();
    formData.append('image', file);
    return instance.post('/ai/beautify', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getRecommendations(dishName: string) {
    return instance.post('/ai/recommend', { dishName });
  },
  // 娱乐化玩法（F27-F30）
  getPokedex() {
    return instance.get('/gamification/pokedex');
  },
  getPersonality() {
    return instance.get('/gamification/personality');
  },
  getTimemachine() {
    return instance.get('/gamification/timemachine');
  },
  createBlindGuessRound(data: { familyId: string; roundName: string; recordIds: string[] }) {
    return instance.post('/gamification/blindguess/round', data);
  },
  getBlindGuessRound(roundId: string) {
    return instance.get(`/gamification/blindguess/round/${roundId}`);
  },
  submitBlindGuess(roundId: string, data: { itemId: string; guessAuthorId: string; guessDishName: string }) {
    return instance.post(`/gamification/blindguess/round/${roundId}/guess`, data);
  },
  revealBlindGuessRound(roundId: string) {
    return instance.post(`/gamification/blindguess/round/${roundId}/reveal`);
  },
};
