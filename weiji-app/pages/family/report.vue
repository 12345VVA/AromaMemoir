<template>
	<cl-page>
		<cl-topbar title="营养分析" />

		<view class="page-content">
			<!-- 月份切换 -->
			<view class="month-bar">
				<text class="month-arrow" @click="changeMonth(-1)">‹</text>
				<text class="month-text">{{ report.month || monthRef }}</text>
				<text class="month-arrow" @click="changeMonth(1)">›</text>
			</view>

			<view v-if="loading" class="empty-tip">加载中...</view>
			<view v-else-if="error" class="empty-tip error-text">{{ error }}</view>

			<template v-else>
				<!-- 概览卡片 -->
				<view class="wj-card overview-card">
					<view class="overview-row">
						<view class="overview-item">
							<text class="overview-num">{{ report.totalRecords || 0 }}</text>
							<text class="overview-label">本月记录</text>
						</view>
						<view class="overview-item">
							<text class="overview-num">{{ report.avgRating ? report.avgRating.toFixed(1) : '0.0' }}</text>
							<text class="overview-label">平均评分</text>
						</view>
						<view class="overview-item">
							<text class="overview-num">{{ trendText }}</text>
							<text class="overview-label">环比上月</text>
						</view>
					</view>
				</view>

				<!-- 成员贡献 -->
				<view class="section-title">成员贡献</view>
				<view v-if="(report.memberContributions || []).length" class="wj-card">
					<view
						v-for="(m, i) in report.memberContributions"
						:key="i"
						class="member-row"
					>
						<image v-if="m.userAvatar" class="member-avatar" :src="resolveImg(m.userAvatar)" mode="aspectFill" />
						<view v-else class="member-avatar member-avatar-emoji">👤</view>
						<text class="member-name">{{ m.userNickname || '家人' }}</text>
						<text class="member-count">{{ m.recordCount }} 餐</text>
					</view>
				</view>
				<view v-else class="empty-tip">本月暂无记录</view>

				<!-- 热门菜品 -->
				<view class="section-title">热门菜品 Top 5</view>
				<view v-if="(report.topDishes || []).length" class="wj-card">
					<view
						v-for="(d, i) in report.topDishes"
						:key="i"
						class="dish-row"
					>
						<text class="dish-rank">{{ i + 1 }}</text>
						<text class="dish-name">{{ d.dishName }}</text>
						<text class="dish-count">{{ d.count }} 次</text>
						<text class="dish-rating">★ {{ d.avgRating ? d.avgRating.toFixed(1) : '0.0' }}</text>
					</view>
				</view>
				<view v-else class="empty-tip">本月暂无热门菜品</view>

				<!-- 标签分布 -->
				<view v-if="(report.tagDistribution || []).length" class="section-title">营养标签分布</view>
				<view v-if="(report.tagDistribution || []).length" class="wj-card tag-grid">
					<view v-for="(t, i) in report.tagDistribution" :key="i" class="tag-item">
						<text class="tag-name">{{ t.tag || t.name }}</text>
						<text class="tag-count">{{ t.count }} 次</text>
					</view>
				</view>
			</template>
		</view>
	</cl-page>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { api, resolveImg } from "/@/utils/api";

