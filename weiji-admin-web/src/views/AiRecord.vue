<template>
  <Layout>
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
        <div v-if="imageUrl" class="preview-box">
          <img :src="imageUrl" class="preview-img" alt="预览" />
        </div>
        <div v-else class="upload-placeholder">
          <el-icon class="upload-icon"><UploadFilled /></el-icon>
          <div class="upload-text">点击或拖拽上传美食照片</div>
          <div class="upload-hint">支持 AI 识别菜品</div>
        </div>
      </el-upload>

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
          <div v-if="ingredients.length" class="result-row">
            <span class="result-label">食材</span>
            <div class="result-tags">
              <el-tag v-for="(ing, idx) in ingredients" :key="idx" size="small" type="warning" effect="plain">
                {{ ing }}
              </el-tag>
            </div>
          </div>
          <div v-if="nutrition" class="result-row">
            <span class="result-label">营养信息</span>
            <span class="result-value nutrition-text">{{ nutrition }}</span>
          </div>
        </div>
      </div>

      <!-- 保存记录表单 -->
      <div v-if="recognizeResult" class="save-section">
        <div class="section-title">保存记录</div>
        <div class="wj-card">
          <el-form label-position="top">
            <el-form-item label="菜品名称">
              <el-input v-model="saveForm.dishName" placeholder="请输入菜品名称" />
            </el-form-item>
            <el-form-item label="评分">
              <el-rate v-model="saveForm.rating" />
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
  </Layout>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { UploadFilled, MagicStick, Brush } from '@element-plus/icons-vue';
import type { UploadFile } from 'element-plus';
import Layout from '../components/Layout.vue';
import { api } from '../api/client';

const file = ref<File | null>(null);
const imageUrl = ref('');
const recognizeLoading = ref(false);
const beautifyLoading = ref(false);
const saveLoading = ref(false);
const recognizeResult = ref<any>(null);

const saveForm = reactive({
  dishName: '',
  rating: 0,
  note: '',
});

// 文件选择
function handleFileChange(uploadFile: UploadFile) {
  const raw = uploadFile.raw;
  if (!raw) return;
  file.value = raw;
  imageUrl.value = URL.createObjectURL(raw);
  recognizeResult.value = null;
}

// 识别食材（转数组）
const ingredients = computed<string[]>(() => {
  const val = recognizeResult.value?.ingredients;
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') return val.split(/[,，、]/).filter(Boolean);
  return [];
});

// 营养信息
const nutrition = computed(() => {
  const r = recognizeResult.value;
  if (!r) return '';
  return r.nutrition || r.nutritionInfo || (r.calories ? `热量：${r.calories} kcal` : '');
});

// 置信度百分比
const confidencePercent = computed(() => {
  const c = recognizeResult.value?.confidence;
  if (c == null) return 0;
  if (c <= 1) return Math.round(c * 100);
  return Math.min(100, Math.round(c));
});

// AI 识别
async function handleRecognize() {
  if (!file.value) return;
  recognizeLoading.value = true;
  try {
    const data: any = await api.recognizeFood(file.value);
    recognizeResult.value = data;
    saveForm.dishName = data.dishName || data.name || '';
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
    const data: any = await api.beautifyImage(file.value);
    // 后端返回美化后的图片 URL 或 base64
    const url = data?.url || data?.imageUrl || data;
    if (typeof url === 'string') {
      imageUrl.value = url;
      ElMessage.success('美化完成');
    } else {
      ElMessage.success('美化完成');
    }
  } catch (err: any) {
    ElMessage.error(err.message || '美化失败');
  } finally {
    beautifyLoading.value = false;
  }
}

// 保存记录
async function handleSave() {
  if (!saveForm.dishName) {
    ElMessage.warning('请输入菜品名称');
    return;
  }
  saveLoading.value = true;
  try {
    await api.saveRecord({
      dishName: saveForm.dishName,
      rating: saveForm.rating,
      note: saveForm.note,
      ingredients: ingredients.value,
    });
    ElMessage.success('保存成功');
    // 重置
    recognizeResult.value = null;
    file.value = null;
    imageUrl.value = '';
    saveForm.dishName = '';
    saveForm.rating = 0;
    saveForm.note = '';
  } catch (err: any) {
    ElMessage.error(err.message || '保存失败');
  } finally {
    saveLoading.value = false;
  }
}
</script>

<style scoped>
.upload-area {
  width: 100%;
}
.upload-area :deep(.el-upload-dragger) {
  width: 100%;
  border-radius: var(--radius-xl);
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
  color: var(--primary-500);
}
.upload-text {
  margin-top: 8px;
  font-size: 14px;
  color: var(--foreground);
}
.upload-hint {
  margin-top: 4px;
  font-size: 12px;
  color: var(--muted-foreground);
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
  border-top: 1px solid var(--border);
}
.result-label {
  width: 64px;
  flex-shrink: 0;
  font-size: 13px;
  color: var(--muted-foreground);
}
.result-value {
  flex: 1;
  font-size: 14px;
  color: var(--foreground);
  font-weight: 500;
}
.result-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex: 1;
}
.nutrition-text {
  font-weight: 400;
  font-size: 13px;
  line-height: 1.6;
}
.save-btn {
  width: 100%;
}
</style>
