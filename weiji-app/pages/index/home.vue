<template>
	<cl-page>
		<view class="page-content">
			<!-- 顶部标题 -->
			<view class="page-header">
				<text class="page-title">味记</text>
				<text class="page-sub">记录每一餐的美好</text>
			</view>

			<!-- 打卡卡片 -->
			<view class="wj-card checkin-card">
				<view class="checkin-info">
					<view class="checkin-left">
						<text class="checkin-title">连续打卡</text>
						<text class="checkin-text">
							{{ checkin.checked ? "今日已打卡" : "今日尚未打卡" }}
							<text v-if="checkin.streak"> · 已坚持 {{ checkin.streak }} 天</text>
						</text>
					</view>
					<button
						class="wj-btn checkin-btn"
						:disabled="checkin.checked || checkinLoading"
						:loading="checkinLoading"
						@click="handleCheckin"
					>
						{{ checkin.checked ? "已打卡" : "今日打卡" }}
					</button>
				</view>
			</view>

			<!-- 快捷入口 -->
			<view class="quick-grid">
				<view class="quick-item" @click="goAiRecord">
					<text class="quick-icon">📸</text>
					<text class="quick-text">AI 记录</text>
				</view>
				<view class="quick-item" @click="goFamily">
					<text class="quick-icon">👨‍👩‍👧</text>
					<text class="quick-text">家庭菜谱</text>
				</view>
				<view class="quick-item" @click="goAchievement">
					<text class="quick-icon">🏆</text>
					<text class="quick-text">成就中心</text>
				</view>
				<view class="quick-item" @click="goGamification">
					<text class="quick-icon">🎮</text>
					<text class="quick-text">游戏化</text>
				</view>
			</view>

			<!-- 搜索框 -->
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

			<!-- 美食日记 -->
			<view class="section-title">美食日记</view>
			<view v-if="recordsLoading" class="empty-tip">加载中...</view>
			<view v-else-if="records.length" class="record-list">
				<view v-for="item in records" :key="item.id" class="wj-card record-card" @click="goAiRecord">
					<view class="record-header">
						<text class="record-name">{{ item.dishName || item.title || "未命名" }}</text>
						<text class="record-time">{{ formatTime(item.createdAt || item.time) }}</text>
					</view>
					<view v-if="toArray(item.ingredients).length" class="record-tags">
						<text
							v-for="(ing, idx) in toArray(item.ingredients).slice(0, 4)"
							:key="idx"
							class="tag"
						>{{ ing }}</text>
					</view>
					<view v-if="item.rating" class="record-rating">
						<text class="stars">{{ "★".repeat(Number(item.rating) || 0) }}</text>
					</view>
				</view>
			</view>
			<view v-else class="empty-tip">还没有美食记录，去 AI 记录页添加吧～</view>

			<!-- AI 推荐 -->
			<view v-if="recommendations.length" class="recommend-section">
				<view class="section-title">
					<text class="rec-icon">✨</text>
					<text>为你推荐</text>
				</view>
				<scroll-view class="recommend-list no-scrollbar" scroll-x>
					<view v-for="(rec, idx) in recommendations" :key="idx" class="recommend-card">
						<text class="recommend-name">{{ rec.dishName || rec.name || "推荐菜" }}</text>
						<text class="recommend-desc">{{ rec.reason || rec.description || "AI 根据你的口味精选" }}</text>
					</view>
				</scroll-view>
			</view>
		</view>

		<tabbar />
	</cl-page>
</template>

<script lang="ts" setup>
import { ref, reactive, onMounted } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { api } from "/@/utils/api";
import Tabbar from "./components/tabbar.vue";

const records = ref<any[]>([]);
const recordsLoading = ref(false);
const recommendations = ref<any[]>([]);
const checkinLoading = ref(false);
const keyword = ref("");

const checkin = reactive({
	checked: false,
	streak: 0,
});

// 加载美食记录
async function loadRecords() {
	recordsLoading.value = true;
	try {
		const data: any = await api.getRecords(keyword.value ? { keyword: keyword.value } : undefined);
		records.value = Array.isArray(data) ? data : data?.list || data?.records || [];
	} catch {
		records.value = [];
	} finally {
		recordsLoading.value = false;
	}
}

