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
    const [recordsRes, checkin, recommendations] = await Promise.all([
      api.getRecords(),
      api.getCheckinStatus(),
      api.getRecommendations().catch(() => null)
    ]);
    renderRecords((recordsRes && recordsRes.list) || []);
    renderCheckin(checkin);
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
    renderChallenges(CHALLENGES);
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
  if (text) text.textContent = '已坚持 ' + data.streakDays + ' 天';

  const btn = document.getElementById('checkin-btn');
  if (btn) {
    if (data.checkedInToday) {
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
    const desc = a.description ? a.name + '：' + a.description : a.name;
    return '<div class="badge-item" onclick="showToast(\'' + escapeAttr(desc) + '\')">' +
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

    return '<div class="challenge-card" onclick="showToast(\'' + escapeAttr(c.name) + '挑战\')">' +
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

/* ===== 交互函数 ===== */
async function doCheckin() {
  const btn = document.getElementById('checkin-btn');
  if (btn) { btn.disabled = true; }
  try {
    await api.doCheckin();
    showToast('打卡成功！🔥');
    const status = await api.getCheckinStatus();
    renderCheckin(status);
  } catch (err) {
    showToast(err.message);
    if (btn) { btn.disabled = false; }
  }
}

async function startRecognize() {
  const fileInput = document.getElementById('file-input');
  const file = fileInput && fileInput.files && fileInput.files[0];
  if (!file) {
    showToast('请先选择照片');
    return;
  }
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
    await api.saveRecord(data);
    showToast('"' + dishName + '" 保存成功！去看看图鉴有没有新点亮');
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
  } else {
    if (recipeView) recipeView.style.display = '';
    if (weeklyView) weeklyView.style.display = 'none';
    if (shoppingSection) shoppingSection.style.display = 'none';
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
        showToast('搜索：' + this.value);
      }
    });
  }
  const familySearch = document.getElementById('family-search');
  if (familySearch) {
    familySearch.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        showToast('搜索：' + this.value);
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
  // 比对上次已点亮集合，找出本次新点亮的格子以播放动效
  const prevUnlocked = JSON.parse(localStorage.getItem('pokedex_unlocked') || '[]');
  const prevSet = new Set(prevUnlocked);
  const justUnlockedSet = new Set();
  const currentUnlocked = [];
  (data.categories || []).forEach(cat => {
    (cat.items || []).forEach(item => {
      if (item.unlocked && item.dishName) {
        currentUnlocked.push(item.dishName);
        if (!prevSet.has(item.dishName)) justUnlockedSet.add(item.dishName);
      }
    });
  });
  localStorage.setItem('pokedex_unlocked', JSON.stringify(currentUnlocked));

  if (categoriesEl) {
    // 空状态：以 unlockedSlots 判断（原代码误用 categories 判断，恒非空导致不可达）
    if (!data.unlockedSlots) {
      categoriesEl.innerHTML = '<div class="caption" style="padding: var(--space-4); text-align:center;">开始记录第一道菜来点亮图鉴</div>' +
        '<div style="text-align:center;margin-top:var(--space-2);">' +
          '<button class="btn btn-primary btn-sm" onclick="navigateTo(\'home\')">去记录 →</button>' +
        '</div>';
      return;
    }
    categoriesEl.innerHTML = data.categories.map(cat => {
      const cells = (cat.items || []).map(item => renderPokedexCell(item, justUnlockedSet)).join('');
      const catRate = cat.totalSlots ? Math.round((cat.unlockedSlots / cat.totalSlots) * 100) : 0;
      return '<div class="pokedex-category">' +
        '<div class="pokedex-category-title">' +
          '<span>' + escapeHTML(cat.category) + '</span>' +
          '<span class="caption">' + cat.unlockedSlots + '/' + cat.totalSlots + ' · ' + catRate + '%</span>' +
        '</div>' +
        '<div class="pokedex-grid">' + cells + '</div>' +
      '</div>';
    }).join('') +
    '<div style="text-align:center;margin-top:var(--space-4);display:flex;flex-direction:column;gap:var(--space-2);">' +
      '<button class="btn btn-outline btn-sm" onclick="navigateTo(\'home\')">去记录解锁更多 →</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="navigateToGameplay(\'personality\')">想了解你的美食人格？→ 测一测</button>' +
    '</div>';
  }
  lucide.createIcons();
}

