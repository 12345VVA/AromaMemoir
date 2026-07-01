<template>
	<cl-page>
		<view class="page-content">
			<!-- 图片上传区 -->
			<view class="wj-card upload-card">
				<view v-if="!imageUrl" class="upload-placeholder" @click="chooseImage">
					<text class="upload-icon">📷</text>
					<text class="upload-text">点击上传美食照片</text>
					<text class="upload-hint">支持拍照或从相册选择</text>
				</view>
				<view v-else class="preview-wrap">
					<image class="preview-img" :src="imageUrl" mode="aspectFill" />
					<view class="preview-actions">
						<button class="wj-btn wj-btn-ghost action-btn" @click="chooseImage">重新选择</button>
						<button
							class="wj-btn action-btn"
							:disabled="beautifyLoading"
							:loading="beautifyLoading"
							@click="handleBeautify"
						>
							{{ beautifyLoading ? "美化中..." : "✨ AI 美化" }}
						</button>
					</view>
				</view>
			</view>

			<!-- 识别按钮 -->
			<button
				v-if="imageUrl && !recognizeResult"
				class="wj-btn recognize-btn"
				:disabled="recognizeLoading"
				:loading="recognizeLoading"
				@click="handleRecognize"
			>
				{{ recognizeLoading ? "AI 识别中..." : "🔍 开始 AI 识别" }}
			</button>

			<!-- 识别结果 -->
			<view v-if="recognizeResult" class="result-section">
				<!-- 营养四指标卡片 -->
				<view class="section-title">营养指标</view>
				<view class="nutrition-grid">
					<view class="nutrition-card">
						<text class="nutrition-value">{{ nutrition.calories || 0 }}</text>
						<text class="nutrition-unit">千卡</text>
						<text class="nutrition-label">热量</text>
					</view>
					<view class="nutrition-card">
						<text class="nutrition-value">{{ nutrition.protein || 0 }}</text>
						<text class="nutrition-unit">克</text>
						<text class="nutrition-label">蛋白质</text>
					</view>
					<view class="nutrition-card">
						<text class="nutrition-value">{{ nutrition.carbs || 0 }}</text>
						<text class="nutrition-unit">克</text>
						<text class="nutrition-label">碳水</text>
					</view>
					<view class="nutrition-card">
						<text class="nutrition-value">{{ nutrition.fat || 0 }}</text>
						<text class="nutrition-unit">克</text>
						<text class="nutrition-label">脂肪</text>
					</view>
				</view>

				<!-- 食材标签 -->
				<view class="section-title">识别食材</view>
				<view class="ingredient-tags">
					<text v-for="(ing, idx) in ingredients" :key="idx" class="ing-tag">{{ ing }}</text>
					<text v-if="!ingredients.length" class="empty-tip">未识别到食材</text>
				</view>
			</view>

			<!-- 保存表单 -->
			<view v-if="recognizeResult" class="wj-card save-form">
				<view class="section-title">完善信息并保存</view>
				<view class="form-item">
					<text class="form-label">菜品名称</text>
					<input class="form-input" v-model="form.dishName" placeholder="请输入菜品名称" placeholder-class="ph" />
				</view>
				<view class="form-item">
					<text class="form-label">评分（1-5）</text>
					<view class="rating-row">
						<text
							v-for="n in 5"
							:key="n"
							class="star"
							:class="{ active: n <= form.rating }"
							@click="form.rating = n"
						>★</text>
					</view>
				</view>
				<view class="form-item">
					<text class="form-label">备注</text>
					<textarea class="form-textarea" v-model="form.note" placeholder="记下今天的感受..." placeholder-class="ph" />
				</view>
				<button class="wj-btn save-btn" :disabled="saving" :loading="saving" @click="handleSave">
					保存记录
				</button>
			</view>
		</view>
	</cl-page>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from "vue";
import { api } from "/@/utils/api";

const imageUrl = ref(''); // 临时文件路径
const recognizeResult = ref<any>(null);
const recognizeLoading = ref(false);
const beautifyLoading = ref(false);
const saving = ref(false);

const form = reactive({
	dishName: '',
	rating: 0,
	note: '',
});

// 营养四指标（兼容后端多种字段命名）
const nutrition = computed(() => {
	const r = recognizeResult.value || {};
	return {
		calories: r.calories ?? r.kcal ?? r.energy ?? 0,
		protein: r.protein ?? r.proteins ?? 0,
		carbs: r.carbs ?? r.carbohydrate ?? 0,
		fat: r.fat ?? r.fats ?? 0,
	};
});

// 食材列表
const ingredients = computed<string[]>(() => {
	const r = recognizeResult.value || {};
	const raw = r.ingredients || r.foods || r.items || [];
	if (Array.isArray(raw)) return raw.map((i: any) => (typeof i === 'string' ? i : i.name || i.food || ''));
	if (typeof raw === 'string') return raw.split(/[,，、]/).filter(Boolean);
	return [];
});

// 选择图片（uni.chooseImage）
function chooseImage() {
	uni.chooseImage({
		count: 1,
		sizeType: ['compressed'],
		sourceType: ['album', 'camera'],
		success: (res) => {
			const path = res.tempFilePaths[0];
			imageUrl.value = path;
			recognizeResult.value = null;
			form.dishName = '';
			form.rating = 0;
			form.note = '';
		},
	});
}

