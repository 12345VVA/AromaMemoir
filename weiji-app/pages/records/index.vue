<template>
	<cl-page>
		<view class="page-content">
			<cl-sticky background-color="#FFFBF5">
			<view class="page-header">
				<text class="page-title">{{ pageTitle }}</text>
				<view class="view-switch">
					<text
						class="switch-btn"
						:class="{ active: viewMode === 'list' }"
						@click="setViewMode('list')"
					>列表</text>
					<text
						class="switch-btn"
						:class="{ active: viewMode === 'grid' }"
						@click="setViewMode('grid')"
					>宫格</text>
				</view>
			</view>

			<!-- 记录来源切换：我的记录 / 家庭动态 -->
			<view v-if="!targetUserId" class="source-tabs">
				<text class="source-tab" :class="{ active: recordSource === 'mine' }" @click="switchSource('mine')">我的记录</text>
				<text class="source-tab" :class="{ active: recordSource === 'family' }" @click="switchSource('family')">家庭动态</text>
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
			</cl-sticky>

			<view v-if="recordsLoading" class="empty-tip">加载中...</view>
			<view v-else-if="records.length" :class="viewMode === 'grid' ? 'record-grid' : 'record-list'">
				<view
					v-for="item in records"
					:key="item.id"
					class="wj-card"
					:class="viewMode === 'grid' ? 'grid-card' : 'record-card'"
					@click="goDetail(item.id)"
				>
					<image
						v-if="item.imageUrl || item.image"
						class="record-cover"
						:class="{ 'grid-cover': viewMode === 'grid' }"
						:src="resolveImg(item.imageUrl || item.image)"
						mode="aspectFill"
					/>
					<view class="record-content" :class="{ 'grid-content': viewMode === 'grid' }">
						<view class="record-header">
							<view class="record-name-wrap">
								<text class="record-name">{{ item.dishName || item.title || "未命名" }}</text>
								<text v-if="Number(item.cookCount) >= 2" class="cook-count-badge">做过{{ item.cookCount }}次</text>
							</view>
							<text v-if="viewMode === 'list'" class="record-time">{{ formatTime(item.createTime || item.recordDate) }}</text>
						</view>
						<!-- 宫格模式：精简为评分 + 时间 -->
						<view v-if="viewMode === 'grid'" class="grid-meta">
							<text v-if="item.rating" class="stars">{{ "★".repeat(Number(item.rating) || 0) }}</text>
							<text class="record-time">{{ formatTime(item.createTime || item.recordDate) }}</text>
						</view>
						<!-- 列表模式：完整信息 -->
						<template v-else>
							<view v-if="item.userNickname" class="record-author">👤 {{ item.userNickname }}</view>
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
							<view v-if="item.likedByMe !== undefined || Number(item.commentCount) > 0 || Number(item.cookCount) >= 2" class="record-interaction">
								<view v-if="item.likedByMe !== undefined" class="like-btn" :class="{ liked: item.likedByMe }" @click.stop="handleLike(item)">
									<text class="like-icon">{{ item.likedByMe ? '❤️' : '🤍' }}</text>
									<text v-if="Number(item.likeCount) > 0" class="like-count">{{ item.likeCount }}</text>
								</view>
								<text v-else-if="Number(item.likeCount) > 0" class="interaction-item">❤️ {{ item.likeCount }}</text>
								<text v-if="Number(item.commentCount) > 0" class="interaction-item">💬 {{ item.commentCount }}</text>
								<text v-if="Number(item.cookCount) >= 2" class="interaction-item">🔁 {{ item.cookCount }}</text>
							</view>
						</template>
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
// reset 加载的请求序列号：每次 reset 自增，旧请求返回时若 seq 不匹配则丢弃，
// 避免切换来源/搜索时旧的在途请求覆盖最新数据
const loadSeq = ref(0);
const loadingMore = ref(false);
const keyword = ref("");

// 视图模式：列表 / 宫格，默认列表；读取本地存储以保持用户上次选择
const viewMode = ref<'list' | 'grid'>(
	(uni.getStorageSync('records_view_mode') as 'list' | 'grid') || 'list'
);

