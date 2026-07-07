<template>
	<cl-page>
		<view class="page-content">
			<view v-if="loading" class="empty-tip">加载中...</view>
			<view v-else-if="!recipe" class="empty-tip">菜谱不存在</view>
			<view v-else>
				<!-- 封面 -->
				<view class="cover-wrap">
					<image v-if="recipe.coverUrl" class="cover-img" :src="recipe.coverUrl" mode="aspectFill" />
					<view v-else class="cover-placeholder">🍽️</view>
				</view>

				<!-- 基本信息 -->
				<view class="wj-card info-card">
					<text class="recipe-title">{{ recipe.name }}</text>
					<view class="meta-row">
						<text class="meta-tag">{{ recipe.category || "其他" }}</text>
						<text v-if="recipe.difficulty" class="meta-text">难度：{{ difficultyText(recipe.difficulty) }}</text>
						<text v-if="recipe.cookTime" class="meta-text">⏱ {{ recipe.cookTime }}</text>
					</view>
					<view class="author-row">
						<text class="author-name">by {{ recipe.authorName || recipe.author || "匿名" }}</text>
						<text class="vis-text">{{ visibilityText(recipe.visibility) }}</text>
					</view>
				</view>

				<!-- 食材 -->
				<view class="section-title">食材</view>
				<view class="wj-card">
					<view v-for="(ing, idx) in ingredients" :key="idx" class="ing-item">
						<text class="ing-dot">•</text>
						<text class="ing-text">{{ typeof ing === "string" ? ing : ing.name + (ing.amount ? " " + ing.amount : "") }}</text>
					</view>
					<view v-if="!ingredients.length" class="empty-tip">暂无食材信息</view>
				</view>

				<!-- 步骤 -->
				<view class="section-title">做法</view>
				<view class="wj-card">
					<view v-for="(step, idx) in steps" :key="idx" class="step-item">
						<view class="step-num">{{ idx + 1 }}</view>
						<view class="step-body">
							<text class="step-text">{{ typeof step === "string" ? step : step.text || step.description }}</text>
							<image v-if="step.imageUrl" class="step-img" :src="step.imageUrl" mode="aspectFill" />
						</view>
					</view>
					<view v-if="!steps.length" class="empty-tip">暂无步骤信息</view>
				</view>

				<!-- 操作按钮（作者鉴权） -->
				<view v-if="canEdit" class="action-row">
					<button class="wj-btn wj-btn-ghost action-btn" @click="goEdit">编辑</button>
					<button class="wj-btn action-btn danger-btn" @click="handleDelete">删除</button>
				</view>
				<button class="wj-btn menu-btn" @click="showMenuModal = true">加入菜单</button>
			</view>

			<!-- 加入菜单弹窗 -->
			<view v-if="showMenuModal" class="modal-mask" @click="showMenuModal = false">
				<view class="modal-content" @click.stop>
					<text class="modal-title">加入家庭菜单</text>
					<view class="form-item">
						<text class="form-label">用餐日期</text>
						<picker mode="date" :value="menuForm.date" @change="onDateChange">
							<view class="picker-value">{{ menuForm.date || "请选择日期" }}</view>
						</picker>
					</view>
					<view class="form-item">
						<text class="form-label">餐次</text>
						<picker :range="mealOptions" :value="mealIndex" @change="onMealChange">
							<view class="picker-value">{{ mealOptions[mealIndex] }}</view>
						</picker>
					</view>
					<button class="wj-btn confirm-btn" :disabled="menuSaving" :loading="menuSaving" @click="confirmAddMenu">
						确认加入
					</button>
					<text class="modal-close" @click="showMenuModal = false">取消</text>
				</view>
			</view>
		</view>
	</cl-page>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { useStore } from "/@/cool";
import { api } from "/@/utils/api";

const { user } = useStore();
const recipeId = ref("");
const recipe = ref<any>(null);
const loading = ref(true);
const showMenuModal = ref(false);
const menuSaving = ref(false);

const mealOptions = ["早餐", "午餐", "晚餐", "小食"];
const mealIndex = ref(1);
const menuForm = reactive({ date: "" });

const ingredients = computed<any[]>(() => {
	const r = recipe.value || {};
	const raw = r.ingredients || [];
	if (Array.isArray(raw)) return raw;
	if (typeof raw === "string") return raw.split(/[,，、]/).filter(Boolean);
	return [];
});

const steps = computed<any[]>(() => {
	const r = recipe.value || {};
	const raw = r.steps || r.instructions || [];
	if (Array.isArray(raw)) return raw;
	if (typeof raw === "string") return raw.split(/\n+/).filter(Boolean);
	return [];
});

// 作者鉴权：当前用户为菜谱作者
const canEdit = computed(() => {
	if (!recipe.value) return false;
	const curUser = user.info || {};
	const curId = curUser.id || curUser.userId || curUser._id;
	const authorId = recipe.value.authorId || recipe.value.userId || recipe.value.createdBy;
	if (authorId && curId && String(authorId) === String(curId)) return true;
	return false;
});

function difficultyText(d: string) {
	const map: Record<string, string> = { easy: "简单", medium: "中等", hard: "困难" };
	return map[d] || d;
}
function visibilityText(v: string) {
	return v === "private" ? "🔒仅自己" : v === "family" ? "👨‍👩‍👧家庭" : "🌍公开";
}

