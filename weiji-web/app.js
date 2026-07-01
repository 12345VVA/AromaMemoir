/* ===== 全局状态 ===== */
let currentPage = 'home';
let currentRating = 0;
let selectedTags = [];
let currentRecognizeData = null;
let currentBeautifiedUrl = null;
let currentOriginalUrl = null;
let selectedImageVersion = 'original';
let currentRecommendations = [];
let currentRecipeVisibility = null;

/* ===== 图片压缩工具（F1增强） ===== */
function compressImage(file, maxSize) {
  maxSize = maxSize || 2 * 1024 * 1024; // 默认2MB
  return new Promise(function(resolve) {
    if (file.size <= maxSize) {
      resolve(file);
      return;
    }
    var reader = new FileReader();
    reader.onload = function(e) {
      var img = new Image();
      img.onload = function() {
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
        var width = img.width;
        var height = img.height;
        var ratio = Math.sqrt(maxSize / file.size);
        canvas.width = Math.floor(width * ratio);
        canvas.height = Math.floor(height * ratio);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(function(blob) {
          var compressed = new File([blob], file.name, { type: file.type || 'image/jpeg' });
          resolve(compressed);
        }, file.type || 'image/jpeg', 0.8);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ===== 静态挑战数据（无对应后端接口，作为前端兜底） ===== */
const CHALLENGES = [
  {
    name: '一周素食',
    icon: 'salad',
    iconColor: 'var(--success-600)',
    statusLabel: '进行中',
    statusType: 'filled',
    statusBg: 'var(--success-50)',
    statusColor: 'var(--success-600)',
    progressLabel: '3/7 天',
    percent: '43%',
    progress: 43,
    barColor: 'var(--success-500)'
  },
  {
    name: '环球美食月',
    icon: 'globe',
    iconColor: 'var(--color-on-surface-variant)',
    statusLabel: '未开始',
    statusType: 'outline',
    progressLabel: '0/30 天',
    percent: '0%',
    progress: 0,
    barColor: 'var(--color-primary)'
  },
  {
    name: '家庭厨艺大赛',
    icon: 'trophy',
    iconColor: 'var(--accent)',
    statusLabel: '即将开始',
    statusType: 'outline',
    statusColor: 'var(--accent)',
    statusBorder: 'var(--accent-300)',
    note: '6月28日开启'
  }
];

/* ===== 工具函数 ===== */
function escapeHTML(s) {
  if (s === undefined || s === null) return '';
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
function escapeAttr(s) { return escapeHTML(s); }

function avatarColors(color) {
  const map = {
    primary: { bg: 'var(--primary-100)', text: 'var(--primary-700)' },
    accent: { bg: 'var(--accent-50)', text: 'var(--accent-700)' },
    success: { bg: 'var(--success-50)', text: 'var(--success-700)' },
    info: { bg: 'var(--info-50)', text: 'var(--info-700)' },
    warning: { bg: 'var(--warning-50)', text: 'var(--warning-700)' }
  };
  if (color && map[color]) return map[color];
  if (color) return { bg: color, text: 'var(--color-on-surface)' };
  return { bg: 'var(--primary-100)', text: 'var(--primary-700)' };
}

function formatRecordDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  const now = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thatDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((today - thatDay) / 86400000);
  if (diffDays === 0) return '今天 ' + hh + ':' + mm;
  if (diffDays === 1) return '昨天 ' + hh + ':' + mm;
  return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + hh + ':' + mm;
}

function renderStarsHTML(rating, size) {
  const s = size || 14;
  let html = '';
  for (let i = 1; i <= 5; i++) {
    if (i <= rating) {
      html += '<i data-lucide="star" class="star" style="width:' + s + 'px;height:' + s + 'px;fill:var(--accent);"></i>';
    } else {
      html += '<i data-lucide="star" class="star star--empty" style="width:' + s + 'px;height:' + s + 'px;"></i>';
    }
  }
  return html;
}

/* ===== 加载状态 ===== */
function showLoading(container) {
  if (!container) return;
  container.innerHTML = '<div class="loading-spinner" style="display:flex;justify-content:center;align-items:center;padding:var(--space-6);"><div class="ai-spinner" style="border-color:rgba(255,94,26,0.2);border-top-color:var(--color-primary);"></div></div>';
}

function hideLoading(container) {
  if (!container) return;
  const sp = container.querySelector('.loading-spinner');
  if (sp) sp.remove();
}

/* ===== Toast ===== */
let toastTimer = null;
function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2000);
}

/* ===== 路由 ===== */
function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.sidebar-nav-item').forEach(n => n.classList.remove('active'));

  const targetPage = document.getElementById('page-' + page);
  if (targetPage) targetPage.classList.add('active');

  document.querySelectorAll('.nav-item[data-page="' + page + '"]').forEach(n => n.classList.add('active'));
  document.querySelectorAll('.sidebar-nav-item[data-page="' + page + '"]').forEach(n => n.classList.add('active'));

  currentPage = page;
  window.scrollTo(0, 0);
  const pw = document.querySelector('.page-wrapper');
  if (pw) pw.scrollTop = 0;

  lucide.createIcons();

  if (page === 'home') loadHomeData();
  else if (page === 'family') loadFamilyData();
  else if (page === 'achievements') loadAchievementsData();
  else if (page === 'profile') loadProfileData();
  else if (page === 'gameplay') loadGameplayEntry();
}

/* ===== 数据加载 ===== */
async function loadHomeData() {
  const listEl = document.getElementById('food-diary-list');
  showLoading(listEl);
  try {
    const [recordsRes, checkin] = await Promise.all([
      api.getRecords(),
      api.getCheckinStatus()
    ]);
    renderRecords((recordsRes && recordsRes.list) || []);
    renderCheckin(checkin);
    // 获取最近记录用于推荐
    var recentDishNames = [];
    if (recordsRes && recordsRes.list) {
      recentDishNames = recordsRes.list.slice(0, 5).map(function(r) { return r.dishName; });
    }
    var recommendations = await api.getRecommendations(recentDishNames).catch(function() { return null; });
    if (recommendations && recommendations.length) {
      renderRecommendations(recommendations);
    } else {
      hideRecommendSection();
    }
  } catch (err) {
    hideLoading(listEl);
    showToast(err.message);
  }
}

async function loadFamilyData() {
  currentRecipeVisibility = null;
  const gridEl = document.getElementById('recipe-grid');
  const membersEl = document.getElementById('family-members');
  showLoading(gridEl);
  showLoading(membersEl);
  try {
    const familyInfo = await api.getFamilyInfo();
    // 如果未加入家庭组，显示创建入口
    const createFamilyBtn = document.getElementById('create-family-entry');
    if (createFamilyBtn) {
      if (!familyInfo) {
        createFamilyBtn.style.display = 'flex';
      } else {
        createFamilyBtn.style.display = 'none';
      }
    }
    const [recipes, members] = await Promise.all([
      api.getFamilyRecipes(),
      api.getFamilyMembers()
    ]);
    renderRecipes(recipes || []);
    renderMembers(members || []);
  } catch (err) {
    hideLoading(gridEl);
    hideLoading(membersEl);
    showToast(err.message);
  }
}

async function loadAchievementsData() {
  const badgeEl = document.getElementById('badge-grid');
  showLoading(badgeEl);
  try {
    const [achievements, level] = await Promise.all([
      api.getAchievements(),
      api.getLevel()
    ]);
    renderAchievements(achievements || []);
    renderLevel(level);
    // 加载挑战赛数据（从后端获取，失败时降级为空）
    let challenges = [];
    try {
      challenges = await api.getChallenges();
    } catch (e) {
      challenges = [];
    }
    renderChallenges(challenges);
  } catch (err) {
    hideLoading(badgeEl);
    showToast(err.message);
  }
}

async function loadProfileData() {
  try {
    const profile = await api.getUserProfile();
    renderProfile(profile);
  } catch (err) {
    showToast(err.message);
  }
}

/* ===== 渲染函数 ===== */
function renderRecords(list) {
  const container = document.getElementById('food-diary-list');
  if (!container) return;
  if (!list || list.length === 0) {
    container.innerHTML = '<div style="padding:var(--space-6);text-align:center;color:var(--color-on-surface-variant);">暂无美食记录</div>';
    return;
  }
  container.innerHTML = list.map(r => {
    const tags = r.tags || [];
    const tagsHTML = tags.map(t => '<span class="chip filled">' + escapeHTML(t) + '</span>').join('');
    const mealChip = r.mealType ? '<span class="chip accent">' + escapeHTML(r.mealType) + '</span>' : '';
    const rating = Number(r.rating) || 0;
    return '<div class="food-card food-card--h food-card--diary" data-tags="' + escapeAttr(tags.join(',')) + '" data-id="' + escapeAttr(r.id) + '">' +
      '<img class="card-img" src="' + escapeAttr(r.imageUrl) + '" alt="' + escapeAttr(r.dishName) + '" />' +
      '<div class="card-body">' +
        '<div class="card-title">' + escapeHTML(r.dishName) + '</div>' +
        '<div class="stars" data-rating="' + rating + '">' + renderStarsHTML(rating, 14) +
          '<span class="rating-num">' + rating.toFixed(1) + '</span>' +
        '</div>' +
        '<div class="card-tags">' + mealChip + tagsHTML + '</div>' +
        '<div class="card-time">' + escapeHTML(formatRecordDate(r.recordDate)) + '</div>' +
      '</div>' +
    '</div>';
  }).join('');
  window._allRecords = list;
  lucide.createIcons();
}

function hideRecommendSection() {
  const section = document.getElementById('recommend-section');
  if (section) section.style.display = 'none';
  currentRecommendations = [];
}

function difficultyClass(diff) {
  if (diff === '简单') return 'difficulty--easy';
  if (diff === '中等') return 'difficulty--medium';
  if (diff === '困难') return 'difficulty--hard';
  return 'difficulty--easy';
}

function matchScoreToPercent(score) {
  const n = Number(score) || 0;
  if (n > 1) return Math.min(100, Math.round(n));
  return Math.round(n * 100);
}

function renderRecommendations(list) {
  const section = document.getElementById('recommend-section');
  const container = document.getElementById('recommend-list');
  if (!section || !container) return;
  if (!list || list.length === 0) {
    section.style.display = 'none';
    currentRecommendations = [];
    return;
  }
  currentRecommendations = list;
  section.style.display = '';
  container.innerHTML = list.map((r, idx) => {
    const diff = r.difficulty || '简单';
    const matchPercent = matchScoreToPercent(r.matchScore);
    const cookTime = (r.cookTime !== undefined && r.cookTime !== null && r.cookTime !== '') ? r.cookTime : '';
    const timeHTML = cookTime !== ''
      ? '<span class="recommend-time">' +
          '<i data-lucide="clock" style="width:12px;height:12px;"></i>' +
          '<span>' + escapeHTML(cookTime) + '分钟</span>' +
        '</span>'
      : '';
    return '<div class="recommend-card" data-idx="' + idx + '">' +
      '<img class="card-img" src="' + escapeAttr(r.coverUrl || '') + '" alt="' + escapeAttr(r.name || '') + '" />' +
      '<div class="card-body">' +
        '<div class="card-title">' + escapeHTML(r.name || '') + '</div>' +
        '<div class="recommend-meta">' +
          '<span class="difficulty-tag ' + difficultyClass(diff) + '">' + escapeHTML(diff) + '</span>' +
          timeHTML +
        '</div>' +
        '<div class="match-score">' +
          '<div class="match-score-bar"><div class="match-score-fill" style="width:' + matchPercent + '%;"></div></div>' +
          '<span class="match-score-text">匹配 ' + matchPercent + '%</span>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');
  lucide.createIcons();
}

function showRecommendDetail(item) {
  const modal = document.getElementById('recommend-modal');
  if (!modal || !item) return;

  const img = document.getElementById('recommend-modal-img');
  if (img) img.src = item.coverUrl || '';

  const title = document.getElementById('recommend-modal-title');
  if (title) title.textContent = item.name || '';

  const meta = document.getElementById('recommend-modal-meta');
  if (meta) {
    const diff = item.difficulty || '';
    const matchPercent = matchScoreToPercent(item.matchScore);
    const cookTime = (item.cookTime !== undefined && item.cookTime !== null && item.cookTime !== '') ? item.cookTime : '';
    meta.innerHTML =
      (diff ? '<span class="difficulty-tag ' + difficultyClass(diff) + '">' + escapeHTML(diff) + '</span>' : '') +
      (cookTime !== '' ? '<span class="recommend-time"><i data-lucide="clock" style="width:12px;height:12px;"></i><span>' + escapeHTML(cookTime) + '分钟</span></span>' : '') +
      '<span class="match-score-text">匹配度 ' + matchPercent + '%</span>';
  }

  const ingEl = document.getElementById('recommend-modal-ingredients');
  if (ingEl) {
    const ingredients = item.ingredients || [];
    if (ingredients.length === 0) {
      ingEl.innerHTML = '<span style="font-size:var(--font-size-caption);color:var(--color-on-surface-variant);">暂无食材信息</span>';
    } else {
      ingEl.innerHTML = ingredients.map(i => {
        const name = typeof i === 'string' ? i : (i.name || '');
        return '<span class="chip filled">' + escapeHTML(name) + '</span>';
      }).join('');
    }
  }

  modal.classList.add('show');
  lucide.createIcons();
}

function closeRecommendModal() {
  const modal = document.getElementById('recommend-modal');
  if (modal) modal.classList.remove('show');
}

function renderCheckin(data) {
  if (!data) return;
  const text = document.getElementById('checkin-text');
  if (text) text.textContent = '已坚持 ' + (data.streak != null ? data.streak : data.streakDays) + ' 天';

  const btn = document.getElementById('checkin-btn');
  if (btn) {
    const checked = data.todayChecked != null ? data.todayChecked : data.checkedInToday;
    if (checked) {
      btn.textContent = '已打卡';
      btn.disabled = true;
      btn.style.opacity = '0.6';
    } else {
      btn.textContent = '今日打卡';
      btn.disabled = false;
      btn.style.opacity = '1';
    }
  }

  const days = document.getElementById('checkin-days');
  if (days && data.calendar) {
    days.innerHTML = data.calendar.map(d =>
      '<div class="checkin-day ' + escapeAttr(d.status) + '" data-day="' + escapeAttr(d.day) + '">' + escapeHTML(d.label) + '</div>'
    ).join('');
  }

  // 补签按钮：今日已打卡但昨日未打卡时显示
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  const replenishBtn = document.getElementById('replenish-btn');
  if (replenishBtn) {
    const checked = data.todayChecked != null ? data.todayChecked : data.checkedInToday;
    const lastDate = data.lastCheckDate;
    if (checked && lastDate !== yesterdayStr) {
      replenishBtn.style.display = 'block';
    } else {
      replenishBtn.style.display = 'none';
    }
  }
}

function renderRecipes(list) {
  const container = document.getElementById('recipe-grid');
  if (!container) return;
  if (!list || list.length === 0) {
    container.innerHTML = '<div style="padding:var(--space-6);text-align:center;color:var(--color-on-surface-variant);grid-column:1/-1;">暂无菜谱</div>';
    return;
  }
  container.innerHTML = list.map(r => {
    const colors = avatarColors(r.uploaderAvatarColor);
    const diffTag = r.difficulty
      ? '<span class="tag ' + (r.difficulty === '简单' ? 'tag--accent' : '') + '">' + escapeHTML(r.difficulty) + '</span>'
      : '';
    const visibility = r.visibility || 'family';
    const visIcon = visibility === 'private' ? 'lock' : 'users';
    const visTitle = visibility === 'private' ? '切换为家庭共享' : '切换为私厨';
    return '<div class="food-card food-card--v" data-category="' + escapeAttr(r.category || '') + '" data-id="' + escapeAttr(r.id) + '" data-visibility="' + escapeAttr(visibility) + '">' +
      '<img class="card-img" src="' + escapeAttr(r.coverUrl) + '" alt="' + escapeAttr(r.name) + '" />' +
      '<button class="visibility-btn" title="' + escapeAttr(visTitle) + '" onclick="toggleRecipeVisibility(\'' + escapeAttr(String(r.id)) + '\', \'' + escapeAttr(visibility) + '\')">' +
        '<i data-lucide="' + visIcon + '" style="width:14px;height:14px;"></i>' +
      '</button>' +
      '<div class="card-body">' +
        '<div class="card-title">' + escapeHTML(r.name) + '</div>' +
        '<div style="display: flex; align-items: center; gap: var(--space-2);">' +
          diffTag +
          '<span style="font-size: var(--font-size-caption); color: var(--color-on-surface-variant);">' + escapeHTML(r.cookTime || '') + '</span>' +
        '</div>' +
        '<div style="display: flex; align-items: center; gap: var(--space-1); margin-top: var(--space-2);">' +
          '<div class="avatar avatar-sm" style="background: ' + colors.bg + '; width: 20px; height: 20px;">' +
            '<span class="avatar-initials" style="color: ' + colors.text + '; font-size: 8px;">' + escapeHTML(r.uploaderInitials || '') + '</span>' +
          '</div>' +
          '<span style="font-size: var(--font-size-caption); color: var(--color-on-surface-variant);">' + escapeHTML(r.uploaderName || '') + '</span>' +
        '</div>' +
        '<button class="btn btn-outline btn-sm add-menu-btn" onclick="showAddToMenuDialog(\'' + escapeAttr(String(r.id)) + '\')">' +
          '<i data-lucide="plus" style="width:14px;height:14px;margin-right:4px;"></i>加入菜单' +
        '</button>' +
      '</div>' +
    '</div>';
  }).join('');
  lucide.createIcons();
}

function memberRoleTagHTML(role) {
  let label = '', bg = '', color = '';
  if (role === 'owner') {
    label = '群主'; bg = 'var(--warning-100)'; color = 'var(--warning-700)';
  } else if (role === 'admin') {
    label = '管理员'; bg = 'var(--info-100)'; color = 'var(--info-700)';
  } else {
    label = '成员'; bg = 'var(--surface-container-high)'; color = 'var(--color-on-surface-variant)';
  }
  return '<span class="member-role-tag" style="background:' + bg + ';color:' + color + ';">' + escapeHTML(label) + '</span>';
}

function renderMembers(list) {
  const container = document.getElementById('family-members');
  if (!container) return;
  if (!list || list.length === 0) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = list.map(m => {
    const colors = avatarColors(m.avatarColor);
    let badge = '';
    if (m.online) badge += '<span class="avatar-badge avatar-online"></span>';
    if (m.role === 'owner' || m.role === 'admin') {
      badge += '<span class="avatar-badge avatar-role"><i data-lucide="crown" style="width:8px;height:8px;color:#fff;"></i></span>';
    }
    return '<div class="family-member">' +
      '<div class="avatar avatar-md" style="background: ' + colors.bg + ';">' +
        '<span class="avatar-initials" style="color: ' + colors.text + ';">' + escapeHTML(m.avatarInitials || '') + '</span>' +
        badge +
      '</div>' +
      '<span style="font-size: var(--font-size-caption); color: var(--color-on-surface); font-weight: 500;">' + escapeHTML(m.nickname || '') + '</span>' +
      memberRoleTagHTML(m.role) +
    '</div>';
  }).join('');
  lucide.createIcons();
}

function renderAchievements(list) {
  const container = document.getElementById('badge-grid');
  if (!container) return;
  if (!list || list.length === 0) {
    container.innerHTML = '<div style="padding:var(--space-6);text-align:center;color:var(--color-on-surface-variant);grid-column:1/-1;">暂无徽章</div>';
    return;
  }
  container.innerHTML = list.map(a => {
    const locked = !a.unlocked;
    const bgStyle = locked ? '' : ' style="background: ' + (a.bgColor || 'var(--primary-50)') + ';"';
    const iconColor = locked ? 'var(--neutral-400)' : (a.iconColor || 'var(--color-primary)');
    const labelColor = locked ? 'var(--color-muted-foreground)' : 'var(--color-on-surface)';
    const desc = a.description || '';
    return '<div class="badge-item" onclick="showBadgeDetail(\'' + escapeAttr(a.name || '') + '\',\'' + escapeAttr(desc) + '\')">' +
      '<div class="badge-icon ' + (locked ? 'locked' : '') + '"' + bgStyle + '>' +
        '<i data-lucide="' + escapeAttr(a.icon || 'award') + '" style="width:24px;height:24px;color:' + iconColor + ';"></i>' +
      '</div>' +
      '<span style="font-size: var(--font-size-caption); color: ' + labelColor + '; text-align: center;">' + escapeHTML(a.name) + '</span>' +
    '</div>';
  }).join('');
  lucide.createIcons();
}

function renderLevel(data) {
  const card = document.querySelector('.level-card');
  if (!card || !data) return;
  card.innerHTML =
    '<div class="level-header">' +
      '<div class="level-icon">' +
        '<i data-lucide="chef-hat" style="width: var(--size-icon-lg); height: var(--size-icon-lg); color: var(--color-primary);"></i>' +
      '</div>' +
      '<div style="flex: 1; min-width: 0;">' +
        '<div style="font-family: var(--font-heading); font-size: var(--font-size-h4); font-weight: var(--font-weight-h4); color: var(--color-on-surface);">' + escapeHTML(data.title || '') + ' Lv.' + escapeHTML(data.level) + '</div>' +
        '<div style="font-size: var(--font-size-caption); color: var(--color-on-surface-variant); margin-top: 2px;">' + escapeHTML(data.currentExp) + ' / ' + escapeHTML(data.maxExp) + ' 经验</div>' +
      '</div>' +
    '</div>' +
    '<div class="progress-bar">' +
      '<div class="progress-bar-fill" style="width: ' + (data.progress || 0) + '%;"></div>' +
    '</div>' +
    '<div style="font-size: var(--font-size-caption); color: var(--color-on-surface-variant); margin-top: var(--space-2);">距下一级还需 ' + escapeHTML(data.expToNext) + ' 经验</div>';
  lucide.createIcons();
}

function renderChallenges(list) {
  const container = document.getElementById('challenge-list');
  if (!container) return;
  if (!list || list.length === 0) {
    container.innerHTML = '<div style="padding:var(--space-4);text-align:center;color:var(--color-on-surface-variant);">暂无挑战</div>';
    return;
  }
  container.innerHTML = list.map(c => {
    const statusChip = c.statusType === 'filled'
      ? '<span class="chip filled" style="background:' + (c.statusBg || 'var(--color-primary-container)') + ';color:' + (c.statusColor || 'var(--color-primary)') + ';">' + escapeHTML(c.statusLabel) + '</span>'
      : '<span class="chip outline"' + (c.statusBorder ? ' style="border-color:' + c.statusBorder + ';' + (c.statusColor ? 'color:' + c.statusColor + ';' : '') + '"' : '') + '>' + escapeHTML(c.statusLabel) + '</span>';

    let progressSection = '';
    if (c.progressLabel !== undefined) {
      progressSection =
        '<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-2);">' +
          '<span style="font-size: var(--font-size-caption); color: var(--color-on-surface-variant);">' + escapeHTML(c.progressLabel) + '</span>' +
          '<span style="font-size: var(--font-size-caption); color: var(--color-on-surface-variant);">' + escapeHTML(c.percent || '') + '</span>' +
        '</div>' +
        '<div class="progress-bar" style="height: 6px;">' +
          '<div class="progress-bar-fill" style="width: ' + (c.progress || 0) + '%;' + (c.barColor ? 'background:' + c.barColor + ';' : '') + '"></div>' +
        '</div>';
    }
    const noteSection = c.note
      ? '<div style="font-size: var(--font-size-caption); color: var(--color-on-surface-variant); margin-top: var(--space-2);">' + escapeHTML(c.note) + '</div>'
      : '';

    return '<div class="challenge-card" onclick="joinChallenge(\'' + escapeAttr(c.name || '') + '\')">' +
      '<div style="display: flex; align-items: center; justify-content: space-between;' + (progressSection ? ' margin-bottom: var(--space-2);' : '') + '">' +
        '<div style="display: flex; align-items: center; gap: var(--space-2);">' +
          '<i data-lucide="' + escapeAttr(c.icon) + '" style="width: var(--size-icon-md); height: var(--size-icon-md); color: ' + (c.iconColor || 'var(--color-on-surface-variant)') + ';"></i>' +
          '<span style="font-size: var(--font-size-body); font-weight: var(--font-weight-h4); color: var(--color-on-surface);">' + escapeHTML(c.name) + '</span>' +
        '</div>' +
        statusChip +
      '</div>' +
      progressSection +
      noteSection +
    '</div>';
  }).join('');
  lucide.createIcons();
}

function renderProfile(data) {
  if (!data) return;
  const avatar = document.getElementById('profile-avatar');
  if (avatar) {
    const colors = avatarColors(data.avatarColor);
    avatar.style.background = colors.bg;
    const initials = avatar.querySelector('.avatar-initials');
    if (initials) {
      initials.style.color = colors.text;
      initials.textContent = data.avatarInitials || '';
    }
  }
  const nameEl = document.getElementById('profile-name');
  if (nameEl) nameEl.textContent = data.nickname || '';
  const bioEl = document.getElementById('profile-bio');
  if (bioEl) bioEl.textContent = data.bio || '';

  const stats = data.stats || {};
  const map = { 'profile-stat-records': stats.recordCount, 'profile-stat-recipes': stats.recipeCount, 'profile-stat-streak': stats.streakDays };
  Object.keys(map).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = (map[id] === undefined || map[id] === null) ? '0' : map[id];
  });
}

/* ===== 占位功能补齐 ===== */

// 参与挑战：用 localStorage 记录已参与状态
function joinChallenge(name) {
  // 未指定挑战名时，取第一个兜底挑战
  if (!name) {
    name = (CHALLENGES[0] && CHALLENGES[0].name) || '美食挑战';
  }
  const KEY = 'weiji_joined_challenges';
  let joined = [];
  try { joined = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { joined = []; }
  if (joined.indexOf(name) >= 0) {
    showToast('你已经参与过「' + name + '」挑战');
    return;
  }
  joined.push(name);
  try { localStorage.setItem(KEY, JSON.stringify(joined)); } catch (e) {}
  showToast('已参与「' + name + '」挑战，加油！');
}

// 徽章详情弹窗
function showBadgeDetail(name, desc) {
  const existing = document.getElementById('badge-detail-dialog');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'badge-detail-dialog';
  overlay.className = 'dialog-overlay';
  overlay.innerHTML =
    '<div class="dialog">' +
      '<div class="dialog-title">' + escapeHTML(name || '徽章') + '</div>' +
      '<div class="dialog-section">' +
        '<div style="font-size:var(--font-size-body);color:var(--color-on-surface);line-height:1.6;">' +
          escapeHTML(desc || '该徽章暂无描述信息。') +
        '</div>' +
      '</div>' +
      '<div class="dialog-actions">' +
        '<button class="btn btn-primary" id="badge-detail-close">知道了</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);
  lucide.createIcons();
  const closeBtn = overlay.querySelector('#badge-detail-close');
  if (closeBtn) closeBtn.addEventListener('click', function() { overlay.remove(); });
  overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
}

// 首页美食记录搜索
async function searchHomeRecords(value) {
  const keyword = (value || '').trim();
  const listEl = document.getElementById('food-diary-list');
  if (!keyword) {
    // 关键字为空，恢复全部
    loadHomeData();
    return;
  }
  showLoading(listEl);
  try {
    const data = await api.getRecords({ keyword: keyword });
    const list = (data && data.list) || [];
    renderRecords(list);
    showToast('找到 ' + list.length + ' 条记录');
  } catch (err) {
    hideLoading(listEl);
    showToast(err.message);
  }
}

// 家庭菜谱搜索
async function searchFamilyRecipes(value) {
  const keyword = (value || '').trim();
  const gridEl = document.getElementById('recipe-grid');
  if (!keyword) {
    filterRecipes('all');
    return;
  }
  showLoading(gridEl);
  try {
    const data = await api.getRecipesFiltered({ keyword: keyword });
    const list = data || [];
    renderRecipes(list);
    showToast('找到 ' + list.length + ' 道菜谱');
  } catch (err) {
    hideLoading(gridEl);
    showToast(err.message);
  }
}

// 按关键字查找菜谱并弹窗展示步骤详情
async function showRecipeStepsByKeyword(text) {
  const keyword = (text || '').trim();
  if (!keyword) return;
  showToast('正在查找菜谱...');
  try {
    const list = await api.getRecipesFiltered({ keyword: keyword });
    if (!list || list.length === 0) {
      showToast('未找到「' + keyword + '」相关菜谱');
      return;
    }
    const first = list[0];
    let detail = first;
    try { detail = await api.getRecipeDetail(first.id); } catch (e) { detail = first; }
    showRecipeDetailDialog(detail);
  } catch (err) {
    showToast(err.message);
  }
}

// 菜谱详情弹窗（展示食材与步骤）
function showRecipeDetailDialog(recipe) {
  if (!recipe) return;
  const existing = document.getElementById('recipe-detail-dialog');
  if (existing) existing.remove();
  const steps = (recipe.steps && recipe.steps.length) ? recipe.steps : [];
  const ingredients = (recipe.ingredients && recipe.ingredients.length) ? recipe.ingredients : [];
  const stepsHTML = steps.length
    ? steps.map(function(s) {
        const num = (s && s.stepNum) || '';
        const txt = s ? (s.text || (typeof s === 'string' ? s : '')) : '';
        return '<div style="display:flex;gap:8px;margin-bottom:8px;">' +
                 (num ? '<span style="flex-shrink:0;width:22px;height:22px;border-radius:50%;background:var(--primary-100);color:var(--primary-700);font-size:12px;display:flex;align-items:center;justify-content:center;font-weight:600;">' + escapeHTML(String(num)) + '</span>' : '') +
                 '<span style="flex:1;font-size:var(--font-size-body);color:var(--color-on-surface);line-height:1.6;">' + escapeHTML(txt) + '</span>' +
               '</div>';
      }).join('')
    : '<div style="font-size:var(--font-size-caption);color:var(--color-on-surface-variant);">该菜谱暂无步骤信息</div>';
  const ingHTML = ingredients.length
    ? ingredients.map(function(i) {
        const name = typeof i === 'string' ? i : (i.name || '');
        const amount = (typeof i === 'object' && i) ? ((i.amount || '') + (i.unit ? (' ' + i.unit) : '')) : '';
        return '<span class="chip filled">' + escapeHTML(name + (amount ? (' ' + amount) : '')) + '</span>';
      }).join('')
    : '<span style="font-size:var(--font-size-caption);color:var(--color-on-surface-variant);">暂无食材信息</span>';
  const coverHTML = recipe.coverUrl
    ? '<img src="' + escapeAttr(recipe.coverUrl) + '" alt="' + escapeAttr(recipe.name || '') + '" style="width:100%;max-height:180px;object-fit:cover;border-radius:8px;margin-bottom:12px;" />'
    : '';
  const overlay = document.createElement('div');
  overlay.id = 'recipe-detail-dialog';
  overlay.className = 'dialog-overlay';
  overlay.innerHTML =
    '<div class="dialog" style="max-width:440px;">' +
      '<div class="dialog-title">' + escapeHTML(recipe.name || '菜谱详情') + '</div>' +
      '<div class="dialog-section">' +
        coverHTML +
        (ingredients.length ? '<div style="font-size:var(--font-size-caption);color:var(--color-on-surface-variant);margin-bottom:6px;">食材</div>' : '') +
        '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">' + ingHTML + '</div>' +
        '<div style="font-size:var(--font-size-caption);color:var(--color-on-surface-variant);margin-bottom:6px;">步骤</div>' +
        stepsHTML +
      '</div>' +
      '<div class="dialog-actions">' +
        '<button class="btn btn-primary" id="recipe-detail-close">关闭</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);
  lucide.createIcons();
  const closeBtn = overlay.querySelector('#recipe-detail-close');
  if (closeBtn) closeBtn.addEventListener('click', function() { overlay.remove(); });
  overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
}

// 触发头像上传
function triggerAvatarUpload() {
  const input = document.getElementById('avatar-file-input');
  if (input) input.click();
}

// 头像选择后预览并调用 api.updateProfile
async function handleAvatarChange(event) {
  const input = event && event.target;
  const file = input && input.files && input.files[0];
  if (!file) return;
  if (!/^image\//.test(file.type || '')) {
    showToast('请选择图片文件');
    if (input) input.value = '';
    return;
  }
  try {
    // FileReader 读取为 DataURL 用于本地预览
    const dataUrl = await new Promise(function(resolve, reject) {
      const reader = new FileReader();
      reader.onload = function(e) { resolve(e.target.result); };
      reader.onerror = function() { reject(new Error('图片读取失败')); };
      reader.readAsDataURL(file);
    });
    // 立即预览到头像元素
    const avatar = document.getElementById('profile-avatar');
    if (avatar) {
      avatar.style.backgroundImage = 'url(' + dataUrl + ')';
      avatar.style.backgroundSize = 'cover';
      avatar.style.backgroundPosition = 'center';
      const initials = avatar.querySelector('.avatar-initials');
      if (initials) initials.style.display = 'none';
    }
    // 调用后端持久化
    try {
      await api.updateProfile({ avatar: dataUrl });
      showToast('头像更新成功');
    } catch (err) {
      showToast(err.message || '头像保存失败');
    }
  } catch (err) {
    showToast(err.message || '头像读取失败');
  } finally {
    if (input) input.value = '';
  }
}

// 跳转到购物清单（家庭菜谱页 → 本周菜单 tab，其中包含购物清单）
function navigateToShoppingList() {
  navigateTo('family');
  setTimeout(function() {
    switchFamilyTab('weekly');
    const shopping = document.getElementById('shopping-section');
    if (shopping) shopping.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

/* ===== 交互函数 ===== */
async function doCheckin() {
  const btn = document.getElementById('checkin-btn');
  if (btn) { btn.disabled = true; }
  try {
    const result = await api.doCheckin();
    showToast('打卡成功！🔥');
    // 成就解锁提示
    if (result && result.newAchievements && result.newAchievements.length > 0) {
      setTimeout(() => {
        result.newAchievements.forEach(ach => {
          showToast('🎉 解锁成就：' + ach.name + '！');
        });
      }, 1000);
    }
    const status = await api.getCheckinStatus();
    renderCheckin(status);
  } catch (err) {
    showToast(err.message);
    if (btn) { btn.disabled = false; }
  }
}

async function handleReplenish() {
  try {
    const data = await api.replenishCheckin();
    showToast('补签成功！连续' + data.streak + '天');
    const status = await api.getCheckinStatus();
    renderCheckin(status);
  } catch (e) {
    showToast(e.message || '补签失败');
  }
}

async function startRecognize() {
  const fileInput = document.getElementById('file-input');
  var rawFile = fileInput && fileInput.files && fileInput.files[0];
  if (!rawFile) {
    showToast('请先选择照片');
    return;
  }
  // 压缩图片
  var file = await compressImage(rawFile);
  // Reset beautify & nutrition state
  currentBeautifiedUrl = null;
  selectedImageVersion = 'original';
  const switcher = document.getElementById('image-version-switcher');
  if (switcher) switcher.style.display = 'none';
  renderNutrition(null);

  const overlay = document.getElementById('ai-overlay');
  const badge = document.getElementById('recognize-badge');
  if (overlay) overlay.classList.add('show');
  try {
    const result = await api.recognizeFood(file);
    currentRecognizeData = result;

    // 低置信度提示
    var confidenceWarn = document.getElementById('confidence-warn');
    if (confidenceWarn) {
      if (result.confidence != null && result.confidence < 0.5) {
        confidenceWarn.style.display = 'block';
        confidenceWarn.textContent = '⚠️ 这可能不是食物，请确认或手动输入菜名';
      } else {
        confidenceWarn.style.display = 'none';
      }
    }

    const dishInput = document.getElementById('dish-name');
    if (dishInput) dishInput.value = result.dishName || '';

    const confEl = document.getElementById('recognize-confidence');
    if (confEl) {
      const conf = result.confidence != null ? Math.round(result.confidence * 100) : 0;
      confEl.textContent = '置信度 ' + conf + '%';
    }

    const ingEl = document.getElementById('ingredient-list');
    if (ingEl && result.ingredients) {
      ingEl.innerHTML = result.ingredients.map(i =>
        '<span class="chip filled" onclick="toggleIngredient(this)">' + escapeHTML(i.name) + '</span>'
      ).join('');
    }

    const cmEl = document.getElementById('cooking-method-tag');
    if (cmEl && result.cookingMethod) {
      cmEl.innerHTML = '<span class="tag tag--accent">' + escapeHTML(result.cookingMethod) + '</span>';
    }

    if (result.imageUrl) {
      const cameraImg = document.getElementById('camera-img');
      if (cameraImg) cameraImg.src = result.imageUrl;
      const thumb = document.getElementById('dish-thumbnail');
      if (thumb) thumb.src = result.imageUrl;
    }

    const cameraImgEl = document.getElementById('camera-img');
    currentOriginalUrl = result.imageUrl || (cameraImgEl ? cameraImgEl.src : '');

    renderNutrition(result.nutrition);

    // Start beautify asynchronously (don't block user editing)
    startBeautify(file);

    if (badge) badge.style.display = 'inline-flex';
    showToast('AI识别完成！');
    lucide.createIcons();
  } catch (err) {
    showToast(err.message);
  } finally {
    if (overlay) overlay.classList.remove('show');
  }
}

function retakePhoto() {
  const fileInput = document.getElementById('file-input');
  if (fileInput) fileInput.click();
}

/* ===== 图片美化 ===== */
async function startBeautify(file) {
  try {
    const result = await api.beautifyImage(file);
    if (result && result.beautifiedUrl) {
      currentBeautifiedUrl = result.beautifiedUrl;
      const switcher = document.getElementById('image-version-switcher');
      if (switcher) switcher.style.display = 'flex';
      switchImageVersion('beautified');
      showToast('图片美化完成');
    }
  } catch (err) {
    showToast('美化失败，将使用原图');
  }
}

function switchImageVersion(version) {
  selectedImageVersion = version;
  const url = (version === 'beautified' && currentBeautifiedUrl) ? currentBeautifiedUrl : currentOriginalUrl;
  if (!url) return;
  const cameraImg = document.getElementById('camera-img');
  if (cameraImg) cameraImg.src = url;
  const thumb = document.getElementById('dish-thumbnail');
  if (thumb) thumb.src = url;
  document.querySelectorAll('#image-version-switcher .version-btn').forEach(btn => {
    if (btn.dataset.version === version) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

/* ===== 营养分析 ===== */
function renderNutrition(nutrition) {
  const container = document.getElementById('nutrition-cards');
  if (!container) return;
  if (!nutrition) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }
  const items = [
    { icon: 'flame', label: '热量', value: nutrition.calories, unit: 'kcal', color: 'var(--color-primary)', bg: 'var(--primary-50)' },
    { icon: 'egg', label: '蛋白质', value: nutrition.protein, unit: 'g', color: 'var(--info-500)', bg: 'var(--info-50)' },
    { icon: 'droplet', label: '脂肪', value: nutrition.fat, unit: 'g', color: 'var(--accent-500)', bg: 'var(--accent-50)' },
    { icon: 'wheat', label: '碳水', value: nutrition.carbs, unit: 'g', color: 'var(--success-500)', bg: 'var(--success-50)' }
  ];
  container.innerHTML = items.map(it => {
    const val = (it.value === undefined || it.value === null) ? '--' : escapeHTML(it.value);
    return '<div style="flex: 1; min-width: 0; background: ' + it.bg + '; border-radius: var(--radius-md); padding: var(--space-2) var(--space-1); text-align: center;">' +
      '<i data-lucide="' + it.icon + '" style="width: 16px; height: 16px; color: ' + it.color + ';"></i>' +
      '<div style="font-size: var(--font-size-body); font-weight: 600; color: var(--color-on-surface); margin-top: var(--space-1);">' + val + '</div>' +
      '<div style="font-size: 10px; color: var(--color-on-surface-variant);">' + it.unit + '</div>' +
      '<div style="font-size: var(--font-size-caption); color: var(--color-on-surface-variant); margin-top: 2px;">' + it.label + '</div>' +
    '</div>';
  }).join('');
  container.style.display = 'flex';
  lucide.createIcons();
}

async function saveRecord() {
  const dishInput = document.getElementById('dish-name');
  const dishName = dishInput ? dishInput.value.trim() : '';
  if (!dishName) {
    showToast('请输入菜品名称');
    return;
  }
  const tags = [];
  document.querySelectorAll('#record-tags .chip.selected').forEach(c => {
    tags.push(c.textContent.trim());
  });
  const data = {
    dishName: dishName,
    rating: currentRating,
    tags: tags,
    mealType: '',
    note: '',
    imageUrl: (selectedImageVersion === 'beautified' && currentBeautifiedUrl)
      ? currentBeautifiedUrl
      : (currentRecognizeData ? (currentRecognizeData.imageUrl || '') : ''),
    aiConfidence: currentRecognizeData ? (currentRecognizeData.confidence != null ? currentRecognizeData.confidence : null) : null
  };
  try {
    const result = await api.saveRecord(data);
    showToast('"' + dishName + '" 保存成功！');
    // 成就解锁提示
    if (result && result.newAchievements && result.newAchievements.length > 0) {
      setTimeout(() => {
        result.newAchievements.forEach(ach => {
          showToast('🎉 解锁成就：' + ach.name + '！');
        });
      }, 1000);
    }
    currentRecognizeData = null;
    setTimeout(() => {
      navigateTo('home');
    }, 800);
  } catch (err) {
    showToast(err.message);
  }
}

async function filterFood(filter) {
  const listEl = document.getElementById('food-diary-list');
  showLoading(listEl);
  try {
    const tag = filter === 'all' ? '' : filter;
    const data = await api.getRecords(tag ? { tag: tag } : {});
    renderRecords((data && data.list) || []);
  } catch (err) {
    hideLoading(listEl);
    showToast(err.message);
  }
}

async function filterRecipes(category) {
  currentRecipeVisibility = null;
  const gridEl = document.getElementById('recipe-grid');
  showLoading(gridEl);
  try {
    const data = await api.getFamilyRecipes(category);
    renderRecipes(data || []);
  } catch (err) {
    hideLoading(gridEl);
    showToast(err.message);
  }
}

async function filterRecipesByVisibility(visibility) {
  currentRecipeVisibility = visibility || null;
  const gridEl = document.getElementById('recipe-grid');
  showLoading(gridEl);
  try {
    const data = visibility
      ? await api.getRecipesFiltered({ visibility: visibility })
      : await api.getFamilyRecipes();
    renderRecipes(data || []);
  } catch (err) {
    hideLoading(gridEl);
    showToast(err.message);
  }
}

async function reloadFamilyRecipes() {
  const gridEl = document.getElementById('recipe-grid');
  if (!gridEl) return;
  showLoading(gridEl);
  try {
    const data = currentRecipeVisibility
      ? await api.getRecipesFiltered({ visibility: currentRecipeVisibility })
      : await api.getFamilyRecipes();
    renderRecipes(data || []);
  } catch (err) {
    hideLoading(gridEl);
    showToast(err.message);
  }
}

async function toggleRecipeVisibility(recipeId, currentVisibility) {
  const newVisibility = currentVisibility === 'private' ? 'family' : 'private';
  try {
    await api.updateRecipeVisibility(recipeId, newVisibility);
    showToast(newVisibility === 'family' ? '已切换为家庭共享' : '已切换为私厨');
    reloadFamilyRecipes();
  } catch (err) {
    showToast(err.message);
  }
}

/* ===== 本周菜单 ===== */
const WEEKLY_DAYS = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 7, label: '周日' }
];
const WEEKLY_MEALS = ['早餐', '午餐', '晚餐'];

function switchFamilyTab(view) {
  const recipeView = document.getElementById('recipe-view');
  const weeklyView = document.getElementById('weekly-menu-view');
  const shoppingSection = document.getElementById('shopping-section');
  document.querySelectorAll('#family-view-tabs .tab-item').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('#family-view-tabs .tab-item[data-view="' + view + '"]').forEach(t => t.classList.add('active'));
  if (view === 'weekly') {
    if (recipeView) recipeView.style.display = 'none';
    if (weeklyView) weeklyView.style.display = '';
    if (shoppingSection) shoppingSection.style.display = '';
    loadWeeklyMenu();
    loadShoppingList();
  } else if (view === 'records') {
    if (recipeView) recipeView.style.display = 'none';
    if (weeklyView) weeklyView.style.display = 'none';
    if (shoppingSection) shoppingSection.style.display = 'none';
  } else {
    if (recipeView) recipeView.style.display = '';
    if (weeklyView) weeklyView.style.display = 'none';
    if (shoppingSection) shoppingSection.style.display = 'none';
  }
  // 在 switchFamilyTab 函数中添加对 records 的处理
  if (view === 'records') {
    document.getElementById('family-records-view').style.display = 'block';
    loadFamilyRecords();
  } else {
    document.getElementById('family-records-view').style.display = 'none';
  }
  // 处理饮食报告 view 的显示与加载
  const reportView = document.getElementById('family-report-view');
  if (view === 'report') {
    if (recipeView) recipeView.style.display = 'none';
    if (weeklyView) weeklyView.style.display = 'none';
    if (shoppingSection) shoppingSection.style.display = 'none';
    if (reportView) reportView.style.display = 'block';
    // 设置月份输入默认为当月
    const monthInput = document.getElementById('report-month-input');
    if (monthInput && !monthInput.value) {
      const now = new Date();
      monthInput.value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    }
    loadFamilyReport(monthInput ? monthInput.value : undefined);
  } else {
    if (reportView) reportView.style.display = 'none';
  }
}

/* ===== 购物清单 ===== */
const SHOPPING_CATEGORY_ICONS = {
  '蔬菜': 'carrot',
  '肉类': 'beef',
  '水产': 'fish',
  '调料': 'leaf',
  '乳制品': 'milk',
  '其他': 'shopping-basket'
};

async function loadShoppingList() {
  const container = document.getElementById('shopping-list');
  if (!container) return;
  showLoading(container);
  try {
    const data = await api.getShoppingList();
    renderShoppingList(data || {});
  } catch (err) {
    hideLoading(container);
    showToast(err.message);
  }
}

function renderShoppingList(groupedItems) {
  const container = document.getElementById('shopping-list');
  if (!container) return;

  const categories = Object.keys(groupedItems || {});
  let total = 0, checked = 0;
  categories.forEach(cat => {
    (groupedItems[cat] || []).forEach(item => {
      total++;
      if (item.checked) checked++;
    });
  });

  if (total === 0) {
    container.innerHTML =
      '<div class="shopping-empty">' +
        '<div class="shopping-empty-icon"><i data-lucide="shopping-cart"></i></div>' +
        '<div class="shopping-empty-text">购物清单是空的</div>' +
      '</div>';
    lucide.createIcons();
    return;
  }

  const percent = Math.round((checked / total) * 100);
  let html =
    '<div class="shopping-progress">' +
      '<span class="shopping-progress-text">已购买 ' + checked + '/' + total + '</span>' +
      '<div class="shopping-progress-bar">' +
        '<div class="shopping-progress-fill" style="width: ' + percent + '%;"></div>' +
      '</div>' +
    '</div>';

  categories.forEach(cat => {
    const items = groupedItems[cat] || [];
    if (items.length === 0) return;
    const icon = SHOPPING_CATEGORY_ICONS[cat] || 'shopping-basket';
    html +=
      '<div class="shopping-category">' +
        '<div class="shopping-category-title">' +
          '<i data-lucide="' + escapeAttr(icon) + '"></i>' +
          '<span>' + escapeHTML(cat) + '</span>' +
        '</div>' +
        '<div class="shopping-items">' +
          items.map(item => {
            const isChecked = !!item.checked;
            return '<div class="shopping-item' + (isChecked ? ' checked' : '') + '" data-id="' + escapeAttr(String(item.id)) + '">' +
              '<button class="shopping-checkbox" onclick="handleToggleShopping(\'' + escapeAttr(String(item.id)) + '\', ' + isChecked + ')">' +
                '<i data-lucide="check"></i>' +
              '</button>' +
              '<span class="shopping-item-name">' + escapeHTML(item.name || '') + '</span>' +
              '<span class="shopping-item-quantity">' + escapeHTML(item.quantity || '') + '</span>' +
              '<button class="shopping-delete-btn" onclick="handleDeleteShoppingItem(\'' + escapeAttr(String(item.id)) + '\')">' +
                '<i data-lucide="trash-2"></i>' +
              '</button>' +
            '</div>';
          }).join('') +
        '</div>' +
      '</div>';
  });

  container.innerHTML = html;
  lucide.createIcons();
}

async function handleToggleShopping(itemId, checked) {
  try {
    await api.toggleShoppingItem(itemId, !checked);
    showToast(checked ? '已取消勾选' : '已购买');
    loadShoppingList();
  } catch (err) {
    showToast(err.message);
  }
}

function handleAddShoppingItem() {
  const modal = document.getElementById('shopping-modal');
  if (!modal) return;
  const nameInput = document.getElementById('shopping-name');
  const qtyInput = document.getElementById('shopping-quantity');
  if (nameInput) nameInput.value = '';
  if (qtyInput) qtyInput.value = '';
  modal.style.display = 'flex';
  lucide.createIcons();
  if (nameInput) setTimeout(() => nameInput.focus(), 100);
}

function closeShoppingModal() {
  const modal = document.getElementById('shopping-modal');
  if (modal) modal.style.display = 'none';
}

async function confirmAddShoppingItem() {
  const nameInput = document.getElementById('shopping-name');
  const catInput = document.getElementById('shopping-category');
  const qtyInput = document.getElementById('shopping-quantity');
  const name = nameInput ? nameInput.value.trim() : '';
  const category = catInput ? catInput.value : '其他';
  const quantity = qtyInput ? qtyInput.value.trim() : '';

  if (!name) {
    showToast('请输入物品名称');
    return;
  }

  try {
    await api.addShoppingItem({ name: name, category: category, quantity: quantity || '1' });
    showToast('添加成功');
    closeShoppingModal();
    loadShoppingList();
  } catch (err) {
    showToast(err.message);
  }
}

async function handleDeleteShoppingItem(itemId) {
  try {
    await api.deleteShoppingItem(itemId);
    showToast('已删除');
    loadShoppingList();
  } catch (err) {
    showToast(err.message);
  }
}

async function loadWeeklyMenu() {
  const viewEl = document.getElementById('weekly-menu-view');
  if (!viewEl) return;
  showLoading(viewEl);
  try {
    const menuList = await api.getWeeklyMenu();
    renderWeeklyMenu(menuList || []);
  } catch (err) {
    hideLoading(viewEl);
    showToast(err.message);
  }
}

function renderWeeklyMenu(menuList) {
  const container = document.getElementById('weekly-menu-view');
  if (!container) return;
  if (!menuList || menuList.length === 0) {
    container.innerHTML = '<div class="weekly-empty">本周暂无菜单安排，去「菜谱」中加入吧～</div>';
    return;
  }
  container.innerHTML = '<div class="weekly-menu-list">' + WEEKLY_DAYS.map(day => {
    const dayItems = menuList.filter(m => m.dayOfWeek === day.value);
    const mealsHTML = WEEKLY_MEALS.map(mealType => {
      const items = dayItems.filter(m => m.mealType === mealType);
      let content;
      if (items.length === 0) {
        content = '<div class="weekly-meal-empty">暂无安排</div>';
      } else {
        content = items.map(item => renderMenuItemCard(item)).join('');
      }
      return '<div class="weekly-meal">' +
        '<div class="weekly-meal-label">' + escapeHTML(mealType) + '</div>' +
        '<div class="weekly-meal-content">' + content + '</div>' +
      '</div>';
    }).join('');
    return '<div class="weekly-day">' +
      '<div class="weekly-day-title">' + escapeHTML(day.label) + '</div>' +
      '<div class="weekly-meals">' + mealsHTML + '</div>' +
    '</div>';
  }).join('') + '</div>';
  lucide.createIcons();
}

function renderMenuItemCard(item) {
  return '<div class="menu-item-card" data-id="' + escapeAttr(String(item.id)) + '">' +
    '<img class="menu-item-img" src="' + escapeAttr(item.coverUrl || '') + '" alt="' + escapeAttr(item.recipeName || '') + '" />' +
    '<div class="menu-item-info">' +
      '<div class="menu-item-name">' + escapeHTML(item.recipeName || '') + '</div>' +
      '<div class="menu-item-votes">' +
        '<button class="vote-btn" onclick="handleVote(\'' + escapeAttr(String(item.id)) + '\', \'up\')">' +
          '<i data-lucide="thumbs-up" style="width:14px;height:14px;"></i>' +
          '<span class="up-count">' + escapeHTML(String(item.upCount || 0)) + '</span>' +
        '</button>' +
        '<button class="vote-btn" onclick="handleVote(\'' + escapeAttr(String(item.id)) + '\', \'down\')">' +
          '<i data-lucide="thumbs-down" style="width:14px;height:14px;"></i>' +
          '<span class="down-count">' + escapeHTML(String(item.downCount || 0)) + '</span>' +
        '</button>' +
      '</div>' +
    '</div>' +
  '</div>';
}

function showAddToMenuDialog(recipeId) {
  const existing = document.getElementById('add-menu-dialog');
  if (existing) existing.remove();

  let selectedDay = 1;
  let selectedMeal = '早餐';

  const overlay = document.createElement('div');
  overlay.id = 'add-menu-dialog';
  overlay.className = 'dialog-overlay';
  overlay.innerHTML =
    '<div class="dialog">' +
      '<div class="dialog-title">加入本周菜单</div>' +
      '<div class="dialog-section">' +
        '<div class="dialog-label">选择日期</div>' +
        '<div class="dialog-options" id="dialog-days">' +
          WEEKLY_DAYS.map(d =>
            '<button class="chip outline' + (d.value === selectedDay ? ' selected' : '') + '" data-day="' + d.value + '">' + escapeHTML(d.label) + '</button>'
          ).join('') +
        '</div>' +
      '</div>' +
      '<div class="dialog-section">' +
        '<div class="dialog-label">选择餐次</div>' +
        '<div class="dialog-options" id="dialog-meals">' +
          WEEKLY_MEALS.map(m =>
            '<button class="chip outline' + (m === selectedMeal ? ' selected' : '') + '" data-meal="' + escapeAttr(m) + '">' + escapeHTML(m) + '</button>'
          ).join('') +
        '</div>' +
      '</div>' +
      '<div class="dialog-actions">' +
        '<button class="btn btn-ghost" id="dialog-cancel">取消</button>' +
        '<button class="btn btn-primary" id="dialog-confirm">确认</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);
  lucide.createIcons();

  overlay.querySelectorAll('#dialog-days .chip').forEach(chip => {
    chip.addEventListener('click', function() {
      overlay.querySelectorAll('#dialog-days .chip').forEach(c => c.classList.remove('selected'));
      this.classList.add('selected');
      selectedDay = parseInt(this.dataset.day, 10);
    });
  });
  overlay.querySelectorAll('#dialog-meals .chip').forEach(chip => {
    chip.addEventListener('click', function() {
      overlay.querySelectorAll('#dialog-meals .chip').forEach(c => c.classList.remove('selected'));
      this.classList.add('selected');
      selectedMeal = this.dataset.meal;
    });
  });
  overlay.querySelector('#dialog-cancel').addEventListener('click', function() { overlay.remove(); });
  overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });

  const confirmBtn = overlay.querySelector('#dialog-confirm');
  confirmBtn.addEventListener('click', async function() {
    confirmBtn.disabled = true;
    confirmBtn.textContent = '提交中...';
    try {
      await api.addToMenu({ dayOfWeek: selectedDay, mealType: selectedMeal, recipeId: recipeId });
      showToast('已加入本周菜单！');
      overlay.remove();
      if (document.getElementById('weekly-menu-view') && document.getElementById('weekly-menu-view').style.display !== 'none') {
        loadWeeklyMenu();
      }
    } catch (err) {
      showToast(err.message);
      confirmBtn.disabled = false;
      confirmBtn.textContent = '确认';
    }
  });
}

function showCreateFamilyDialog() {
  document.getElementById('create-family-modal').style.display = 'flex';
  document.getElementById('create-family-name').value = '';
}

function closeCreateFamilyModal() {
  document.getElementById('create-family-modal').style.display = 'none';
}

async function handleCreateFamily() {
  const name = document.getElementById('create-family-name').value.trim();
  if (!name) {
    showToast('请输入家庭组名称');
    return;
  }
  try {
    await api.createFamily(name);
    closeCreateFamilyModal();
    showToast('创建成功');
    loadFamilyData();
  } catch (e) {
    showToast(e.message || '创建失败');
  }
}

function showUploadRecipeDialog() {
  document.getElementById('upload-recipe-modal').style.display = 'flex';
}

function closeUploadRecipeModal() {
  document.getElementById('upload-recipe-modal').style.display = 'none';
}

async function handleUploadRecipe() {
  const name = document.getElementById('recipe-name').value.trim();
  const category = document.getElementById('recipe-category').value;
  const difficulty = document.getElementById('recipe-difficulty').value;
  const cookTime = parseInt(document.getElementById('recipe-cooktime').value, 10) || 30;
  const ingredientsText = document.getElementById('recipe-ingredients').value.trim();
  const stepsText = document.getElementById('recipe-steps').value.trim();

  if (!name) {
    showToast('请填写菜谱名称');
    return;
  }
  if (!ingredientsText) {
    showToast('请填写食材清单');
    return;
  }

  // 解析食材：每行一项，格式 名称,用量,单位
  const ingredients = ingredientsText.split('\n').filter(l => l.trim()).map(line => {
    const parts = line.split(',').map(p => p.trim());
    return { name: parts[0] || '', amount: parts[1] || '', unit: parts[2] || '' };
  }).filter(i => i.name);

  // 解析步骤：每行一步
  const steps = stepsText ? stepsText.split('\n').filter(l => l.trim()).map((line, i) => ({
    stepNum: i + 1,
    text: line.replace(/^\d+\.\s*/, '').trim()
  })) : [];

  try {
    await api.uploadRecipe({ name, category, difficulty, cookTime, ingredients, steps, visibility: 'family' });
    closeUploadRecipeModal();
    showToast('上传成功');
    loadFamilyData();
  } catch (e) {
    showToast(e.message || '上传失败');
  }
}

/* ===== 家庭动态（F16） ===== */
async function loadFamilyRecords() {
  var container = document.getElementById('family-records-list');
  if (!container) return;
  container.innerHTML = '<div style="padding:var(--space-6);text-align:center;color:var(--color-on-surface-variant);">加载中...</div>';
  try {
    var data = await api.getFamilyRecords(1);
    renderFamilyRecords((data && data.list) || []);
  } catch (e) {
    container.innerHTML = '<div style="padding:var(--space-6);text-align:center;color:var(--color-on-surface-variant);">暂无动态</div>';
  }
}

function renderFamilyRecords(list) {
  var container = document.getElementById('family-records-list');
  if (!container) return;
  if (!list || list.length === 0) {
    container.innerHTML = '<div style="padding:var(--space-6);text-align:center;color:var(--color-on-surface-variant);">还没有家庭动态，快去记录美食吧！</div>';
    return;
  }
  container.innerHTML = list.map(function(item) {
    var imgUrl = item.beautifiedUrl || item.imageUrl || '';
    var imgHtml = imgUrl ? '<img src="' + escapeAttr(imgUrl) + '" style="width:100%;height:200px;object-fit:cover;border-radius:8px;margin-bottom:12px;" />' : '';
    var stars = '';
    for (var i = 1; i <= 5; i++) {
      stars += '<span style="color:' + (i <= item.rating ? '#FFB800' : '#ddd') + ';">★</span>';
    }
    var tagsHtml = (item.tags || []).map(function(t) {
      return '<span class="chip filled" style="font-size:11px;">' + escapeHTML(t) + '</span>';
    }).join('');
    var commentsHtml = (item.comments || []).map(function(c) {
      return '<div style="padding:4px 0;font-size:13px;"><strong>' + escapeHTML(c.userNickname) + '</strong>: ' + escapeHTML(c.content) + '</div>';
    }).join('');
    return '<div style="background:var(--color-surface);border-radius:12px;padding:16px;margin-bottom:12px;">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
        '<div style="width:32px;height:32px;border-radius:50%;background:var(--color-primary);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;">' + escapeHTML((item.userNickname || '?').charAt(0)) + '</div>' +
        '<div><div style="font-weight:600;font-size:14px;">' + escapeHTML(item.userNickname) + '</div>' +
        '<div style="font-size:12px;color:var(--color-on-surface-variant);">' + escapeHTML(item.recordDate) + '</div></div>' +
      '</div>' +
      imgHtml +
      '<div style="font-size:16px;font-weight:600;margin-bottom:4px;">' + escapeHTML(item.dishName) + '</div>' +
      '<div style="margin-bottom:8px;">' + stars + '</div>' +
      (tagsHtml ? '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px;">' + tagsHtml + '</div>' : '') +
      '<div style="display:flex;gap:16px;padding-top:8px;border-top:1px solid var(--color-outline);">' +
        '<button onclick="handleToggleLike(\'' + escapeAttr(item.id) + '\')" style="border:none;background:transparent;color:' + (item.likedByMe ? 'var(--color-primary)' : 'var(--color-on-surface-variant)') + ';cursor:pointer;font-size:14px;display:flex;align-items:center;gap:4px;">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="' + (item.likedByMe ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>' +
          '<span>' + item.likeCount + '</span>' +
        '</button>' +
        '<button onclick="toggleCommentBox(\'' + escapeAttr(item.id) + '\')" style="border:none;background:transparent;color:var(--color-on-surface-variant);cursor:pointer;font-size:14px;display:flex;align-items:center;gap:4px;">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
          '<span>' + item.commentCount + '</span>' +
        '</button>' +
      '</div>' +
      (commentsHtml ? '<div style="padding-top:8px;margin-top:4px;border-top:1px solid var(--color-outline);">' + commentsHtml + '</div>' : '') +
      '<div id="comment-box-' + escapeAttr(item.id) + '" style="display:none;padding-top:8px;">' +
        '<div style="display:flex;gap:8px;">' +
          '<input type="text" id="comment-input-' + escapeAttr(item.id) + '" placeholder="写评论..." style="flex:1;padding:8px 12px;border:1px solid var(--color-outline);border-radius:20px;font-size:13px;outline:none;" />' +
          '<button onclick="handleSubmitComment(\'' + escapeAttr(item.id) + '\')" style="padding:8px 16px;border:none;background:var(--color-primary);color:#fff;border-radius:20px;font-size:13px;cursor:pointer;">发送</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

async function handleToggleLike(recordId) {
  try {
    await api.toggleRecordLike(recordId);
    loadFamilyRecords();
  } catch (e) {
    showToast(e.message || '操作失败');
  }
}

function toggleCommentBox(recordId) {
  var box = document.getElementById('comment-box-' + recordId);
  if (box) {
    box.style.display = box.style.display === 'none' ? 'block' : 'none';
    if (box.style.display === 'block') {
      var input = document.getElementById('comment-input-' + recordId);
      if (input) input.focus();
    }
  }
}

async function handleSubmitComment(recordId) {
  var input = document.getElementById('comment-input-' + recordId);
  if (!input) return;
  var content = input.value.trim();
  if (!content) {
    showToast('请输入评论内容');
    return;
  }
  try {
    await api.addRecordComment(recordId, content);
    showToast('评论成功');
    loadFamilyRecords();
  } catch (e) {
    showToast(e.message || '评论失败');
  }
}

/* ===== 日历视图（F3增强） ===== */
var calendarCurrentMonth = new Date();

function renderCalendarView(recordsList) {
  var container = document.getElementById('calendar-view');
  if (!container) return;

  var year = calendarCurrentMonth.getFullYear();
  var month = calendarCurrentMonth.getMonth();

  // 构建有记录的日期集合
  var recordDates = {};
  (recordsList || []).forEach(function(r) {
    if (r.recordDate) {
      if (!recordDates[r.recordDate]) recordDates[r.recordDate] = [];
      recordDates[r.recordDate].push(r);
    }
  });

  // 计算日历网格
  var firstDay = new Date(year, month, 1);
  var lastDay = new Date(year, month + 1, 0);
  var startWeekday = firstDay.getDay() || 7; // 周日=0转为7
  var daysInMonth = lastDay.getDate();

  var monthNames = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
  var today = new Date().toISOString().split('T')[0];
  var todayDate = new Date();
  var isCurrentMonth = (year === todayDate.getFullYear() && month === todayDate.getMonth());

  var html = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">' +
    '<button onclick="changeMonth(-1)" style="border:none;background:transparent;color:var(--color-primary);font-size:18px;cursor:pointer;padding:8px;">‹</button>' +
    '<span style="font-size:16px;font-weight:600;">' + year + '年' + monthNames[month] + '</span>' +
    '<button onclick="changeMonth(1)" style="border:none;background:transparent;color:var(--color-primary);font-size:18px;cursor:pointer;padding:8px;">›</button>' +
  '</div>';

  html += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:8px;">';
  ['一','二','三','四','五','六','日'].forEach(function(d) {
    html += '<div style="text-align:center;font-size:12px;color:var(--color-on-surface-variant);padding:4px;">' + d + '</div>';
  });
  html += '</div>';

  html += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;">';
  // 空白格
  for (var i = 1; i < startWeekday; i++) {
    html += '<div></div>';
  }
  // 日期格
  for (var d = 1; d <= daysInMonth; d++) {
    var dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    var hasRecord = !!recordDates[dateStr];
    var isToday = isCurrentMonth && d === todayDate.getDate();
    var bg = hasRecord ? 'background:var(--color-primary);color:#fff;' : 'background:var(--color-surface-variant);';
    if (isToday) bg += 'border:2px solid var(--color-primary);';
    html += '<div onclick="' + (hasRecord ? 'showDayRecords(\'' + dateStr + '\')' : '') + '" ' +
      'style="aspect-ratio:1;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:8px;cursor:' + (hasRecord ? 'pointer' : 'default') + ';' + bg + 'padding:4px;">' +
      '<span style="font-size:14px;">' + d + '</span>' +
      (hasRecord ? '<span style="width:4px;height:4px;border-radius:50%;background:#fff;margin-top:2px;"></span>' : '') +
    '</div>';
  }
  html += '</div>';

  html += '<div id="day-records-container" style="margin-top:16px;"></div>';

  // 存储记录数据供点击使用
  window._calendarRecordDates = recordDates;

  container.innerHTML = html;
}

function changeMonth(delta) {
  calendarCurrentMonth.setMonth(calendarCurrentMonth.getMonth() + delta);
  // 重新加载日历
  var list = window._allRecords || [];
  renderCalendarView(list);
}

function showDayRecords(dateStr) {
  var container = document.getElementById('day-records-container');
  if (!container) return;
  var records = (window._calendarRecordDates || {})[dateStr] || [];
  if (records.length === 0) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = '<div style="font-size:14px;font-weight:600;margin-bottom:8px;">' + dateStr + ' 的记录</div>' +
    records.map(function(r) {
      var imgUrl = r.beautifiedUrl || r.imageUrl || '';
      var imgHtml = imgUrl ? '<img src="' + escapeAttr(imgUrl) + '" style="width:60px;height:60px;object-fit:cover;border-radius:8px;" />' : '';
      var stars = '';
      for (var i = 1; i <= 5; i++) {
        stars += '<span style="color:' + (i <= r.rating ? '#FFB800' : '#ddd') + ';font-size:12px;">★</span>';
      }
      return '<div style="display:flex;gap:12px;padding:8px 0;border-bottom:1px solid var(--color-outline);">' +
        imgHtml +
        '<div><div style="font-weight:600;font-size:14px;">' + escapeHTML(r.dishName) + '</div>' +
        '<div>' + stars + '</div></div>' +
      '</div>';
    }).join('');
}

function switchDiaryView(view) {
  var listView = document.getElementById('food-diary-list');
  var calView = document.getElementById('calendar-view');
  var btnList = document.getElementById('btn-list-view');
  var btnCal = document.getElementById('btn-calendar-view');
  if (view === 'calendar') {
    if (listView) listView.style.display = 'none';
    if (calView) calView.style.display = 'block';
    if (btnList) btnList.style.background = 'transparent';
    if (btnList) btnList.style.color = 'var(--color-on-surface-variant)';
    if (btnCal) btnCal.style.background = 'var(--color-primary)';
    if (btnCal) btnCal.style.color = '#fff';
    renderCalendarView(window._allRecords || []);
  } else {
    if (listView) listView.style.display = 'block';
    if (calView) calView.style.display = 'none';
    if (btnList) btnList.style.background = 'var(--color-primary)';
    if (btnList) btnList.style.color = '#fff';
    if (btnCal) btnCal.style.background = 'transparent';
    if (btnCal) btnCal.style.color = 'var(--color-on-surface-variant)';
  }
}

async function showInvitationDialog() {
  const existing = document.getElementById('invitation-dialog');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'invitation-dialog';
  overlay.className = 'dialog-overlay';
  overlay.innerHTML =
    '<div class="dialog">' +
      '<div class="dialog-title">邀请家人</div>' +
      '<div class="dialog-section">' +
        '<div class="dialog-label">邀请码</div>' +
        '<div id="invitation-code" class="invitation-code">生成中...</div>' +
        '<div style="font-size:var(--font-size-caption);color:var(--color-on-surface-variant);margin-top:var(--space-2);">将邀请码分享给家人，他们注册后即可加入家庭。</div>' +
      '</div>' +
      '<div class="dialog-actions">' +
        '<button class="btn btn-ghost" id="invitation-cancel">关闭</button>' +
        '<button class="btn btn-primary" id="invitation-copy" disabled>复制邀请码</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);
  lucide.createIcons();

  const codeEl = overlay.querySelector('#invitation-code');
  const copyBtn = overlay.querySelector('#invitation-copy');
  const cancelBtn = overlay.querySelector('#invitation-cancel');

  cancelBtn.addEventListener('click', function() { overlay.remove(); });
  overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });

  try {
    const data = await api.createInvitation();
    const code = (data && (data.code || data.invitationCode)) || '';
    if (codeEl) codeEl.textContent = code || '暂无邀请码';
    if (copyBtn) copyBtn.disabled = !code;
    if (copyBtn && code) {
      copyBtn.addEventListener('click', function() {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(code).then(function() {
            showToast('邀请码已复制');
          }).catch(function() {
            showToast('复制失败，请手动复制');
          });
        } else {
          showToast('当前环境不支持复制');
        }
      });
    }
  } catch (err) {
    if (codeEl) codeEl.textContent = '生成失败';
    showToast(err.message);
  }
}

async function handleVote(menuId, vote) {
  try {
    await api.voteMenuItem(menuId, vote, 'user-001');
    showToast(vote === 'up' ? '点赞成功！' : '已踩');
    const card = document.querySelector('.menu-item-card[data-id="' + menuId + '"]');
    if (card) {
      const countEl = card.querySelector(vote === 'up' ? '.up-count' : '.down-count');
      if (countEl) {
        countEl.textContent = (parseInt(countEl.textContent, 10) || 0) + 1;
      }
    }
  } catch (err) {
    showToast(err.message);
  }
}

/* ===== 评分星星 ===== */
function initRatingStars() {
  const starsContainer = document.getElementById('rating-stars');
  if (!starsContainer) return;
  currentRating = parseInt(starsContainer.dataset.rating, 10) || 0;
  const stars = starsContainer.querySelectorAll('.star');
  stars.forEach((star, index) => {
    star.addEventListener('click', function() {
      setRating(index + 1);
    });
    star.addEventListener('mouseenter', function() {
      highlightStars(index + 1);
    });
  });
  starsContainer.addEventListener('mouseleave', function() {
    highlightStars(currentRating);
  });
}

function setRating(rating) {
  currentRating = rating;
  const starsContainer = document.getElementById('rating-stars');
  if (starsContainer) starsContainer.dataset.rating = rating;
  highlightStars(rating);
  const valueEl = document.getElementById('rating-value');
  if (valueEl) valueEl.textContent = rating.toFixed(1);
}

function highlightStars(rating) {
  const starsContainer = document.getElementById('rating-stars');
  if (!starsContainer) return;
  const stars = starsContainer.querySelectorAll('.star');
  stars.forEach((star, index) => {
    if (index < rating) {
      star.style.fill = 'var(--accent)';
      star.classList.remove('star--empty');
    } else {
      star.style.fill = 'none';
      star.classList.add('star--empty');
    }
  });
}

/* ===== 标签切换 ===== */
function toggleIngredient(el) {
  if (el.classList.contains('filled')) {
    el.classList.remove('filled');
    el.classList.add('outline');
  } else {
    el.classList.remove('outline');
    el.classList.add('filled');
  }
}

function toggleRecordTag(el) {
  if (el.classList.contains('selected')) {
    el.classList.remove('selected');
    el.classList.add('filled');
  } else if (el.classList.contains('filled')) {
    el.classList.remove('filled');
    el.classList.add('outline');
  } else {
    el.classList.remove('outline');
    el.classList.add('selected');
  }
  selectedTags = [];
  document.querySelectorAll('#record-tags .chip.selected').forEach(c => {
    selectedTags.push(c.textContent.trim());
  });
}

function showCustomTagInput() {
  // 检查标签数量
  const tags = document.querySelectorAll('#record-tags .chip:not(#add-tag-btn)');
  if (tags.length >= 5) {
    showToast('最多5个标签');
    return;
  }
  document.getElementById('add-tag-btn').style.display = 'none';
  const input = document.getElementById('custom-tag-input');
  input.style.display = 'inline-block';
  input.value = '';
  input.focus();
}

function hideCustomTagInput() {
  document.getElementById('custom-tag-input').style.display = 'none';
  document.getElementById('add-tag-btn').style.display = 'inline-flex';
}

function addCustomTag() {
  const input = document.getElementById('custom-tag-input');
  const value = input.value.trim();
  if (!value) {
    hideCustomTagInput();
    return;
  }
  if (value.length > 10) {
    showToast('标签最多10个字');
    return;
  }
  // 检查是否已存在
  const existing = Array.from(document.querySelectorAll('#record-tags .chip')).map(c => c.textContent.trim());
  if (existing.includes(value)) {
    showToast('标签已存在');
    return;
  }
  // 检查数量
  const tags = document.querySelectorAll('#record-tags .chip:not(#add-tag-btn)');
  if (tags.length >= 5) {
    showToast('最多5个标签');
    hideCustomTagInput();
    return;
  }
  // 添加到选中标签
  if (!selectedTags.includes(value)) {
    selectedTags.push(value);
  }
  // 创建chip元素
  const container = document.getElementById('record-tags');
  const chip = document.createElement('button');
  chip.className = 'chip selected';
  chip.textContent = value;
  chip.onclick = function() {
    const idx = selectedTags.indexOf(value);
    if (idx > -1) selectedTags.splice(idx, 1);
    chip.remove();
    if (selectedTags.length < 5) {
      document.getElementById('add-tag-btn').style.display = 'inline-flex';
    }
  };
  container.insertBefore(chip, document.getElementById('add-tag-btn'));
  hideCustomTagInput();
}

/* ===== 文件选择 ===== */
function initFileInput() {
  const fileInput = document.getElementById('file-input');
  const cameraImg = document.getElementById('camera-img');
  if (fileInput) {
    fileInput.addEventListener('change', function() {
      const file = this.files && this.files[0];
      if (file && cameraImg) {
        cameraImg.src = URL.createObjectURL(file);
        const badge = document.getElementById('recognize-badge');
        if (badge) badge.style.display = 'none';
        const thumb = document.getElementById('dish-thumbnail');
        if (thumb) thumb.src = URL.createObjectURL(file);
        // Reset beautify & nutrition state
        currentBeautifiedUrl = null;
        currentOriginalUrl = null;
        selectedImageVersion = 'original';
        const switcher = document.getElementById('image-version-switcher');
        if (switcher) switcher.style.display = 'none';
        renderNutrition(null);
      }
    });
  }
}

/* ===== 初始化 ===== */
function initInteractions() {
  document.querySelectorAll('#home-chips .chip').forEach(chip => {
    chip.addEventListener('click', function() {
      document.querySelectorAll('#home-chips .chip').forEach(c => c.classList.remove('selected'));
      this.classList.add('selected');
      filterFood(this.dataset.filter);
    });
  });

  document.querySelectorAll('#recipe-tabs .tab-item').forEach(tab => {
    tab.addEventListener('click', function() {
      document.querySelectorAll('#recipe-tabs .tab-item').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      const visibility = this.dataset.visibility;
      if (visibility !== undefined) {
        filterRecipesByVisibility(visibility);
      } else {
        filterRecipes(this.dataset.tab);
      }
    });
  });

  document.querySelectorAll('#family-view-tabs .tab-item').forEach(tab => {
    tab.addEventListener('click', function() {
      switchFamilyTab(this.dataset.view);
    });
  });

  initRatingStars();
  initFileInput();

  const homeSearch = document.getElementById('home-search');
  if (homeSearch) {
    homeSearch.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        searchHomeRecords(this.value);
      }
    });
  }
  const familySearch = document.getElementById('family-search');
  if (familySearch) {
    familySearch.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        searchFamilyRecipes(this.value);
      }
    });
  }

  document.addEventListener('click', function(e) {
    const recCard = e.target.closest('.recommend-card');
    if (recCard) {
      const idx = parseInt(recCard.dataset.idx, 10);
      const item = currentRecommendations[idx];
      if (item) showRecommendDetail(item);
      return;
    }
    const card = e.target.closest('.food-card');
    if (card && !e.target.closest('.chip') && !e.target.closest('.star') && !e.target.closest('.add-menu-btn') && !e.target.closest('.visibility-btn')) {
      const title = card.querySelector('.card-title');
      if (title) showToast('查看：' + title.textContent);
    }
  });

  const shoppingModal = document.getElementById('shopping-modal');
  if (shoppingModal) {
    shoppingModal.addEventListener('click', function(e) {
      if (e.target === this) closeShoppingModal();
    });
  }
}