function setViewMode(mode: 'list' | 'grid') {
	if (viewMode.value === mode) return;
	viewMode.value = mode;
	uni.setStorageSync('records_view_mode', mode);
}

// 记录来源：我的记录 / 家庭动态
const recordSource = ref<'mine' | 'family'>('mine');

function switchSource(source: 'mine' | 'family') {
	if (recordSource.value === source) return;
	recordSource.value = source;
	loadRecords(true);
}

// 目标成员过滤：贡献榜点击跳转时传入 userId + name
const targetUserId = ref<number | null>(null);
const targetName = ref("");

// 分页：每页不超过 5 条。后端 /app/record/list 已支持 page/pageSize，按 createTime DESC 返回 { list, total }
const PAGE_SIZE = 5;
const page = ref(1);
const total = ref(0);
// 是否还有下一页：已加载条数 < 总数
const hasMore = computed(() => records.value.length < total.value);

// 页面标题与占位文案随模式变化
const pageTitle = computed(() =>
	targetUserId.value
		? `${targetName.value || '家人'}的记录`
		: recordSource.value === 'family' ? '家庭动态' : '美食记录'
);
const searchPlaceholder = computed(() =>
	targetUserId.value ? "搜索该成员记录" : "搜索美食记录"
);
const emptyText = computed(() =>
	targetUserId.value
		? `${targetName.value || '该成员'}还没有记录`
		: recordSource.value === 'family'
			? '家里还没有动态，快去记录吧~'
			: '还没有美食记录，快去AI记录添加吧~'
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
	if (recordSource.value === 'family') {
		// 家庭动态模式：拉取全部家庭成员记录（含点赞/评论数据）
		await loadFamilyRecords(reset);
		return;
	}
	const mySeq = reset ? ++loadSeq.value : 0;
	if (reset) {
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
		if (reset && mySeq !== loadSeq.value) return; // 已被新请求覆盖，丢弃旧结果
		const list = Array.isArray(data) ? data : data?.list || data?.records || [];
		// total 取后端返回；兼容历史直接返回数组的形态（此时 total = 当次条数）
		total.value = Array.isArray(data) ? list.length : Number(data?.total) || 0;
		records.value = reset ? list : [...records.value, ...list];
	} catch {
		if (reset && mySeq !== loadSeq.value) return;
		if (reset) {
			records.value = [];
			total.value = 0;
		} else {
			// 加载更多失败：回退页码，下次触底重试同一页
			page.value -= 1;
		}
		// api.ts 已统一 toast，此处静默
	} finally {
		if (reset) {
			if (mySeq === loadSeq.value) recordsLoading.value = false;
		} else {
			loadingMore.value = false;
		}
	}
}

// 家庭动态模式：拉取全部家庭成员记录（后端 listFamilyRecords 返回含 likeCount/likedByMe）
async function loadFamilyRecords(reset: boolean) {
	const mySeq = reset ? ++loadSeq.value : 0;
	if (reset) {
		recordsLoading.value = true;
		page.value = 1;
	} else {
		if (loadingMore.value || !hasMore.value) return;
		loadingMore.value = true;
		page.value += 1;
	}
	try {
		const data: any = await api.getFamilyFeed({
			page: page.value,
			pageSize: PAGE_SIZE,
			keyword: keyword.value.trim() || undefined,
		});
		if (reset && mySeq !== loadSeq.value) return; // 已被新请求覆盖，丢弃旧结果
		const list = Array.isArray(data) ? data : data?.list || data?.records || [];
		total.value = Array.isArray(data) ? list.length : Number(data?.total) || 0;
		records.value = reset ? list : [...records.value, ...list];
	} catch {
		if (reset && mySeq !== loadSeq.value) return;
		if (reset) {
			records.value = [];
			total.value = 0;
		} else {
			page.value -= 1;
		}
	} finally {
		if (reset) {
			if (mySeq === loadSeq.value) recordsLoading.value = false;
		} else {
			loadingMore.value = false;
		}
	}
}