async function loadDetail() {
	loading.value = true;
	try {
		const data: any = await api.getRecipeDetail(recipeId.value);
		recipe.value = data;
	} catch {
		recipe.value = null;
	} finally {
		loading.value = false;
	}
}

function onDateChange(e: any) {
	menuForm.date = e.detail.value;
}
function onMealChange(e: any) {
	mealIndex.value = e.detail.value;
}

async function confirmAddMenu() {
	if (!menuForm.date) {
		uni.showToast({ title: "请选择日期", icon: "none" });
		return;
	}
	menuSaving.value = true;
	try {
		await api.addToMenu({
			recipeId: recipeId.value,
			date: menuForm.date,
			meal: ["breakfast", "lunch", "dinner", "snack"][mealIndex.value],
		});
		uni.showToast({ title: "已加入菜单", icon: "success" });
		showMenuModal.value = false;
	} catch {
		// api.ts 已统一 toast
	} finally {
		menuSaving.value = false;
	}
}

function goEdit() {
	uni.navigateTo({ url: `/pages/family/recipe-form?id=${recipeId.value}` });
}

async function handleDelete() {
	uni.showModal({
		title: "确认删除",
		content: "确定要删除这个菜谱吗？删除后不可恢复。",
		confirmColor: "#FF6B35",
		success: async (res) => {
			if (!res.confirm) return;
			try {
				await api.deleteRecipe(recipeId.value);
				uni.showToast({ title: "已删除", icon: "success" });
				setTimeout(() => uni.navigateBack(), 600);
			} catch {
				// api.ts 已统一 toast
			}
		},
	});
}

onLoad((options: any) => {
	recipeId.value = options?.id || "";
	if (recipeId.value) loadDetail();
});
</script>

<style scoped>
.cover-wrap {
	width: 100%;
	height: 400rpx;
	margin-bottom: 16rpx;
	border-radius: var(--wj-radius);
	overflow: hidden;
	background: #f0f0f0;
}
.cover-img {
	width: 100%;
	height: 100%;
}
.cover-placeholder {
	width: 100%;
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 120rpx;
}

.info-card {
	padding: 24rpx 28rpx;
}
.recipe-title {
	display: block;
	font-size: 40rpx;
	font-weight: 700;
	color: var(--wj-text);
	margin-bottom: 16rpx;
}
.meta-row {
	display: flex;
	align-items: center;
	gap: 16rpx;
	margin-bottom: 12rpx;
	flex-wrap: wrap;
}
.meta-tag {
	font-size: 24rpx;
	color: var(--wj-primary);
	background: rgba(255, 107, 53, 0.08);
	padding: 4rpx 16rpx;
	border-radius: 8rpx;
}
.meta-text {
	font-size: 24rpx;
	color: var(--wj-text-muted);
}
.author-row {
	display: flex;
	justify-content: space-between;
}
.author-name {
	font-size: 24rpx;
	color: var(--wj-text-muted);
}
.vis-text {
	font-size: 24rpx;
	color: var(--wj-text-muted);
}

.ing-item {
	display: flex;
	align-items: flex-start;
	padding: 12rpx 0;
}
.ing-dot {
	color: var(--wj-primary);
	margin-right: 16rpx;
	font-size: 28rpx;
}
.ing-text {
	flex: 1;
	font-size: 28rpx;
	color: var(--wj-text);
}

.step-item {
	display: flex;
	align-items: flex-start;
	padding: 16rpx 0;
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
	margin-right: 20rpx;
	flex-shrink: 0;
}
.step-body {
	flex: 1;
}
.step-text {
	display: block;
	font-size: 28rpx;
	color: var(--wj-text);
	line-height: 1.6;
}
.step-img {
	width: 100%;
	height: 320rpx;
	margin-top: 16rpx;
	border-radius: var(--wj-radius);
}

.action-row {
	display: flex;
	gap: 16rpx;
	margin: 24rpx 0;
}
.action-btn {
	flex: 1;
	height: 88rpx;
	line-height: 88rpx;
	font-size: 30rpx;
	border-radius: 16rpx;
}
.danger-btn {
	background: #fff;
	color: #e54848;
	border: 2rpx solid #e54848;
}

.menu-btn {
	width: 100%;
	height: 96rpx;
	line-height: 96rpx;
	font-size: 32rpx;
	border-radius: 16rpx;
	margin-bottom: 32rpx;
}

/* 弹窗 */
.modal-mask {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background: rgba(0, 0, 0, 0.5);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 999;
}
.modal-content {
	width: 80%;
	max-width: 600rpx;
	background: #fff;
	border-radius: 24rpx;
	padding: 48rpx 32rpx;
}
.modal-title {
	display: block;
	font-size: 34rpx;
	font-weight: 600;
	color: var(--wj-text);
	margin-bottom: 32rpx;
	text-align: center;
}
.form-item {
	margin-bottom: 24rpx;
}
.form-label {
	display: block;
	font-size: 26rpx;
	color: var(--wj-text);
	margin-bottom: 12rpx;
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
.confirm-btn {
	width: 100%;
	height: 88rpx;
	line-height: 88rpx;
	font-size: 30rpx;
	border-radius: 16rpx;
	margin-top: 16rpx;
}
.modal-close {
	display: block;
	text-align: center;
	margin-top: 24rpx;
	font-size: 26rpx;
	color: var(--wj-text-muted);
}
</style>
