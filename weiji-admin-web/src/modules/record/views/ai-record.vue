<template>
  <div class="page-content">
    <!-- 文件上传区域 -->
    <el-upload
      class="upload-area"
      drag
      :auto-upload="false"
      :show-file-list="false"
      accept="image/*"
      :on-change="handleFileChange"
    >
      <div v-if="previewUrl" class="preview-box">
        <img :src="previewUrl" class="preview-img" alt="预览" />
      </div>
      <div v-else class="upload-placeholder">
        <el-icon class="upload-icon"><UploadFilled /></el-icon>
        <div class="upload-text">点击或拖拽上传美食照片</div>
        <div class="upload-hint">支持 AI 识别菜品</div>
      </div>
    </el-upload>

    <!-- 原图/美化图切换器（美化成功后显示） -->
    <div v-if="beautifiedUrl" class="image-switcher">
      <el-radio-group v-model="imageMode" size="small">
        <el-radio-button value="original">原图</el-radio-button>
        <el-radio-button value="beautified">美化图</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 操作按钮 -->
    <div class="action-row">
      <el-button :disabled="!file" :loading="recognizeLoading" type="primary" @click="handleRecognize">
        <el-icon><MagicStick /></el-icon>
        AI 识别
      </el-button>
      <el-button :disabled="!file" :loading="beautifyLoading" @click="handleBeautify">
        <el-icon><Brush /></el-icon>
        美化图片
      </el-button>
    </div>

    <!-- 识别结果 -->
    <div v-if="recognizeResult" class="result-section">
      <div class="section-title">识别结果</div>
      <div class="wj-card">
        <div class="result-row">
          <span class="result-label">菜名</span>
          <span class="result-value">{{ recognizeResult.dishName || recognizeResult.name || '未识别' }}</span>
        </div>
        <div class="result-row">
          <span class="result-label">置信度</span>
          <span class="result-value">
            <el-progress
              :percentage="confidencePercent"
              :stroke-width="8"
              style="width: 140px"
            />
          </span>
        </div>
        <!-- 烹饪方式 -->
        <div v-if="cookingMethod" class="result-row">
          <span class="result-label">烹饪方式</span>
          <div class="result-tags">
            <el-tag type="danger" effect="dark" size="small">{{ cookingMethod }}</el-tag>
          </div>
        </div>
        <!-- 食材：可点击切换选中状态 -->
        <div v-if="ingredientList.length" class="result-row">
          <span class="result-label">食材</span>
          <div class="result-tags">
            <el-tag
              v-for="(ing, idx) in ingredientList"
              :key="idx"
              size="small"
              :type="isIngredientSelected(ing.name) ? 'success' : 'info'"
              :effect="isIngredientSelected(ing.name) ? 'dark' : 'plain'"
              class="ingredient-tag"
              @click="toggleIngredient(ing.name)"
            >
              {{ ing.name }}
              <span v-if="ing.confidence != null" class="ing-conf">
                {{ ingredientConfidencePercent(ing.confidence) }}%
              </span>
            </el-tag>
          </div>
        </div>
        <div v-if="ingredientList.length" class="ingredient-hint">点击标签可切换选中状态，仅选中食材会保存</div>
      </div>
    </div>

    <!-- 营养信息：4 格卡片 -->
    <div v-if="nutritionList.length" class="nutrition-section">
      <div class="section-title">营养信息</div>
      <el-row :gutter="12">
        <el-col v-for="item in nutritionList" :key="item.key" :span="6">
          <div class="nutrition-card" :class="`nutrition-card--${item.key}`">
            <div class="nutrition-icon">{{ item.icon }}</div>
            <div class="nutrition-title">{{ item.title }}</div>
            <div class="nutrition-value">
              {{ item.value }}<span class="nutrition-unit">{{ item.unit }}</span>
            </div>
          </div>
        </el-col>
      </el-row>
    </div>

    <!-- 保存记录表单 -->
    <div v-if="recognizeResult" class="save-section">
      <div class="section-title">保存记录</div>
      <div class="wj-card">
        <el-form label-position="top">
          <el-form-item label="菜品名称">
            <el-input v-model="saveForm.dishName" placeholder="请输入菜品名称" />
          </el-form-item>
          <el-form-item label="餐次">
            <el-select v-model="saveForm.mealType" placeholder="请选择餐次" style="width: 100%">
              <el-option label="早餐" value="breakfast" />
              <el-option label="午餐" value="lunch" />
              <el-option label="晚餐" value="dinner" />
            </el-select>
          </el-form-item>
          <el-form-item label="评分">
            <el-rate v-model="saveForm.rating" />
          </el-form-item>
          <el-form-item label="标签">
            <div class="tags-area">
              <el-tag
                v-for="(tag, idx) in saveForm.tags"
                :key="idx"
                closable
                size="small"
                type="primary"
                effect="plain"
                @close="removeTag(idx)"
              >
                {{ tag }}
              </el-tag>
              <el-input
                v-if="tagInputVisible"
                ref="tagInputRef"
                v-model="tagInputValue"
                size="small"
                class="tag-input"
                @keyup.enter="addTag"
                @blur="addTag"
              />
              <el-button v-else size="small" class="tag-add-btn" @click="showTagInput">
                + 添加标签
              </el-button>
            </div>
          </el-form-item>
          <el-form-item label="备注">
            <el-input v-model="saveForm.note" type="textarea" :rows="2" placeholder="记录这道菜的感受" />
          </el-form-item>
          <el-button type="primary" :loading="saveLoading" class="save-btn" @click="handleSave">
            保存记录
          </el-button>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { UploadFilled, MagicStick, Brush } from '@element-plus/icons-vue';