/* ===== 登录/注册 ===== */
let isLoginMode = true;

function showLoginPage() {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const loginPage = document.getElementById('page-login');
  if (loginPage) loginPage.classList.add('active');
  const nav = document.querySelector('.bottom-nav');
  if (nav) nav.style.display = 'none';
  const sidebar = document.querySelector('.desktop-sidebar');
  if (sidebar) sidebar.style.display = 'none';
  lucide.createIcons();
}

function hideLoginPage() {
  const nav = document.querySelector('.bottom-nav');
  if (nav) nav.style.display = '';
  const sidebar = document.querySelector('.desktop-sidebar');
  if (sidebar) sidebar.style.display = '';
  navigateTo('home');
}

function switchAuthMode(mode) {
  isLoginMode = mode === 'login';
  const loginTitle = document.getElementById('auth-title');
  const loginSubtitle = document.getElementById('auth-subtitle');
  const nicknameField = document.getElementById('auth-nickname-field');
  const submitBtn = document.getElementById('auth-submit');
  const switchText = document.getElementById('auth-switch-text');

  if (isLoginMode) {
    loginTitle.textContent = '欢迎回来';
    loginSubtitle.textContent = '登录味记，记录美食时光';
    if (nicknameField) nicknameField.style.display = 'none';
    submitBtn.textContent = '登录';
    switchText.innerHTML = '还没有账号？<span style="color:var(--color-primary);cursor:pointer;" onclick="switchAuthMode(\'register\')">立即注册</span>';
  } else {
    loginTitle.textContent = '创建账号';
    loginSubtitle.textContent = '加入味记，开启美食记录之旅';
    if (nicknameField) nicknameField.style.display = '';
    submitBtn.textContent = '注册';
    switchText.innerHTML = '已有账号？<span style="color:var(--color-primary);cursor:pointer;" onclick="switchAuthMode(\'login\')">去登录</span>';
  }
}

