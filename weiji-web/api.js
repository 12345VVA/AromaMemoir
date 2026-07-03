const API_BASE = '';
const SUCCESS_CODE = 1000;

function getToken() {
  return localStorage.getItem('weiji_token') || '';
}

function setToken(token) {
  if (token) {
    localStorage.setItem('weiji_token', token);
  } else {
    localStorage.removeItem('weiji_token');
  }
}

function getCurrentUser() {
  const user = localStorage.getItem('weiji_user');
  return user ? JSON.parse(user) : null;
}

function setCurrentUser(user) {
  if (user) {
    localStorage.setItem('weiji_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('weiji_user');
  }
}

// 后端返回 nickName，前端历史代码使用 nickname，统一兼容
function normalizeUser(user) {
  if (user && user.nickName !== undefined && user.nickname === undefined) {
    user.nickname = user.nickName;
  }
  return user;
}

async function request(method, path, body, isFormData) {
  const options = { method, headers: {} };
  const token = getToken();
  if (token) {
    options.headers['Authorization'] = 'Bearer ' + token;
  }

  if (body !== undefined && body !== null) {
    if (isFormData) {
      options.body = body;
    } else {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
  }

  // 超时控制：15s 后中止请求
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  options.signal = controller.signal;

  let response;
  try {
    response = await fetch(API_BASE + path, options);
  } catch (err) {
    if (err && err.name === 'AbortError') {
      throw new Error('请求超时，请稍后重试');
    }
    throw new Error('网络异常，请稍后重试');
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error('网络异常，请稍后重试');
  }

  let result;
  try {
    result = await response.json();
  } catch (err) {
    throw new Error('网络异常，请稍后重试');
  }

  if (!result || result.code !== SUCCESS_CODE) {
    throw new Error((result && result.message) || '请求失败');
  }

  return result.data;
}

const api = {
  login(username, password) {
    return request('POST', '/app/account/login', { username, password }).then(data => {
      setToken(data.token);
      setCurrentUser(normalizeUser(data.user));
      return data.user;
    });
  },
  register(username, password, nickname) {
    return request('POST', '/app/account/register', { username, password, nickName: nickname }).then(data => {
      setToken(data.token);
      setCurrentUser(normalizeUser(data.user));
      return data.user;
    });
  },
  logout() {
    return request('POST', '/app/account/logout').finally(() => {
      setToken(null);
      setCurrentUser(null);
    });
  },
  isLoggedIn() {
    return !!getToken();
  },
  getToken,
  setToken,
  getCurrentUser,
  setCurrentUser,

  getRecords(params) {
    let query = '';
    if (params) {
      const sp = new URLSearchParams();
      Object.keys(params).forEach(k => {
        const v = params[k];
        if (v !== undefined && v !== null && v !== '') {
          sp.append(k, v);
        }
      });
      const qs = sp.toString();
      if (qs) query = '?' + qs;
    }
    return request('GET', '/app/record/list' + query);
  },
  saveRecord(data) {
    return request('POST', '/app/record/save', data);
  },
  recognizeFood(file) {
    const fd = new FormData();
    fd.append('image', file);
    return request('POST', '/app/ai/recognize', fd, true);
  },
  getFamilyRecipes(cat) {
    const query = cat && cat !== 'all' ? '?category=' + encodeURIComponent(cat) : '';
    return request('GET', '/app/family/recipe/list' + query);
  },
  getFamilyMembers() {
    return request('GET', '/app/family/member/list');
  },
  getAchievements() {
    return request('GET', '/app/achievement/list');
  },
  getLevel() {
    return request('GET', '/app/achievement/level');
  },
  getChallenges() {
    return request('GET', '/app/challenge/list');
  },
  getCheckinStatus() {
    return request('GET', '/app/checkin/status');
  },
  doCheckin() {
    return request('POST', '/app/checkin/');
  },
  getUserProfile() {
    return request('GET', '/app/user/profile').then(user => normalizeUser(user));
  },
  beautifyImage(file) {
    const fd = new FormData();
    fd.append('image', file);
    return request('POST', '/app/ai/beautify', fd, true);
  },
  recognizeVoice(file) {
    const fd = new FormData();
    fd.append('audio', file);
    return request('POST', '/app/ai/voice/recognize', fd, true);
  },
  getRecommendations(recentRecords) {
    var body = { dishName: '' };
    if (Array.isArray(recentRecords) && recentRecords.length > 0) {
      body.recentRecords = recentRecords;
      body.dishName = recentRecords[0] || '';
    } else if (typeof recentRecords === 'string') {
      body.dishName = recentRecords;
    }
    return request('POST', '/app/ai/recommend', body).then(function(data) { return data.recipes || data || []; });
  },
  getWeeklyMenu() {
    return request('GET', '/app/family/menu/list');
  },
  addToMenu(data) {
    return request('POST', '/app/family/menu/', data);
  },
  voteMenuItem(menuId, vote, userId) {
    return request('POST', '/app/family/menu/' + menuId + '/vote', { vote, userId });
  },
  getShoppingList() {
    return request('GET', '/app/family/shopping/list');
  },
  addShoppingItem(data) {
    return request('POST', '/app/family/shopping/', data);
  },
  toggleShoppingItem(itemId, checked) {
    return request('PATCH', '/app/family/shopping/' + itemId, { checked });
  },
  deleteShoppingItem(itemId) {
    return request('DELETE', '/app/family/shopping/' + itemId);
  },
  generateShoppingFromMenu() {
    return request('POST', '/app/family/shopping/generate', {});
  },
  getFamilyReport(month) {
    const query = month ? ('?month=' + encodeURIComponent(month)) : '';
    return request('GET', '/app/family/report' + query);
  },
  getFamilyInfo() {
    return request('GET', '/app/family/');
  },
  createFamily(name) {
    return request('POST', '/app/family/', { name });
  },
  updateMemberRole(memberId, role) {
    return request('PATCH', '/app/family/member/' + memberId, { role });
  },
  removeMember(memberId) {
    return request('DELETE', '/app/family/member/' + memberId);
  },
  createInvitation() {
    return request('POST', '/app/family/invitation');
  },
  getInvitations() {
    return request('GET', '/app/family/invitation/list');
  },
  joinFamily(code) {
    return request('POST', '/app/family/join', { code });
  },
  uploadRecipe(data) {
    return request('POST', '/app/family/recipe/', data);
  },
  // 菜谱详情
  getRecipeDetail(id) {
    return request('GET', '/app/family/recipe/' + encodeURIComponent(id));
  },
  // 新建菜谱（与 uploadRecipe 等价，命名更通用）
  createRecipe(data) {
    return request('POST', '/app/family/recipe/', data);
  },
  // 更新菜谱
  updateRecipe(id, data) {
    return request('PUT', '/app/family/recipe/' + encodeURIComponent(id), data);
  },
  // 删除菜谱
  deleteRecipe(id) {
    return request('DELETE', '/app/family/recipe/' + encodeURIComponent(id));
  },
  // 更新用户资料（头像、昵称、简介等）
  updateProfile(data) {
    const payload = Object.assign({}, data);
    if (payload.avatar !== undefined) { payload.avatarUrl = payload.avatar; delete payload.avatar; }
    if (payload.nickname !== undefined) { payload.nickName = payload.nickname; delete payload.nickname; }
    return request('PATCH', '/app/user/profile', payload);
  },
  replenishCheckin() {
    return request('POST', '/app/checkin/replenish');
  },
  getFamilyRecords(page) {
    const query = page ? '?page=' + page + '&pageSize=20' : '';
    return request('GET', '/app/family/record/list' + query);
  },
  toggleRecordLike(recordId) {
    return request('POST', '/app/family/record/' + recordId + '/like');
  },
  addRecordComment(recordId, content) {
    return request('POST', '/app/family/record/' + recordId + '/comment', { content });
  },
  getRecipesFiltered(params) {
    const query = new URLSearchParams();
    if (params.visibility) query.set('visibility', params.visibility);
    if (params.authorId) query.set('authorId', params.authorId);
    if (params.category) query.set('category', params.category);
    if (params.keyword) query.set('keyword', params.keyword);
    const qs = query.toString();
    return request('GET', '/app/family/recipe/list' + (qs ? '?' + qs : ''));
  },
  updateRecipeVisibility(recipeId, visibility) {
    return request('PATCH', '/app/family/recipe/' + recipeId + '/visibility', { visibility });
  },

  /* ===== 趣味玩法（F27-F30） ===== */
  getPokedex() {
    return request('GET', '/app/gamification/pokedex');
  },
  getPersonality() {
    return request('GET', '/app/gamification/personality');
  },
  getTimemachine() {
    return request('GET', '/app/gamification/timemachine');
  },
  createBlindGuessRound(data) {
    return request('POST', '/app/gamification/blindguess/round', data);
  },
  getBlindGuessRound(roundId) {
    return request('GET', '/app/gamification/blindguess/round/' + encodeURIComponent(roundId));
  },
  submitBlindGuess(roundId, data) {
    return request('POST', '/app/gamification/blindguess/round/' + encodeURIComponent(roundId) + '/guess', data);
  },
  revealBlindGuessRound(roundId) {
    return request('POST', '/app/gamification/blindguess/round/' + encodeURIComponent(roundId) + '/reveal');
  },
};