// 点赞/取消点赞（toggle）：仅家庭动态记录可点赞
async function handleLike(item: any) {
	if (item.likedByMe === undefined) return;
	// 乐观更新：先切换本地状态，失败时回滚
	const prevLiked = item.likedByMe;
	const prevCount = Number(item.likeCount) || 0;
	item.likedByMe = !prevLiked;
	item.likeCount = prevLiked ? prevCount - 1 : prevCount + 1;
	try {
		const res: any = await api.likeFamilyRecord(item.id);
		item.likedByMe = res.liked;
		item.likeCount = res.likes;
	} catch {
		// 回滚
		item.likedByMe = prevLiked;
		item.likeCount = prevCount;
	}
}

// 成员模式：服务端按 userId/cookId 过滤 + 标准分页（后端 listFamilyRecords 已支持）
async function loadMemberRecords(reset: boolean) {
	const mySeq = reset ? ++loadSeq.value : 0;
	if (reset) {
		recordsLoading.value = true;
		page.value = 1;
	} else {
		if (loadingMore.value || !hasMore.value) return;
		loadingMore.value = true;
		page.value += 1;
	}
	try {
		const data: any = await api.getFamilyFeed({
			userId: targetUserId.value,
			page: page.value,
			pageSize: PAGE_SIZE,
			keyword: keyword.value.trim() || undefined,
		});
		if (reset && mySeq !== loadSeq.value) return; // 已被新请求覆盖，丢弃旧结果
		const list = Array.isArray(data) ? data : data?.list || data?.records || [];
		total.value = Array.isArray(data) ? list.length : Number(data?.total) || 0;
		records.value = reset ? list : [...records.value, ...list];
	} catch {
		if (reset && mySeq !== loadSeq.value) return;
		if (reset) {
			records.value = [];
			total.value = 0;
		} else {
			// 加载更多失败：回退页码，下次触底重试同一页
			page.value -= 1;
		}
	} finally {
		if (reset) {
			if (mySeq === loadSeq.value) recordsLoading.value = false;
		} else {
			loadingMore.value = false;
		}
	}
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
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 16rpx 4rpx 12rpx;
}

.view-switch {
	display: flex;
	background: var(--wj-card-bg);
	border-radius: 12rpx;
	padding: 4rpx;
	box-shadow: var(--wj-shadow);
}

.switch-btn {
	font-size: 24rpx;
	padding: 8rpx 24rpx;
	border-radius: 8rpx;
	color: var(--wj-text-muted);
}

.switch-btn.active {
	background: var(--wj-primary);
	color: #fff;
}

.source-tabs {
	display: flex;
	gap: 16rpx;
	padding: 0 4rpx 12rpx;
}

.source-tab {
	font-size: 26rpx;
	padding: 8rpx 28rpx;
	border-radius: 24rpx;
	color: var(--wj-text-muted);
	background: var(--wj-card-bg);
	box-shadow: var(--wj-shadow);
}

.source-tab.active {
	color: #fff;
	background: var(--wj-primary);
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

.record-grid {
	display: flex;
	flex-wrap: wrap;
	gap: 20rpx;
}

.grid-card {
	width: calc((100% - 20rpx) / 2);
	padding: 0;
	overflow: hidden;
}

.grid-cover {
	height: 240rpx;
}

.grid-content {
	padding: 16rpx 20rpx;
}

.grid-meta {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-top: 8rpx;
	gap: 8rpx;
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

.record-author {
	font-size: 24rpx;
	color: var(--wj-text);
	margin-top: 4rpx;
	margin-bottom: 4rpx;
	font-weight: 500;
}

.record-interaction {
	display: flex;
	align-items: center;
	gap: 24rpx;
	margin-top: 16rpx;
	padding-top: 16rpx;
	border-top: 1rpx solid rgba(0, 0, 0, 0.04);
}

.interaction-item {
	font-size: 24rpx;
	color: var(--wj-text-muted);
}

.like-btn {
	display: flex;
	align-items: center;
	gap: 6rpx;
	padding: 4rpx 8rpx;
	border-radius: 8rpx;
}

.like-icon {
	font-size: 28rpx;
}

.like-count {
	font-size: 24rpx;
	color: var(--wj-text-muted);
}

.like-btn.liked .like-count {
	color: var(--wj-primary);
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