// AI 识别（api.ts 内部已封装 uni.uploadFile）
async function handleRecognize() {
	if (!imageUrl.value) return;
	recognizeLoading.value = true;
	try {
		const data: any = await api.recognizeFood(imageUrl.value);
		recognizeResult.value = data;
		// 预填菜品名
		form.dishName = data.dishName || data.name || data.dish || form.dishName;
		uni.showToast({ title: '识别成功', icon: 'success' });
	} catch {
		// api.ts 已统一 toast
	} finally {
		recognizeLoading.value = false;
	}
}

// AI 美化（api.ts 内部已封装 uni.uploadFile）
async function handleBeautify() {
	if (!imageUrl.value) return;
	beautifyLoading.value = true;
	try {
		const data: any = await api.beautifyImage(imageUrl.value);
		// 后端返回美化后图片地址或 base64
		const newUrl = data.imageUrl || data.url || data.beautifiedUrl;
		if (newUrl) {
			imageUrl.value = newUrl;
			uni.showToast({ title: '美化完成', icon: 'success' });
		}
	} catch {
		// api.ts 已统一 toast
	} finally {
		beautifyLoading.value = false;
	}
}

// 保存记录
async function handleSave() {
	if (!form.dishName.trim()) {
		uni.showToast({ title: '请填写菜品名称', icon: 'none' });
		return;
	}
	saving.value = true;
	try {
		await api.saveRecord({
			dishName: form.dishName.trim(),
			rating: form.rating,
			note: form.note,
			imageUrl: imageUrl.value,
			ingredients: ingredients.value,
			nutrition: nutrition.value,
		});
		uni.showToast({ title: '保存成功', icon: 'success' });
		// 重置并返回上一页
		setTimeout(() => {
			imageUrl.value = '';
			recognizeResult.value = null;
			form.dishName = '';
			form.rating = 0;
			form.note = '';
			uni.navigateBack();
		}, 600);
	} catch {
		// api.ts 已统一 toast
	} finally {
		saving.value = false;
	}
}
</script>

<style scoped>
.upload-card {
	padding: 0;
	overflow: hidden;
	margin-bottom: 24rpx;
}
.upload-placeholder {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 80rpx 0;
	background: #fff;
}
.upload-icon {
	font-size: 96rpx;
	margin-bottom: 16rpx;
}
.upload-text {
	font-size: 30rpx;
	color: var(--wj-text);
	font-weight: 500;
}
.upload-hint {
	font-size: 24rpx;
	color: var(--wj-text-muted);
	margin-top: 8rpx;
}
.preview-wrap {
	position: relative;
}
.preview-img {
	width: 100%;
	height: 480rpx;
	display: block;
	background: #f0f0f0;
}
.preview-actions {
	display: flex;
	gap: 16rpx;
	padding: 16rpx;
}
.action-btn {
	flex: 1;
	height: 72rpx;
	line-height: 72rpx;
	font-size: 26rpx;
	border-radius: 12rpx;
}

.recognize-btn {
	width: 100%;
	height: 96rpx;
	line-height: 96rpx;
	font-size: 30rpx;
	border-radius: 16rpx;
	margin-bottom: 16rpx;
}

.nutrition-grid {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: 16rpx;
	margin-bottom: 16rpx;
}
.nutrition-card {
	background: #fff;
	border-radius: var(--wj-radius);
	box-shadow: var(--wj-shadow);
	padding: 24rpx;
	text-align: center;
}
.nutrition-value {
	display: block;
	font-size: 44rpx;
	font-weight: 700;
	color: var(--wj-primary);
}
.nutrition-unit {
	display: block;
	font-size: 22rpx;
	color: var(--wj-text-muted);
	margin-top: -4rpx;
}
.nutrition-label {
	display: block;
	font-size: 24rpx;
	color: var(--wj-text);
	margin-top: 8rpx;
}

.ingredient-tags {
	display: flex;
	flex-wrap: wrap;
	gap: 16rpx;
	margin-bottom: 16rpx;
}
.ing-tag {
	font-size: 26rpx;
	color: var(--wj-primary);
	background: rgba(255, 107, 53, 0.08);
	padding: 8rpx 24rpx;
	border-radius: 24rpx;
}

.save-form .form-item {
	margin-bottom: 24rpx;
}
.form-label {
	display: block;
	font-size: 26rpx;
	color: var(--wj-text);
	margin-bottom: 12rpx;
	font-weight: 500;
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
.form-textarea {
	width: 100%;
	height: 160rpx;
	border: 2rpx solid var(--wj-border);
	border-radius: 12rpx;
	padding: 16rpx 20rpx;
	font-size: 28rpx;
	background: #fff;
}
.ph {
	color: var(--wj-text-muted);
}
.rating-row {
	display: flex;
	gap: 16rpx;
}
.star {
	font-size: 48rpx;
	color: #ddd;
}
.star.active {
	color: var(--wj-primary);
}
.save-btn {
	width: 100%;
	height: 96rpx;
	line-height: 96rpx;
	font-size: 32rpx;
	border-radius: 16rpx;
	margin-top: 16rpx;
}
</style>
