<template>
	<cl-page>
		<view class="page-content">
			<view class="page-header">
				<text class="page-title">美食记录</text>
			</view>

			<view class="search-bar">
				<text class="search-icon">🔍</text>
				<input
					class="search-input"
					v-model="keyword"
					placeholder="搜索美食记录"
					placeholder-class="ph"
					@confirm="loadRecords"
				/>
			</view>

			<view v-if="recordsLoading" class="empty-tip">加载中...</view>
			<view v-else-if="records.length" class="record-list">
				<view v-for="item in records" :key="item.id" class="wj-card record-card" @click="goDetail(item.id)">
					<image v-if="item.imageUrl || item.image" class="record-cover" :src="resolveImg(item.imageUrl || item.image)" mode="aspectFill" />
					<view class="record-content">
						<view class="record-header">
							<text class="record-name">{{ item.dishName || item.title || "未命名" }}</text>
							<text class="record-time">{{ formatTime(item.createdAt || item.time) }}</text>
						</view>
						<view v-if="toArray(item.ingredients).length" class="record-tags">
							<text
								v-for="(ing, idx) in toArray(item.ingredients).slice(0, 4)"
								:key="idx"
								class="tag"
							>{{ formatIngredient(ing) }}</text>
						</view>
						<view v-if="item.rating" class="record-rating">
							<text class="stars">{{ "★".repeat(Number(item.rating) || 0) }}</text>
						</view>
					</view>
				</view>
			</view>
			<view v-else class="empty-state">
				<text class="empty-text">还没有美食记录，快去AI记录添加吧~</text>
				<button class="wj-btn empty-btn" @click="goAiRecord">去 AI 记录</button>
			</view>
		</view>

		<tabbar />
	</cl-page>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import { onMounted } from "vue";
import { onShow, onPullDownRefresh } from "@dcloudio/uni-app";
import { api, resolveImg } from "/@/utils/api";
import Tabbar from "/@/pages/index/components/tabbar.vue";

const records = ref<any[]>([]);
const recordsLoading = ref(false);
const keyword = ref("");

function toArray(val: any): any[] {
	if (Array.isArray(val)) return val;
	if (typeof val === "string") {
		try {
			const parsed = JSON.parse(val);
			if (Array.isArray(parsed)) return parsed;
		} catch {
			// ignore
		}
		return val.split(/[,，、]/).filter(Boolean);
	}
	return [];
}

function formatIngredient(val: any): string {
	if (!val) return "";
	if (typeof val === "string") {
		try {
			const parsed = JSON.parse(val);
			if (typeof parsed === "object" && parsed !== null) {
				return parsed.name || parsed.food || "";
			}
		} catch {
			return val;
		}
		return val;
	}
	if (typeof val === "object") return val.name || val.food || "";
	return String(val);
}

function formatTime(t: string) {
	if (!t) return "";
	return String(t).replace("T", " ").slice(0, 16);
}

function sortRecords(list: any[]) {
	return list.sort((a, b) => {
		const timeA = new Date(a.createdAt || a.time || 0).getTime();
		const timeB = new Date(b.createdAt || b.time || 0).getTime();
		return timeB - timeA;
	});
}

async function loadRecords() {
	recordsLoading.value = true;
	try {
		const data: any = await api.getRecords(keyword.value ? { keyword: keyword.value } : undefined);
		const list = Array.isArray(data) ? data : data?.list || data?.records || [];
		records.value = sortRecords(list);
	} catch {
		records.value = [];
	} finally {
		recordsLoading.value = false;
	}
}

function goDetail(id: number) {
	uni.navigateTo({ url: `/pages/record/detail?id=${id}` });
}

function goAiRecord() {
	uni.navigateTo({ url: "/pages/record/ai-record" });
}

// 首次加载由 onMounted 完成；onShow 仅在返回页面时刷新，避免首屏重复请求
const recordsLoadedOnce = ref(false);
onMounted(() => {
	loadRecords();
	recordsLoadedOnce.value = true;
});

onShow(() => {
	if (recordsLoadedOnce.value) loadRecords();
});

onPullDownRefresh(async () => {
	await loadRecords();
	uni.stopPullDownRefresh();
});
</script>

<style scoped>
.page-content {
	padding: 16rpx 28rpx 140rpx;
}

.page-header {
	padding: 16rpx 4rpx 12rpx;
}

.page-title {
	display: block;
	font-size: 44rpx;
	font-weight: 700;
	color: var(--wj-text);
}

.search-bar {
	display: flex;
	align-items: center;
	background: var(--wj-card-bg);
	border-radius: 16rpx;
	padding: 0 24rpx;
	height: 80rpx;
	margin-bottom: 8rpx;
	box-shadow: var(--wj-shadow);
}

.search-icon {
	font-size: 28rpx;
	margin-right: 12rpx;
}

.search-input {
	flex: 1;
	font-size: 28rpx;
	color: var(--wj-text);
}

.record-list {
	display: flex;
	flex-direction: column;
	gap: 0;
}

.record-card {
	padding: 0;
	overflow: hidden;
}

.record-cover {
	width: 100%;
	height: 320rpx;
	display: block;
	background: #f0f0f0;
}

.record-content {
	padding: 24rpx 28rpx;
}

.record-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 16rpx;
}

.record-name {
	font-weight: 600;
	font-size: 30rpx;
	color: var(--wj-text);
}

.record-time {
	font-size: 24rpx;
	color: var(--wj-text-muted);
}

.record-tags {
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
}

.tag {
	font-size: 22rpx;
	color: var(--wj-primary);
	background: rgba(255, 107, 53, 0.08);
	padding: 4rpx 16rpx;
	border-radius: 8rpx;
}

.record-rating {
	margin-top: 16rpx;
}

.stars {
	color: var(--wj-primary);
	font-size: 26rpx;
}

.empty-state {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 80rpx 0;
}

.empty-text {
	color: var(--wj-text-muted);
	font-size: 28rpx;
	margin-bottom: 32rpx;
}

.empty-btn {
	margin: 0;
	height: 72rpx;
	line-height: 72rpx;
	padding: 0 48rpx;
	font-size: 28rpx;
	border-radius: 36rpx;
}
</style>
