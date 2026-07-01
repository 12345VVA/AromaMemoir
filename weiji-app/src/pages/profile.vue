<template>
  <view class="page-content">
    <!-- 用户信息卡片 -->
    <view class="wj-card profile-card">
      <view class="avatar-wrap" @click="changeAvatar">
        <image v-if="user.avatar" class="avatar-img" :src="user.avatar" mode="aspectFill" />
        <view v-else class="avatar-placeholder">{{ (user.nickname || user.username || '?').charAt(0) }}</view>
        <view class="avatar-edit">📷</view>
      </view>
      <view class="profile-meta">
        <text class="profile-name">{{ user.nickname || user.username || '味记用户' }}</text>
        <text class="profile-sub">@{{ user.username || 'unknown' }}</text>
      </view>
    </view>

    <!-- 统计数据 -->
    <view class="wj-card stats-card">
      <view class="stat-item">
        <text class="stat-value">{{ stats.records }}</text>
        <text class="stat-label">美食记录</text>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-item">
        <text class="stat-value">{{ stats.recipes }}</text>
        <text class="stat-label">家庭菜谱</text>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-item">
        <text class="stat-value">{{ stats.streak }}</text>
        <text class="stat-label">连续打卡</text>
      </view>
    </view>

    <!-- 功能菜单 -->
    <view class="wj-card menu-card">
      <view class="menu-item" @click="goFamily">
        <text class="menu-icon">👨‍👩‍👧</text>
        <text class="menu-text">我的家庭</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @click="goAchievements">
        <text class="menu-icon">🏆</text>
        <text class="menu-text">成就中心</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @click="editNickname">
        <text class="menu-icon">✏️</text>
        <text class="menu-text">修改昵称</text>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <!-- 退出登录 -->
    <button class="wj-btn logout-btn" @click="handleLogout">退出登录</button>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { api } from '../api/client';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const stats = reactive({ records: 0, recipes: 0, streak: 0 });

const user = computed(() => auth.user || {});

async function loadProfile() {
  try {
    const data: any = await api.getUserProfile();
    if (data) {
      auth.setAuth(auth.token, { ...auth.user, ...data });
    }
    stats.records = data?.recordCount || data?.stats?.records || 0;
    stats.recipes = data?.recipeCount || data?.stats?.recipes || 0;
    stats.streak = data?.streak || data?.checkinStreak || 0;
  } catch {
    // 静默
  }
}

// 头像上传（uni.chooseImage）
function changeAvatar() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (res) => {
      const filePath = res.tempFilePaths[0];
      uni.showLoading({ title: '上传中...' });
      try {
        // 复用后端用户更新接口；小程序下若后端需文件上传，可改走 upload
        // 这里先以本地路径 + updateProfile 提交（实际项目应上传至 OSS/CDN 后再提交 URL）
        await api.updateProfile({ avatar: filePath } as any);
        auth.setAuth(auth.token, { ...auth.user, avatar: filePath });
        uni.showToast({ title: '头像已更新', icon: 'success' });
      } catch {
        // client.ts 已统一 toast
      } finally {
        uni.hideLoading();
      }
    },
  });
}

// 修改昵称
function editNickname() {
  uni.showModal({
    title: '修改昵称',
    editable: true,
    placeholderText: '请输入新昵称',
    content: user.value.nickname || '',
    success: async (res) => {
      if (!res.confirm) return;
      const nickname = (res.content || '').trim();
      if (!nickname) {
        uni.showToast({ title: '昵称不能为空', icon: 'none' });
        return;
      }
      try {
        await api.updateProfile({ nickname });
        auth.setAuth(auth.token, { ...auth.user, nickname });
        uni.showToast({ title: '修改成功', icon: 'success' });
      } catch {
        // client.ts 已统一 toast
      }
    },
  });
}

function goFamily() {
  uni.switchTab({ url: '/pages/family' });
}
function goAchievements() {
  uni.switchTab({ url: '/pages/achievements' });
}

async function handleLogout() {
  uni.showModal({
    title: '退出登录',
    content: '确定要退出登录吗？',
    confirmColor: '#FF6B35',
    success: async (res) => {
      if (!res.confirm) return;
      await auth.logout();
      uni.showToast({ title: '已退出', icon: 'success' });
      setTimeout(() => {
        uni.reLaunch({ url: '/pages/login' });
      }, 400);
    },
  });
}

onMounted(() => {
  loadProfile();
});

onShow(() => {
  loadProfile();
});
</script>

<style scoped>
.profile-card {
  display: flex;
  align-items: center;
  padding: 32rpx 28rpx;
}
.avatar-wrap {
  position: relative;
  width: 128rpx;
  height: 128rpx;
  margin-right: 24rpx;
  flex-shrink: 0;
}
.avatar-img {
  width: 128rpx;
  height: 128rpx;
  border-radius: 50%;
  border: 4rpx solid var(--wj-border);
}
.avatar-placeholder {
  width: 128rpx;
  height: 128rpx;
  border-radius: 50%;
  background: var(--wj-primary);
  color: #fff;
  font-size: 56rpx;
  line-height: 128rpx;
  text-align: center;
}
.avatar-edit {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  background: var(--wj-primary);
  color: #fff;
  font-size: 24rpx;
  line-height: 44rpx;
  text-align: center;
  border: 2rpx solid #fff;
}
.profile-meta {
  flex: 1;
}
.profile-name {
  display: block;
  font-size: 36rpx;
  font-weight: 600;
  color: var(--wj-text);
  margin-bottom: 8rpx;
}
.profile-sub {
  display: block;
  font-size: 24rpx;
  color: var(--wj-text-muted);
}

.stats-card {
  display: flex;
  align-items: center;
  padding: 32rpx 0;
}
.stat-item {
  flex: 1;
  text-align: center;
}
.stat-value {
  display: block;
  font-size: 44rpx;
  font-weight: 700;
  color: var(--wj-primary);
}
.stat-label {
  display: block;
  font-size: 24rpx;
  color: var(--wj-text-muted);
  margin-top: 4rpx;
}
.stat-divider {
  width: 2rpx;
  height: 64rpx;
  background: var(--wj-border);
}

.menu-card {
  padding: 0;
  overflow: hidden;
}
.menu-item {
  display: flex;
  align-items: center;
  padding: 28rpx;
  border-bottom: 2rpx solid var(--wj-border);
}
.menu-item:last-child {
  border-bottom: none;
}
.menu-icon {
  font-size: 36rpx;
  margin-right: 20rpx;
}
.menu-text {
  flex: 1;
  font-size: 30rpx;
  color: var(--wj-text);
}
.menu-arrow {
  font-size: 36rpx;
  color: var(--wj-text-muted);
}

.logout-btn {
  width: 100%;
  height: 96rpx;
  line-height: 96rpx;
  font-size: 32rpx;
  border-radius: 16rpx;
  margin: 32rpx 0;
  background: #fff;
  color: #e54848;
  border: 2rpx solid #e54848;
}
</style>
