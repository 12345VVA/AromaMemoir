<template>
	<cl-page>
		<view class="page-content">
			<view v-if="loading" class="empty-tip">加载中...</view>
			<view v-else-if="!record" class="empty-wrap">
				<text class="empty-tip">记录不存在</text>
				<button class="wj-btn back-btn" @click="goBack">返回</button>
			</view>
			<view v-else>
				<!-- 菜品图片 -->
				<view v-if="record.imageUrl" class="cover-wrap">
					<image class="cover-img" :src="record.imageUrl" mode="aspectFill" />
				</view>

				<!-- 基本信息 -->
				<view class="wj-card info-card">
					<text class="dish-name">{{ record.dishName || record.title || "未命名" }}</text>
					<view class="rating-row">
						<text
							v-for="n in 5"
							:key="n"
							class="star"
							:class="{ active: n <= Number(record.rating) || 0 }"
						>★</text>
						<text v-if="record.rating" class="rating-text">{{ record.rating }} 分</text>
					</view>
					<view class="meta-row">
						<text v-if="recordDateText" class="meta-text">📅 {{ recordDateText }}</text>
						<text v-if="mealTypeText" class="meta-tag">{{ mealTypeText }}</text>
					</view>
				</view>

				<!-- 食材标签 -->
				<view class="section-title">食材</view>
				<view class="wj-card">
					<view v-if="ingredients.length" class="chip-list">
						<text v-for="(ing, idx) in ingredients" :key="idx" class="chip">{{ ing }}</text>
					</view>
					<text v-else class="empty-tip">暂无食材信息</text>
				</view>

				<!-- 烹饪方式 -->
				<view v-if="record.cookingMethod" class="section-title">烹饪方式</view>
				<view v-if="record.cookingMethod" class="wj-card">
					<text class="block-text">{{ record.cookingMethod }}</text>
				</view>

				<!-- 营养信息 -->
				<view v-if="nutritionItems.length" class="section-title">营养信息</view>
				<view v-if="nutritionItems.length" class="wj-card">
					<view v-for="item in nutritionItems" :key="item.label" class="kv-row">
						<text class="kv-label">{{ item.label }}</text>
						<text class="kv-value">{{ item.value }}{{ item.unit }}</text>
					</view>
				</view>

				<!-- 备注 -->
				<view v-if="record.note" class="section-title">备注</view>
				<view v-if="record.note" class="wj-card">
					<text class="block-text">{{ record.note }}</text>
				</view>

				<!-- 标签 -->
				<view v-if="tags.length" class="section-title">标签</view>
				<view v-if="tags.length" class="wj-card">
					<view class="chip-list">
						<text v-for="(tag, idx) in tags" :key="idx" class="chip chip--tag">{{ tag }}</text>
					</view>
				</view>
			</view>
		</view>
	</cl-page>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { api } from "/@/utils/api";

const record = ref<any>(null);
const loading = ref(true);

// 食材列表（兼容字符串数组 / 对象数组 / 逗号字符串）
const ingredients = computed<string[]>(() => {
	const r = record.value || {};
	const raw = r.ingredients || r.foods || r.items || [];
	if (Array.isArray(raw)) return raw.map((i: any) => (typeof i === "string" ? i : i.name || i.food || "")).filter(Boolean);
	if (typeof raw === "string") return raw.split(/[,，、]/).filter(Boolean);
	return [];
});

// 标签列表
const tags = computed<string[]>(() => {
	const r = record.value || {};
	const raw = r.tags || [];
	if (Array.isArray(raw)) return raw.map((t: any) => (typeof t === "string" ? t : t.name || "")).filter(Boolean);
	if (typeof raw === "string") return raw.split(/[,，、]/).filter(Boolean);
	return [];
});

