<template>
  <view class="page-content">
    <view class="section-title">{{ isEdit ? '编辑菜谱' : '新建菜谱' }}</view>

    <view class="wj-card form-card">
      <view class="form-item">
        <text class="form-label">菜谱名称 <text class="required">*</text></text>
        <input class="form-input" v-model="form.name" placeholder="请输入菜谱名称" placeholder-class="ph" />
      </view>

      <view class="form-item">
        <text class="form-label">分类</text>
        <picker :range="categoryLabels" :value="categoryIndex" @change="onCategoryChange">
          <view class="picker-value">{{ categoryLabels[categoryIndex] }}</view>
        </picker>
      </view>

      <view class="form-item">
        <text class="form-label">难度</text>
        <picker :range="difficultyLabels" :value="difficultyIndex" @change="onDifficultyChange">
          <view class="picker-value">{{ difficultyLabels[difficultyIndex] }}</view>
        </picker>
      </view>

      <view class="form-item">
        <text class="form-label">烹饪时长</text>
        <input class="form-input" v-model="form.cookTime" placeholder="如 30 分钟" placeholder-class="ph" />
      </view>

      <view class="form-item">
        <text class="form-label">可见性</text>
        <picker :range="visibilityLabels" :value="visibilityIndex" @change="onVisibilityChange">
          <view class="picker-value">{{ visibilityLabels[visibilityIndex] }}</view>
        </picker>
      </view>

      <view class="form-item">
        <text class="form-label">封面图 URL</text>
        <input class="form-input" v-model="form.coverUrl" placeholder="可选，填写图片链接" placeholder-class="ph" />
      </view>
    </view>

    <!-- 动态食材列表 -->
    <view class="section-title">
      <text>食材 <text class="required">*</text></text>
      <text class="add-link" @click="addIngredient">+ 添加</text>
    </view>
    <view class="wj-card">
      <view v-for="(ing, idx) in form.ingredients" :key="idx" class="dynamic-row">
        <input class="dyn-input" v-model="ing.name" placeholder="食材名称" placeholder-class="ph" />
        <input class="dyn-input small" v-model="ing.amount" placeholder="用量" placeholder-class="ph" />
        <text class="del-btn" @click="removeIngredient(idx)">✕</text>
      </view>
      <view v-if="!form.ingredients.length" class="empty-tip">至少添加一种食材</view>
    </view>

    <!-- 动态步骤列表 -->
    <view class="section-title">
      <text>做法步骤</text>
      <text class="add-link" @click="addStep">+ 添加</text>
    </view>
    <view class="wj-card">
      <view v-for="(step, idx) in form.steps" :key="idx" class="step-row">
        <view class="step-num">{{ idx + 1 }}</view>
        <textarea class="step-textarea" v-model="step.text" :placeholder="`第 ${idx + 1} 步描述`" placeholder-class="ph" />
        <text class="del-btn" @click="removeStep(idx)">✕</text>
      </view>
      <view v-if="!form.steps.length" class="empty-tip">添加做法步骤</view>
    </view>

    <button class="wj-btn save-btn" :disabled="saving" :loading="saving" @click="handleSave">
      {{ isEdit ? '保存修改' : '创建菜谱' }}
    </button>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { api } from '../api/client';

const recipeId = ref('');
const isEdit = computed(() => !!recipeId.value);
const saving = ref(false);

const categoryOptions = ['', 'breakfast', 'lunch', 'dinner', 'snack', 'dessert'];
const categoryLabels = ['未分类', '早餐', '午餐', '晚餐', '小食', '甜点'];
const difficultyOptions = ['', 'easy', 'medium', 'hard'];
const difficultyLabels = ['未设置', '简单', '中等', '困难'];
const visibilityOptions = ['family', 'public', 'private'];
const visibilityLabels = ['👨‍👩‍👧 家庭可见', '🌍 公开', '🔒 仅自己'];

const form = reactive({
  name: '',
  category: '',
  difficulty: '',
  cookTime: '',
  visibility: 'family',
  coverUrl: '',
  ingredients: [{ name: '', amount: '' }] as Array<{ name: string; amount: string }>,
  steps: [] as Array<{ text: string }>,
});

const categoryIndex = ref(0);
const difficultyIndex = ref(0);
const visibilityIndex = ref(0);

function onCategoryChange(e: any) {
  categoryIndex.value = e.detail.value;
  form.category = categoryOptions[categoryIndex.value];
}
function onDifficultyChange(e: any) {
  difficultyIndex.value = e.detail.value;
  form.difficulty = difficultyOptions[difficultyIndex.value];
}
function onVisibilityChange(e: any) {
  visibilityIndex.value = e.detail.value;
  form.visibility = visibilityOptions[visibilityIndex.value];
}

// 食材增删
function addIngredient() {
  form.ingredients.push({ name: '', amount: '' });
}
function removeIngredient(idx: number) {
  form.ingredients.splice(idx, 1);
}

// 步骤增删
function addStep() {
  form.steps.push({ text: '' });
}
function removeStep(idx: number) {
  form.steps.splice(idx, 1);
}

