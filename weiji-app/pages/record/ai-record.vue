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
					<!-- AI 美化风格：选中后点击「AI 美化」按该风格出图 -->
					<view class="style-row">
						<text
							v-for="s in beautifyStyles"
							:key="s.value"
							class="style-chip"
							:class="{ active: beautifyStyle === s.value }"
							@click="beautifyStyle = s.value"
						>{{ s.label }}</text>
					</view>
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
			<view v-if="recognizeResult" id="save-form" class="wj-card save-form">
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

		<!-- 图片裁剪+压缩（选图后弹出，确认后产物赋给 imageUrl） -->
		<wj-image-cropper
			:src="cropSrc"
			v-model:visible="cropperVisible"
			:max-edge="1280"
			:quality="0.8"
			@confirm="onCropped"
		/>
	</cl-page>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from "vue";
import { api, resolveImg } from "/@/utils/api";

// imageUrl：用于 <image :src> 显示，裁剪后是本地临时路径，美化后是 resolveImg 处理后的可访问 URL
const imageUrl = ref('');
// localFilePath：永远指向可上传的本地文件路径，uploadFile 必须使用本地路径（不能是服务器 URL）
// 裁剪后设置为本地临时路径；美化返回服务器 URL 时下载到本地更新此值
const localFilePath = ref('');
// persistImageUrl：保存到后端的图片路径（服务器相对路径，如 /static/ai_xxx.jpg 或 /upload/xxx.jpg）
// 裁剪阶段为空（尚未上传到服务器），美化成功后写入后端返回的 beautifiedUrl，保存记录时发送给后端
const persistImageUrl = ref('');
const recognizeResult = ref<any>(null);
const recognizeLoading = ref(false);
const beautifyLoading = ref(false);
// AI 美化风格（传给后端 /app/ai/beautify 的 style 字段，对应不同 prompt）
const beautifyStyle = ref<"auto" | "poster" | "vivid" | "art">("auto");
const beautifyStyles = [
	{ value: "auto", label: "美食大片" },
	{ value: "poster", label: "海报" },
	{ value: "vivid", label: "浓郁" },
	{ value: "art", label: "艺术" },
] as const;
const saving = ref(false);
const cropSrc = ref(''); // 待裁剪原图路径（选图后、裁剪前）
const cropperVisible = ref(false); // 裁剪弹层显隐

const form = reactive({
	dishName: '',
	rating: 0,
	note: '',
});

