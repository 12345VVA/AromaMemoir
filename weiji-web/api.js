const API_BASE = '';

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

  let response;
  try {
    response = await fetch(API_BASE + path, options);
  } catch (err) {
    throw new Error('网络异常，请稍后重试');
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

  if (!result || result.code !== 0) {
    throw new Error((result && result.message) || '请求失败');
  }

  return result.data;
}

const api = {
  login(username, password) {
    return request('POST', '/api/auth/login', { username, password }).then(data => {
      setToken(data.token);
      setCurrentUser(data.user);
      return data.user;
    });
  },
  register(username, password, nickname) {
    return request('POST', '/api/auth/register', { username, password, nickname }).then(data => {
      setToken(data.token);
      setCurrentUser(data.user);
      return data.user;
    });
  },
  logout() {
    return request('POST', '/api/auth/logout').finally(() => {
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
    return request('GET', '/api/record/list' + query);
  },
  saveRecord(data) {
    return request('POST', '/api/record', data);
  },
  recognizeFood(file) {
    const fd = new FormData();
    fd.append('image', file);
    return request('POST', '/api/ai/recognize', fd, true);
  },
  getFamilyRecipes(cat) {
    const query = cat && cat !== 'all' ? '?category=' + encodeURIComponent(cat) : '';
    return request('GET', '/api/family/recipes' + query);
  },
  getFamilyMembers() {
    return request('GET', '/api/family/members');
  },
  getAchievements() {
    return request('GET', '/api/achievement/list');
  },
  getLevel() {
    return request('GET', '/api/achievement/level');
  },
  getChallenges() {
    return request('GET', '/api/challenge/list');
  },
  getCheckinStatus() {
    return request('GET', '/api/checkin/status');
  },
  doCheckin() {
    return request('POST', '/api/checkin');
  },
  getUserProfile() {
    return request('GET', '/api/user/profile');
  },
  beautifyImage(file) {
    const fd = new FormData();
    fd.append('image', file);
    return request('POST', '/api/ai/beautify', fd, true);
  },
  getRecommendations(dishName) {
    return request('POST', '/api/ai/recommend', { dishName: dishName || '' }).then(data => data.recipes || data || []);
  },
  getWeeklyMenu() {
    return request('GET', '/api/family/menu');
  },
  addToMenu(data) {
    return request('POST', '/api/family/menu', data);
  },
  voteMenuItem(menuId, vote, userId) {
    return request('POST', '/api/family/menu/' + menuId + '/vote', { vote, userId });
  },
  getShoppingList() {
    return request('GET', '/api/family/shopping');
  },
  addShoppingItem(data) {
    return request('POST', '/api/family/shopping', data);
  },
  toggleShoppingItem(itemId, checked) {
    return request('PATCH', '/api/family/shopping/' + itemId, { checked });
  },
  deleteShoppingItem(itemId) {
    return request('DELETE', '/api/family/shopping/' + itemId);
  },
  getFamilyInfo() {
    return request('GET', '/api/family');
  },
  createFamily(name) {
    return request('POST', '/api/family', { name });
  },
  updateMemberRole(memberId, role) {
    return request('PATCH', '/api/family/members/' + memberId, { role });
  },
  removeMember(memberId) {
    return request('DELETE', '/api/family/members/' + memberId);
  },
  createInvitation() {
    return request('POST', '/api/family/invitations');
  },
  getInvitations() {
    return request('GET', '/api/family/invitations');
  },
  joinFamily(code) {
    return request('POST', '/api/family/join', { code });
  },
  getRecipesFiltered(params) {
    const query = new URLSearchParams();
    if (params.visibility) query.set('visibility', params.visibility);
    if (params.authorId) query.set('authorId', params.authorId);
    if (params.category) query.set('category', params.category);
    const qs = query.toString();
    return request('GET', '/api/family/recipes' + (qs ? '?' + qs : ''));
  },
  updateRecipeVisibility(recipeId, visibility) {
    return request('PATCH', '/api/family/recipes/' + recipeId + '/visibility', { visibility });
  },

  /* ===== 趣味玩法（F27-F30） ===== */
  getPokedex() {
    return request('GET', '/api/gamification/pokedex');
  },
  getPersonality() {
    return request('GET', '/api/gamification/personality');
  },
  getTimemachine() {
    return request('GET', '/api/gamification/timemachine');
  },
  createBlindGuessRound(data) {
    return request('POST', '/api/gamification/blindguess/round', data);
  },
  getBlindGuessRound(roundId) {
    return request('GET', '/api/gamification/blindguess/round/' + encodeURIComponent(roundId));
  },
  submitBlindGuess(roundId, data) {
    return request('POST', '/api/gamification/blindguess/round/' + encodeURIComponent(roundId) + '/guess', data);
  },
  revealBlindGuessRound(roundId) {
    return request('POST', '/api/gamification/blindguess/round/' + encodeURIComponent(roundId) + '/reveal');
  },
};