function renderPokedexCell(item, justUnlockedSet) {
  const rarityLabel = { common: '', rare: '·稀有', epic: '·史诗', legendary: '·传说' };
  if (item.unlocked) {
    const isNew = !!(justUnlockedSet && justUnlockedSet.has(item.dishName));
    return '<div class="pokedex-cell unlocked rarity-' + item.rarity + (isNew ? ' just-unlocked' : '') + '">' +
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
        '<div style="margin-top:var(--space-3);text-align:center;">' +
          '<button class="btn btn-ghost btn-sm" onclick="navigateToGameplay(\'pokedex\')">想点亮更多美食？→ 图鉴</button>' +
        '</div>' +
      '</div>' +
    '</div>';
    lucide.createIcons();
    return;
  }
  const traits = (data.traits || []).map(t => '<span class="personality-tag">' + escapeHTML(t) + '</span>').join('');
  const personalityType = data.personalityType || '';
  const shareText = data.shareText || '';
  // 供分享按钮使用
  window.__personalityShareData = { type: personalityType, text: shareText };
  const coverHTML = data.coverImage
    ? '<img class="personality-cover" src="' + escapeAttr(data.coverImage) + '" alt="' + escapeAttr(personalityType) + '">'
    : '';
  el.innerHTML = '<div class="padding-x" style="padding-top: var(--space-4);">' +
    '<div class="card-white personality-card">' +
      coverHTML +
      '<div style="font-size: 40px; margin-bottom: var(--space-2);">🎯</div>' +
      '<div class="personality-type">' + escapeHTML(personalityType) + '</div>' +
      '<div class="personality-desc">' + escapeHTML(data.description) + '</div>' +
      '<div class="personality-traits">' + traits + '</div>' +
      '<div style="background: var(--primary-50); padding: var(--space-3); border-radius: 10px; margin-bottom: var(--space-3); text-align: left;">' +
        '<div class="caption" style="margin-bottom: 4px;">分享文案</div>' +
        '<div style="font-size: var(--font-size-caption); color: var(--color-on-surface); line-height: 1.5;">' + escapeHTML(shareText) + '</div>' +
      '</div>' +
      '<div style="display:flex;gap:var(--space-2);justify-content:center;flex-wrap:wrap;">' +
        '<button class="btn btn-primary" onclick="sharePersonality()">' +
          '<i data-lucide="share-2" style="width:16px;height:16px;margin-right:4px;"></i>分享' +
        '</button>' +
        '<button class="btn btn-outline" onclick="copyPersonalityShareText(' + JSON.stringify(JSON.stringify(shareText)) + ')">' +
          '<i data-lucide="copy" style="width:16px;height:16px;margin-right:4px;"></i>复制文案' +
        '</button>' +
      '</div>' +
      '<div style="margin-top:var(--space-4);text-align:center;">' +
        '<button class="btn btn-ghost btn-sm" onclick="navigateToGameplay(\'timemachine\')">回顾往年今日的味道 → 时光机</button>' +
      '</div>' +
    '</div>' +
  '</div>';
  lucide.createIcons();
}

async function sharePersonality() {
  const d = window.__personalityShareData || {};
  const text = d.text || '';
  const personalityType = d.type || '';
  try { await api.trackEvent('personality_share', { personalityType }); } catch (e) {}
  if (navigator.share) {
    try {
      await navigator.share({ title: '我的美食人格', text: text });
      showToast('已分享');
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return; // 用户取消
    }
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text)
      .then(() => showToast('已复制分享文案'))
      .catch(() => showToast('复制失败，请手动复制'));
  } else {
    showToast('当前环境不支持分享');
  }
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
    // 进入时光机时上报埋点
    try { await api.trackEvent('timemachine_view'); } catch (e) {}
    renderTimemachine(data);
  } catch (err) {
    el.innerHTML = '<div class="timemachine-empty">' + escapeHTML(err.message) + '</div>';
  }
}

