<template>
  <div class="page-content" v-loading="loading">
    <!-- 顶部操作区 -->
    <div class="detail-actions">
      <el-button text @click="goBack">
        <el-icon><ArrowLeft /></el-icon>
        返回
      </el-button>
      <div class="action-right">
        <el-button v-if="isAuthor" type="primary" plain size="small" @click="goEdit">
          <el-icon><Edit /></el-icon>
          编辑
        </el-button>
        <el-button
          v-if="isAuthor"
          type="danger"
          plain
          size="small"
          :loading="deleteLoading"
          @click="handleDelete"
        >
          <el-icon><Delete /></el-icon>
          删除
        </el-button>
        <el-button type="success" plain size="small" @click="openMenuDialog">
          <el-icon><Plus /></el-icon>
          加入菜单
        </el-button>
      </div>
    </div>

    <!-- 菜谱信息卡片 -->
    <div v-if="recipe" class="wj-card detail-card">
      <div class="detail-cover">
        <el-image
          v-if="recipe.coverUrl"
          :src="recipe.coverUrl"
          fit="cover"
          class="cover-img"
        />
        <div v-else class="cover-placeholder">
          <el-icon :size="40"><Picture /></el-icon>
          <span>暂无封面</span>
        </div>
      </div>
      <div class="detail-info">
        <h2 class="detail-name">{{ recipe.name || '未命名菜谱' }}</h2>
        <div class="detail-meta">
          <el-tag size="small" type="info" effect="plain">{{ recipe.category || '未分类' }}</el-tag>
          <el-tag size="small" type="warning" effect="plain">{{ recipe.difficulty || '未知难度' }}</el-tag>
          <el-tag size="small" type="success" effect="plain">烹饪 {{ recipe.cookTime ?? 0 }} 分钟</el-tag>
          <el-tag
            size="small"
            :type="recipe.visibility === 'family' ? 'success' : 'info'"
            effect="plain"
          >
            {{ recipe.visibility === 'family' ? '家庭共享' : '我的私厨' }}
          </el-tag>
        </div>
        <div class="detail-author">
          <el-icon><User /></el-icon>
          <span>作者ID：{{ recipe.authorId || '未知' }}</span>
          <el-tag v-if="isAuthor" size="small" type="primary" effect="plain">我</el-tag>
        </div>
      </div>
    </div>

    <!-- 食材列表 -->
    <template v-if="recipe">
      <div class="section-title">食材</div>
      <el-table v-if="ingredients.length" :data="ingredients" border size="small" class="ingredient-table">
        <el-table-column label="名称" prop="name" />
        <el-table-column label="用量" prop="amount" width="120" />
        <el-table-column label="单位" prop="unit" width="100" />
      </el-table>
      <div v-else class="empty-tip small">暂无食材信息</div>

      <!-- 步骤列表 -->
      <div class="section-title">烹饪步骤</div>
      <div v-if="steps.length" class="step-list">
        <div v-for="step in steps" :key="step.stepNum" class="step-item wj-card">
          <div class="step-num">{{ step.stepNum }}</div>
          <div class="step-body">
            <div class="step-text">{{ step.text }}</div>
            <el-image
              v-if="step.imageUrl"
              :src="step.imageUrl"
              fit="cover"
              class="step-img"
            />
          </div>
        </div>
      </div>
      <div v-else class="empty-tip small">暂无步骤信息</div>
    </template>

    <!-- 加入菜单弹窗 -->
    <el-dialog v-model="menuDialogVisible" title="加入菜单" width="90%">
      <el-form :model="menuForm" label-width="80px">
        <el-form-item label="星期">
          <el-select v-model="menuForm.dayOfWeek" placeholder="选择星期" style="width: 100%">
            <el-option v-for="d in dayOptions" :key="d.value" :label="d.label" :value="d.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="餐次">
          <el-select v-model="menuForm.mealType" placeholder="选择餐次" style="width: 100%">
            <el-option v-for="m in mealOptions" :key="m.value" :label="m.label" :value="m.value" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="menuDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="menuLoading" @click="handleAddToMenu">确认加入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { ArrowLeft, Edit, Delete, Plus, Picture, User } from '@element-plus/icons-vue';
import { appApi } from '/@/modules/business/utils/app-api';

const route = useRoute();
const router = useRouter();

const recipe = ref<any>(null);
const loading = ref(false);
const deleteLoading = ref(false);

// 当前 C 端 App 用户 ID（用于作者鉴权）
const currentUserId = ref('');

// 加入菜单弹窗状态
const menuDialogVisible = ref(false);
const menuLoading = ref(false);
const menuForm = ref({
  dayOfWeek: 1,
  mealType: 'breakfast' as 'breakfast' | 'lunch' | 'dinner',
});

