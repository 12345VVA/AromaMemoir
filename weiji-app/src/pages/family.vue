<template>
  <view class="page-content">
    <!-- 家庭信息 + 邀请 -->
    <view class="wj-card family-header">
      <view class="family-meta">
        <text class="family-name">{{ familyInfo.name || '我的家庭' }}</text>
        <text class="family-desc">{{ members.length }} 位成员</text>
      </view>
      <button class="wj-btn wj-btn-ghost invite-btn" @click="handleInvite">邀请家人</button>
    </view>

    <!-- 家庭成员横向列表 -->
    <view class="section-title">家庭成员</view>
    <scroll-view class="member-list no-scrollbar" scroll-x>
      <view v-for="m in members" :key="m.userId || m.id" class="member-item">
        <view class="member-avatar">{{ (m.nickname || m.username || '?').charAt(0) }}</view>
        <text class="member-name">{{ m.nickname || m.username || '成员' }}</text>
        <text class="member-role">{{ roleText(m.role) }}</text>
      </view>
      <view v-if="!members.length" class="empty-tip">还没有家庭成员</view>
    </scroll-view>

    <!-- 分类筛选 -->
    <view class="section-title">家庭菜谱</view>
    <scroll-view class="category-bar no-scrollbar" scroll-x>
      <view
        v-for="c in categories"
        :key="c.value"
        class="category-item"
        :class="{ active: currentCategory === c.value }"
        @click="switchCategory(c.value)"
      >
        {{ c.label }}
      </view>
    </scroll-view>

    <!-- 菜谱网格 -->
    <view v-if="recipesLoading" class="empty-tip">加载中...</view>
    <view v-else-if="recipes.length" class="recipe-grid">
      <view v-for="r in recipes" :key="r.id" class="recipe-card" @click="goDetail(r.id)">
        <view class="recipe-cover">
          <image v-if="r.coverUrl" class="cover-img" :src="r.coverUrl" mode="aspectFill" />
          <view v-else class="cover-placeholder">🍽️</view>
        </view>
        <view class="recipe-info">
          <text class="recipe-name">{{ r.name }}</text>
          <view class="recipe-meta">
            <text class="recipe-cat">{{ r.category || '其他' }}</text>
            <text class="recipe-vis" @click.stop="toggleVisibility(r)">{{ visibilityText(r.visibility) }}</text>
          </view>
        </view>
      </view>
    </view>
    <view v-else class="empty-tip">暂无菜谱，快去添加吧～</view>

    <!-- 新增菜谱入口 -->
    <button class="wj-btn add-btn" @click="goCreate">+ 新建菜谱</button>

    <!-- 邀请码弹窗 -->
    <view v-if="inviteVisible" class="modal-mask" @click="inviteVisible = false">
      <view class="modal-content" @click.stop>
        <text class="modal-title">家庭邀请码</text>
        <text class="modal-desc">将邀请码分享给家人，24 小时内有效</text>
        <view class="invite-code-box">
          <text class="invite-code">{{ inviteCode }}</text>
        </view>
        <button class="wj-btn copy-btn" @click="copyInviteCode">复制邀请码</button>
        <text class="modal-close" @click="inviteVisible = false">关闭</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { api } from '../api/client';

const familyInfo = ref<any>({});
const members = ref<any[]>([]);
const recipes = ref<any[]>([]);
const recipesLoading = ref(false);
const inviteVisible = ref(false);
const inviteCode = ref('');

const categories = [
  { value: '', label: '全部' },
  { value: 'breakfast', label: '早餐' },
  { value: 'lunch', label: '午餐' },
  { value: 'dinner', label: '晚餐' },
  { value: 'snack', label: '小食' },
  { value: 'dessert', label: '甜点' },
];
const currentCategory = ref('');

function roleText(role: string) {
  const map: Record<string, string> = { owner: '家长', admin: '管理员', member: '成员' };
  return map[role] || '成员';
}
function visibilityText(v: string) {
  return v === 'private' ? '🔒仅自己' : v === 'family' ? '👨‍👩‍👧家庭' : '🌍公开';
}

async function loadFamily() {
  try {
    const data: any = await api.getFamilyInfo();
    familyInfo.value = data || {};
  } catch {
    // 静默
  }
}

async function loadMembers() {
  try {
    const data: any = await api.getFamilyMembers();
    members.value = Array.isArray(data) ? data : data?.list || data?.members || [];
  } catch {
    members.value = [];
  }
}

async function loadRecipes() {
  recipesLoading.value = true;
  try {
    const params = currentCategory.value ? { category: currentCategory.value } : undefined;
    const data: any = await api.getFamilyRecipes(params);
    recipes.value = Array.isArray(data) ? data : data?.list || data?.recipes || [];
  } catch {
    recipes.value = [];
  } finally {
    recipesLoading.value = false;
  }
}