let currentTimemachineMemories = [];
function renderTimemachine(data) {
  const el = document.getElementById('gameplay-view-timemachine');
  if (!el) return;
  const memories = data.memories || [];
  currentTimemachineMemories = memories;
  if (!memories.length) {
    el.innerHTML = '<div class="timemachine-empty">' +
      '<div style="font-size: 36px; margin-bottom: var(--space-2);">🕰️</div>' +
      '暂无往年今日回忆，再记录一年就有啦' +
      '<div style="margin-top:var(--space-3);">' +
        '<button class="btn btn-ghost btn-sm" onclick="navigateToGameplay(\'pokedex\')">想点亮更多美食？→ 图鉴</button>' +
      '</div>' +
    '</div>';
    lucide.createIcons();
    return;
  }
  // 节日特别版 banner
  const festival = data.festival;
  const festivalBanner = (festival && festival.name)
    ? '<div class="timemachine-festival-banner">🏮 ' + escapeHTML(festival.name) + (festival.isFamilyFeast ? ' · 家宴回忆' : '') + '</div>'
    : '';
  el.innerHTML = festivalBanner + memories.map((mem, idx) => {
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
      '<button class="btn btn-outline btn-sm" style="margin-top:var(--space-2);" onclick="shareTimemachine(' + idx + ')">' +
        '<i data-lucide="share-2" style="width:14px;height:14px;margin-right:4px;"></i>分享回忆' +
      '</button>' +
    '</div>';
  }).join('') +
  '<div style="text-align:center;margin:var(--space-3) var(--space-5);">' +
    '<button class="btn btn-ghost btn-sm" onclick="navigateToGameplay(\'pokedex\')">想点亮更多美食？→ 图鉴</button>' +
  '</div>';
  lucide.createIcons();
}

async function shareTimemachine(idx) {
  const mem = currentTimemachineMemories[idx];
  const text = (mem && mem.caption) || '我在味记里翻到了一段往年今日的美食回忆';
  try { await api.trackEvent('timemachine_view'); } catch (e) {}
  if (navigator.share) {
    try {
      await navigator.share({ title: '往年今日的味道', text: text });
      showToast('已分享');
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return; // 用户取消
    }
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text)
      .then(() => showToast('已复制回忆文案'))
      .catch(() => showToast('复制失败，请手动复制'));
  } else {
    showToast('当前环境不支持分享');
  }
}