// 当月 YYYY-MM（本地时区）
function currentMonthStr(): string {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const report = ref<any>({});
const loading = ref(false);
const error = ref("");
const currentMonth = currentMonthStr();
const monthRef = ref("");

const trendText = computed(() => {
	const cur = Number(report.value.totalRecords) || 0;
	const prev = Number(report.value.prevMonthRecords) || 0;
	if (prev === 0) return cur > 0 ? `+${cur}` : "0";
	const diff = cur - prev;
	if (diff > 0) return `+${diff}`;
	if (diff < 0) return `${diff}`;
	return "持平";
});

async function loadReport(month: string) {
	loading.value = true;
	error.value = "";
	try {
		const data: any = await api.getFamilyReport({ month });
		report.value = data || {};
	} catch (err: any) {
		error.value = err?.message || "加载失败";
		report.value = {};
	} finally {
		loading.value = false;
	}
}

function changeMonth(delta: number) {
	const [year, monthNum] = (monthRef.value || currentMonth).split('-').map(Number);
	let newMonth = monthNum + delta;
	let newYear = year;
	if (newMonth === 0) {
		newMonth = 12;
		newYear -= 1;
	} else if (newMonth === 13) {
		newMonth = 1;
		newYear += 1;
	}
	monthRef.value = `${newYear}-${String(newMonth).padStart(2, '0')}`;
	loadReport(monthRef.value);
}

onLoad((options: any) => {
	monthRef.value = (options?.month as string) || currentMonth;
	loadReport(monthRef.value);
});
</script>

<style scoped>
.page-content {
	padding: 16rpx 28rpx 80rpx;
}

.month-bar {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 48rpx;
	padding: 16rpx 0 24rpx;
}
.month-arrow {
	font-size: 48rpx;
	color: var(--wj-primary);
	width: 64rpx;
	text-align: center;
}
.month-text {
	font-size: 32rpx;
	font-weight: 600;
	color: var(--wj-text);
}

.overview-card {
	padding: 32rpx 24rpx;
}
.overview-row {
	display: flex;
	justify-content: space-around;
}
.overview-item {
	display: flex;
	flex-direction: column;
	align-items: center;
}
.overview-num {
	font-size: 40rpx;
	font-weight: 700;
	color: var(--wj-primary);
}
.overview-label {
	font-size: 24rpx;
	color: var(--wj-text-muted);
	margin-top: 8rpx;
}

.section-title {
	display: block;
	font-size: 30rpx;
	font-weight: 600;
	color: var(--wj-text);
	margin: 32rpx 4rpx 16rpx;
}

.member-row {
	display: flex;
	align-items: center;
	padding: 16rpx 24rpx;
	border-bottom: 1rpx solid rgba(0, 0, 0, 0.04);
}
.member-row:last-child {
	border-bottom: none;
}
.member-avatar {
	width: 64rpx;
	height: 64rpx;
	border-radius: 50%;
	background: var(--wj-card-bg);
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 32rpx;
	margin-right: 16rpx;
}
.member-avatar-emoji {
	background: rgba(255, 107, 53, 0.1);
}
.member-name {
	flex: 1;
	font-size: 28rpx;
	color: var(--wj-text);
}
.member-count {
	font-size: 26rpx;
	color: var(--wj-primary);
	font-weight: 600;
}

.dish-row {
	display: flex;
	align-items: center;
	padding: 20rpx 24rpx;
	border-bottom: 1rpx solid rgba(0, 0, 0, 0.04);
}
.dish-row:last-child {
	border-bottom: none;
}
.dish-rank {
	width: 48rpx;
	height: 48rpx;
	line-height: 48rpx;
	text-align: center;
	border-radius: 50%;
	background: var(--wj-primary);
	color: #fff;
	font-size: 24rpx;
	font-weight: 700;
	margin-right: 16rpx;
}
.dish-name {
	flex: 1;
	font-size: 28rpx;
	color: var(--wj-text);
}
.dish-count {
	font-size: 24rpx;
	color: var(--wj-text-muted);
	margin-right: 16rpx;
}
.dish-rating {
	font-size: 24rpx;
	color: var(--wj-primary);
}

.tag-grid {
	display: flex;
	flex-wrap: wrap;
	gap: 16rpx;
	padding: 24rpx;
}
.tag-item {
	display: flex;
	flex-direction: column;
	align-items: center;
	background: rgba(255, 107, 53, 0.08);
	border-radius: 12rpx;
	padding: 16rpx 24rpx;
	min-width: 120rpx;
}
.tag-name {
	font-size: 26rpx;
	color: var(--wj-primary);
	font-weight: 600;
}
.tag-count {
	font-size: 22rpx;
	color: var(--wj-text-muted);
	margin-top: 4rpx;
}

.empty-tip {
	text-align: center;
	font-size: 26rpx;
	color: var(--wj-text-muted);
	padding: 40rpx 0;
}
.error-text {
	color: #e54d42;
}
</style>