function switchCategory(v: string) {
  currentCategory.value = v;
  loadRecipes();
}

// 邀请码
async function handleInvite() {
  try {
    const data: any = await api.createInvitation();
    inviteCode.value = data.code || data.invitationCode || '';
    inviteVisible.value = true;
  } catch {
    // client.ts 已统一 toast
  }
}

// 复制邀请码（小程序适配）
function copyInviteCode() {
  if (!inviteCode.value) return;
  uni.setClipboardData({
    data: inviteCode.value,
    success: () => {
      uni.showToast({ title: '已复制邀请码', icon: 'success' });
    },
  });
}

// 可见性切换
async function toggleVisibility(r: any) {
  const next = r.visibility === 'private' ? 'family' : r.visibility === 'family' ? 'public' : 'private';
  try {
    await api.updateRecipe(r.id, { visibility: next });
    r.visibility = next;
    uni.showToast({ title: '已更新可见性', icon: 'success' });
  } catch {
    // 静默
  }
}

function goDetail(id: string) {
  uni.navigateTo({ url: `/pages/recipe-detail?id=${id}` });
}
function goCreate() {
  uni.navigateTo({ url: '/pages/recipe-form' });
}

onMounted(() => {
  loadFamily();
  loadMembers();
  loadRecipes();
});

onShow(() => {
  loadRecipes();
});
</script>

<style scoped>
.family-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.family-name {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: var(--wj-text);
}
.family-desc {
  display: block;
  font-size: 24rpx;
  color: var(--wj-text-muted);
  margin-top: 4rpx;
}
.invite-btn {
  height: 64rpx;
  line-height: 64rpx;
  padding: 0 24rpx;
  font-size: 26rpx;
  border-radius: 32rpx;
}

.member-list {
  white-space: nowrap;
  padding-bottom: 16rpx;
}
.member-item {
  display: inline-block;
  vertical-align: top;
  width: 140rpx;
  text-align: center;
  margin-right: 24rpx;
  white-space: normal;
}
.member-avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: var(--wj-primary);
  color: #fff;
  font-size: 40rpx;
  line-height: 96rpx;
  margin: 0 auto 12rpx;
}
.member-name {
  display: block;
  font-size: 26rpx;
  color: var(--wj-text);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.member-role {
  display: block;
  font-size: 22rpx;
  color: var(--wj-text-muted);
  margin-top: 4rpx;
}

.category-bar {
  white-space: nowrap;
  margin-bottom: 16rpx;
}
.category-item {
  display: inline-block;
  padding: 12rpx 28rpx;
  margin-right: 16rpx;
  background: #fff;
  border-radius: 32rpx;
  font-size: 26rpx;
  color: var(--wj-text);
  border: 2rpx solid var(--wj-border);
}
.category-item.active {
  background: var(--wj-primary);
  color: #fff;
  border-color: var(--wj-primary);
}

.recipe-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16rpx;
}
.recipe-card {
  background: #fff;
  border-radius: var(--wj-radius);
  box-shadow: var(--wj-shadow);
  overflow: hidden;
}
.recipe-cover {
  width: 100%;
  height: 220rpx;
  background: #f0f0f0;
}
.cover-img {
  width: 100%;
  height: 100%;
}
.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 72rpx;
}
.recipe-info {
  padding: 16rpx 20rpx;
}
.recipe-name {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: var(--wj-text);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.recipe-meta {
  display: flex;
  justify-content: space-between;
  margin-top: 8rpx;
}
.recipe-cat {
  font-size: 22rpx;
  color: var(--wj-text-muted);
}
.recipe-vis {
  font-size: 22rpx;
  color: var(--wj-primary);
}

.add-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  margin-top: 24rpx;
  font-size: 30rpx;
  border-radius: 16rpx;
}

/* 弹窗 */
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}
.modal-content {
  width: 80%;
  max-width: 600rpx;
  background: #fff;
  border-radius: 24rpx;
  padding: 48rpx 32rpx;
  text-align: center;
}
.modal-title {
  display: block;
  font-size: 34rpx;
  font-weight: 600;
  color: var(--wj-text);
  margin-bottom: 12rpx;
}
.modal-desc {
  display: block;
  font-size: 24rpx;
  color: var(--wj-text-muted);
  margin-bottom: 32rpx;
}
.invite-code-box {
  background: var(--wj-bg);
  border-radius: 16rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
}
.invite-code {
  font-size: 56rpx;
  font-weight: 700;
  color: var(--wj-primary);
  letter-spacing: 8rpx;
}
.copy-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  font-size: 30rpx;
  border-radius: 16rpx;
}
.modal-close {
  display: block;
  margin-top: 24rpx;
  font-size: 26rpx;
  color: var(--wj-text-muted);
}
</style>
