<template>
  <Layout>
    <div class="page-content">
      <!-- 等级卡片 -->
      <div v-loading="levelLoading" class="wj-card level-card">
        <div class="level-header">
          <div class="level-icon">
            <el-icon :size="24"><Trophy /></el-icon>
          </div>
          <div class="level-info">
            <div class="level-name">{{ level.level || 1 }} 级</div>
            <div class="level-title">{{ level.title || '美食新手' }}</div>
          </div>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
        </div>
        <div class="progress-text">
          {{ level.currentExp || 0 }} / {{ level.nextLevelExp || 100 }} 经验
        </div>
      </div>

      <!-- 统计 -->
      <div class="stats-row">
        <div class="wj-card stat-card">
          <div class="stat-num">{{ level.recordCount || 0 }}</div>
          <div class="stat-label">美食记录</div>
        </div>
        <div class="wj-card stat-card">
          <div class="stat-num">{{ level.recipeCount || 0 }}</div>
          <div class="stat-label">家庭菜谱</div>
        </div>
        <div class="wj-card stat-card">
          <div class="stat-num">{{ level.streak || 0 }}</div>
          <div class="stat-label">连续打卡</div>
        </div>
      </div>

      <!-- 我的徽章 -->
      <div class="section-title">我的徽章</div>
      <div v-loading="badgesLoading" class="badge-grid">
        <div
          v-for="b in badges"
          :key="b.id || b.name"
          class="badge-item"
          :class="{ locked: !b.unlocked }"
        >
          <div class="badge-icon" :style="{ background: b.unlocked ? badgeColor(b) : 'var(--neutral-100)' }">
            <el-icon :size="28"><component :is="badgeIcon(b)" /></el-icon>
          </div>
          <span class="badge-name">{{ b.name || b.title }}</span>
          <span v-if="b.unlocked" class="badge-desc">已解锁</span>
          <span v-else class="badge-desc locked-desc">未解锁</span>
        </div>
        <div v-if="!badges.length && !badgesLoading" class="empty-tip">暂无徽章</div>
      </div>

      <!-- 美食挑战 -->
      <div class="section-title">美食挑战</div>
      <div v-loading="challengesLoading" class="challenge-list">
        <div v-for="c in challenges" :key="c.id || c.title || c.name" class="wj-card challenge-card">
          <div class="challenge-header">
            <span class="challenge-name">{{ c.title || c.name }}</span>
            <el-tag size="small" :type="challengeTagType(c)" effect="plain">
              {{ c.status || '进行中' }}
            </el-tag>
          </div>
          <p v-if="c.description" class="challenge-desc">{{ c.description }}</p>
          <!-- 已参与时展示进度条 -->
          <div v-if="isJoined(c) && c.progress != null" class="challenge-progress">
            <el-progress :percentage="Math.round((c.progress / (c.target || c.total || 100)) * 100)" :stroke-width="6" />
          </div>
          <!-- 参与挑战按钮 -->
          <div class="challenge-footer">
            <el-button v-if="isJoined(c)" type="success" size="small" plain disabled>已参与</el-button>
            <el-button v-else type="primary" size="small" @click="handleJoinChallenge(c)">参与挑战</el-button>
          </div>
        </div>
        <div v-if="!challenges.length && !challengesLoading" class="empty-tip">暂无挑战</div>
      </div>
    </div>
  </Layout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Trophy, Medal, Star, GoldMedal, Flag, Sunny } from '@element-plus/icons-vue';
import Layout from '../components/Layout.vue';
import { api } from '../api/client';

const level = ref<any>({});
const badges = ref<any[]>([]);
const challenges = ref<any[]>([]);
const levelLoading = ref(false);
const badgesLoading = ref(false);
const challengesLoading = ref(false);

// 已参与挑战 ID 集合（来自 localStorage，用于恢复按钮状态）
const joinedChallenges = ref<Set<string>>(new Set());

// localStorage 存储键
const JOINED_KEY = 'joinedChallenges';

// 进度百分比
const progressPercent = computed(() => {
  const cur = level.value.currentExp || 0;
  const next = level.value.nextLevelExp || 100;
  if (!next) return 0;
  return Math.min(100, Math.round((cur / next) * 100));
});

// 从 localStorage 读取已参与挑战
function loadJoinedChallenges() {
  try {
    const raw = localStorage.getItem(JOINED_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        joinedChallenges.value = new Set(arr.map((id) => String(id)));
      }
    }
  } catch {
    // 数据损坏时重置为空集合
    joinedChallenges.value = new Set();
  }
}

// 保存已参与挑战到 localStorage
function saveJoinedChallenges() {
  localStorage.setItem(JOINED_KEY, JSON.stringify(Array.from(joinedChallenges.value)));
}