import type { UploadFile } from 'element-plus';
import { appApi } from '/@/modules/business/utils/app-api';

const router = useRouter();

const file = ref<File | null>(null);
// 原图 URL（本地上传后的 blob URL）
const originalUrl = ref('');
// 美化图 URL（后端返回）
const beautifiedUrl = ref('');
// 图片预览模式：原图 / 美化图
const imageMode = ref<'original' | 'beautified'>('original');
const recognizeLoading = ref(false);
const beautifyLoading = ref(false);
const saveLoading = ref(false);
const recognizeResult = ref<any>(null);

// 选中的食材列表（数组管理，便于响应式）
const selectedIngredients = ref<string[]>([]);

const saveForm = reactive({
  dishName: '',
  rating: 0,
  note: '',
  mealType: 'lunch' as 'breakfast' | 'lunch' | 'dinner',
  tags: [] as string[],
});

// 标签输入控制
const tagInputVisible = ref(false);
const tagInputValue = ref('');
const tagInputRef = ref<any>(null);

// 当前预览图片地址：根据切换器返回原图或美化图
const previewUrl = computed(() => {
  if (imageMode.value === 'beautified' && beautifiedUrl.value) {
    return beautifiedUrl.value;
  }
  return originalUrl.value;
});

// 食材列表（统一为 { name, confidence } 形式，兼容字符串数组/字符串）
const ingredientList = computed<{ name: string; confidence?: number }[]>(() => {
  const val = recognizeResult.value?.ingredients;
  if (Array.isArray(val)) {
    return val.map((ing: any) => {
      if (typeof ing === 'string') return { name: ing };
      return { name: ing.name || ing.ingredient || '', confidence: ing.confidence };
    });
  }
  if (typeof val === 'string') {
    return val.split(/[,，、]/).filter(Boolean).map((name: string) => ({ name }));
  }
  return [];
});

// 烹饪方式
const cookingMethod = computed(() => recognizeResult.value?.cookingMethod || recognizeResult.value?.cooking_method || '');

// 营养信息：4 格卡片（热量/蛋白质/脂肪/碳水）
const nutritionList = computed(() => {
  const n = recognizeResult.value?.nutrition;
  if (!n || typeof n !== 'object') return [];
  return [
    { key: 'calories', title: '热量', value: n.calories ?? 0, unit: 'kcal', icon: '🔥' },
    { key: 'protein', title: '蛋白质', value: n.protein ?? 0, unit: 'g', icon: '🥩' },
    { key: 'fat', title: '脂肪', value: n.fat ?? 0, unit: 'g', icon: '🧈' },
    { key: 'carbs', title: '碳水', value: n.carbs ?? 0, unit: 'g', icon: '🍚' },
  ];
});

