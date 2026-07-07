<template>
	<cl-page>
		<view class="page-content">
			<!-- 顶部标题 -->
			<view class="page-header">
				<view class="header-left">
					<text class="page-title">味记</text>
					<text class="page-sub">记录每一餐的美好</text>
				</view>
				<view class="header-right" @click="checkAiStatus" :class="aiStatusClass">
					<view class="status-dot"></view>
					<text class="status-text">{{ aiStatusText }}</text>
				</view>
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
						:class="{ 'is-disabled': checkin.checked }"
						:disabled="checkin.checked || checkinLoading"
						:loading="checkinLoading"
						@click="handleCheckin"
					>
						{{ checkin.checked ? "今日已打卡" : "今日打卡" }}
					</button>
				</view>
			</view>

			<!-- 今天吃什么 -->
			<view class="wj-card what-to-eat-card" @click="goWhatToEat">
				<view class="wte-left">
					<text class="wte-emoji">🎰</text>
					<view class="wte-info">
						<text class="wte-title">今天吃什么</text>
						<text class="wte-desc">纠结吃啥？一键帮你决定</text>
					</view>
				</view>
				<text class="wte-action">去试试 →</text>
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


			<!-- 美食日记 -->
			<view class="section-title">美食日记</view>
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

<script lang="ts">
export default {
	inheritAttrs: false
}
</script>

<script lang="ts" setup>
import { ref, reactive, computed, onMounted, onUnmounted } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { api, resolveImg } from "/@/utils/api";
import Tabbar from "./components/tabbar.vue";

const records = ref<any[]>([]);
const recordsLoading = ref(false);
const recommendations = ref<any[]>([]);
const checkinLoading = ref(false);

const aiStatus = ref<"checking" | "online" | "offline">("checking");

const aiStatusText = computed(() => {
	if (aiStatus.value === "checking") return "检测中...";
	return aiStatus.value === "online" ? "AI服务在线" : "AI服务离线";
});

const aiStatusClass = computed(() => `ai-status-${aiStatus.value}`);

let lastAiCheckTime = 0;
const AI_CHECK_INTERVAL = 5 * 60 * 1000; // 5分钟检查间隔

async function checkAiStatus(force: boolean | Event = false) {
	const isForce = force === true || (force && typeof force === "object");
	const now = Date.now();
	
	// 如果不是手动点击强制刷新，且距离上次检查不足5分钟，则跳过
	if (!isForce && now - lastAiCheckTime < AI_CHECK_INTERVAL) {
		return;
	}
	lastAiCheckTime = now;

	aiStatus.value = "checking";
	try {
		const res = await api.health();
		// 后端 /open/health 返回 ai 为字符串 'up'|'down'（AiProxyService.aiStatus）
		aiStatus.value = res.ai === "up" ? "online" : "offline";
	} catch {
		aiStatus.value = "offline";
	}
}

const checkin = reactive({
	checked: false,
	streak: 0,
});

// 加载美食记录
async function loadRecords() {
	recordsLoading.value = true;
	try {
		const data: any = await api.getRecords();
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
		checkin.checked = !!(data.checked || data.todayChecked);
		checkin.streak = data.streak || data.continuousDays || 0;
	} catch {
		// 静默处理
	}
}

// 执行打卡
async function handleCheckin() {
	checkinLoading.value = true;
	try {
		const res: any = await api.doCheckin();
		checkin.checked = true;
		if (res && res.streak !== undefined) {
			checkin.streak = res.streak;
		} else {
			checkin.streak += 1;
		}
		if (res && res.alreadyChecked) {
			uni.showToast({ title: "今日已打卡", icon: "none" });
		} else {
			uni.showToast({ title: "打卡成功", icon: "success" });
		}
	} catch {
		// api.ts 已统一 toast
	} finally {
		checkinLoading.value = false;
	}
}

// 加载推荐（基于最近一条记录的菜名，无记录则跳过）
async function loadRecommendations() {
	const lastDish = records.value[0]?.dishName;
	if (!lastDish) {
		recommendations.value = [];
		return;
	}
	try {
		const data: any = await api.getRecommendations(lastDish);
		recommendations.value = Array.isArray(data) ? data : data?.list || [];
	} catch {
		recommendations.value = [];
	}
}

// 刷新美食记录与推荐（onShow + recordSaved 事件双保险）
async function refreshRecords() {
	await loadRecords();
	loadRecommendations();
	checkAiStatus();
}

// 跳转 AI 记录页（子包页面）
function goDetail(id: number) {
	uni.navigateTo({ url: `/pages/record/detail?id=${id}` });
}

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
function goWhatToEat() {
	uni.navigateTo({ url: "/pages/what-to-eat/index" });
}

// 工具：转数组
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

// 工具：格式化食材名称
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

// 工具：格式化时间
function formatTime(t: string) {
	if (!t) return "";
	return String(t).replace("T", " ").slice(0, 16);
}

onMounted(async () => {
	await loadRecords();
	loadCheckin();
	loadRecommendations();
	checkAiStatus();
	// 监听 recordSaved 事件：记录保存后自动刷新（双保险）
	uni.$on("recordSaved", refreshRecords);
});

// tabBar 页每次显示时刷新打卡状态 + 美食记录
onShow(() => {
	loadCheckin();
	refreshRecords();
});

onUnmounted(() => {
	// 避免内存泄漏：组件卸载时移除事件监听
	uni.$off("recordSaved", refreshRecords);
});
</script>

<style scoped>
.page-content {
	padding: 16rpx 28rpx 140rpx;
}

.page-header {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	padding: 16rpx 4rpx 12rpx;
}
.header-right {
	display: flex;
	align-items: center;
	padding: 8rpx 16rpx;
	border-radius: 24rpx;
	background: rgba(0,0,0,0.04);
	margin-top: 8rpx;
}
.status-dot {
	width: 12rpx;
	height: 12rpx;
	border-radius: 50%;
	margin-right: 8rpx;
}
.status-text {
	font-size: 22rpx;
	color: var(--wj-text-muted);
}
.ai-status-checking .status-dot { background: #ccc; }
.ai-status-online .status-dot { background: #52c41a; }
.ai-status-offline .status-dot { background: #ff4d4f; }
.ai-status-online .status-text { color: #52c41a; }
.ai-status-offline .status-text { color: #ff4d4f; }

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
	margin: 0;
	flex-shrink: 0;
	height: 64rpx;
	line-height: 64rpx;
	padding: 0 28rpx;
	font-size: 26rpx;
	border-radius: 32rpx;
}
.checkin-btn.is-disabled {
	background: #f5f5f5 !important;
	color: #999 !important;
	box-shadow: none !important;
}

.what-to-eat-card {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 28rpx 28rpx;
	margin-bottom: 16rpx;
	background: linear-gradient(135deg, var(--wj-primary) 0%, #ff8c42 100%);
}
.wte-left {
	display: flex;
	align-items: center;
}
.wte-emoji {
	font-size: 56rpx;
	margin-right: 20rpx;
}
.wte-title {
	display: block;
	font-size: 32rpx;
	font-weight: 700;
	color: #fff;
}
.wte-desc {
	display: block;
	font-size: 24rpx;
	color: rgba(255,255,255,0.85);
	margin-top: 4rpx;
}
.wte-action {
	font-size: 26rpx;
	color: rgba(255,255,255,0.9);
	flex-shrink: 0;
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