let currentBlindGuessFamilyId = null;
let currentBlindGuessMembers = [];
function getCurrentUserId() {
  const u = api.getCurrentUser();
  return u ? String(u.id || u.userId || u._id || '') : '';
}
async function loadBlindguess() {
  const el = document.getElementById('gameplay-view-blindguess');
  if (!el) return;
  el.innerHTML = '<div class="blindguess-section"><div class="caption">加载中...</div></div>';
  try {
    const familyInfo = await api.getFamilyInfo();
    currentBlindGuessFamilyId = familyInfo && familyInfo.id;
    const [recipes, members] = await Promise.all([
      api.getFamilyRecipes().catch(() => []),
      api.getFamilyMembers().catch(() => [])
    ]);
    currentBlindGuessMembers = members || [];
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
  if (!currentBlindGuessFamilyId) {
    listEl.innerHTML = '<div class="caption" style="text-align:center;padding:var(--space-4);">未找到家庭组</div>';
    return;
  }
  listEl.innerHTML = '<div class="caption" style="text-align:center;padding:var(--space-2);">加载中...</div>';
  try {
    const rounds = await api.getBlindGuessRounds(currentBlindGuessFamilyId);
    if (!rounds || !rounds.length) {
      listEl.innerHTML = '<div class="caption" style="text-align:center;padding:var(--space-4);">还没有发起过盲猜轮次</div>';
      return;
    }
    listEl.innerHTML = rounds.map(r => renderBlindGuessRoundCard(r)).join('');
    lucide.createIcons();
  } catch (err) {
    listEl.innerHTML = '<div class="caption" style="text-align:center;padding:var(--space-4);">' + escapeHTML(err.message) + '</div>';
  }
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
  try {
    const round = await api.getBlindGuessRound(roundId);
    const myId = getCurrentUserId();
    const isActive = round.status === 'active';
    const isCreator = !!(round.creatorId && myId && String(round.creatorId) === myId);
    // 当前用户已猜测的 itemId 集合（active 状态下用于禁用重复提交）
    const myGuessedItemIds = new Set(
      (round.guesses || []).filter(g => String(g.userId) === myId).map(g => String(g.itemId))
    );
    const itemsHTML = (round.items || []).map((item, idx) => {
      const itemId = item.recordId || '';
      const coverHTML = '<img src="' + escapeAttr(item.coverUrl || '') + '" alt="" onerror="this.style.visibility=\'hidden\'">';
      // active：隐藏真实菜名与作者；revealed：展示真实菜名与作者
      const dishLine = isActive
        ? '<div style="font-weight:600;">菜名：???（待猜）</div>'
        : '<div style="font-weight:600;">' + escapeHTML(item.dishName || '') + '</div>';
      const authorLine = isActive
        ? '<div class="caption">作者：???（待揭晓）</div>'
        : '<div class="caption">作者：' + escapeHTML(item.realAuthorName || '') + '</div>';
      let formHTML = '';
      if (isActive) {
        const alreadyGuessed = myGuessedItemIds.has(String(itemId));
        if (alreadyGuessed) {
          formHTML = '<div class="caption" style="color:var(--success-600);margin-top:var(--space-1);">✓ 已猜测</div>';
        } else {
          // 作者选择：优先用家庭成员列表，否则退化为作者名输入框（guessAuthorId 用作者名兜底）
          const authorField = currentBlindGuessMembers.length
            ? '<select class="blindguess-input blindguess-author-select" data-item-id="' + escapeAttr(itemId) + '">' +
                '<option value="">选择作者</option>' +
                currentBlindGuessMembers.map(m =>
                  '<option value="' + escapeAttr(String(m.userId || m.id || '')) + '">' + escapeHTML(m.nickname || '') + '</option>'
                ).join('') +
              '</select>'
            : '<input class="blindguess-input blindguess-author-input" data-item-id="' + escapeAttr(itemId) + '" placeholder="输入作者名">';
          formHTML = '<div style="margin-top:var(--space-2);display:flex;flex-direction:column;gap:var(--space-1);">' +
            '<div class="caption">这是谁做的？</div>' +
            authorField +
            '<div class="caption">你猜的菜名</div>' +
            '<input class="blindguess-input blindguess-dish-input" data-item-id="' + escapeAttr(itemId) + '" placeholder="输入菜名">' +
            '<button class="btn btn-primary btn-sm" style="align-self:flex-start;" onclick="submitBlindGuessItem(\'' + escapeAttr(round.id) + '\',\'' + escapeAttr(itemId) + '\')">提交</button>' +
          '</div>';
        }
      }
      return '<div class="blindguess-item-card blindguess-question" data-item-id="' + escapeAttr(itemId) + '" data-idx="' + idx + '">' +
        coverHTML +
        '<div style="flex:1;">' +
          dishLine +
          authorLine +
          formHTML +
        '</div>' +
      '</div>';
    }).join('');

    const actionBtn = isActive
      ? (isCreator
          ? '<button class="btn btn-primary" onclick="revealBlindGuess(\'' + escapeAttr(round.id) + '\')">揭晓结果</button>'
          : '<div class="caption" style="color:var(--color-on-surface-variant);">等待发起人揭晓结果</div>')
      : '';
    const ranking = !isActive ? renderBlindGuessRanking(round) : '';
    const crossCTA = !isActive
      ? '<div style="margin-top:var(--space-4);text-align:center;">' +
          '<button class="btn btn-ghost btn-sm" onclick="navigateToGameplay(\'pokedex\')">去图鉴看看你的美食收集 →</button>' +
        '</div>'
      : '';

    const html = '<div class="blindguess-section">' +
      '<button class="btn btn-ghost btn-sm" onclick="loadBlindguess()" style="margin-bottom:var(--space-2);">← 返回</button>' +
      '<div class="blindguess-round-card">' +
        '<div style="font-weight:600;margin-bottom:var(--space-2);">' + escapeHTML(round.roundName) + '</div>' +
        itemsHTML +
        (isActive ? '<div style="margin-top:var(--space-3);">' + actionBtn + '</div>' : '') +
        ranking +
        crossCTA +
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

async function submitBlindGuessItem(roundId, itemId) {
  const card = document.querySelector('.blindguess-question[data-item-id="' + itemId + '"]');
  if (!card) { showToast('未找到该题'); return; }
  const authorSelect = card.querySelector('.blindguess-author-select');
  const authorInput = card.querySelector('.blindguess-author-input');
  const dishInput = card.querySelector('.blindguess-dish-input');
  let guessAuthorId = '';
  let guessAuthorName = '';
  if (authorSelect) {
    guessAuthorId = authorSelect.value || '';
    const m = currentBlindGuessMembers.find(mm => String(mm.userId || mm.id || '') === String(guessAuthorId));
    guessAuthorName = m ? (m.nickname || '') : '';
  } else if (authorInput) {
    guessAuthorName = authorInput.value.trim();
    guessAuthorId = guessAuthorName; // 无成员列表时用作者名作为 fallback
  }
  const guessDishName = dishInput ? dishInput.value.trim() : '';
  if (!guessAuthorId) { showToast('请选择作者'); return; }
  if (!guessDishName) { showToast('请输入菜名'); return; }
  try {
    await api.submitBlindGuess(roundId, {
      itemId: itemId,
      guessAuthorId: guessAuthorId,
      guessAuthorName: guessAuthorName,
      guessDishName: guessDishName
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
