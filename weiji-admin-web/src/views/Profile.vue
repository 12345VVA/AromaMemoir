<template>
  <Layout>
    <div class="page-content">
      <!-- 用户头部 -->
      <div v-loading="loading" class="profile-header">
        <el-avatar :size="72" :src="user.avatar" class="profile-avatar">
          {{ (user.nickname || user.username || '味').slice(0, 1) }}
        </el-avatar>
        <div class="profile-name">{{ user.nickname || user.username || '味记用户' }}</div>
        <div v-if="user.bio" class="profile-bio">{{ user.bio }}</div>

        <!-- 统计数据 -->
        <div class="profile-stats">
          <div class="profile-stat">
            <div class="stat-num">{{ user.recordCount || 0 }}</div>
            <div class="stat-label">美食记录</div>
          </div>
          <div class="profile-stat">
            <div class="stat-num">{{ user.recipeCount || 0 }}</div>
            <div class="stat-label">家庭菜谱</div>
          </div>
          <div class="profile-stat">
            <div class="stat-num">{{ user.streak || 0 }}</div>
            <div class="stat-label">连续打卡</div>
          </div>
        </div>
      </div>

      <!-- 快捷操作 -->
      <div class="quick-actions">
        <el-button type="primary" @click="$router.push('/ai-record')">
          <el-icon><Camera /></el-icon>
          记录美食
        </el-button>
        <el-button @click="$router.push('/family')">
          <el-icon><User /></el-icon>
          家庭菜谱
        </el-button>
      </div>

      <!-- 功能菜单 -->
      <div class="section-title">我的功能</div>
      <div class="menu-list">
        <div class="menu-item" @click="$router.push('/')">
          <el-icon><HomeFilled /></el-icon>
          <span class="menu-text">我的日记</span>
          <el-icon class="menu-arrow"><ArrowRight /></el-icon>
        </div>
        <div class="menu-item" @click="$router.push('/family')">
          <el-icon><User /></el-icon>
          <span class="menu-text">家庭菜谱</span>
          <el-icon class="menu-arrow"><ArrowRight /></el-icon>
        </div>
        <div class="menu-item" @click="$router.push('/achievements')">
          <el-icon><Trophy /></el-icon>
          <span class="menu-text">成就徽章</span>
          <el-icon class="menu-arrow"><ArrowRight /></el-icon>
        </div>
      </div>

      <!-- 退出登录 -->
      <div class="logout-section">
        <el-button type="danger" plain class="logout-btn" :loading="logoutLoading" @click="handleLogout">
          <el-icon><SwitchButton /></el-icon>
          退出登录
        </el-button>
      </div>
    </div>
  </Layout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Camera,
  User,
  HomeFilled,
  Trophy,
  ArrowRight,
  SwitchButton,
} from '@element-plus/icons-vue';
import Layout from '../components/Layout.vue';
import { api } from '../api/client';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const auth = useAuthStore();

const user = ref<any>({});
const loading = ref(false);
const logoutLoading = ref(false);

// 加载用户信息
async function loadProfile() {
  loading.value = true;
  try {
    const data: any = await api.getUserProfile();
    user.value = data || {};
  } catch (err) {
    // 接口未就绪时使用本地存储的用户信息
    user.value = auth.user || {};
  } finally {
    loading.value = false;
  }
}

// 退出登录
async function handleLogout() {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      confirmButtonText: '退出',
      cancelButtonText: '取消',
      type: 'warning',
    });
    logoutLoading.value = true;
    try {
      await api.logout();
    } catch {
      // 即使后端登出失败也继续清理本地状态
    }
    auth.clearAuth();
    ElMessage.success('已退出登录');
    router.push('/login');
  } catch {
    // 用户取消
  } finally {
    logoutLoading.value = false;
  }
}

onMounted(() => {
  loadProfile();
});
</script>

<style scoped>
.profile-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 16px 16px;
}
.profile-avatar {
  background: var(--primary-100);
  color: var(--primary-700);
  font-size: 24px;
  font-weight: 600;
  box-shadow: var(--shadow-2);
}
.profile-name {
  font-family: var(--font-heading);
  font-size: 18px;
  font-weight: 600;
  color: var(--foreground);
  margin-top: 12px;
}
.profile-bio {
  font-size: 12px;
  color: var(--muted-foreground);
  margin-top: 4px;
}
.profile-stats {
  display: flex;
  gap: 32px;
  margin-top: 16px;
}
.profile-stat {
  text-align: center;
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
.quick-actions {
  display: flex;
  gap: 12px;
  margin: 8px 0 16px;
}
.quick-actions .el-button {
  flex: 1;
}
.menu-list {
  background: var(--card);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-1);
  overflow: hidden;
}
.menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  cursor: pointer;
  transition: background 0.15s;
}
.menu-item + .menu-item {
  border-top: 1px solid var(--border);
}
.menu-item:hover {
  background: var(--surface-container-low);
}
.menu-item .el-icon {
  font-size: 18px;
  color: var(--muted-foreground);
}
.menu-text {
  flex: 1;
  font-size: 14px;
  color: var(--foreground);
}
.menu-arrow {
  color: var(--neutral-300);
  font-size: 14px;
}
.logout-section {
  margin-top: 24px;
}
.logout-btn {
  width: 100%;
}
</style>
