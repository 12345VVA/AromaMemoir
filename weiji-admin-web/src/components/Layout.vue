<template>
  <div class="app-shell">
    <!-- 顶部标题栏 -->
    <header class="app-header">
      <span class="app-header-title">{{ currentTitle }}</span>
    </header>

    <!-- 页面内容 -->
    <main class="page-wrapper">
      <slot />
    </main>

    <!-- 底部导航栏 -->
    <nav class="bottom-nav">
      <button
        v-for="tab in tabs"
        :key="tab.path"
        class="nav-item"
        :class="{ active: isActive(tab) }"
        @click="goTo(tab.path)"
      >
        <el-icon><component :is="tab.icon" /></el-icon>
        <span class="nav-label">{{ tab.label }}</span>
      </button>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { HomeFilled, Camera, User, Trophy, UserFilled } from '@element-plus/icons-vue';

// 底部导航 Tab 配置
const tabs = [
  { path: '/', label: '首页', icon: HomeFilled },
  { path: '/ai-record', label: 'AI记录', icon: Camera },
  { path: '/family', label: '家庭', icon: User },
  { path: '/achievements', label: '成就', icon: Trophy },
  { path: '/profile', label: '我的', icon: UserFilled },
];

const route = useRoute();
const router = useRouter();

// 当前路由对应的标题
const titleMap: Record<string, string> = {
  Home: '今日美食',
  AiRecord: 'AI 记录',
  FamilyRecipes: '家庭菜谱',
  Achievements: '成就徽章',
  Profile: '我的',
};
const currentTitle = computed(() => titleMap[route.name as string] || '味记');

// 判断当前 tab 是否高亮
function isActive(tab: { path: string }) {
  return route.path === tab.path;
}

function goTo(path: string) {
  router.push(path);
}
</script>
