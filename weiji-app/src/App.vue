<script setup lang="ts">
import { onMounted } from 'vue';
import { useAuthStore } from './stores/auth';

const auth = useAuthStore();

onMounted(() => {
  // 应用启动时从本地存储恢复登录态
  auth.restoreFromStorage();
});
</script>

<style>
/* ========== 全局样式：移动端 480px 居中、橙色主题 ========== */
:root {
  --wj-primary: #FF6B35;
  --wj-primary-light: #FF8A5C;
  --wj-primary-dark: #E5511E;
  --wj-bg: #F7F7F8;
  --wj-card-bg: #FFFFFF;
  --wj-text: #1F1F22;
  --wj-text-muted: #8A8A8F;
  --wj-border: #ECECEE;
  --wj-radius: 12px;
  --wj-radius-lg: 16px;
  --wj-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

/* #ifdef H5 */
page {
  background-color: var(--wj-bg);
  color: var(--wj-text);
  font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}
/* #endif */

/* #ifndef H5 */
page {
  background-color: var(--wj-bg);
  color: var(--wj-text);
  font-size: 28rpx;
  line-height: 1.5;
}
/* #endif */

/* H5 下将 #app 限制为 480px 居中，模拟移动端容器 */
/* #ifdef H5 */
uni-app,
uni-page,
uni-page-body {
  max-width: 480px;
  margin: 0 auto;
  background-color: var(--wj-bg);
  min-height: 100vh;
  box-shadow: 0 0 24px rgba(0, 0, 0, 0.04);
}
/* #endif */

view, text, button, input, textarea {
  box-sizing: border-box;
}

/* 通用卡片 */
.wj-card {
  background: var(--wj-card-bg);
  border-radius: var(--wj-radius);
  box-shadow: var(--wj-shadow);
  padding: 14px 16px;
  margin-bottom: 12px;
}

/* 区块标题 */
.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--wj-text);
  margin: 16px 0 10px;
}

/* 页面容器（移动端 480px 居中由全局控制） */
.page-content {
  padding: 12px 14px 24px;
}

/* 空提示 */
.empty-tip {
  text-align: center;
  color: var(--wj-text-muted);
  font-size: 13px;
  padding: 32px 0;
}

/* 主按钮 */
.wj-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--wj-primary);
  color: #fff;
  border: none;
  border-radius: var(--wj-radius);
  padding: 10px 18px;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
}
.wj-btn::after {
  border: none;
}
.wj-btn[disabled] {
  background: var(--wj-primary-light);
  opacity: 0.6;
}
.wj-btn-ghost {
  background: #fff;
  color: var(--wj-primary);
  border: 1px solid var(--wj-primary);
}

/* 隐藏滚动条 */
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
