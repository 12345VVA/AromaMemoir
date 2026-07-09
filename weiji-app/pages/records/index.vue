<template>
	<cl-page>
		<view class="page-content">
			<view class="page-header">
				<text class="page-title">{{ pageTitle }}</text>
			</view>

			<view class="search-bar">
				<text class="search-icon">🔍</text>
				<input
					class="search-input"
					v-model="keyword"
					:placeholder="searchPlaceholder"
					placeholder-class="ph"
					@confirm="loadRecords(true)"
				/>
			</view>

			<view v-if="recordsLoading" class="empty-tip">加载中...</view>
			<view v-else-if="records.length" class="record-list">
				<view v-for="item in records" :key="item.id" class="wj-card record-card" @click="goDetail(item.id)">
					<image v-if="item.imageUrl || item.image" class="record-cover" :src="resolveImg(item.imageUrl || item.image)" mode="aspectFill" />
					<view class="record-content">
						<view class="record-header">
							<view class="record-name-wrap">
								<text class="record-name">{{ item.dishName || item.title || "未命名" }}</text>
								<text v-if="Number(item.cookCount) >= 2" class="cook-count-badge">做过{{ item.cookCount }}次</text>
							</view>
							<text class="record-time">{{ formatTime(item.createdAt || item.time) }}</text>
						</view>
						<view v-if="item.cookName || item.cookId" class="record-cook">👩 {{ item.cookName || '家人' }} 制作</view>
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
						<view v-if="Number(item.likeCount) > 0 || Number(item.commentCount) > 0 || Number(item.cookCount) >= 2" class="record-interaction">
							<text v-if="Number(item.likeCount) > 0" class="interaction-item">❤️ {{ item.likeCount }}</text>
							<text v-if="Number(item.commentCount) > 0" class="interaction-item">💬 {{ item.commentCount }}</text>
							<text v-if="Number(item.cookCount) >= 2" class="interaction-item">🔁 {{ item.cookCount }}</text>
						</view>
					</view>
				</view>
				<!-- 加载更多状态：进行中显示加载中，已全部加载显示没有更多 -->
				<view v-if="loadingMore" class="load-tip">加载中...</view>
				<view v-else-if="!hasMore" class="load-tip">没有更多了</view>
			</view>
			<view v-else class="empty-state">
				<text class="empty-text">{{ emptyText }}</text>
				<button v-if="!targetUserId" class="wj-btn empty-btn" @click="goAiRecord">去 AI 记录</button>
			</view>
		</view>

		<tabbar />
	</cl-page>
</template>

<script lang="ts" setup>
import { ref, computed } from "vue";
import { onMounted } from "vue";
import { onLoad, onShow, onPullDownRefresh, onReachBottom } from "@dcloudio/uni-app";
import { api, resolveImg } from "/@/utils/api";
import Tabbar from "/@/pages/index/components/tabbar.vue";

const records = ref<any[]>([]);
const recordsLoading = ref(false);
const loadingMore = ref(false);
const keyword = ref("");

// 目标成员过滤：贡献榜点击跳转时传入 userId + name
const targetUserId = ref<number | null>(null);
const targetName = ref("");

// 成员模式：拉取家庭动态后前端按 userId/cookId 过滤，本地切片分页
const allMemberRecords = ref<any[]>([]);

// 分页：每页不超过 5 条。后端 /app/record/list 已支持 page/pageSize，按 createTime DESC 返回 { list, total }
const PAGE_SIZE = 5;
const page = ref(1);
const total = ref(0);
// 是否还有下一页：已加载条数 < 总数
const hasMore = computed(() => records.value.length < total.value);

// 页面标题与占位文案随模式变化
const pageTitle = computed(() =>
	targetUserId.value ? `${targetName.value || '家人'}的记录` : "美食记录"
);
const searchPlaceholder = computed(() =>
	targetUserId.value ? "搜索该成员记录" : "搜索美食记录"
);
const emptyText = computed(() =>
	targetUserId.value
		? `${targetName.value || '该成员'}还没有记录`
		: "还没有美食记录，快去AI记录添加吧~"
);

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