// 星期与餐次选项
const dayOptions = [
  { label: '周一', value: 1 },
  { label: '周二', value: 2 },
  { label: '周三', value: 3 },
  { label: '周四', value: 4 },
  { label: '周五', value: 5 },
  { label: '周六', value: 6 },
  { label: '周日', value: 7 },
];

const mealOptions = [
  { label: '早餐', value: 'breakfast' },
  { label: '午餐', value: 'lunch' },
  { label: '晚餐', value: 'dinner' },
];

const isAuthor = computed(
  () => !!recipe.value && !!currentUserId.value && recipe.value.authorId === currentUserId.value
);

// 食材列表
const ingredients = computed<any[]>(() => {
  if (!recipe.value) return [];
  return Array.isArray(recipe.value.ingredients) ? recipe.value.ingredients : [];
});

// 步骤列表
const steps = computed<any[]>(() => {
  if (!recipe.value) return [];
  return Array.isArray(recipe.value.steps) ? recipe.value.steps : [];
});

// 加载菜谱详情
async function loadDetail() {
  const id = route.params.id as string;
  if (!id) return;
  loading.value = true;
  try {
    const data: any = await appApi.getRecipeDetail(id);
    recipe.value = data;
  } catch (err: any) {
    ElMessage.error(err.message || '加载菜谱详情失败');
  } finally {
    loading.value = false;
  }
}

// 加载当前 App 用户资料（用于作者鉴权）
async function loadCurrentUser() {
  try {
    const data: any = await appApi.getUserProfile();
    currentUserId.value = String(data?.id ?? data?.userId ?? '');
  } catch (err) {
    currentUserId.value = '';
  }
}

// 返回上一页
function goBack() {
  router.back();
}

// 跳转编辑页（通过 query 传 id 复用新建表单页）
function goEdit() {
  router.push({ path: '/family/recipe/form', query: { id: recipe.value.id } });
}

// 删除菜谱
async function handleDelete() {
  try {
    await ElMessageBox.confirm('确定要删除该菜谱吗？删除后不可恢复。', '删除确认', {
      type: 'warning',
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
    });
  } catch {
    return; // 用户取消
  }
  deleteLoading.value = true;
  try {
    await appApi.deleteRecipe(recipe.value.id);
    ElMessage.success('删除成功');
    router.push('/family/recipes');
  } catch (err: any) {
    ElMessage.error(err.message || '删除失败');
  } finally {
    deleteLoading.value = false;
  }
}

// 打开加入菜单弹窗
function openMenuDialog() {
  menuForm.value = { dayOfWeek: 1, mealType: 'breakfast' };
  menuDialogVisible.value = true;
}

// 提交加入菜单
async function handleAddToMenu() {
  if (!recipe.value) return;
  menuLoading.value = true;
  try {
    await appApi.addToMenu({
      dayOfWeek: menuForm.value.dayOfWeek,
      mealType: menuForm.value.mealType,
      recipeId: recipe.value.id,
      recipeName: recipe.value.name || '未命名菜谱',
    });
    ElMessage.success('已加入菜单');
    menuDialogVisible.value = false;
  } catch (err: any) {
    ElMessage.error(err.message || '加入菜单失败');
  } finally {
    menuLoading.value = false;
  }
}

onMounted(() => {
  loadDetail();
  loadCurrentUser();
});
</script>

<style scoped>
.page-content {
  padding: 12px;
}
.wj-card {
  background: var(--el-bg-color);
  border-radius: 12px;
  box-shadow: var(--el-box-shadow-light);
}
.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  padding: 8px 0;
}
.empty-tip {
  padding: 24px;
  text-align: center;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.empty-tip.small {
  padding: 16px;
}
.detail-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.action-right {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.detail-card {
  display: flex;
  gap: 12px;
  padding: 12px;
  margin-bottom: 8px;
}
.detail-cover {
  flex-shrink: 0;
  width: 120px;
  height: 120px;
  border-radius: 8px;
  overflow: hidden;
  background: var(--el-fill-color-light);
}
.cover-img {
  width: 100%;
  height: 100%;
}
.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.detail-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.detail-name {
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 0;
  word-break: break-word;
}
.detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.detail-author {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.ingredient-table {
  margin-bottom: 8px;
}
.step-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.step-item {
  display: flex;
  gap: 12px;
  padding: 12px;
}
.step-num {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--el-color-primary);
  color: #fff;
  font-weight: 600;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.step-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.step-text {
  font-size: 14px;
  color: var(--el-text-color-primary);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
.step-img {
  width: 100%;
  max-width: 200px;
  height: 140px;
  border-radius: 8px;
}
</style>