// 营养信息（兼容后端多种字段命名）
const nutritionItems = computed<{ label: string; value: any; unit: string }[]>(() => {
	const r = record.value || {};
	const n = r.nutrition || {};
	const list = [
		{ key: "calories", aliases: ["calories", "kcal", "energy"], label: "热量", unit: " 千卡" },
		{ key: "protein", aliases: ["protein", "proteins"], label: "蛋白质", unit: " 克" },
		{ key: "carbs", aliases: ["carbs", "carbohydrate"], label: "碳水", unit: " 克" },
		{ key: "fat", aliases: ["fat", "fats"], label: "脂肪", unit: " 克" },
	];
	return list
		.map((it) => {
			const val = it.aliases.reduce((v: any, k: string) => (v ?? n[k]) ?? v, n[it.key]);
			return { label: it.label, value: val ?? 0, unit: it.unit };
		})
		.filter((it) => it.value !== 0 && it.value !== undefined && it.value !== null);
});

// 记录日期（兼容 recordDate / date / createdAt）
const recordDateText = computed(() => {
	const r = record.value || {};
	const d = r.recordDate || r.date || r.createdAt || r.time || "";
	if (!d) return "";
	return String(d).replace("T", " ").slice(0, 16);
});

// 餐次映射
const mealTypeText = computed(() => {
	const r = record.value || {};
	const m = r.mealType || r.meal || "";
	const map: Record<string, string> = {
		breakfast: "早餐",
		lunch: "午餐",
		dinner: "晚餐",
		snack: "小食",
	};
	return map[m] || (m ? String(m) : "");
});

async function loadDetail(id: string | number) {
	loading.value = true;
	try {
		const data: any = await api.getRecord(id);
		record.value = data || null;
	} catch {
		record.value = null;
	} finally {
		loading.value = false;
	}
}

function goBack() {
	uni.navigateBack();
}

onLoad((options: any) => {
	const id = options?.id;
	if (id) loadDetail(id);
	else loading.value = false;
});
</script>

<style scoped>
.cover-wrap {
	width: 100%;
	height: 480rpx;
	margin-bottom: 16rpx;
	border-radius: var(--wj-radius);
	overflow: hidden;
	background: #f0f0f0;
}
.cover-img {
	width: 100%;
	height: 100%;
	display: block;
}

.info-card {
	padding: 24rpx 28rpx;
}
.dish-name {
	display: block;
	font-size: 40rpx;
	font-weight: 700;
	color: var(--wj-text);
	margin-bottom: 16rpx;
}
.rating-row {
	display: flex;
	align-items: center;
	gap: 12rpx;
	margin-bottom: 16rpx;
}
.star {
	font-size: 40rpx;
	color: #ddd;
}
.star.active {
	color: var(--wj-primary);
}
.rating-text {
	font-size: 24rpx;
	color: var(--wj-text-muted);
	margin-left: 8rpx;
}
.meta-row {
	display: flex;
	align-items: center;
	gap: 16rpx;
	flex-wrap: wrap;
}
.meta-text {
	font-size: 24rpx;
	color: var(--wj-text-muted);
}
.meta-tag {
	font-size: 24rpx;
	color: var(--wj-primary);
	background: rgba(255, 107, 53, 0.08);
	padding: 4rpx 16rpx;
	border-radius: 8rpx;
}

.chip-list {
	display: flex;
	flex-wrap: wrap;
	gap: 16rpx;
}
.chip {
	font-size: 26rpx;
	color: var(--wj-primary);
	background: rgba(255, 107, 53, 0.08);
	padding: 8rpx 24rpx;
	border-radius: 24rpx;
}
.chip--tag {
	color: var(--wj-text);
	background: #f2f3f5;
}

.block-text {
	display: block;
	font-size: 28rpx;
	color: var(--wj-text);
	line-height: 1.6;
}

.kv-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 16rpx 0;
}
.kv-row + .kv-row {
	border-top: 2rpx solid var(--wj-border);
}
.kv-label {
	font-size: 28rpx;
	color: var(--wj-text);
}
.kv-value {
	font-size: 28rpx;
	font-weight: 600;
	color: var(--wj-primary);
}

.empty-wrap {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 120rpx 0;
}
.empty-tip {
	font-size: 28rpx;
	color: var(--wj-text-muted);
	text-align: center;
}
.back-btn {
	width: 60%;
	height: 88rpx;
	line-height: 88rpx;
	font-size: 30rpx;
	border-radius: 16rpx;
	margin-top: 32rpx;
}
</style>
