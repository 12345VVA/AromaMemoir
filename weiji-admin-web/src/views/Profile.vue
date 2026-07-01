<template>
  <Layout>
    <div class="page-content">
      <!-- 用户头部 -->
      <div v-loading="loading" class="profile-header">
        <!-- 头像：点击触发文件选择器上传 -->
        <div
          class="avatar-wrapper"
          v-loading="avatarUploading"
          title="点击更换头像"
          @click="triggerAvatarUpload"
        >
          <el-avatar :size="72" :src="user.avatar" class="profile-avatar">
            {{ (user.nickname || user.username || '味').slice(0, 1) }}
          </el-avatar>
          <div class="avatar-edit-badge">
            <el-icon><Camera /></el-icon>
          </div>
          <input
            ref="avatarInput"
            type="file"
            accept="image/*"
            class="hidden-input"
            @change="handleAvatarChange"
          />
        </div>
        <div class="profile-name">{{ user.nickname || user.username || '味记用户' }}</div>
        <div v-if="user.bio" class="profile-bio">{{ user.bio }}</div>

        <!-- 统计数据 -->
        <div class="profile-stats">
          <div class="profile-stat">
            <div class="stat-num">{{ stats.recordCount || 0 }}</div>
            <div class="stat-label">美食记录</div>
          </div>
          <div class="profile-stat">
            <div class="stat-num">{{ stats.recipeCount || 0 }}</div>
            <div class="stat-label">家庭菜谱</div>
          </div>
          <div class="profile-stat">
            <div class="stat-num">{{ stats.streak || 0 }}</div>
            <div class="stat-label">连续打卡</div>
          </div>
          <div class="profile-stat">
            <div class="stat-num">{{ stats.achievementCount || 0 }}</div>
            <div class="stat-label">成就徽章</div>
          </div>
        </div>
      </div>

      <!-- 快捷操作 -->
      <div class="quick-actions">
        <el-button type="primary" @click="goMenu('/ai-record')">
          <el-icon><Camera /></el-icon>
          记录美食
        </el-button>
        <el-button @click="goMenu('/family')">
          <el-icon><User /></el-icon>
          家庭菜谱
        </el-button>
      </div>

      <!-- 编辑资料 -->
      <div class="section-title">编辑资料</div>
      <div class="wj-card edit-profile-card">
        <div class="edit-row">
          <span class="edit-label">昵称</span>
          <div class="edit-input-wrap">
            <el-input
              v-model="nicknameInput"
              placeholder="请输入昵称"
              maxlength="20"
              clearable
              @keyup.enter="handleSaveNickname"
            />
          </div>
          <el-button type="primary" :loading="savingNickname" @click="handleSaveNickname">保存</el-button>
        </div>
      </div>

      <!-- 功能菜单 -->
      <div class="section-title">我的功能</div>
      <div class="menu-list">
        <div v-for="m in menus" :key="m.path" class="menu-item" @click="goMenu(m.path)">
          <el-icon><component :is="m.icon" /></el-icon>
          <span class="menu-text">{{ m.text }}</span>
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
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Camera,
  User,
  HomeFilled,
  Trophy,
  ArrowRight,
  SwitchButton,
  MagicStick,
} from '@element-plus/icons-vue';
import Layout from '../components/Layout.vue';
import { api } from '../api/client';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const auth = useAuthStore();

const user = ref<any>({});
const loading = ref(false);
const logoutLoading = ref(false);
const avatarUploading = ref(false);
const avatarInput = ref<HTMLInputElement | null>(null);
const nicknameInput = ref('');
const savingNickname = ref(false);

// 功能菜单：每项均指向真实路由
const menus = [
  { path: '/', text: '我的日记', icon: HomeFilled },
  { path: '/ai-record', text: 'AI 记录美食', icon: Camera },
  { path: '/family', text: '家庭菜谱', icon: User },
  { path: '/achievements', text: '成就徽章', icon: Trophy },
  { path: '/gameplay', text: '娱乐玩法', icon: MagicStick },
];

// 统计信息：兼容 user.stats 嵌套结构与扁平字段
const stats = computed(() => {
  const u: any = user.value || {};
  if (u.stats) {
    return {
      recordCount: u.stats.recordCount || 0,
      recipeCount: u.stats.recipeCount || 0,
      streak: u.stats.streak || 0,
      achievementCount: u.stats.achievementCount || 0,
    };
  }
  return {
    recordCount: u.recordCount || 0,
    recipeCount: u.recipeCount || 0,
    streak: u.streak || 0,
    achievementCount: u.achievementCount || 0,
  };
});

// 加载用户信息
async function loadProfile() {
  loading.value = true;
  try {
    const data: any = await api.getUserProfile();
    user.value = data || {};
    nicknameInput.value = data?.nickname || data?.username || '';
  } catch (err: any) {
    // 接口未就绪时回退到本地存储的用户信息
    ElMessage.error(err.message || '获取用户信息失败');
    user.value = auth.user || {};
    nicknameInput.value = user.value?.nickname || user.value?.username || '';
  } finally {
    loading.value = false;
  }
}

// 触发头像文件选择器
function triggerAvatarUpload() {
  if (avatarUploading.value) return;
  avatarInput.value?.click();
}

// 头像选择后上传
async function handleAvatarChange(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    ElMessage.error('请选择图片文件');
    target.value = '';
    return;
  }
  avatarUploading.value = true;
  try {
    const data: any = await api.uploadAvatar(file);
    // 更新本地头像显示
    if (data && typeof data === 'object') {
      user.value = { ...user.value, ...data };
    }
    ElMessage.success('头像更新成功');
  } catch (err: any) {
    ElMessage.error(err.message || '头像上传失败');
  } finally {
    avatarUploading.value = false;
    // 重置 input，允许再次选择同一文件
    target.value = '';
  }
}

// 保存昵称
async function handleSaveNickname() {
  const nickname = nicknameInput.value.trim();
  if (!nickname) {
    ElMessage.warning('请输入昵称');
    return;
  }
  savingNickname.value = true;
  try {
    const data: any = await api.updateProfile({ nickname });
    // 优先使用后端返回，回退到本地输入值
    user.value = { ...user.value, ...(data || {}), nickname: data?.nickname || nickname };
    ElMessage.success('昵称保存成功');
  } catch (err: any) {
    ElMessage.error(err.message || '保存昵称失败');
  } finally {
    savingNickname.value = false;
  }
}

// 菜单 / 快捷操作跳转
function goMenu(path: string) {
  router.push(path);
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
    } catch (err: any) {
      // 后端登出失败仍继续清理本地状态，提示但不阻断流程
      ElMessage.error(err.message || '退出登录失败，已清理本地状态');
    }
    auth.clearAuth();
    ElMessage.success('已退出登录');
    router.push('/login');
  } catch {
    // 用户取消，无需处理
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
.avatar-wrapper {
  position: relative;
  display: inline-block;
  cursor: pointer;
}
.profile-avatar {
  background: var(--primary-100);
  color: var(--primary-700);
  font-size: 24px;
  font-weight: 600;
  box-shadow: var(--shadow-2);
}
.avatar-edit-badge {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-full);
  background: var(--primary-500);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-1);
  font-size: 13px;
}
.hidden-input {
  display: none;
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
  flex-wrap: wrap;
  justify-content: center;
  gap: 24px;
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
.edit-profile-card {
  padding: 14px 16px;
  margin-bottom: 16px;
}
.edit-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.edit-label {
  font-size: 14px;
  color: var(--foreground);
  flex-shrink: 0;
}
.edit-input-wrap {
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