// 加载记录：reset=true 为首屏/搜索/下拉刷新（page=1、清空列表）；false 为触底加载下一页
async function loadRecords(reset = true) {
	if (targetUserId.value != null) {
		// 成员模式：拉取家庭动态后前端按 userId/cookId 过滤，本地切片分页
		await loadMemberRecords(reset);
		return;
	}
	if (reset) {
		if (recordsLoading.value) return;
		recordsLoading.value = true;
		page.value = 1;
	} else {
		// 加载更多：进行中或已无更多时直接拦截，避免重复/越界请求
		if (loadingMore.value || !hasMore.value) return;
		loadingMore.value = true;
		page.value += 1;
	}
	try {
		const params: Record<string, any> = { page: page.value, pageSize: PAGE_SIZE };
		if (keyword.value.trim()) params.keyword = keyword.value.trim();
		const data: any = await api.getRecords(params);
		const list = Array.isArray(data) ? data : data?.list || data?.records || [];
		// total 取后端返回；兼容历史直接返回数组的形态（此时 total = 当次条数）
		total.value = Array.isArray(data) ? list.length : Number(data?.total) || 0;
		records.value = reset ? list : [...records.value, ...list];
	} catch {
		if (reset) {
			records.value = [];
			total.value = 0;
		} else {
			// 加载更多失败：回退页码，下次触底重试同一页
			page.value -= 1;
		}
		// api.ts 已统一 toast，此处静默
	} finally {
		recordsLoading.value = false;
		loadingMore.value = false;
	}
}

// 成员模式：通过家庭动态接口拉取全部记录，前端按 userId 或 cookId 过滤后切片分页
async function loadMemberRecords(reset: boolean) {
	if (reset) {
		if (recordsLoading.value) return;
		recordsLoading.value = true;
		page.value = 1;
		// 首屏/刷新时重新拉取家庭动态全量数据
		try {
			const data: any = await api.getFamilyFeed({ pageSize: 999 });
			const list = Array.isArray(data) ? data : data?.list || data?.records || [];
			const uid = Number(targetUserId.value);
			allMemberRecords.value = list.filter((r: any) => {
				const rUid = Number(r.userId);
				const cUid = Number(r.cookId);
				// 匹配记录创建者或制作人
				return rUid === uid || cUid === uid;
			});
			total.value = allMemberRecords.value.length;
		} catch {
			allMemberRecords.value = [];
			total.value = 0;
		}
	} else {
		if (loadingMore.value || !hasMore.value) return;
		loadingMore.value = true;
		page.value += 1;
	}
	// 关键词二次过滤
	const kw = keyword.value.trim();
	const filtered = kw
		? allMemberRecords.value.filter(r =>
				(r.dishName || r.title || "").toLowerCase().includes(kw.toLowerCase())
			)
		: allMemberRecords.value;
	total.value = filtered.length;
	const start = (page.value - 1) * PAGE_SIZE;
	const slice = filtered.slice(start, start + PAGE_SIZE);
	records.value = reset ? slice : [...records.value, ...slice];
	recordsLoading.value = false;
	loadingMore.value = false;
}

function goDetail(id: number) {
	uni.navigateTo({ url: `/pages/record/detail?id=${id}` });
}

function goAiRecord() {
	uni.navigateTo({ url: "/pages/record/ai-record" });
}

// onLoad 读取 userId/name 参数（贡献榜点击跳转传入）
onLoad((options: any) => {
	if (options?.userId) {
		targetUserId.value = Number(options.userId);
		targetName.value = options?.name ? decodeURIComponent(options.name) : "";
	}
});

// 首次加载由 onMounted 完成；onShow 仅在返回页面时刷新（回到第一页），避免首屏重复请求
const recordsLoadedOnce = ref(false);
onMounted(() => {
	loadRecords(true);
	recordsLoadedOnce.value = true;
});

onShow(() => {
	if (recordsLoadedOnce.value) loadRecords(true);
});

onPullDownRefresh(async () => {
	await loadRecords(true);
	uni.stopPullDownRefresh();
});

// 触底加载下一页（页面级滚动触发；触发距离由 pages.json 的 onReachBottomDistance 控制，默认 50px）
onReachBottom(() => {
	loadRecords(false);
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

.record-name-wrap {
	display: flex;
	align-items: center;
	flex: 1;
	min-width: 0;
	margin-right: 16rpx;
}

.cook-count-badge {
	font-size: 20rpx;
	color: #fff;
	background: var(--wj-primary);
	padding: 2rpx 12rpx;
	border-radius: 8rpx;
	margin-left: 12rpx;
	vertical-align: middle;
}

.record-cook {
	font-size: 24rpx;
	color: var(--wj-text-muted);
	margin-top: 8rpx;
	margin-bottom: 8rpx;
}

.record-interaction {
	display: flex;
	gap: 24rpx;
	margin-top: 16rpx;
	padding-top: 16rpx;
	border-top: 1rpx solid rgba(0, 0, 0, 0.04);
}

.interaction-item {
	font-size: 24rpx;
	color: var(--wj-text-muted);
}

.load-tip {
	text-align: center;
	font-size: 24rpx;
	color: var(--wj-text-muted);
	padding: 24rpx 0;
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