async function handleAuthSubmit() {
  const username = document.getElementById('auth-username').value.trim();
  const password = document.getElementById('auth-password').value;
  const nickname = document.getElementById('auth-nickname') ? document.getElementById('auth-nickname').value.trim() : '';

  if (!username || !password) {
    showToast('请输入用户名和密码');
    return;
  }

  const btn = document.getElementById('auth-submit');
  if (btn) { btn.disabled = true; btn.textContent = isLoginMode ? '登录中...' : '注册中...'; }

  try {
    if (isLoginMode) {
      await api.login(username, password);
      showToast('登录成功！');
    } else {
      await api.register(username, password, nickname);
      showToast('注册成功！');
    }
    hideLoginPage();
  } catch (err) {
    showToast(err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = isLoginMode ? '登录' : '注册'; }
  }
}

async function handleLogout() {
  try {
    await api.logout();
  } catch (e) {}
  showToast('已退出登录');
  showLoginPage();
}

function init() {
  if (typeof lucide !== 'undefined') lucide.createIcons();
  initInteractions();

  if (!api.isLoggedIn()) {
    showLoginPage();
  } else {
    loadHomeData();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

/* ===== 趣味玩法（F27-F30） ===== */
function navigateToGameplay(view) {
  ['pokedex', 'personality', 'timemachine', 'blindguess'].forEach(v => {
    const el = document.getElementById('gameplay-view-' + v);
    if (el) el.style.display = 'none';
  });
  const target = document.getElementById('gameplay-view-' + view);
  if (target) target.style.display = 'block';
  if (view === 'pokedex') loadPokedex();
  else if (view === 'personality') loadPersonality();
  else if (view === 'timemachine') loadTimemachine();
  else if (view === 'blindguess') loadBlindguess();
  lucide.createIcons();
  window.scrollTo(0, 0);
}

function loadGameplayEntry() {
  navigateToGameplay('pokedex');
}

async function loadPokedex() {
  const summaryEl = document.getElementById('pokedex-summary');
  const categoriesEl = document.getElementById('pokedex-categories');
  if (summaryEl) summaryEl.innerHTML = '<div class="caption">加载中...</div>';
  if (categoriesEl) categoriesEl.innerHTML = '';
  try {
    const data = await api.getPokedex();
    renderPokedex(data);
  } catch (err) {
    if (summaryEl) summaryEl.innerHTML = '<div class="caption">' + escapeHTML(err.message) + '</div>';
  }
}

function renderPokedex(data) {
  const summaryEl = document.getElementById('pokedex-summary');
  const categoriesEl = document.getElementById('pokedex-categories');
  const rate = Math.round((data.completionRate || 0) * 100);
  if (summaryEl) {
    summaryEl.innerHTML =
      '<div class="pokedex-progress">' +
        '<span class="pokedex-progress-num">' + (data.unlockedSlots || 0) + '/' + (data.totalSlots || 0) + '</span>' +
        '<span class="pokedex-progress-text">已点亮 ' + rate + '%</span>' +
      '</div>' +
      '<div class="pokedex-progress-bar"><div class="pokedex-progress-fill" style="width:' + rate + '%;"></div></div>';
  }
  if (categoriesEl) {
    if (!data.categories || !data.categories.length) {
      categoriesEl.innerHTML = '<div class="caption" style="padding: var(--space-4); text-align:center;">开始记录第一道菜来点亮图鉴</div>';
      return;
    }
    categoriesEl.innerHTML = data.categories.map(cat => {
      const cells = (cat.items || []).map(item => renderPokedexCell(item)).join('');
      const catRate = cat.totalSlots ? Math.round((cat.unlockedSlots / cat.totalSlots) * 100) : 0;
      return '<div class="pokedex-category">' +
        '<div class="pokedex-category-title">' +
          '<span>' + escapeHTML(cat.category) + '</span>' +
          '<span class="caption">' + cat.unlockedSlots + '/' + cat.totalSlots + ' · ' + catRate + '%</span>' +
        '</div>' +
        '<div class="pokedex-grid">' + cells + '</div>' +
      '</div>';
    }).join('');
  }
  lucide.createIcons();
}

function renderPokedexCell(item) {
  const rarityLabel = { common: '', rare: '·稀有', epic: '·史诗', legendary: '·传说' };
  if (item.unlocked) {
    return '<div class="pokedex-cell unlocked rarity-' + item.rarity + '">' +
      '<div class="pokedex-cell-icon">' + rarityEmoji(item.rarity) + '</div>' +
      '<div class="pokedex-cell-name">' + escapeHTML(item.dishName) + '</div>' +
      '<div class="pokedex-cell-count">×' + (item.recordCount || 0) + '</div>' +
    '</div>';
  }
  return '<div class="pokedex-cell locked">' +
    '<div class="pokedex-cell-icon">🔒</div>' +
    '<div class="pokedex-cell-name">未点亮</div>' +
  '</div>';
}

function rarityEmoji(rarity) {
  return { common: '🍽️', rare: '⭐', epic: '💎', legendary: '👑' }[rarity] || '🍽️';
}

async function loadPersonality() {
  const el = document.getElementById('gameplay-view-personality');
  if (!el) return;
  el.innerHTML = '<div class="padding-x" style="padding-top: var(--space-4);"><div class="caption">生成中...</div></div>';
  try {
    const data = await api.getPersonality();
    renderPersonality(data);
  } catch (err) {
    el.innerHTML = '<div class="padding-x" style="padding-top: var(--space-4);"><div class="caption">' + escapeHTML(err.message) + '</div></div>';
  }
}

function renderPersonality(data) {
  const el = document.getElementById('gameplay-view-personality');
  if (!el) return;
  if (!data.available) {
    el.innerHTML = '<div class="padding-x" style="padding-top: var(--space-4);">' +
      '<div class="card-white" style="text-align:center; padding: var(--space-6);">' +
        '<div style="font-size: 36px; margin-bottom: var(--space-2);">🍽️</div>' +
        '<div style="color: var(--color-on-surface-variant);">' + escapeHTML(data.description) + '</div>' +
        '<div class="caption" style="margin-top: var(--space-2);">当前记录数：' + data.recordCount + ' / 3</div>' +
      '</div>' +
    '</div>';
    return;
  }
  const traits = (data.traits || []).map(t => '<span class="personality-tag">' + escapeHTML(t) + '</span>').join('');
  el.innerHTML = '<div class="padding-x" style="padding-top: var(--space-4);">' +
    '<div class="card-white personality-card">' +
      '<div style="font-size: 40px; margin-bottom: var(--space-2);">🎯</div>' +
      '<div class="personality-type">' + escapeHTML(data.personalityType) + '</div>' +
      '<div class="personality-desc">' + escapeHTML(data.description) + '</div>' +
      '<div class="personality-traits">' + traits + '</div>' +
      '<div style="background: var(--primary-50); padding: var(--space-3); border-radius: 10px; margin-bottom: var(--space-3); text-align: left;">' +
        '<div class="caption" style="margin-bottom: 4px;">分享文案</div>' +
        '<div style="font-size: var(--font-size-caption); color: var(--color-on-surface); line-height: 1.5;">' + escapeHTML(data.shareText) + '</div>' +
      '</div>' +
      '<button class="btn btn-primary" onclick="copyPersonalityShareText(' + JSON.stringify(JSON.stringify(data.shareText)) + ')">' +
        '<i data-lucide="copy" style="width:16px;height:16px;margin-right:4px;"></i>复制分享文案' +
      '</button>' +
    '</div>' +
  '</div>';
  lucide.createIcons();
}

function copyPersonalityShareText(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => showToast('已复制分享文案'));
  } else {
    showToast('当前浏览器不支持复制');
  }
}

