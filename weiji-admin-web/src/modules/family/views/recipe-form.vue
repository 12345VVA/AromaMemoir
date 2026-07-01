<template>
  <div class="page-content">
    <div class="form-header">
      <el-button text @click="goBack">
        <el-icon><ArrowLeft /></el-icon>
        返回
      </el-button>
      <span class="form-title">{{ isEdit ? '编辑菜谱' : '创建菜谱' }}</span>
    </div>

    <div v-loading="detailLoading">
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="80px"
        class="wj-card recipe-form"
      >
        <!-- 菜名 -->
        <el-form-item label="菜名" prop="name">
          <el-input v-model="form.name" placeholder="请输入菜名" maxlength="50" />
        </el-form-item>

        <!-- 分类 -->
        <el-form-item label="分类" prop="category">
          <el-select v-model="form.category" placeholder="选择分类" style="width: 100%">
            <el-option v-for="c in categoryOptions" :key="c" :label="c" :value="c" />
          </el-select>
        </el-form-item>

        <!-- 难度 -->
        <el-form-item label="难度" prop="difficulty">
          <el-select v-model="form.difficulty" placeholder="选择难度" style="width: 100%">
            <el-option v-for="d in difficultyOptions" :key="d" :label="d" :value="d" />
          </el-select>
        </el-form-item>

        <!-- 烹饪时间 -->
        <el-form-item label="烹饪时间" prop="cookTime">
          <el-input-number
            v-model="form.cookTime"
            :min="0"
            :step="5"
            placeholder="分钟"
            controls-position="right"
            style="width: 100%"
          />
          <span class="unit-label">分钟</span>
        </el-form-item>

        <!-- 可见性 -->
        <el-form-item label="可见性" prop="visibility">
          <el-radio-group v-model="form.visibility">
            <el-radio value="family">家庭共享</el-radio>
            <el-radio value="private">我的私厨</el-radio>
          </el-radio-group>
        </el-form-item>

        <!-- 封面URL -->
        <el-form-item label="封面URL" prop="coverUrl">
          <el-input v-model="form.coverUrl" placeholder="请输入封面图片URL" />
        </el-form-item>

        <!-- 食材列表 -->
        <el-form-item label="食材" prop="ingredients" :error="ingredientsError">
          <div class="dynamic-list">
            <div v-for="(ing, idx) in form.ingredients" :key="idx" class="dynamic-row">
              <el-input v-model="ing.name" placeholder="食材名" class="ing-name" />
              <el-input v-model="ing.amount" placeholder="用量" class="ing-amount" />
              <el-input v-model="ing.unit" placeholder="单位" class="ing-unit" />
              <el-button
                text
                type="danger"
                :disabled="form.ingredients.length <= 1"
                @click="removeIngredient(idx)"
              >
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
            <el-button text type="primary" @click="addIngredient">
              <el-icon><Plus /></el-icon>
              添加食材
            </el-button>
          </div>
        </el-form-item>

        <!-- 步骤列表 -->
        <el-form-item label="步骤">
          <div class="dynamic-list">
            <div v-for="(step, idx) in form.steps" :key="idx" class="dynamic-row step-row">
              <span class="step-auto-num">{{ idx + 1 }}</span>
              <el-input
                v-model="step.text"
                type="textarea"
                :autosize="{ minRows: 2, maxRows: 5 }"
                placeholder="步骤描述"
                class="step-input"
              />
              <el-button text type="danger" @click="removeStep(idx)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
            <el-button text type="primary" @click="addStep">
              <el-icon><Plus /></el-icon>
              添加步骤
            </el-button>
          </div>
        </el-form-item>

        <!-- 提交按钮 -->
        <el-form-item>
          <el-button type="primary" :loading="submitLoading" @click="handleSubmit">
            {{ isEdit ? '保存修改' : '创建菜谱' }}
          </el-button>
          <el-button @click="goBack">取消</el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import { ArrowLeft, Delete, Plus } from '@element-plus/icons-vue';
import { appApi } from '/@/modules/business/utils/app-api';

const route = useRoute();
const router = useRouter();

// 判断是否编辑模式（支持路由参数或 query 传 id）
const recipeId = computed(
  () => (route.params.id as string) || (route.query.id as string) || ''
);
const isEdit = computed(() => !!recipeId.value);

// 选项配置
const categoryOptions = ['家常菜', '面食', '烘焙', '汤品', '凉菜', '其他'];
const difficultyOptions = ['简单', '中等', '困难'];

// 表单数据
const formRef = ref<FormInstance>();
const detailLoading = ref(false);
const submitLoading = ref(false);
const ingredientsError = ref('');

