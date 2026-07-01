<template>
  <view class="login-page">
    <!-- Logo 区域 -->
    <view class="login-logo">
      <view class="logo-icon">🍜</view>
      <text class="login-title">{{ isRegister ? '注册味记' : '欢迎回来' }}</text>
      <text class="login-subtitle">{{ isRegister ? '创建账号，开启美食之旅' : '登录味记，记录美食时光' }}</text>
    </view>

    <!-- 表单区域 -->
    <view class="login-form">
      <view v-if="isRegister" class="form-item">
        <text class="form-label">昵称</text>
        <input class="form-input" v-model="form.nickname" placeholder="请输入昵称" placeholder-class="ph" />
      </view>
      <view class="form-item">
        <text class="form-label">用户名</text>
        <input class="form-input" v-model="form.username" placeholder="请输入用户名" placeholder-class="ph" />
      </view>
      <view class="form-item">
        <text class="form-label">密码</text>
        <input
          class="form-input"
          v-model="form.password"
          :password="true"
          placeholder="请输入密码"
          placeholder-class="ph"
          @confirm="handleSubmit"
        />
        <text v-if="isRegister" class="form-hint">至少 8 字符，需含字母与数字</text>
      </view>

      <button class="wj-btn submit-btn" :loading="loading" :disabled="loading" @click="handleSubmit">
        {{ isRegister ? '注册' : '登录' }}
      </button>

      <!-- 模式切换 -->
      <view class="switch-text">
        <text>{{ isRegister ? '已有账号？' : '还没有账号？' }}</text>
        <text class="switch-link" @click="toggleMode">{{ isRegister ? '立即登录' : '立即注册' }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { api } from '../api/client';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();

const isRegister = ref(false);
const loading = ref(false);

const form = reactive({
  username: '',
  password: '',
  nickname: '',
});

// 切换登录/注册模式
function toggleMode() {
  isRegister.value = !isRegister.value;
}

// 简单表单校验
function validate(): string | null {
  if (!form.username.trim()) return '请输入用户名';
  if (!form.password) return '请输入密码';
  if (isRegister.value) {
    if (!form.nickname.trim()) return '请输入昵称';
    if (form.password.length < 8) return '密码至少 8 位';
  }
  return null;
}

// 提交表单
async function handleSubmit() {
  const err = validate();
  if (err) {
    uni.showToast({ title: err, icon: 'none' });
    return;
  }
  loading.value = true;
  try {
    if (isRegister.value) {
      await api.register(form.username.trim(), form.password, form.nickname.trim());
      uni.showToast({ title: '注册成功，请登录', icon: 'success' });
      isRegister.value = false;
    } else {
      const data: any = await api.login(form.username.trim(), form.password);
      const token = data.token || data.accessToken || '';
      const user = data.user || data;
      auth.setAuth(token, user);
      uni.showToast({ title: '登录成功', icon: 'success' });
      // 跳转首页（tabBar 页用 switchTab）
      setTimeout(() => {
        uni.switchTab({ url: '/pages/home' });
      }, 400);
    }
  } catch (e: any) {
    // client.ts 已统一 toast，这里不重复提示
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  background: var(--wj-bg);
  display: flex;
  flex-direction: column;
  padding: 96rpx 48rpx 48rpx;
}

.login-logo {
  text-align: center;
  margin-bottom: 64rpx;
}
.logo-icon {
  width: 144rpx;
  height: 144rpx;
  border-radius: 32rpx;
  background: var(--wj-primary);
  color: #fff;
  font-size: 72rpx;
  line-height: 144rpx;
  margin: 0 auto 32rpx;
  box-shadow: 0 8rpx 24rpx rgba(255, 107, 53, 0.3);
}
.login-title {
  display: block;
  font-size: 48rpx;
  font-weight: 700;
  color: var(--wj-text);
  margin-bottom: 16rpx;
}
.login-subtitle {
  display: block;
  font-size: 28rpx;
  color: var(--wj-text-muted);
}

.login-form {
  flex: 1;
}

.form-item {
  margin-bottom: 32rpx;
}
.form-label {
  display: block;
  font-size: 28rpx;
  color: var(--wj-text);
  margin-bottom: 16rpx;
  font-weight: 500;
}
.form-input {
  width: 100%;
  height: 88rpx;
  background: #fff;
  border: 2rpx solid var(--wj-border);
  border-radius: 16rpx;
  padding: 0 24rpx;
  font-size: 30rpx;
  color: var(--wj-text);
}
.ph {
  color: var(--wj-text-muted);
}
.form-hint {
  display: block;
  font-size: 24rpx;
  color: var(--wj-text-muted);
  margin-top: 12rpx;
}

.submit-btn {
  width: 100%;
  height: 96rpx;
  line-height: 96rpx;
  margin-top: 16rpx;
  font-size: 32rpx;
  border-radius: 16rpx;
}

.switch-text {
  text-align: center;
  margin-top: 48rpx;
  font-size: 28rpx;
  color: var(--wj-text-muted);
}
.switch-link {
  color: var(--wj-primary);
  font-weight: 500;
  margin-left: 8rpx;
}
</style>