async function loadTimemachine() {
  const el = document.getElementById('gameplay-view-timemachine');
  if (!el) return;
  el.innerHTML = '<div class="timemachine-empty">寻找记忆中...</div>';
  try {
    const data = await api.getTimemachine();
    renderTimemachine(data);
  } catch (err) {
    el.innerHTML = '<div class="timemachine-empty">' + escapeHTML(err.message) + '</div>';
  }
}

function renderTimemachine(data) {
  const el = document.getElementById('gameplay-view-timemachine');
  if (!el) return;
  const memories = data.memories || [];
  if (!memories.length) {
    el.innerHTML = '<div class="timemachine-empty">' +
      '<div style="font-size: 36px; margin-bottom: var(--space-2);">🕰️</div>' +
      '暂无往年今日回忆，再记录一年就有啦' +
    '</div>';
    return;
  }
  el.innerHTML = memories.map(mem => {
    const records = (mem.records || []).map(r =>
      '<div class="timemachine-record">' +
        '<img src="' + escapeAttr(r.imageUrl || r.beautifiedUrl || '') + '" alt="" onerror="this.style.visibility=\'hidden\'">' +
        '<div class="timemachine-record-name">' + escapeHTML(r.dishName) + '</div>' +
      '</div>'
    ).join('');
    return '<div class="timemachine-card">' +
      '<div class="timemachine-year">' + mem.year + ' 年</div>' +
      '<div class="timemachine-caption">' + escapeHTML(mem.caption) + '</div>' +
      '<div class="timemachine-records">' + records + '</div>' +
    '</div>';
  }).join('');
  lucide.createIcons();
}