// 营养四指标（weiji-ai 实际返回嵌套 nutrition 对象，兼容历史顶层字段命名）
const nutrition = computed(() => {
	const r = recognizeResult.value || {};
	const n = r.nutrition || {};
	return {
		calories: n.calories ?? r.calories ?? r.kcal ?? r.energy ?? 0,
		protein: n.protein ?? r.protein ?? r.proteins ?? 0,
		carbs: n.carbs ?? r.carbs ?? r.carbohydrate ?? 0,
		fat: n.fat ?? r.fats ?? r.fat ?? 0,
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

// 选择图片 → 进入裁剪（裁剪组件内完成压缩，产物再赋给 imageUrl）
function chooseImage() {
	uni.chooseImage({
		count: 1,
		sizeType: ['compressed'],
		sourceType: ['album', 'camera'],
		success: (res) => {
			cropSrc.value = res.tempFilePaths[0];
			cropperVisible.value = true;
		},
	});
}

// 裁剪完成回调：拿到本地裁剪+压缩后的临时图，同时作为预览源与后续上传源
function onCropped(path: string) {
	imageUrl.value = path;
	localFilePath.value = path;
	persistImageUrl.value = ''; // 新裁剪的图尚未上传/美化，持久化路径清空
	recognizeResult.value = null;
	form.dishName = '';
	form.rating = 0;
	form.note = '';
}

// 确保 src 是本地路径：若为远程 URL 则先下载到本地临时文件，避免 uploadFile 失败
async function ensureLocalPath(src: string): Promise<string> {
	if (/^https?:\/\//.test(src)) {
		return new Promise((resolve, reject) => {
			uni.downloadFile({
				url: src,
				success: (res) => {
					if (res.statusCode === 200 && res.tempFilePath) {
						resolve(res.tempFilePath);
					} else {
						reject(new Error('下载图片失败'));
					}
				},
				fail: reject,
			});
		});
	}
	return src;
}

// AI 识别（api.ts 内部已封装 uni.uploadFile）
// 注意：必须用 localFilePath（本地路径）上传，不能用 imageUrl（可能是服务器 URL）
async function handleRecognize() {
	let src = localFilePath.value || imageUrl.value;
	if (!src) return;
	try {
		src = await ensureLocalPath(src);
	} catch {
		uni.showToast({ title: '图片加载失败，请重新选择', icon: 'none' });
		return;
	}
	recognizeLoading.value = true;
	uni.showLoading({ title: '正在识别…', mask: true });
	let ok = false;
	try {
		const data: any = await api.recognizeFood(src);
		recognizeResult.value = data;
		// 预填菜品名
		form.dishName = data.dishName || data.name || data.dish || form.dishName;
		// 识别接口返回的是营养/食材数据，不返回新图片；不再覆盖 imageUrl/localFilePath
		// （旧逻辑覆盖 imageUrl 会导致本地路径丢失，后续美化因 uploadFile 无法上传远程 URL 而报错）
		ok = true;
	} catch {
		// api.ts 已统一 toast
	} finally {
		recognizeLoading.value = false;
		// 必须先关 loading 再弹 toast：uni 的 loading 与 toast 共用同一组件，
		// 并发触发会互相覆盖，导致成功提示被 hideLoading 一并清掉。
		uni.hideLoading();
		if (ok) {
			uni.showToast({ title: '识别成功', icon: 'success' });
			// 识别成功后自动滚动到保存表单，让"保存记录"按钮立即可见
			setTimeout(() => {
				const query = uni.createSelectorQuery();
				query.select('#save-form').boundingClientRect();
				query.selectViewport().scrollOffset();
				query.exec((res: any) => {
					const rect = res?.[0];
					const scroll = res?.[1];
					if (rect && scroll) {
						uni.pageScrollTo({
							scrollTop: Math.max(0, rect.top + scroll.scrollTop - 20),
							duration: 300,
						});
					}
				});
			}, 400);
		}
	}
}

// AI 美化（api.ts 内部已封装 uni.uploadFile）
// 使用 localFilePath 上传（本地路径），美化后用 resolveImg 拼接完整 URL 显示，
// 并下载到本地更新 localFilePath，保证后续"再次识别/再次美化"仍可正常上传
async function handleBeautify() {
	let src = localFilePath.value || imageUrl.value;
	if (!src) return;
	try {
		src = await ensureLocalPath(src);
	} catch {
		uni.showToast({ title: '图片加载失败，请重新选择', icon: 'none' });
		return;
	}
	beautifyLoading.value = true;
	uni.showLoading({ title: '正在美化…', mask: true });
	let ok = false;
	try {
		const data: any = await api.beautifyImage(src, beautifyStyle.value);
		// 后端返回美化后图片地址（相对路径 /static/xxx.jpg 或完整 URL）
		const rawUrl = data.beautifiedUrl || data.imageUrl || data.url;
		if (rawUrl) {
			// 1) 显示用：resolveImg 将相对路径拼接 HOST（H5 走 vite 代理，非 H5 拼完整域名）
			imageUrl.value = resolveImg(rawUrl);
			// 2) 持久化用：保存后端返回的路径（相对路径 /static/ai_xxx.jpg 或完整 URL），后续 saveRecord 直接透传给后端
			persistImageUrl.value = rawUrl;
			// 3) 后续上传用：下载美化后图片到本地临时路径，避免 localFilePath 变成服务器 URL
			//    H5 下 uni.downloadFile 受跨域限制可能失败，降级为保留原 localFilePath
			await new Promise<void>((resolve) => {
				uni.downloadFile({
					url: resolveImg(rawUrl),
					success: (res) => {
						if (res.statusCode === 200 && res.tempFilePath) {
							localFilePath.value = res.tempFilePath;
						}
					},
					fail: () => {
						// H5 跨域或其他失败场景：保持原有 localFilePath 不覆盖，用户仍可基于原图再次操作
					},
					complete: () => resolve(),
				});
			});
			ok = true;
		}
	} catch {
		// api.ts 已统一 toast
	} finally {
		beautifyLoading.value = false;
		uni.hideLoading();
		if (ok) uni.showToast({ title: '美化完成', icon: 'success' });
	}
}

// 保存记录
async function handleSave() {
	if (!form.dishName.trim()) {
		uni.showToast({ title: '请填写菜品名称', icon: 'none' });
		return;
	}
	saving.value = true;
	uni.showLoading({ title: '保存中…', mask: true });
	try {
		// 确定持久化图片路径：
		//   1) 已美化：使用 beautify 返回的相对路径（/static/ai_xxx.jpg）
		//   2) 未美化但有本地路径：先上传到通用 upload 接口，拿到 /upload/xxx.jpg
		//   3) imageUrl 已是 http(s) URL（极端情况）：直接存
		let finalImageUrl = persistImageUrl.value;
		if (!finalImageUrl) {
			const src = localFilePath.value || imageUrl.value;
			if (src && /^https?:\/\//.test(src)) {
				finalImageUrl = src;
			} else if (src) {
				try {
					finalImageUrl = await api.uploadFile(src);
				} catch {
					uni.showToast({ title: '图片上传失败', icon: 'none' });
					saving.value = false;
					uni.hideLoading();
					return;
				}
			}
		}
		await api.saveRecord({
			dishName: form.dishName.trim(),
			rating: form.rating,
			note: form.note,
			imageUrl: finalImageUrl,
			beautifiedUrl: persistImageUrl.value,
			ingredients: ingredients.value,
			nutrition: nutrition.value,
		});
		uni.hideLoading();
		uni.showToast({ title: '保存成功', icon: 'success' });
		// 通知首页刷新记录（双保险：配合首页 onShow 自动刷新）
		uni.$emit('recordSaved');
		// 重置并返回上一页
		setTimeout(() => {
			imageUrl.value = '';
			localFilePath.value = '';
			persistImageUrl.value = '';
			recognizeResult.value = null;
			form.dishName = '';
			form.rating = 0;
			form.note = '';
			uni.navigateBack();
		}, 600);
	} catch {
		// api.ts 已统一 toast
		uni.hideLoading();
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
.style-row {
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
	padding: 16rpx 16rpx 0;
}
.style-chip {
	font-size: 24rpx;
	color: var(--wj-text-muted);
	background: #f5f5f5;
	padding: 8rpx 24rpx;
	border-radius: 24rpx;
}
.style-chip.active {
	color: #fff;
	background: var(--wj-primary);
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
/* 页面底部留白，确保保存按钮完全可见 */
.save-form {
	margin-bottom: 48rpx;
}
</style>