// 置信度百分比
const confidencePercent = computed(() => {
  const c = recognizeResult.value?.confidence;
  if (c == null) return 0;
  if (c <= 1) return Math.round(c * 100);
  return Math.min(100, Math.round(c));
});

// 食材置信度转百分比显示
function ingredientConfidencePercent(c: number) {
  if (c == null) return '';
  if (c <= 1) return Math.round(c * 100);
  return Math.min(100, Math.round(c));
}

// 判断食材是否选中
function isIngredientSelected(name: string) {
  return selectedIngredients.value.includes(name);
}

// 切换食材选中状态
function toggleIngredient(name: string) {
  const idx = selectedIngredients.value.indexOf(name);
  if (idx >= 0) {
    selectedIngredients.value.splice(idx, 1);
  } else {
    selectedIngredients.value.push(name);
  }
}

// 文件选择
function handleFileChange(uploadFile: UploadFile) {
  const raw = uploadFile.raw;
  if (!raw) return;
  file.value = raw;
  originalUrl.value = URL.createObjectURL(raw);
  beautifiedUrl.value = '';
  imageMode.value = 'original';
  recognizeResult.value = null;
  selectedIngredients.value = [];
}

// AI 识别
async function handleRecognize() {
  if (!file.value) return;
  recognizeLoading.value = true;
  try {
    const data: any = await appApi.recognizeFood(file.value);
    recognizeResult.value = data;
    saveForm.dishName = data.dishName || data.name || '';
    // 默认选中所有识别到的食材
    selectedIngredients.value = ingredientList.value.map((i) => i.name);
    // 初始化标签（用识别返回的 tags）
    const tags = data.tags;
    if (Array.isArray(tags)) {
      saveForm.tags = tags.filter((t: any) => typeof t === 'string');
    } else if (typeof tags === 'string') {
      saveForm.tags = tags.split(/[,，、]/).filter(Boolean);
    } else {
      saveForm.tags = [];
    }
    ElMessage.success('识别完成');
  } catch (err: any) {
    ElMessage.error(err.message || '识别失败');
  } finally {
    recognizeLoading.value = false;
  }
}

// 美化图片
async function handleBeautify() {
  if (!file.value) return;
  beautifyLoading.value = true;
  try {
    const data: any = await appApi.beautifyImage(file.value);
    // 后端返回 { imageUrl }，兼容其它字段名
    const url = data?.imageUrl || data?.url || (typeof data === 'string' ? data : '');
    if (url) {
      beautifiedUrl.value = url;
      imageMode.value = 'beautified';
      ElMessage.success('美化完成');
    } else {
      ElMessage.warning('美化接口未返回图片地址');
    }
  } catch (err: any) {
    ElMessage.error(err.message || '美化失败');
  } finally {
    beautifyLoading.value = false;
  }
}

// 标签：显示输入框
function showTagInput() {
  tagInputVisible.value = true;
  tagInputValue.value = '';
  nextTick(() => {
    tagInputRef.value?.focus?.();
  });
}

// 标签：添加
function addTag() {
  const v = tagInputValue.value.trim();
  if (v && !saveForm.tags.includes(v)) {
    saveForm.tags.push(v);
  }
  tagInputVisible.value = false;
  tagInputValue.value = '';
}

// 标签：删除
function removeTag(idx: number) {
  saveForm.tags.splice(idx, 1);
}

// 重置表单与状态
function resetForm() {
  recognizeResult.value = null;
  file.value = null;
  originalUrl.value = '';
  beautifiedUrl.value = '';
  imageMode.value = 'original';
  selectedIngredients.value = [];
  saveForm.dishName = '';
  saveForm.rating = 0;
  saveForm.note = '';
  saveForm.mealType = 'lunch';
  saveForm.tags = [];
}

