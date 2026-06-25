<template>
  <div class="login-page">
    <!-- Logo 区域 -->
    <div class="login-logo">
      <div class="logo-icon">
        <el-icon :size="36"><Food /></el-icon>
      </div>
      <h1 class="login-title">{{ isRegister ? '注册味记' : '欢迎回来' }}</h1>
      <p class="login-subtitle">{{ isRegister ? '创建账号，开启美食之旅' : '登录味记，记录美食时光' }}</p>
    </div>

    <!-- 表单区域 -->
    <div class="login-form">
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item v-if="isRegister" label="昵称" prop="nickname">
          <el-input v-model="form.nickname" placeholder="请输入昵称" size="large" />
        </el-form-item>
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" placeholder="请输入用户名" size="large" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            size="large"
            show-password
            @keyup.enter="handleSubmit"
          />
        </el-form-item>
        <el-button
          type="primary"
          size="large"
          class="submit-btn"
          :loading="loading"
          @click="handleSubmit"
        >
          {{ isRegister ? '注册' : '登录' }}
        </el-button>
      </el-form>

      <!-- 模式切换 -->
      <p class="switch-text">
        {{ isRegister ? '已有账号？' : '还没有账号？' }}
        <span class="switch-link" @click="toggleMode">
          {{ isRegister ? '立即登录' : '立即注册' }}
        </span>
      </p>

      <!-- 演示账号提示 -->
      <div class="demo-tip">
        <p class="demo-label">演示账号</p>
        <p class="demo-info">用户名：demo　密码：123456</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import { Food } from '@element-plus/icons-vue';
import { api } from '../api/client';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const auth = useAuthStore();

const isRegister = ref(false);
const loading = ref(false);
const formRef = ref<FormInstance>();

const form = reactive({
  username: 'demo',
  password: '123456',
  nickname: '',
});

const rules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  nickname: [{ required: true, message: '请输入昵称', trigger: 'blur' }],
};

// 切换登录/注册模式
function toggleMode() {
  isRegister.value = !isRegister.value;
}

// 提交表单
async function handleSubmit() {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    loading.value = true;
    try {
      if (isRegister.value) {
        // 注册
        await api.register(form.username, form.password, form.nickname);
        ElMessage.success('注册成功，请登录');
        isRegister.value = false;
      } else {
        // 登录
        const data: any = await api.login(form.username, form.password);
        auth.setAuth(data.token || data.accessToken || '', data.user || data);
        ElMessage.success('登录成功');
        router.push('/');
      }
    } catch (err: any) {
      ElMessage.error(err.message || '操作失败');
    } finally {
      loading.value = false;
    }
  });
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  max-width: 480px;
  margin: 0 auto;
  background: var(--background);
  display: flex;
  flex-direction: column;
  padding: 48px 24px 24px;
}

.login-logo {
  text-align: center;
  margin-bottom: 32px;
}

.logo-icon {
  width: 72px;
  height: 72px;
  border-radius: var(--radius-xl);
  background: var(--primary-500);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
  box-shadow: var(--shadow-3);
}

.login-title {
  font-family: var(--font-heading);
  font-size: 26px;
  font-weight: 700;
  color: var(--foreground);
  margin-bottom: 8px;
}

.login-subtitle {
  font-size: 14px;
  color: var(--muted-foreground);
}

.login-form {
  flex: 1;
}

.submit-btn {
  width: 100%;
  margin-top: 8px;
  font-weight: 600;
}

.switch-text {
  text-align: center;
  margin-top: 24px;
  font-size: 14px;
  color: var(--muted-foreground);
}

.switch-link {
  color: var(--primary-500);
  cursor: pointer;
  font-weight: 500;
}

.demo-tip {
  margin-top: 24px;
  padding: 16px;
  background: var(--surface-container-low);
  border-radius: var(--radius-lg);
}

.demo-label {
  font-size: 12px;
  color: var(--muted-foreground);
  margin-bottom: 8px;
}

.demo-info {
  font-size: 12px;
  color: var(--foreground);
}
</style>
