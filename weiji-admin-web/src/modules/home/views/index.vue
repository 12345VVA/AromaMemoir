<template>
  <div class="page-content">
    <!-- 打卡卡片 -->
    <div class="wj-card checkin-card">
      <div class="checkin-info">
        <div>
          <div class="checkin-title">连续打卡</div>
          <div class="checkin-text">
            {{ checkin.checked ? '今日已打卡' : '今日尚未打卡' }}
            <template v-if="checkin.streak">· 已坚持 {{ checkin.streak }} 天</template>
          </div>
        </div>
        <el-button
          type="primary"
          size="small"
          :disabled="checkin.checked"
          :loading="checkinLoading"
          @click="handleCheckin"
        >
          {{ checkin.checked ? '已打卡' : '今日打卡' }}
        </el-button>
      </div>
    </div>

    <!-- 搜索框 -->
    <div class="search-box">
      <el-input
        v-model="keyword"
        placeholder="搜索美食记录..."
        clearable
        @keyup.enter="handleSearch"
        @clear="handleClearSearch"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
        <template #append>
          <el-button :loading="searchLoading" @click="handleSearch">搜索</el-button>
        </template>
      </el-input>
    </div>

    <!-- 美食日记 / 搜索结果 -->
    <div class="section-title">{{ keyword ? '搜索结果' : '美食日记' }}</div>
    <div v-loading="recordsLoading || searchLoading">
      <div v-if="records.length" class="record-list">
        <div v-for="item in records" :key="item.id" class="wj-card record-card">
          <div class="record-header">
            <span class="record-name">{{ item.dishName || item.title || '未命名' }}</span>
            <span class="record-time">{{ formatTime(item.createdAt || item.time) }}</span>
          </div>
          <div v-if="item.ingredients" class="record-tags">
            <el-tag
              v-for="(ing, idx) in toArray(item.ingredients).slice(0, 4)"
              :key="idx"
              size="small"
              type="info"
              effect="plain"
            >
              {{ ing }}
            </el-tag>
          </div>
          <div v-if="item.rating" class="record-rating">
            <el-rate v-model="item.rating" disabled size="small" />
          </div>
        </div>
      </div>
      <div v-else-if="!recordsLoading && !searchLoading" class="empty-tip">
        {{ keyword ? '未找到匹配的美食记录' : '还没有美食记录，去 AI 记录页添加吧～' }}
      </div>
    </div>

    <!-- AI 推荐 -->
    <div v-if="recommendations.length" class="recommend-section">
      <div class="section-title">
        <el-icon style="vertical-align: -2px; color: var(--el-color-primary)"><MagicStick /></el-icon>
        为你推荐
      </div>
      <div class="recommend-list no-scrollbar">
        <div v-for="(rec, idx) in recommendations" :key="idx" class="recommend-card">
          <div class="recommend-name">{{ rec.dishName || rec.name || '推荐菜' }}</div>
          <div class="recommend-desc">{{ rec.reason || rec.description || 'AI 根据你的口味精选' }}</div>
          <!-- 推荐菜谱的难度 / 烹饪时间 / 匹配度 -->
          <div class="recommend-meta">
            <span v-if="rec.difficulty" class="meta-tag">
              <el-icon><Histogram /></el-icon>{{ rec.difficulty }}
            </span>
            <span v-if="rec.cookTime" class="meta-tag">
              <el-icon><Timer /></el-icon>{{ rec.cookTime }}
            </span>
            <span v-if="rec.matchScore != null" class="meta-tag match">
              匹配度 {{ formatMatchScore(rec.matchScore) }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { MagicStick, Search, Histogram, Timer } from '@element-plus/icons-vue';
import { appApi } from '/@/modules/business/utils/app-api';

const records = ref<any[]>([]);
const recordsLoading = ref(false);
const recommendations = ref<any[]>([]);
const checkinLoading = ref(false);
const keyword = ref('');
const searchLoading = ref(false);

const checkin = reactive({
  checked: false,
  streak: 0,
});

// 加载美食记录
async function loadRecords() {
  recordsLoading.value = true;
  try {
    const data: any = await appApi.getRecords();
    records.value = Array.isArray(data) ? data : data?.list || data?.records || [];
  } catch (err: any) {
    ElMessage.error(err.message || '加载美食记录失败');
    records.value = [];
  } finally {
    recordsLoading.value = false;
  }
}

// 搜索美食记录
async function handleSearch() {
  const kw = keyword.value.trim();
  if (!kw) {
    // 关键字为空时恢复全部记录
    handleClearSearch();
    return;
  }
  searchLoading.value = true;
  try {
    const data: any = await appApi.getRecords({ keyword: kw });
    records.value = Array.isArray(data) ? data : data?.list || data?.records || [];
  } catch (err: any) {
    ElMessage.error(err.message || '搜索失败');
    records.value = [];
  } finally {
    searchLoading.value = false;
  }
}

// 清空搜索，重新加载全部记录
function handleClearSearch() {
  keyword.value = '';
  loadRecords();
}

// 加载打卡状态
async function loadCheckin() {
  try {
    const data: any = await appApi.getCheckinStatus();
    checkin.checked = !!data.checked;
    checkin.streak = data.streak || data.continuousDays || 0;
  } catch (err: any) {
    ElMessage.error(err.message || '获取打卡状态失败');
  }
}

// 执行打卡
async function handleCheckin() {
  checkinLoading.value = true;
  try {
    await appApi.doCheckin();
    checkin.checked = true;
    checkin.streak += 1;
    ElMessage.success('打卡成功');
  } catch (err: any) {
    ElMessage.error(err.message || '打卡失败');
  } finally {
    checkinLoading.value = false;
  }
}

// 加载推荐
async function loadRecommendations() {
  try {
    const data: any = await appApi.getRecommendations('');
    recommendations.value = Array.isArray(data) ? data : data?.list || [];
  } catch (err: any) {
    ElMessage.error(err.message || '获取推荐失败');
    recommendations.value = [];
  }
}

// 工具：转数组
function toArray(val: any): any[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') return val.split(/[,，、]/).filter(Boolean);
  return [];
}

// 工具：格式化时间
function formatTime(t: string) {
  if (!t) return '';
  return String(t).replace('T', ' ').slice(0, 16);
}

// 工具：格式化匹配度（兼容 0~1 小数、0~100 整数、字符串）
function formatMatchScore(score: any): string {
  const n = Number(score);
  if (isNaN(n)) return String(score);
  if (n <= 1) return Math.round(n * 100) + '%';
  return n + '%';
}

onMounted(() => {
  loadRecords();
  loadCheckin();
  loadRecommendations();
});
</script>

<style scoped>
.page-content {
  padding: 12px;
}
.wj-card {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  padding: 12px 16px;
  box-shadow: var(--el-box-shadow-light);
}
.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 12px 0 8px;
}
.empty-tip {
  padding: 24px;
  text-align: center;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.checkin-card {
  margin-bottom: 8px;
}
.checkin-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.checkin-title {
  font-weight: 600;
  font-size: 15px;
  color: var(--el-text-color-primary);
}
.checkin-text {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
}
.search-box {
  margin-bottom: 12px;
}
.record-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.record-card {
  padding: 14px 16px;
}
.record-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.record-name {
  font-weight: 600;
  font-size: 15px;
  color: var(--el-text-color-primary);
}
.record-time {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.record-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.record-rating {
  margin-top: 8px;
}
.recommend-section {
  margin-top: 8px;
}
.recommend-list {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 8px;
}
.recommend-card {
  min-width: 140px;
  background: var(--el-bg-color);
  border-radius: 12px;
  box-shadow: var(--el-box-shadow-light);
  padding: 12px;
  flex-shrink: 0;
}
.recommend-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--el-text-color-primary);
  margin-bottom: 4px;
}
.recommend-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}
.recommend-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.meta-tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  border-radius: 999px;
  padding: 2px 8px;
}
.meta-tag .el-icon {
  font-size: 12px;
}
.meta-tag.match {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
</style>