const form = ref({
  name: '',
  category: '',
  difficulty: '',
  cookTime: 0 as number,
  visibility: 'family' as 'family' | 'private',
  coverUrl: '',
  ingredients: [{ name: '', amount: '', unit: '' }],
  steps: [{ text: '' }],
});

// 表单校验规则
const rules: FormRules = {
  name: [{ required: true, message: '请输入菜名', trigger: 'blur' }],
  category: [{ required: true, message: '请选择分类', trigger: 'change' }],
  difficulty: [{ required: true, message: '请选择难度', trigger: 'change' }],
  visibility: [{ required: true, message: '请选择可见性', trigger: 'change' }],
};

// 食材操作
function addIngredient() {
  form.value.ingredients.push({ name: '', amount: '', unit: '' });
}

function removeIngredient(idx: number) {
  if (form.value.ingredients.length <= 1) return;
  form.value.ingredients.splice(idx, 1);
}

// 步骤操作
function addStep() {
  form.value.steps.push({ text: '' });
}

function removeStep(idx: number) {
  form.value.steps.splice(idx, 1);
}

// 自定义校验：至少 1 个食材有 name
function validateIngredients(): boolean {
  const hasName = form.value.ingredients.some((ing) => ing.name.trim() !== '');
  if (!hasName) {
    ingredientsError.value = '至少填写一个食材名称';
    return false;
  }
  ingredientsError.value = '';
  return true;
}

// 返回
function goBack() {
  router.back();
}

// 编辑模式预填数据
async function loadDetail() {
  if (!recipeId.value) return;
  detailLoading.value = true;
  try {
    const data: any = await appApi.getRecipeDetail(recipeId.value);
    form.value.name = data.name || '';
    form.value.category = data.category || '';
    form.value.difficulty = data.difficulty || '';
    form.value.cookTime = data.cookTime ?? 0;
    form.value.visibility = data.visibility || 'family';
    form.value.coverUrl = data.coverUrl || '';
    form.value.ingredients = Array.isArray(data.ingredients) && data.ingredients.length
      ? data.ingredients.map((ing: any) => ({
          name: ing.name || '',
          amount: ing.amount || '',
          unit: ing.unit || '',
        }))
      : [{ name: '', amount: '', unit: '' }];
    form.value.steps = Array.isArray(data.steps) && data.steps.length
      ? data.steps.map((s: any) => ({ text: s.text || '' }))
      : [{ text: '' }];
  } catch (err: any) {
    ElMessage.error(err.message || '加载菜谱失败');
  } finally {
    detailLoading.value = false;
  }
}

// 提交表单
async function handleSubmit() {
  if (!formRef.value) return;
  // 先做 el-form 校验
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;
  // 再校验食材
  if (!validateIngredients()) return;

  // 构造提交数据，步骤自动编号
  const submitData = {
    name: form.value.name,
    category: form.value.category,
    difficulty: form.value.difficulty,
    cookTime: form.value.cookTime,
    visibility: form.value.visibility,
    coverUrl: form.value.coverUrl,
    ingredients: form.value.ingredients.filter((ing) => ing.name.trim() !== ''),
    steps: form.value.steps
      .filter((s) => s.text.trim() !== '')
      .map((s, idx) => ({ stepNum: idx + 1, text: s.text })),
  };

  submitLoading.value = true;
  try {
    if (isEdit.value) {
      await appApi.updateRecipe(recipeId.value, submitData);
      ElMessage.success('修改成功');
      router.push('/family/recipe/' + recipeId.value);
    } else {
      const result: any = await appApi.createRecipe(submitData);
      const newId = result?.id || result?._id || '';
      ElMessage.success('创建成功');
      if (newId) {
        router.push('/family/recipe/' + newId);
      } else {
        router.push('/family/recipes');
      }
    }
  } catch (err: any) {
    ElMessage.error(err.message || (isEdit.value ? '修改失败' : '创建失败'));
  } finally {
    submitLoading.value = false;
  }
}

onMounted(() => {
  if (isEdit.value) {
    loadDetail();
  }
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
.form-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.form-title {
  font-weight: 600;
  font-size: 16px;
  color: var(--el-text-color-primary);
}
.recipe-form {
  padding: 16px;
}
.unit-label {
  margin-left: 8px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}
.dynamic-list {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.dynamic-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.step-row {
  align-items: flex-start;
}
.ing-name {
  flex: 2;
}
.ing-amount {
  flex: 1;
}
.ing-unit {
  flex: 1;
}
.step-auto-num {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--el-color-primary);
  color: #fff;
  font-weight: 600;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 6px;
}
.step-input {
  flex: 1;
}
</style>
