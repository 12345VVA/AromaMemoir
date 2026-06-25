<template>
  <Layout>
    <div class="page-content">
      <!-- 家庭成员 -->
      <div class="members-section">
        <div class="section-header">
          <span class="section-title inline">家人</span>
          <el-button text type="primary" size="small" :loading="inviteLoading" @click="handleInvite">
            <el-icon><Plus /></el-icon>
            邀请家人
          </el-button>
        </div>
        <div v-loading="membersLoading" class="members-list no-scrollbar">
          <div v-for="m in members" :key="m.id || m.userId" class="member-item">
            <el-avatar :size="44" :src="m.avatar">{{ (m.nickname || m.username || '?').slice(0, 1) }}</el-avatar>
            <span class="member-name">{{ m.nickname || m.username || '成员' }}</span>
            <el-tag v-if="m.role" size="small" type="warning" effect="plain">{{ m.role }}</el-tag>
          </div>
          <div v-if="!members.length && !membersLoading" class="empty-tip small">还没有家庭成员</div>
        </div>
      </div>

      <!-- 邀请码弹窗 -->
      <el-dialog v-model="inviteVisible" title="邀请家人" width="90%">
        <div class="invite-code-box">
          <p class="invite-tip">将以下邀请码分享给家人，即可加入家庭</p>
          <div class="invite-code">{{ inviteCode || '生成中...' }}</div>
        </div>
        <template #footer>
          <el-button type="primary" @click="copyCode">复制邀请码</el-button>
        </template>
      </el-dialog>

      <!-- 菜谱网格 -->
      <div class="section-title">家庭菜谱</div>
      <div v-loading="recipesLoading">
        <div v-if="recipes.length" class="recipe-grid">
          <div v-for="r in recipes" :key="r.id" class="wj-card recipe-card">
            <div class="recipe-header">
              <span class="recipe-name">{{ r.dishName || r.name || '未命名菜谱' }}</span>
              <el-button
                text
                size="small"
                @click="toggleVisibility(r)"
              >
                <el-icon>
                  <View v-if="r.visibility === 'family'" />
                  <Hide v-else />
                </el-icon>
              </el-button>
            </div>
            <div v-if="r.ingredients" class="recipe-tags">
              <el-tag
                v-for="(ing, idx) in toArray(r.ingredients).slice(0, 3)"
                :key="idx"
                size="small"
                type="info"
                effect="plain"
              >
                {{ ing }}
              </el-tag>
            </div>
            <div class="recipe-meta">
              <el-tag size="small" :type="r.visibility === 'family' ? 'success' : 'info'" effect="plain">
                {{ r.visibility === 'family' ? '家庭共享' : '我的私厨' }}
              </el-tag>
              <span v-if="r.author" class="recipe-author">by {{ r.author }}</span>
            </div>
          </div>
        </div>
        <div v-else-if="!recipesLoading" class="empty-tip">还没有家庭菜谱</div>
      </div>
    </div>
  </Layout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus, View, Hide } from '@element-plus/icons-vue';
import Layout from '../components/Layout.vue';
import { api } from '../api/client';

const members = ref<any[]>([]);
const recipes = ref<any[]>([]);
const membersLoading = ref(false);
const recipesLoading = ref(false);
const inviteLoading = ref(false);
const inviteVisible = ref(false);
const inviteCode = ref('');

// 加载家庭成员
async function loadMembers() {
  membersLoading.value = true;
  try {
    const data: any = await api.getFamilyMembers();
    members.value = Array.isArray(data) ? data : data?.list || data?.members || [];
  } catch (err) {
    members.value = [];
  } finally {
    membersLoading.value = false;
  }
}

// 加载家庭菜谱
async function loadRecipes() {
  recipesLoading.value = true;
  try {
    const data: any = await api.getFamilyRecipes();
    recipes.value = Array.isArray(data) ? data : data?.list || data?.recipes || [];
  } catch (err) {
    recipes.value = [];
  } finally {
    recipesLoading.value = false;
  }
}

// 生成邀请码
async function handleInvite() {
  inviteLoading.value = true;
  try {
    const data: any = await api.createInvitation();
    inviteCode.value = data?.code || data?.invitationCode || data || '';
    inviteVisible.value = true;
  } catch (err: any) {
    ElMessage.error(err.message || '生成邀请码失败');
  } finally {
    inviteLoading.value = false;
  }
}

// 复制邀请码
async function copyCode() {
  if (!inviteCode.value) return;
  try {
    await navigator.clipboard.writeText(inviteCode.value);
    ElMessage.success('已复制邀请码');
  } catch {
    ElMessage.warning('复制失败，请手动复制');
  }
}

// 切换菜谱可见性
async function toggleVisibility(recipe: any) {
  const next = recipe.visibility === 'family' ? 'private' : 'family';
  try {
    await api.updateRecipeVisibility(recipe.id, next);
    recipe.visibility = next;
    ElMessage.success(next === 'family' ? '已设为家庭共享' : '已设为我的私厨');
  } catch (err: any) {
    ElMessage.error(err.message || '切换失败');
  }
}

// 工具：转数组
function toArray(val: any): any[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') return val.split(/[,，、]/).filter(Boolean);
  return [];
}

onMounted(() => {
  loadMembers();
  loadRecipes();
});
</script>

<style scoped>
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.section-title.inline {
  padding: 0;
}
.members-list {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  padding: 8px 0 16px;
}
.member-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.member-name {
  font-size: 12px;
  color: var(--foreground);
  max-width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.empty-tip.small {
  padding: 16px;
}
.recipe-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
.recipe-card {
  padding: 12px;
}
.recipe-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.recipe-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--foreground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.recipe-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}
.recipe-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.recipe-author {
  font-size: 11px;
  color: var(--muted-foreground);
}
.invite-code-box {
  text-align: center;
  padding: 16px 0;
}
.invite-tip {
  font-size: 13px;
  color: var(--muted-foreground);
  margin-bottom: 16px;
}
.invite-code {
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1.5px dashed var(--border);
  border-radius: var(--radius-lg);
  padding: 12px;
  font-family: var(--font-heading);
  font-size: 20px;
  font-weight: 600;
  color: var(--primary-500);
  letter-spacing: 2px;
  background: var(--primary-50);
  word-break: break-all;
}
</style>