let currentBlindGuessFamilyId = null;
async function loadBlindguess() {
  const el = document.getElementById('gameplay-view-blindguess');
  if (!el) return;
  el.innerHTML = '<div class="blindguess-section"><div class="caption">加载中...</div></div>';
  try {
    const familyInfo = await api.getFamilyInfo();
    currentBlindGuessFamilyId = familyInfo && familyInfo.id;
    const recipes = await api.getFamilyRecipes();
    renderBlindguess(recipes || []);
  } catch (err) {
    el.innerHTML = '<div class="blindguess-section"><div class="caption">' + escapeHTML(err.message) + '</div></div>';
  }
}

let blindGuessSelectedRecipes = new Set();
function renderBlindguess(recipes) {
  const el = document.getElementById('gameplay-view-blindguess');
  if (!el) return;
  const selectable = recipes.filter(r => !r.isDeleted);
  blindGuessSelectedRecipes = new Set();
  const recipeCheckboxes = selectable.map(r =>
    '<label style="display:flex;align-items:center;gap:var(--space-2);padding:var(--space-2);background:var(--color-surface);border-radius:8px;">' +
      '<input type="checkbox" value="' + escapeAttr(r.id) + '" onchange="toggleBlindGuessRecipe(\'' + escapeAttr(r.id) + '\', this.checked)">' +
      '<span style="flex:1;">' + escapeHTML(r.name) + '</span>' +
      '<span class="caption">' + escapeHTML(r.difficulty || '') + '</span>' +
    '</label>'
  ).join('');
  el.innerHTML = '<div class="blindguess-section">' +
    '<div class="section-title">发起一轮盲猜</div>' +
    '<div class="blindguess-form">' +
      '<input class="blindguess-input" id="blindguess-round-name" placeholder="轮次名称（如：本周家庭盲猜）">' +
      '<div style="max-height:200px;overflow-y:auto;display:flex;flex-direction:column;gap:var(--space-1);">' + recipeCheckboxes + '</div>' +
      '<button class="btn btn-primary" onclick="createBlindGuessRound()">' +
        '<i data-lucide="plus" style="width:16px;height:16px;margin-right:4px;"></i>发起盲猜（需选 3-10 道）' +
      '</button>' +
    '</div>' +
    '<div id="blindguess-rounds-list"></div>' +
  '</div>';
  lucide.createIcons();
  loadBlindGuessRounds();
}