// 加载打卡状态
async function loadCheckin() {
	try {
		const data: any = await api.getCheckinStatus();
		checkin.checked = !!data.checked;
		checkin.streak = data.streak || data.continuousDays || 0;
	} catch {
		// 静默处理
	}
}

// 执行打卡
async function handleCheckin() {
	checkinLoading.value = true;
	try {
		await api.doCheckin();
		checkin.checked = true;
		checkin.streak += 1;
		uni.showToast({ title: "打卡成功", icon: "success" });
	} catch {
		// api.ts 已统一 toast
	} finally {
		checkinLoading.value = false;
	}
}

// 加载推荐
async function loadRecommendations() {
	try {
		const data: any = await api.getRecommendations("");
		recommendations.value = Array.isArray(data) ? data : data?.list || [];
	} catch {
		recommendations.value = [];
	}
}

// 跳转 AI 记录页（子包页面）
function goAiRecord() {
	uni.navigateTo({ url: "/pages/record/ai-record" });
}
function goFamily() {
	uni.navigateTo({ url: "/pages/family/index" });
}
function goAchievement() {
	uni.navigateTo({ url: "/pages/achievement/index" });
}
function goGamification() {
	uni.navigateTo({ url: "/pages/gamification/index" });
}

// 工具：转数组
function toArray(val: any): any[] {
	if (Array.isArray(val)) return val;
	if (typeof val === "string") return val.split(/[,，、]/).filter(Boolean);
	return [];
}

// 工具：格式化时间
function formatTime(t: string) {
	if (!t) return "";
	return String(t).replace("T", " ").slice(0, 16);
}

onMounted(() => {
	loadRecords();
	loadCheckin();
	loadRecommendations();
});

// tabBar 页每次显示时刷新打卡状态
onShow(() => {
	loadCheckin();
});
</script>

<style scoped>
.page-header {
	padding: 16rpx 4rpx 12rpx;
}
.page-title {
	display: block;
	font-size: 44rpx;
	font-weight: 700;
	color: var(--wj-text);
}
.page-sub {
	display: block;
	font-size: 24rpx;
	color: var(--wj-text-muted);
	margin-top: 4rpx;
}

.checkin-card {
	margin-bottom: 16rpx;
}
.checkin-info {
	display: flex;
	align-items: center;
	justify-content: space-between;
}
.checkin-title {
	display: block;
	font-weight: 600;
	font-size: 30rpx;
	color: var(--wj-text);
}
.checkin-text {
	display: block;
	font-size: 24rpx;
	color: var(--wj-text-muted);
	margin-top: 4rpx;
}
.checkin-btn {
	flex-shrink: 0;
	height: 64rpx;
	line-height: 64rpx;
	padding: 0 28rpx;
	font-size: 26rpx;
	border-radius: 32rpx;
}

.quick-grid {
	display: grid;
	grid-template-columns: repeat(4, 1fr);
	gap: 16rpx;
	margin-bottom: 16rpx;
}
.quick-item {
	background: #fff;
	border-radius: var(--wj-radius);
	box-shadow: var(--wj-shadow);
	padding: 24rpx 8rpx;
	text-align: center;
}
.quick-icon {
	display: block;
	font-size: 48rpx;
	margin-bottom: 8rpx;
}
.quick-text {
	display: block;
	font-size: 24rpx;
	color: var(--wj-text);
}

.search-bar {
	display: flex;
	align-items: center;
	background: #fff;
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

.recommend-section {
	margin-top: 16rpx;
}
.recommend-list {
	white-space: nowrap;
	padding-bottom: 16rpx;
}
.recommend-card {
	display: inline-block;
	vertical-align: top;
	width: 280rpx;
	background: var(--wj-card-bg);
	border-radius: var(--wj-radius-lg);
	box-shadow: var(--wj-shadow);
	padding: 24rpx;
	margin-right: 24rpx;
	white-space: normal;
}
.recommend-name {
	display: block;
	font-weight: 600;
	font-size: 28rpx;
	color: var(--wj-text);
	margin-bottom: 8rpx;
}
.recommend-desc {
	display: block;
	font-size: 24rpx;
	color: var(--wj-text-muted);
	line-height: 1.5;
}
.rec-icon {
	margin-right: 8rpx;
}
</style>