// 表单校验
function validate(): string | null {
  if (!form.name.trim()) return '请填写菜谱名称';
  const validIngs = form.ingredients.filter((i) => i.name.trim());
  if (!validIngs.length) return '至少添加一种食材';
  return null;
}

async function handleSave() {
  const err = validate();
  if (err) {
    uni.showToast({ title: err, icon: 'none' });
    return;
  }
  // 过滤空行
  const payload = {
    name: form.name.trim(),
    category: form.category,
    difficulty: form.difficulty,
    cookTime: form.cookTime,
    visibility: form.visibility,
    coverUrl: form.coverUrl,
    ingredients: form.ingredients.filter((i) => i.name.trim()),
    steps: form.steps.filter((s) => s.text.trim()).map((s) => s.text.trim()),
  };

  saving.value = true;
  try {
    if (isEdit.value) {
      await api.updateRecipe(recipeId.value, payload);
      uni.showToast({ title: '修改成功', icon: 'success' });
    } else {
      await api.createRecipe(payload);
      uni.showToast({ title: '创建成功', icon: 'success' });
    }
    setTimeout(() => uni.navigateBack(), 600);
  } catch {
    // client.ts 已统一 toast
  } finally {
    saving.value = false;
  }
}

// 编辑模式：加载已有数据
async function loadForEdit() {
  try {
    const data: any = await api.getRecipeDetail(recipeId.value);
    form.name = data.name || '';
    form.category = data.category || '';
    form.difficulty = data.difficulty || '';
    form.cookTime = data.cookTime || '';
    form.visibility = data.visibility || 'family';
    form.coverUrl = data.coverUrl || '';
    // 食材归一化
    const rawIngs = data.ingredients || [];
    form.ingredients = Array.isArray(rawIngs) && rawIngs.length
      ? rawIngs.map((i: any) => ({ name: typeof i === 'string' ? i : i.name || '', amount: typeof i === 'string' ? '' : i.amount || '' }))
      : [{ name: '', amount: '' }];
    // 步骤归一化
    const rawSteps = data.steps || data.instructions || [];
    form.steps = Array.isArray(rawSteps) && rawSteps.length
      ? rawSteps.map((s: any) => ({ text: typeof s === 'string' ? s : s.text || s.description || '' }))
      : [];
    // 同步 picker 索引
    categoryIndex.value = Math.max(0, categoryOptions.indexOf(form.category));
    difficultyIndex.value = Math.max(0, difficultyOptions.indexOf(form.difficulty));
    visibilityIndex.value = Math.max(0, visibilityOptions.indexOf(form.visibility));
  } catch {
    // client.ts 已统一 toast
  }
}

onLoad((options: any) => {
  recipeId.value = options?.id || '';
  if (recipeId.value) {
    loadForEdit();
  }
});
</script>

<style scoped>
.form-card {
  margin-bottom: 16rpx;
}
.form-item {
  margin-bottom: 24rpx;
}
.form-label {
  display: block;
  font-size: 26rpx;
  color: var(--wj-text);
  margin-bottom: 12rpx;
  font-weight: 500;
}
.required {
  color: var(--wj-primary);
}
.form-input {
  width: 100%;
  height: 80rpx;
  border: 2rpx solid var(--wj-border);
  border-radius: 12rpx;
  padding: 0 20rpx;
  font-size: 28rpx;
  background: #fff;
}
.picker-value {
  height: 80rpx;
  line-height: 80rpx;
  border: 2rpx solid var(--wj-border);
  border-radius: 12rpx;
  padding: 0 20rpx;
  font-size: 28rpx;
  color: var(--wj-text);
}
.ph {
  color: var(--wj-text-muted);
}

.section-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.add-link {
  font-size: 26rpx;
  color: var(--wj-primary);
  font-weight: 500;
}

.dynamic-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 16rpx;
}
.dyn-input {
  flex: 1;
  height: 72rpx;
  border: 2rpx solid var(--wj-border);
  border-radius: 12rpx;
  padding: 0 16rpx;
  font-size: 26rpx;
  background: #fff;
}
.dyn-input.small {
  flex: 0 0 160rpx;
}
.del-btn {
  width: 56rpx;
  height: 56rpx;
  line-height: 56rpx;
  text-align: center;
  color: #e54848;
  font-size: 28rpx;
  flex-shrink: 0;
}

.step-row {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
  margin-bottom: 16rpx;
}
.step-num {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: var(--wj-primary);
  color: #fff;
  font-size: 26rpx;
  line-height: 48rpx;
  text-align: center;
  flex-shrink: 0;
  margin-top: 8rpx;
}
.step-textarea {
  flex: 1;
  min-height: 120rpx;
  border: 2rpx solid var(--wj-border);
  border-radius: 12rpx;
  padding: 16rpx;
  font-size: 26rpx;
  background: #fff;
}

.save-btn {
  width: 100%;
  height: 96rpx;
  line-height: 96rpx;
  font-size: 32rpx;
  border-radius: 16rpx;
  margin: 24rpx 0 32rpx;
}
</style>