function toggleBlindGuessRecipe(recipeId, checked) {
  if (checked) blindGuessSelectedRecipes.add(recipeId);
  else blindGuessSelectedRecipes.delete(recipeId);
}

async function createBlindGuessRound() {
  const name = (document.getElementById('blindguess-round-name') || {}).value || '';
  const ids = Array.from(blindGuessSelectedRecipes);
  if (!name.trim()) { showToast('请输入轮次名称'); return; }
  if (ids.length < 3 || ids.length > 10) { showToast('请选择 3-10 道菜谱'); return; }
  if (!currentBlindGuessFamilyId) { showToast('未找到家庭组'); return; }
  try {
    await api.createBlindGuessRound({ familyId: currentBlindGuessFamilyId, roundName: name.trim(), recordIds: ids });
    showToast('盲猜轮次已发起');
    document.getElementById('blindguess-round-name').value = '';
    document.querySelectorAll('#gameplay-view-blindguess input[type=checkbox]').forEach(c => c.checked = false);
    blindGuessSelectedRecipes = new Set();
    loadBlindGuessRounds();
  } catch (err) {
    showToast(err.message);
  }
}

async function loadBlindGuessRounds() {
  const listEl = document.getElementById('blindguess-rounds-list');
  if (!listEl) return;
  const roundIds = JSON.parse(localStorage.getItem('blindguess_rounds') || '[]');
  if (!roundIds.length) {
    listEl.innerHTML = '<div class="caption" style="text-align:center;padding:var(--space-4);">还没有发起过盲猜轮次</div>';
    return;
  }
  const rounds = await Promise.all(roundIds.map(id => api.getBlindGuessRound(id).catch(() => null)));
  listEl.innerHTML = rounds.filter(Boolean).map(r => renderBlindGuessRoundCard(r)).join('');
  lucide.createIcons();
}