// 判断是否已参与（后端 joined 字段或 localStorage 记录）
function isJoined(c: any) {
  const id = c.id ?? c.title ?? c.name;
  if (id == null) return false;
  return !!c.joined || joinedChallenges.value.has(String(id));
}

// 参与挑战：记录到 localStorage 并刷新按钮 UI
function handleJoinChallenge(c: any) {
  const id = c.id ?? c.title ?? c.name;
  if (id == null) return;
  const sid = String(id);
  if (joinedChallenges.value.has(sid)) return;
  // 重新赋值以触发响应式更新
  const next = new Set(joinedChallenges.value);
  next.add(sid);
  joinedChallenges.value = next;
  saveJoinedChallenges();
  ElMessage.success(`已参与挑战：${c.title || c.name || ''}`);
}

// 加载等级
async function loadLevel() {
  levelLoading.value = true;
  try {
    const data: any = await api.getLevel();
    level.value = data || {};
  } catch (err: any) {
    ElMessage.error(err.message || '获取等级失败');
    level.value = {};
  } finally {
    levelLoading.value = false;
  }
}

// 加载徽章
async function loadBadges() {
  badgesLoading.value = true;
  try {
    const data: any = await api.getAchievements();
    badges.value = Array.isArray(data) ? data : data?.list || [];
  } catch (err: any) {
    ElMessage.error(err.message || '获取徽章失败');
    badges.value = [];
  } finally {
    badgesLoading.value = false;
  }
}

// 加载挑战
async function loadChallenges() {
  challengesLoading.value = true;
  try {
    const data: any = await api.getChallenges();
    challenges.value = Array.isArray(data) ? data : data?.list || [];
  } catch (err: any) {
    ElMessage.error(err.message || '获取挑战失败');
    challenges.value = [];
  } finally {
    challengesLoading.value = false;
  }
}

// 徽章图标
function badgeIcon(b: any) {
  const name = (b.icon || b.name || '').toLowerCase();
  if (name.includes('star') || name.includes('星')) return Star;
  if (name.includes('medal') || name.includes('勋章')) return Medal;
  if (name.includes('award') || name.includes('奖')) return GoldMedal;
  if (name.includes('flag') || name.includes('旗')) return Flag;
  if (name.includes('sun') || name.includes('日')) return Sunny;
  return Trophy;
}

// 徽章颜色
function badgeColor(b: any) {
  return b.color || 'var(--primary-100)';
}

// 挑战标签类型
function challengeTagType(c: any) {
  const status = c.status || '';
  if (status.includes('完成') || status.includes('done')) return 'success';
  if (status.includes('失败') || status.includes('fail')) return 'danger';
  return 'warning';
}

onMounted(() => {
  // 先恢复本地已参与状态，再加载列表数据
  loadJoinedChallenges();
  loadLevel();
  loadBadges();
  loadChallenges();
});
</script>

<style scoped>
.level-card {
  margin-bottom: 16px;
}
.level-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.level-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-full);
  background: var(--primary-100);
  color: var(--primary-700);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.level-name {
  font-family: var(--font-heading);
  font-size: 18px;
  font-weight: 700;
  color: var(--foreground);
}
.level-title {
  font-size: 12px;
  color: var(--muted-foreground);
  margin-top: 2px;
}
.progress-bar {
  width: 100%;
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--surface-container-high);
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  border-radius: var(--radius-full);
  background: var(--primary-500);
  transition: width 0.5s ease;
}
.progress-text {
  font-size: 12px;
  color: var(--muted-foreground);
  margin-top: 8px;
  text-align: right;
}
.stats-row {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
}
.stat-card {
  flex: 1;
  text-align: center;
  padding: 16px 8px;
}
.stat-num {
  font-family: var(--font-heading);
  font-size: 22px;
  font-weight: 700;
  color: var(--foreground);
}
.stat-label {
  font-size: 12px;
  color: var(--muted-foreground);
  margin-top: 2px;
}
.badge-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 8px;
}
.badge-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.badge-icon {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary-700);
  box-shadow: var(--shadow-1);
}
.badge-item.locked .badge-icon {
  color: var(--neutral-400);
}
.badge-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--foreground);
  text-align: center;
}
.badge-desc {
  font-size: 10px;
  color: var(--success-500);
}
.badge-desc.locked-desc {
  color: var(--muted-foreground);
}
.challenge-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.challenge-card {
  padding: 14px 16px;
}
.challenge-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.challenge-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--foreground);
}
.challenge-desc {
  font-size: 12px;
  color: var(--muted-foreground);
  margin-bottom: 8px;
}
.challenge-progress {
  margin-top: 4px;
}
.challenge-footer {
  margin-top: 10px;
  display: flex;
  justify-content: flex-end;
}
</style>
