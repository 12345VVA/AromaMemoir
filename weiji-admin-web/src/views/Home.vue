<template>
  <Layout>
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

      <!-- 美食日记 -->
      <div class="section-title">美食日记</div>
      <div v-loading="recordsLoading">
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
        <div v-else-if="!recordsLoading" class="empty-tip">还没有美食记录，去 AI 记录页添加吧～</div>
      </div>

      <!-- AI 推荐 -->
      <div v-if="recommendations.length" class="recommend-section">
        <div class="section-title">
          <el-icon style="vertical-align: -2px; color: var(--primary-500)"><MagicStick /></el-icon>
          为你推荐
        </div>
        <div class="recommend-list no-scrollbar">
          <div v-for="(rec, idx) in recommendations" :key="idx" class="recommend-card">
            <div class="recommend-name">{{ rec.dishName || rec.name || '推荐菜' }}</div>
            <div class="recommend-desc">{{ rec.reason || rec.description || 'AI 根据你的口味精选' }}</div>
          </div>
        </div>
      </div>
    </div>
  </Layout>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { MagicStick } from '@element-plus/icons-vue';
import Layout from '../components/Layout.vue';
import { api } from '../api/client';

const records = ref<any[]>([]);
const recordsLoading = ref(false);
const recommendations = ref<any[]>([]);
const checkinLoading = ref(false);

const checkin = reactive({
  checked: false,
  streak: 0,
});

// 加载美食记录
async function loadRecords() {
  recordsLoading.value = true;
  try {
    const data: any = await api.getRecords();
    records.value = Array.isArray(data) ? data : data?.list || data?.records || [];
  } catch (err) {
    // 接口未就绪时静默处理
    records.value = [];
  } finally {
    recordsLoading.value = false;
  }
}

// 加载打卡状态
async function loadCheckin() {
  try {
    const data: any = await api.getCheckinStatus();
    checkin.checked = !!data.checked;
    checkin.streak = data.streak || data.continuousDays || 0;
  } catch (err) {
    // 静默处理
  }
}

// 执行打卡
async function handleCheckin() {
  checkinLoading.value = true;
  try {
    await api.doCheckin();
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
    const data: any = await api.getRecommendations('');
    recommendations.value = Array.isArray(data) ? data : data?.list || [];
  } catch (err) {
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

onMounted(() => {
  loadRecords();
  loadCheckin();
  loadRecommendations();
});
</script>

<style scoped>
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
  color: var(--foreground);
}
.checkin-text {
  font-size: 12px;
  color: var(--muted-foreground);
  margin-top: 2px;
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
  color: var(--foreground);
}
.record-time {
  font-size: 12px;
  color: var(--muted-foreground);
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
  background: var(--card);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-1);
  padding: 12px;
  flex-shrink: 0;
}
.recommend-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--foreground);
  margin-bottom: 4px;
}
.recommend-desc {
  font-size: 12px;
  color: var(--muted-foreground);
  line-height: 1.5;
}
</style>