function renderBlindGuessRoundCard(round) {
  const statusTag = round.status === 'revealed'
    ? '<span class="chip filled" style="background: var(--success-100); color: var(--success-700);">已揭晓</span>'
    : '<span class="chip filled" style="background: var(--warning-100); color: var(--warning-700);">进行中</span>';
  return '<div class="blindguess-round-card">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-2);">' +
      '<span style="font-weight:600;">' + escapeHTML(round.roundName) + '</span>' +
      statusTag +
    '</div>' +
    '<div class="caption" style="margin-bottom:var(--space-2);">' + (round.items || []).length + ' 道菜 · ' + (round.guesses || []).length + ' 次猜测</div>' +
    '<button class="btn btn-outline btn-sm" onclick="showBlindGuessDetail(\'' + escapeAttr(round.id) + '\')">查看详情</button>' +
  '</div>';
}

async function showBlindGuessDetail(roundId) {
  const ids = JSON.parse(localStorage.getItem('blindguess_rounds') || '[]');
  if (!ids.includes(roundId)) {
    ids.unshift(roundId);
    localStorage.setItem('blindguess_rounds', JSON.stringify(ids.slice(0, 20)));
  }
  try {
    const round = await api.getBlindGuessRound(roundId);
    const items = (round.items || []).map(item => {
      return '<div class="blindguess-item-card">' +
        '<img src="' + escapeAttr(item.coverUrl || '') + '" alt="" onerror="this.style.visibility=\'hidden\'">' +
        '<div style="flex:1;">' +
          '<div style="font-weight:600;">' + escapeHTML(item.dishName) + '</div>' +
          (round.status === 'revealed' ? '<div class="caption">作者：' + escapeHTML(item.realAuthorName || '') + '</div>' : '<div class="caption">作者：???（待揭晓）</div>') +
        '</div>' +
      '</div>';
    }).join('');
    const actionBtn = round.status === 'active'
      ? '<button class="btn btn-primary" onclick="revealBlindGuess(\'' + escapeAttr(round.id) + '\')">揭晓结果</button>'
      : '';
    const guessForm = round.status === 'active'
      ? '<div style="margin-top:var(--space-3);"><div class="caption" style="margin-bottom:var(--space-1);">提交一次猜测（选一道菜）</div>' +
        '<div class="blindguess-form">' +
          '<input class="blindguess-input" id="blindguess-dish-input" placeholder="你猜的菜名">' +
          '<button class="btn btn-outline btn-sm" onclick="submitBlindGuessForm(\'' + escapeAttr(round.id) + '\')">提交猜测</button>' +
        '</div></div>'
      : '';
    const ranking = round.status === 'revealed' ? renderBlindGuessRanking(round) : '';
    const html = '<div class="blindguess-section">' +
      '<button class="btn btn-ghost btn-sm" onclick="loadBlindguess()" style="margin-bottom:var(--space-2);">← 返回</button>' +
      '<div class="blindguess-round-card">' +
        '<div style="font-weight:600;margin-bottom:var(--space-2);">' + escapeHTML(round.roundName) + '</div>' +
        items +
        guessForm +
        ranking +
        '<div style="margin-top:var(--space-3);">' + actionBtn + '</div>' +
      '</div>' +
    '</div>';
    document.getElementById('gameplay-view-blindguess').innerHTML = html;
    lucide.createIcons();
  } catch (err) {
    showToast(err.message);
  }
}