// 保存记录
async function handleSave() {
  if (!saveForm.dishName) {
    ElMessage.warning('请输入菜品名称');
    return;
  }
  saveLoading.value = true;
  try {
    // 只包含选中的食材
    const selectedIngs = [...selectedIngredients.value];
    await appApi.saveRecord({
      dishName: saveForm.dishName,
      cookingMethod: cookingMethod.value,
      rating: saveForm.rating,
      note: saveForm.note,
      aiConfidence: recognizeResult.value?.confidence,
      nutrition: recognizeResult.value?.nutrition,
      ingredients: selectedIngs,
      tags: saveForm.tags,
      mealType: saveForm.mealType,
      imageUrl: originalUrl.value,
      beautifiedUrl: beautifiedUrl.value,
      source: 'ai',
    });
    ElMessage.success('保存成功');
    resetForm();
    // 跳转首页
    router.push('/home');
  } catch (err: any) {
    ElMessage.error(err.message || '保存失败');
  } finally {
    saveLoading.value = false;
  }
}
</script>

<style scoped>
.page-content {
  padding: 12px;
}
.wj-card {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  padding: 12px 16px;
  box-shadow: var(--el-box-shadow-light);
}
.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 12px 0 8px;
}
.upload-area {
  width: 100%;
}
.upload-area :deep(.el-upload-dragger) {
  width: 100%;
  border-radius: 16px;
  padding: 0;
  overflow: hidden;
}
.preview-box {
  width: 100%;
  height: 220px;
}
.preview-img {
  width: 100%;
  height: 220px;
  object-fit: cover;
}
.upload-placeholder {
  padding: 40px 16px;
  text-align: center;
}
.upload-icon {
  font-size: 40px;
  color: var(--el-color-primary);
}
.upload-text {
  margin-top: 8px;
  font-size: 14px;
  color: var(--el-text-color-primary);
}
.upload-hint {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
/* 原图/美化图切换器 */
.image-switcher {
  display: flex;
  justify-content: center;
  margin-top: 12px;
}
.action-row {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}
.action-row .el-button {
  flex: 1;
}
.result-section,
.nutrition-section,
.save-section {
  margin-top: 16px;
}
.result-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 8px 0;
}
.result-row + .result-row {
  border-top: 1px solid var(--el-border-color);
}
.result-label {
  width: 64px;
  flex-shrink: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.result-value {
  flex: 1;
  font-size: 14px;
  color: var(--el-text-color-primary);
  font-weight: 500;
}
.result-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex: 1;
}
/* 食材标签：可点击 */
.ingredient-tag {
  cursor: pointer;
  user-select: none;
}
.ing-conf {
  margin-left: 4px;
  font-size: 11px;
  opacity: 0.75;
}
.ingredient-hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
/* 营养信息 4 格卡片 */
.nutrition-card {
  border-radius: 12px;
  padding: 12px 8px;
  text-align: center;
  box-shadow: var(--el-box-shadow-light);
  background: var(--el-bg-color);
}
.nutrition-icon {
  font-size: 20px;
  line-height: 1;
}
.nutrition-title {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.nutrition-value {
  margin-top: 4px;
  font-size: 18px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}
.nutrition-unit {
  margin-left: 2px;
  font-size: 12px;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}
.nutrition-card--calories {
  background: linear-gradient(135deg, #fff1f0, #ffe3e0);
}
.nutrition-card--calories .nutrition-value {
  color: #e8584a;
}
.nutrition-card--protein {
  background: linear-gradient(135deg, #fff5e6, #ffe8c7);
}
.nutrition-card--protein .nutrition-value {
  color: #d9751a;
}
.nutrition-card--fat {
  background: linear-gradient(135deg, #fffbe6, #fff3bf);
}
.nutrition-card--fat .nutrition-value {
  color: #ca9a2b;
}
.nutrition-card--carbs {
  background: linear-gradient(135deg, #f0f7ff, #dcecff);
}
.nutrition-card--carbs .nutrition-value {
  color: #2f6fd6;
}
/* 标签编辑区 */
.tags-area {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  width: 100%;
}
.tag-input {
  width: 110px;
}
.tag-add-btn {
  border-style: dashed;
}
.save-btn {
  width: 100%;
}
</style>
