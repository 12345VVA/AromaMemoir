/* ===== 全局状态 ===== */
let currentPage = 'home';
let currentRating = 0;
let selectedTags = [];
let currentRecognizeData = null;

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
  } catch (err) {
    hideLoading(listEl);
    showToast(err.message);
  }
}

async function loadFamilyData() {
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
    return '<div class="food-card food-card--v" data-category="' + escapeAttr(r.category || '') + '" data-id="' + escapeAttr(r.id) + '">' +
      '<img class="card-img" src="' + escapeAttr(r.coverUrl) + '" alt="' + escapeAttr(r.name) + '" />' +
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
      '</div>' +
    '</div>';
  }).join('');
  lucide.createIcons();
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
      '<span style="font-size: var(--font-size-caption); color: var(--color-on-surface-variant);">' + escapeHTML(m.nickname || '') + '</span>' +
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
    imageUrl: currentRecognizeData ? (currentRecognizeData.imageUrl || '') : '',
    aiConfidence: currentRecognizeData ? (currentRecognizeData.confidence != null ? currentRecognizeData.confidence : null) : null
  };
  try {
    await api.saveRecord(data);
    showToast('"' + dishName + '" 保存成功！');
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
      filterRecipes(this.dataset.tab);
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
    const card = e.target.closest('.food-card');
    if (card && !e.target.closest('.chip') && !e.target.closest('.star')) {
      const title = card.querySelector('.card-title');
      if (title) showToast('查看：' + title.textContent);
    }
  });
}

function init() {
  if (typeof lucide !== 'undefined') lucide.createIcons();
  initInteractions();
  loadHomeData();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