function renderBlindGuessRanking(round) {
  const cached = sessionStorage.getItem('blindguess_result_' + round.id);
  if (!cached) return '<div class="caption" style="margin-top:var(--space-2);">已揭晓</div>';
  try {
    const result = JSON.parse(cached);
    const ranking = (result.ranking || []).map(r =>
      '<div style="display:flex;justify-content:space-between;padding:var(--space-2);border-bottom:1px solid var(--color-outline, #eee);">' +
        '<span>' + (r.isChef ? '👑 ' : '') + escapeHTML(r.userNickname) + '</span>' +
        '<span class="caption">得分 ' + r.totalScore + ' · 命中 ' + r.correctCount + '</span>' +
      '</div>'
    ).join('');
    return '<div style="margin-top:var(--space-3);"><div class="section-title">排名</div>' + ranking + '</div>';
  } catch {
    return '';
  }
}

async function submitBlindGuessForm(roundId) {
  const dishInput = document.getElementById('blindguess-dish-input');
  if (!dishInput || !dishInput.value.trim()) { showToast('请输入菜名'); return; }
  try {
    const round = await api.getBlindGuessRound(roundId);
    const firstItem = (round.items || [])[0];
    if (!firstItem) { showToast('轮次无菜品'); return; }
    await api.submitBlindGuess(roundId, {
      itemId: firstItem.recordId,
      guessAuthorId: '',
      guessDishName: dishInput.value.trim()
    });
    showToast('猜测已提交');
    showBlindGuessDetail(roundId);
  } catch (err) {
    showToast(err.message);
  }
}

async function revealBlindGuess(roundId) {
  try {
    const result = await api.revealBlindGuessRound(roundId);
    sessionStorage.setItem('blindguess_result_' + roundId, JSON.stringify(result));
    showToast('已揭晓，' + (result.chefWinner ? result.chefWinner.userNickname + ' 获得本周厨神！' : '无人得分'));
    showBlindGuessDetail(roundId);
  } catch (err) {
    showToast(err.message);
  }
}

/* ===== F11 语音交互 ===== */
let mediaRecorder = null;
let voiceChunks = [];
let voiceStream = null;
let voiceTimer = null;
let voiceStartTime = 0;

async function startVoiceRecording() {
  // 检查浏览器支持
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') {
    showToast('当前浏览器不支持语音录制，请使用文字输入');
    return;
  }
  try {
    voiceStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    if (err && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
      showToast('麦克风权限被拒绝，请使用文字输入');
    } else {
      showToast('无法访问麦克风：' + (err.message || '未知错误'));
    }
    return;
  }
  voiceChunks = [];
  // 优先使用 audio/webm，回退到默认
  let mimeType = 'audio/webm';
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = '';
  }
  mediaRecorder = mimeType ? new MediaRecorder(voiceStream, { mimeType }) : new MediaRecorder(voiceStream);
  mediaRecorder.ondataavailable = function(e) {
    if (e.data && e.data.size > 0) voiceChunks.push(e.data);
  };
  mediaRecorder.onstop = function() {
    handleVoiceStop();
  };
  mediaRecorder.start();
  voiceStartTime = Date.now();
  // 显示录音指示器
  const indicator = document.getElementById('voice-recording-indicator');
  if (indicator) indicator.style.display = 'flex';
  // 30秒自动停止
  voiceTimer = setTimeout(function() {
    stopVoiceRecording();
  }, 30000);
}

function stopVoiceRecording() {
  if (voiceTimer) { clearTimeout(voiceTimer); voiceTimer = null; }
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
  if (voiceStream) {
    voiceStream.getTracks().forEach(function(t) { t.stop(); });
    voiceStream = null;
  }
  const indicator = document.getElementById('voice-recording-indicator');
  if (indicator) indicator.style.display = 'none';
}

async function handleVoiceStop() {
  if (!voiceChunks || voiceChunks.length === 0) {
    showToast('未录制到音频，请重试');
    return;
  }
  const blob = new Blob(voiceChunks, { type: 'audio/webm' });
  const file = new File([blob], 'voice.webm', { type: 'audio/webm' });
  showToast('正在识别...');
  try {
    const result = await api.recognizeVoice(file);
    const text = (result && result.text) || '';
    const intent = (result && result.intent) || 'unknown';
    if (!text) {
      showToast('未能识别您的语音，请尝试文字输入');
      return;
    }
    handleVoiceResult(text, intent);
  } catch (err) {
    showToast('语音识别失败：' + (err.message || '请重试'));
  }
}

function handleVoiceResult(text, intent) {
  // 显示识别文本（Toast）
  showToast('识别到：' + text);
  // 按意图分流
  if (intent === 'what_to_cook') {
    // 跳转到首页并触发推荐
    navigateTo('home');
    setTimeout(function() {
      // 触发推荐刷新
      loadHomeData();
      showToast('为你推荐今天可以做的菜');
    }, 200);
  } else if (intent === 'search_recipe') {
    // 弹出搜索结果（简单实现：弹出 alert 或在家庭菜谱页过滤）
    // 找到家庭菜谱并按菜名过滤
    navigateTo('family');
    setTimeout(function() {
      try {
        const grid = document.getElementById('recipe-grid');
        if (grid) {
          const cards = grid.querySelectorAll('.food-card, .recipe-card');
          let matched = 0;
          cards.forEach(function(card) {
            const title = card.querySelector('.card-title');
            if (title && title.textContent.indexOf(text) >= 0) {
              card.style.display = '';
              matched++;
            } else if (title) {
              card.style.display = 'none';
            }
          });
          showToast('找到 ' + matched + ' 道相关菜谱');
        }
      } catch (e) {}
    }, 500);
  } else if (intent === 'cooking_step') {
    showRecipeStepsByKeyword(text);
  } else {
    // unknown，仅显示文本
  }
}

/* ===== F15 购物清单自动生成 ===== */
async function handleGenerateShopping() {
  // 二次确认
  const confirmed = confirm('将根据本周菜单自动生成购物清单，已存在条目会跳过，是否继续？');
  if (!confirmed) return;
  try {
    showToast('正在生成...');
    const result = await api.generateShoppingFromMenu();
    const added = (result && result.added) || 0;
    const skipped = (result && result.skipped) || 0;
    const message = result && result.message;
    if (message) {
      showToast(message);
    } else {
      showToast('已生成 ' + added + ' 条，跳过 ' + skipped + ' 条已存在');
    }
    // 刷新购物清单
    loadShoppingList();
  } catch (err) {
    showToast('生成失败：' + (err.message || '请重试'));
  }
}

/* ===== F17 家庭饮食报告 ===== */
async function loadFamilyReport(month) {
  const container = document.getElementById('family-report-content');
  if (!container) return;
  container.innerHTML = '<div style="padding:var(--space-6);text-align:center;color:var(--color-on-surface-variant);">加载中...</div>';
  try {
    const report = await api.getFamilyReport(month);
    renderFamilyReport(report || {});
  } catch (err) {
    container.innerHTML = '<div style="padding:var(--space-6);text-align:center;color:var(--color-error);">' + escapeHTML(err.message || '加载失败') + '</div>';
  }
}

function renderFamilyReport(report) {
  const container = document.getElementById('family-report-content');
  if (!container) return;
  const total = report.totalRecords || 0;
  if (total === 0) {
    container.innerHTML =
      '<div style="padding:var(--space-8);text-align:center;">' +
        '<div style="font-size:14px;color:var(--color-on-surface-variant);margin-bottom:12px;">本月暂无记录，去记录第一餐吧</div>' +
        '<button class="btn btn-primary btn-sm" onclick="navigateTo(\'home\')">去记录</button>' +
      '</div>';
    return;
  }
  const prev = report.prevMonthRecords || 0;
  const diff = total - prev;
  const diffText = diff > 0 ? ('↑' + diff) : (diff < 0 ? ('↓' + Math.abs(diff)) : '持平');
  const diffColor = diff > 0 ? 'var(--success-600)' : (diff < 0 ? 'var(--error)' : 'var(--color-on-surface-variant)');

  // 贡献榜
  const contribs = report.memberContributions || [];
  const contribHTML = contribs.slice(0, 5).map(function(c, idx) {
    return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;">' +
      '<span style="width:24px;height:24px;border-radius:50%;background:var(--primary-100);color:var(--primary-700);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;">' + (idx + 1) + '</span>' +
      '<img src="' + escapeAttr(c.userAvatar || '') + '" style="width:32px;height:32px;border-radius:50%;" />' +
      '<span style="flex:1;font-size:14px;">' + escapeHTML(c.userNickname || '匿名') + '</span>' +
      '<span style="font-size:14px;color:var(--color-on-surface-variant);">' + (c.recordCount || 0) + ' 条</span>' +
    '</div>';
  }).join('');

  // Top5 菜品
  const topDishes = report.topDishes || [];
  const topHTML = topDishes.map(function(d, idx) {
    return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--color-outline);">' +
      '<span style="width:24px;height:24px;border-radius:50%;background:var(--accent-50);color:var(--accent-700);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;">' + (idx + 1) + '</span>' +
      '<span style="flex:1;font-size:14px;">' + escapeHTML(d.dishName || '') + '</span>' +
      '<span style="font-size:12px;color:var(--color-on-surface-variant);">' + (d.count || 0) + ' 次</span>' +
      '<span style="font-size:12px;color:var(--accent);">★ ' + (d.avgRating || 0).toFixed(1) + '</span>' +
    '</div>';
  }).join('');

  // 标签云
  const tags = report.tagDistribution || [];
  const tagHTML = tags.map(function(t) {
    const fontSize = Math.min(20, Math.max(12, 12 + (t.count || 0) * 2));
    return '<span style="display:inline-block;padding:4px 10px;margin:4px;background:var(--primary-50);color:var(--primary-700);border-radius:12px;font-size:' + fontSize + 'px;">' + escapeHTML(t.tag || '') + ' (' + (t.count || 0) + ')</span>';
  }).join('');

  container.innerHTML =
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:16px;">' +
      '<div class="report-card" style="background:var(--color-surface);border:1px solid var(--color-outline);border-radius:12px;padding:16px;">' +
        '<div style="font-size:12px;color:var(--color-on-surface-variant);margin-bottom:6px;">本月记录</div>' +
        '<div style="font-size:28px;font-weight:600;color:var(--primary-700);">' + total + '</div>' +
        '<div style="font-size:12px;color:' + diffColor + ';margin-top:4px;">环比 ' + diffText + '</div>' +
      '</div>' +
      '<div class="report-card" style="background:var(--color-surface);border:1px solid var(--color-outline);border-radius:12px;padding:16px;">' +
        '<div style="font-size:12px;color:var(--color-on-surface-variant);margin-bottom:6px;">平均评分</div>' +
        '<div style="font-size:28px;font-weight:600;color:var(--accent);">★ ' + (report.avgRating || 0).toFixed(1) + '</div>' +
        '<div style="font-size:12px;color:var(--color-on-surface-variant);margin-top:4px;">满分 5.0</div>' +
      '</div>' +
      '<div class="report-card" style="background:var(--color-surface);border:1px solid var(--color-outline);border-radius:12px;padding:16px;">' +
        '<div style="font-size:12px;color:var(--color-on-surface-variant);margin-bottom:6px;">活跃成员</div>' +
        '<div style="font-size:28px;font-weight:600;color:var(--success-600);">' + contribs.length + '</div>' +
        '<div style="font-size:12px;color:var(--color-on-surface-variant);margin-top:4px;">参与记录</div>' +
      '</div>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">' +
      '<div style="background:var(--color-surface);border:1px solid var(--color-outline);border-radius:12px;padding:16px;">' +
        '<div style="font-size:14px;font-weight:600;margin-bottom:8px;">🏆 贡献榜</div>' +
        (contribHTML || '<div style="padding:12px;color:var(--color-on-surface-variant);text-align:center;font-size:13px;">暂无数据</div>') +
      '</div>' +
      '<div style="background:var(--color-surface);border:1px solid var(--color-outline);border-radius:12px;padding:16px;">' +
        '<div style="font-size:14px;font-weight:600;margin-bottom:8px;">🍽️ 高频菜品 Top 5</div>' +
        (topHTML || '<div style="padding:12px;color:var(--color-on-surface-variant);text-align:center;font-size:13px;">暂无数据</div>') +
      '</div>' +
    '</div>' +
    '<div style="background:var(--color-surface);border:1px solid var(--color-outline);border-radius:12px;padding:16px;">' +
      '<div style="font-size:14px;font-weight:600;margin-bottom:8px;">🏷️ 标签云</div>' +
      (tagHTML || '<div style="padding:12px;color:var(--color-on-surface-variant);text-align:center;font-size:13px;">暂无标签</div>') +
    '</div>';
}

function changeReportMonth() {
  const input = document.getElementById('report-month-input');
  if (!input || !input.value) return;
  loadFamilyReport(input.value);
}
