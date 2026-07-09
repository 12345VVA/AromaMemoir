<template>
	<cl-page>
		<view class="page-content">
			<!-- 1. 顶部标题 + 家庭今日状态（Task 6） -->
			<view class="page-header">
				<view class="header-left">
					<text class="page-title">味记</text>
					<text class="page-sub">记录每一餐的美好</text>
					<text class="page-tagline">家庭温度，每日陪伴</text>
				</view>
				<view class="family-status" v-if="familyStatus">
					<view v-if="familyStatus.hasFamily" class="family-has">
						<view class="family-avatars" :class="{ 'is-gray': familyStatus.todayRecordedCount === 0 }">
							<template v-for="(m, i) in (familyStatus.members || []).slice(0, 3)" :key="m.userId || i">
								<image v-if="m.avatarUrl" class="family-avatar" :src="resolveImg(m.avatarUrl)" mode="aspectFill" />
								<view v-else class="family-avatar family-avatar-emoji">👤</view>
							</template>
							<view v-if="(familyStatus.members || []).length > 3" class="family-avatar-more">+{{ (familyStatus.members || []).length - 3 }}</view>
						</view>
						<text class="family-tip">
							今日 {{ familyStatus.todayRecordedCount || 0 }}/{{ familyStatus.totalMemberCount || 0 }} 人已记录{{ familyStatus.todayRecordedCount > 0 ? '' : ' · 一起来记一餐吧' }}
						</text>
						<text v-if="familyStatus.familyStreakDays" class="family-streak">连续记录 {{ familyStatus.familyStreakDays }} 天 <text class="pulse">🔥</text></text>
					</view>
					<view v-else class="family-none" @click="goFamily">
						<text class="family-none-emoji">👨‍👩‍👧</text>
						<text class="family-none-text">创建/加入家庭</text>
					</view>
				</view>
			</view>

			<!-- 2. 连续打卡卡片 + 徽章进度（Task 7） -->
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
						{{ checkin.checked ? "明日继续" : "今日打卡" }}
					</button>
				</view>
				<view v-if="nextBadge" class="badge-progress" @click="goAchievement">
				<view class="badge-info">
					<view class="badge-icon" :class="{ 'pulse': nextBadge.allUnlocked || (nextBadge.remainingDays !== undefined && nextBadge.remainingDays <= 1) }">
						<text class="badge-icon-emoji">{{ nextBadge.allUnlocked ? resolveBadgeIcon(nextBadge.highestBadge?.icon) : resolveBadgeIcon(nextBadge.badge?.icon) }}</text>
					</view>
					<view class="badge-meta">
						<text class="badge-name">{{ nextBadge.allUnlocked ? '已达成全部打卡成就' : (nextBadge.badge?.name || '下一徽章') }}</text>
						<text v-if="!nextBadge.allUnlocked && nextBadge.remainingDays !== undefined" class="badge-desc">距离 {{ nextBadge.badge?.name || '徽章' }} 还差 {{ nextBadge.remainingDays }} 天 · 完成解锁 {{ resolveBadgeIcon(nextBadge.badge?.icon) }} +50 EXP</text>
						<text v-else-if="nextBadge.allUnlocked" class="badge-desc">恭喜达成全部打卡成就 🎉</text>
					</view>
				</view>
				<view class="progress-bar">
				<view class="progress-inner" :style="{ width: (nextBadge.allUnlocked ? 100 : (nextBadge.progress || 0)) + '%' }"></view>
			</view>
		</view>
			<!-- 今日家庭任务清单（Task 2 深化） -->
			<view v-if="familyStatus?.hasFamily" class="today-tasks">
				<view class="tasks-header">
					<text class="tasks-title">今日家庭任务</text>
					<text v-if="familyLevel" class="tasks-level">Lv{{ familyLevel.level }} · {{ familyLevel.currentTitle }}</text>
				</view>
				<view class="tasks-list">
					<view v-for="(t, i) in todayTasks" :key="i" class="task-item">
						<view class="task-check" :class="{ 'is-done': t.done }">{{ t.done ? '✓' : '' }}</view>
						<text class="task-name" :class="{ 'is-done': t.done }">{{ t.name }}</text>
					</view>
				</view>
				<view v-if="allTasksDone" class="tasks-complete">今日家庭挑战全部完成 🎉</view>
			</view>
		</view>

			<!-- 3. 今天吃什么 主角卡片（Task 5） -->
			<view
				class="hero-card wj-card-hero"
				:class="{ 'is-fallback': !heroBg }"
			:style="{ height: '360rpx' }"
			@click="goWhatToEat"
		>
			<!-- 背景层：始终使用本地美食背景图轮换 -->
			<image v-if="heroBg" class="hero-bg" :src="heroBg" mode="aspectFill" @error="onHeroImgErr" />
				<!-- 遮罩层 -->
				<view class="hero-mask"></view>
				<!-- 内容层 -->
				<view class="hero-content">
					<view class="hero-top">
						<text class="hero-label">今天吃什么</text>
						<view class="hero-refresh" @click.stop="loadRecommendation">
							<text class="hero-refresh-icon" :class="{ rotating: refreshing }">🔄</text>
							<text class="hero-refresh-text">换一批</text>
						</view>
					</view>
					<view class="hero-bottom">
						<text class="hero-dish">{{ recommend?.dishName || '加载中...' }}</text>
						<text v-if="recommend?.reason" class="hero-reason">{{ recommend.reason }}</text>
						<view class="hero-actions">
							<view class="hero-vote-btn" @click.stop="goFamilyVote">🗳 家人投票</view>
						</view>
					</view>
				</view>
			</view>
			<!-- 场景推荐辅助区（保留多场景功能） -->
			<view class="scene-section">
				<view class="scene-buttons">
					<view class="scene-btn" :class="{ 'is-active': currentScene === 'dinner' }" @click="handleSceneRecommend('dinner')">晚餐推荐</view>
					<view class="scene-btn" :class="{ 'is-active': currentScene === 'fridge' }" @click="handleSceneRecommend('fridge')">冰箱推荐</view>
					<view class="scene-btn" :class="{ 'is-active': currentScene === 'kids' }" @click="handleSceneRecommend('kids')">孩子喜欢</view>
				</view>
				<view v-if="recommendSceneLoading" class="scene-loading">AI 推荐中...</view>
				<view v-else-if="sceneDisplay" class="scene-result">
					<view v-if="sceneDisplay.fallback" class="scene-fallback">数据不足，已随机推荐</view>
					<view class="scene-dish">
						<text class="scene-dish-name">{{ sceneDisplay.dishName || sceneDisplay.name || '推荐菜' }}</text>
						<text v-if="sceneDisplay.reason" class="scene-dish-reason">{{ sceneDisplay.reason }}</text>
						<view v-if="toArray(sceneDisplay.reasons).length" class="scene-reasons">
							<text v-for="(r, i) in toArray(sceneDisplay.reasons)" :key="'r' + i" class="scene-reason-item">· {{ r }}</text>
						</view>
						<view v-if="toArray(sceneDisplay.usedIngredients).length" class="scene-used">
							<text class="scene-used-label">用到：</text>
							<text v-for="(ing, i) in toArray(sceneDisplay.usedIngredients)" :key="'u' + i" class="scene-used-item">{{ ing }}</text>
						</view>
					</view>
				</view>
			</view>

		<!-- 家庭今日动态 -->
		<view v-if="todayFeedLoaded && todayFeed.length > 0" class="wj-card-story today-feed-card">
			<view class="section-title-bar">
				<text class="section-title-text">家庭今日动态</text>
				<text class="section-more" @click="goRecords">全部 →</text>
			</view>
			<view class="feed-list">
				<view v-for="(item, i) in todayFeed" :key="i" class="feed-item" :style="{ animationDelay: (i * 0.05) + 's' }" @click="goRecords">
					<image v-if="item.actorAvatar" class="feed-avatar" :src="resolveImg(item.actorAvatar)" mode="aspectFill" />
					<view v-else class="feed-avatar feed-avatar-emoji">👤</view>
					<view class="feed-content">
						<text class="feed-text"><text class="feed-emoji">{{ feedEventEmoji(item.eventType) }}</text> <text class="feed-name">{{ item.actorNickName || '家人' }}</text> {{ item.summary }}</text>
						<text class="feed-time">{{ formatFeedTime(item.createdAt) }}</text>
					</view>
				</view>
			</view>
		</view>
		<!-- 无家庭时隐藏卡片；有家庭无动态时展示引导 -->
		<view v-else-if="todayFeedLoaded && todayFeed.length === 0 && familyStatus?.hasFamily" class="wj-card-story today-feed-empty">
			<text class="empty-text">今天家里的厨房还在等你来记录～</text>
			<button class="wj-btn empty-btn" @click="goBlindGuess">猜猜谁做的菜 →</button>
		</view>

		<!-- 5. 美食记录预览（Task 7 横向卡片） -->
			<view class="diary-header">
				<text class="section-title">美食日记</text>
				<text v-if="!recordsLoading && records.length" class="diary-more" @click="goRecords">查看全部 →</text>
			</view>
			<view v-if="recordsLoading" class="empty-tip">加载中...</view>
			<view v-else-if="records.length" class="record-list">
				<view v-for="item in records.slice(0, 1)" :key="item.id" class="record-card" @click="goDetail(item.id)">
					<image v-if="item.imageUrl || item.image" class="record-cover" :src="resolveImg(item.imageUrl || item.image)" mode="aspectFill" />
					<view v-else class="record-cover record-cover-placeholder">🍽️</view>
					<view class="record-content">
						<text class="record-name">{{ item.dishName || item.title || "未命名" }}</text>
						<text v-if="item.cookName" class="record-cook-text">👨‍🍳 {{ item.cookName }}</text>
						<text class="record-time">{{ formatMealTime(item) }}</text>
					</view>
				</view>
			</view>
			<view v-else class="empty-tip">还没有美食记录，去 AI 记录页添加吧～</view>

			<!-- 7. 快捷入口（Task 8 下移到底部） -->
			<view class="quick-grid">
				<view class="quick-item" @click="goAiRecord">
					<view class="quick-icon quick-icon-orange">
						<text class="quick-icon-emoji">📸</text>
					</view>
					<text class="quick-text">AI 记录</text>
				</view>
				<view class="quick-item" @click="goPokedex">
					<view class="quick-icon quick-icon-yellow">
						<text class="quick-icon-emoji">📖</text>
					</view>
					<text class="quick-text">美食图鉴</text>
				</view>
				<view class="quick-item" @click="goBlindGuess">
					<view class="quick-icon quick-icon-green">
						<text class="quick-icon-emoji">🎮</text>
					</view>
					<text class="quick-text">家庭挑战</text>
				</view>
				<view class="quick-item" @click="goAchievement">
					<view class="quick-icon quick-icon-orange">
						<text class="quick-icon-emoji">🏆</text>
					</view>
					<text class="quick-text">成就</text>
				</view>
			</view>

			<!-- 6. 成长奖励入口（Task 12） -->
			<view class="wj-card growth-entry" @click="goAchievement">
				<text class="growth-icon">🏆</text>
				<view class="growth-info">
					<text class="growth-title">成长奖励</text>
					<text class="growth-desc">查看徽章与贡献</text>
				</view>
				<text class="growth-action">→</text>
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

// Task 0.12: 美食背景图常量（兜底用于主角卡片）
const BG_IMAGES = [
	"/static/bg/bg-ramen.jpg",
	"/static/bg/bg-hotpot.jpg",
	"/static/bg/bg-baozi.jpg",
	"/static/bg/bg-tea.jpg",
	"/static/bg/bg-spice.jpg",
	"/static/bg/bg-ingredients.jpg",
	"/static/bg/bg-family.jpg",
	"/static/bg/bg-kitchen.jpg",
	"/static/bg/bg-harvest.jpg",
	"/static/bg/bg-ricefield.jpg",
];
// 当前主角卡片背景图
const heroBg = ref<string>(BG_IMAGES[0]);
// 整页背景图（每次打开随机选一张，避免与 heroBg 重复）
const pageBg = ref<string>("");
// 整页背景样式：背景图 + 半透明白色遮罩，保证内容可读
const pageBgStyle = computed(() => {
	if (!pageBg.value) {
		// 兜底：暖色渐变
		return { background: "linear-gradient(180deg, #FFF1E6 0%, #FFFBF5 480rpx)" };
	}
	return {
		backgroundImage: `linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(255,250,245,0.88) 100%), url(${pageBg.value})`,
		backgroundSize: "cover",
		backgroundPosition: "center top",
		backgroundRepeat: "no-repeat",
		backgroundAttachment: "fixed",
	};
});
// 主角卡片推荐结果（Task 5）
const recommend = ref<any>(null);
// 「换一批」刷新状态
const refreshing = ref(false);

// 从 BG_IMAGES 随机选一张，若 exclude 提供则避免选到同一张
function pickRandomBg(exclude?: string): string {
	if (BG_IMAGES.length === 0) return "";
	if (BG_IMAGES.length === 1) return BG_IMAGES[0];
	let pool = BG_IMAGES;
	if (exclude) {
		pool = BG_IMAGES.filter((src) => src !== exclude);
		if (pool.length === 0) pool = BG_IMAGES;
	}
	return pool[Math.floor(Math.random() * pool.length)];
}

// 主角卡片图片加载失败：清空 heroBg 触发兜底渐变背景
const heroImgFailed = ref(false);
function onHeroImgErr() {
	heroImgFailed.value = true;
	heroBg.value = "";
}

// 「换一批」：重新拉取推荐，若新推荐无 imageUrl 则随机换背景
async function loadRecommendation() {
	refreshing.value = true;
	heroImgFailed.value = false;
	try {
		const familyId = familyStatus.value?.familyId;
		const data: any = await api.getRecommendations("", "dinner", familyId);
		if (Array.isArray(data)) {
			recommend.value = data[0] || null;
		} else {
			recommend.value = data;
		}
		// 无论推荐是否有图片，都随机切换本地美食背景图（让用户提供的背景图始终展示）
		heroBg.value = pickRandomBg(heroBg.value);
	} catch {
		recommend.value = null;
	} finally {
		refreshing.value = false;
	}
}

const records = ref<any[]>([]);
const recordsLoading = ref(false);
const checkinLoading = ref(false);

// 家庭今日状态（Task 6）
const familyStatus = ref<any>(null);
// 下一徽章（Task 7）
const nextBadge = ref<any>(null);
// 家庭今日动态 feed
const todayFeed = ref<any[]>([]);
const todayFeedLoaded = ref(false);

// 多场景推荐（Task 8）
const currentScene = ref<string>("");
const recommendSceneLoading = ref(false);
const sceneResult = ref<any>(null);

// 推荐结果归一化：后端可能返回单个对象或数组，统一取第一个用于展示
const sceneDisplay = computed(() => {
	if (!sceneResult.value) return null;
	if (Array.isArray(sceneResult.value)) {
		return sceneResult.value[0] || null;
	}
	return sceneResult.value;
});

// 今日家庭任务（基于 todayFeed 推断完成状态）
const todayTasks = computed(() => {
	const feed = todayFeed.value || [];
	const hasRecord = feed.some((f: any) => f.eventType === 'record');
	const hasBlindguess = feed.some((f: any) => f.eventType === 'blindguess');
	const hasLike = feed.some((f: any) => f.eventType === 'like');
	const tasks = [
		{ name: '上传一餐记录', done: hasRecord },
		{ name: '完成一次盲猜', done: hasBlindguess },
		{ name: '给家人点赞', done: hasLike },
	];
	return tasks;
});
const allTasksDone = computed(() => todayTasks.value.every(t => t.done));

// AI 状态检测：保留脚本逻辑（onMounted/onShow 仍调用），但模板不再渲染状态指示器
const aiStatus = ref<"checking" | "online" | "offline">("checking");
let lastAiCheckTime = 0;
const AI_CHECK_INTERVAL = 5 * 60 * 1000;

async function checkAiStatus(force: boolean | Event = false) {
	const isForce = force === true || (force && typeof force === "object");
	const now = Date.now();
	if (!isForce && now - lastAiCheckTime < AI_CHECK_INTERVAL) {
		return;
	}
	lastAiCheckTime = now;
	aiStatus.value = "checking";
	try {
		const res: any = await api.health();
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
		// 首页美食日记仅展示最近 3 条：传 pageSize=3 让后端只返回 3 条（省流量），
		// 模板再 slice(0,3) 做硬上限兜底。
		const data: any = await api.getRecords({ pageSize: 3 });
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
		// 打卡后刷新徽章进度
		loadNextBadge();
	} catch {
		// api.ts 已统一 toast
	} finally {
		checkinLoading.value = false;
	}
}

// 加载家庭今日状态（Task 6）
async function loadFamilyStatus() {
	try {
		const data: any = await api.getFamilyTodayStatus();
		familyStatus.value = data || { hasFamily: false };
	} catch {
		familyStatus.value = { hasFamily: false };
	}
}

// 家庭等级（Task 2 深化）
const familyLevel = ref<any>(null);
async function loadFamilyLevel() {
	try {
		const data: any = await api.getFamilyLevel();
		familyLevel.value = data || null;
	} catch {
		familyLevel.value = null;
	}
}

// 加载下一打卡徽章（Task 7）
async function loadNextBadge() {
	try {
		const data: any = await api.getNextStreakBadge();
		nextBadge.value = data || null;
	} catch {
		nextBadge.value = null;
	}
}

// 加载家庭今日动态 feed
async function loadTodayFeed() {
	try {
		const data: any = await api.getFamilyTodayFeed();
		const list = Array.isArray(data) ? data : (data?.list || data?.feed || []);
		todayFeed.value = list.slice(0, 5);
	} catch {
		todayFeed.value = [];
	} finally {
		todayFeedLoaded.value = true;
	}
}

// 多场景推荐（Task 8）：点击场景按钮按需触发，传空 dishName + scene + familyId
async function handleSceneRecommend(scene: string) {
	if (recommendSceneLoading.value) return;
	currentScene.value = scene;
	recommendSceneLoading.value = true;
	sceneResult.value = null;
	try {
		const familyId = familyStatus.value?.familyId;
		const data: any = await api.getRecommendations("", scene, familyId);
		sceneResult.value = data;
	} catch {
		sceneResult.value = null;
		uni.showToast({ title: "推荐失败，请稍后重试", icon: "none" });
	} finally {
		recommendSceneLoading.value = false;
	}
}

// recordSaved 事件处理：刷新记录、贡献榜、家庭状态
function onRecordSaved() {
	loadRecords();
	loadFamilyStatus();
}

// 跳转 AI 记录页
function goDetail(id: number) {
	uni.navigateTo({ url: `/pages/record/detail?id=${id}` });
}

function goAiRecord() {
	uni.navigateTo({ url: "/pages/record/ai-record" });
}
function goFamily() {
	uni.navigateTo({ url: "/pages/family/index" });
}
function goFamilyReport() {
	// 营养分析：跳转家庭饮食月度报告页
	uni.navigateTo({ url: "/pages/family/report" });
}
function goAchievement() {
	uni.navigateTo({ url: "/pages/achievement/index" });
}
function goPokedex() {
	uni.navigateTo({ url: "/pages/gamification/index?tab=pokedex" });
}
function goBlindGuess() {
	uni.navigateTo({ url: "/pages/gamification/index?tab=blindguess" });
}
function goWhatToEat() {
	uni.navigateTo({ url: "/pages/what-to-eat/index" });
}
function goFamilyVote() {
	uni.navigateTo({ url: "/pages/family/index" });
}
function goRecords() {
	uni.switchTab({ url: "/pages/records/index" });
}
// 跳转发现页（tabbar）
function goDiscover() {
	uni.switchTab({ url: "/pages/discover/index" });
}
// 格式化 feed 时间：HH:mm 或 X分钟前
function formatFeedTime(t: string): string {
	if (!t) return "";
	const ts = new Date(t).getTime();
	if (isNaN(ts)) return "";
	const now = Date.now();
	const diff = now - ts;
	if (diff < 60 * 60 * 1000) {
		if (diff < 60 * 1000) return "刚刚";
		return `${Math.floor(diff / 60000)}分钟前`;
	}
	const d = new Date(ts);
	const hh = String(d.getHours()).padStart(2, "0");
	const mm = String(d.getMinutes()).padStart(2, "0");
	return `${hh}:${mm}`;
}
// feed 事件 emoji 前缀
function feedEventEmoji(type?: string): string {
	if (type === 'record') return '📸';
	if (type === 'like') return '❤️';
	if (type === 'blindguess') return '🎮';
	return '•';
}

// 贡献榜点击：跳转到指定成员的记录列表
function goMemberRecords(userId?: number, name?: string) {
	if (!userId) {
		uni.navigateTo({ url: "/pages/records/index" });
		return;
	}
	const encodedName = name ? encodeURIComponent(name) : "";
	uni.navigateTo({
		url: `/pages/records/index?userId=${userId}&name=${encodedName}`,
	});
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

// badge.icon 兜底映射：后端可能返回 "flame"/"star" 等字符串，统一转 emoji
const BADGE_ICON_MAP: Record<string, string> = {
	flame: '🔥', fire: '🔥', star: '⭐', crown: '👑', medal: '🏅', trophy: '🏆',
};
function resolveBadgeIcon(icon?: string): string {
	if (!icon) return '🏆';
	// 已是 emoji（非纯字母）直接返回
	if (!/^[a-zA-Z]+$/.test(icon)) return icon;
	return BADGE_ICON_MAP[icon.toLowerCase()] || '🏆';
}

// 工具：格式化餐次 + 时间（Task 10）
function formatMealTime(item: any): string {
	const mealMap: Record<string, string> = {
		breakfast: "早餐",
		lunch: "午餐",
		dinner: "晚餐",
		snack: "加餐",
	};
	const meal = item.mealType ? (mealMap[item.mealType] || item.mealType) : "";
	const time = formatTime(item.createdAt || item.time);
	return meal && time ? `${meal} | ${time}` : meal || time;
}

onMounted(async () => {
	await loadRecords();
	loadCheckin();
	loadFamilyStatus();
	loadNextBadge();
	loadTodayFeed();
	loadFamilyLevel();
	loadRecommendation();
	checkAiStatus();
	// 监听 recordSaved 事件：记录保存后刷新记录、贡献榜、家庭状态
	uni.$on("recordSaved", onRecordSaved);
});

// tabBar 页每次显示时刷新轻量数据
onShow(() => {
	loadCheckin();
	loadRecords();
	loadFamilyStatus();
	loadTodayFeed();
	loadFamilyLevel();
	checkAiStatus();
});

onUnmounted(() => {
	// 避免内存泄漏：组件卸载时移除事件监听
	uni.$off("recordSaved", onRecordSaved);
});
</script>

<style scoped>
/* ===== Task 9: 微交互关键帧动画 ===== */
@keyframes fadeInUp {
	from {
		opacity: 0;
		transform: translateY(20rpx);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}
@keyframes pulse {
	0%,
	100% {
		transform: scale(1);
	}
	50% {
		transform: scale(1.15);
	}
}
@keyframes rotateSpin {
	from {
		transform: rotate(0deg);
	}
	to {
		transform: rotate(180deg);
	}
}

/* 应用动画的工具类 */
.pulse {
	display: inline-block;
	animation: pulse 1.5s ease infinite;
}

.page-content {
	padding: 24rpx 28rpx 140rpx;
}

.page-header {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	padding: 16rpx 4rpx 12rpx;
	background: transparent;
}

.page-tagline {
	display: block;
	font-size: 24rpx;
	color: #999;
	margin-top: 4rpx;
}

/* ===== Task 6: 家庭今日状态 ===== */
.family-status {
	display: flex;
	flex-direction: column;
	align-items: flex-end;
	margin-top: 8rpx;
}
.family-has {
	display: flex;
	flex-direction: column;
	align-items: flex-end;
	padding: 12rpx 20rpx;
	border-radius: 16rpx;
	background: rgba(255, 255, 255, 0.7);
	border: 1rpx solid rgba(255, 107, 53, 0.15);
}
.family-avatars {
	display: flex;
	align-items: center;
}
.family-avatars.is-gray {
	opacity: 0.4;
}
.family-avatar {
	width: 48rpx;
	height: 48rpx;
	border-radius: 50%;
	margin-left: -12rpx;
	border: 2rpx solid #fff;
	background: #f0f0f0;
}
.family-avatar:first-child {
	margin-left: 0;
}
.family-avatar-emoji {
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 28rpx;
	color: var(--wj-text-muted);
}
.family-avatar-more {
	margin-left: 8rpx;
	font-size: 22rpx;
	color: var(--wj-text-muted);
}
.family-tip {
	font-size: 22rpx;
	color: var(--wj-text);
	margin-top: 8rpx;
}
.family-streak {
	font-size: 20rpx;
	color: var(--wj-primary);
	margin-top: 4rpx;
}
.family-none {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 12rpx 20rpx;
	border-radius: 16rpx;
	background: rgba(255, 255, 255, 0.7);
	border: 1rpx solid rgba(255, 107, 53, 0.15);
}
.family-none-emoji {
	font-size: 40rpx;
}
.family-none-text {
	font-size: 22rpx;
	color: var(--wj-primary);
	margin-top: 4rpx;
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

/* ===== Task 7: 打卡卡片 + 徽章进度 ===== */
.checkin-card {
	background: transparent;
	box-shadow: none;
	background: linear-gradient(135deg, rgba(255, 122, 69, 0.12), rgba(255, 214, 102, 0.08));
	margin-bottom: var(--wj-space-lg);
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
.checkin-btn:active {
	transform: scale(0.96);
}
.checkin-btn.is-disabled {
	background: #f5f5f5 !important;
	color: #999 !important;
	box-shadow: none !important;
}
.badge-progress {
	margin-top: 20rpx;
	padding-top: 20rpx;
	border-top: 1rpx solid rgba(0, 0, 0, 0.06);
}
.badge-info {
	display: flex;
	align-items: center;
	margin-bottom: 12rpx;
}
.badge-icon {
	width: 64rpx;
	height: 64rpx;
	border-radius: 50%;
	background: rgba(255, 107, 53, 0.12);
	display: inline-flex;
	align-items: center;
	justify-content: center;
	margin-right: 16rpx;
	flex-shrink: 0;
}
.badge-icon-emoji {
	font-size: 36rpx;
	line-height: 1;
}
.badge-meta {
	flex: 1;
}
.badge-name {
	display: block;
	font-size: 26rpx;
	font-weight: 600;
	color: var(--wj-text);
}
.badge-desc {
	display: block;
	font-size: 22rpx;
	color: var(--wj-text-muted);
	margin-top: 4rpx;
}
.progress-bar {
	height: 12rpx;
	background: #f0f0f0;
	border-radius: 6rpx;
	overflow: hidden;
}
.progress-inner {
	height: 100%;
	background: var(--wj-primary);
	border-radius: 6rpx;
	transition: width 0.3s;
}

/* ===== Task 5: 今天吃什么 主角卡片 ===== */
.hero-card {
	position: relative;
	height: 360rpx;
	border-radius: var(--wj-radius-xl);
	overflow: hidden;
	margin-bottom: var(--wj-space-lg);
}
.hero-card.is-fallback {
	background: linear-gradient(135deg, #FF7A45, #FFD666);
}
.hero-bg {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
}
.hero-mask {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	background: linear-gradient(180deg, rgba(0, 0, 0, 0.2) 0%, transparent 30%, rgba(0, 0, 0, 0.65) 100%);
}
.hero-content {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	padding: 24rpx;
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
	justify-content: space-between;
}
.hero-top {
	display: flex;
	align-items: center;
	justify-content: space-between;
}
.hero-label {
	font-size: 28rpx;
	font-weight: 600;
	color: #fff;
	background: rgba(0, 0, 0, 0.3);
	padding: 4rpx 16rpx;
	border-radius: 20rpx;
}
.hero-refresh {
	display: flex;
	align-items: center;
}
.hero-refresh:active {
	opacity: 0.7;
}
.hero-refresh-icon {
	font-size: 24rpx;
	color: #fff;
	margin-right: 6rpx;
}
.hero-refresh-icon.rotating {
	transition: transform 0.4s;
	transform: rotate(180deg);
}
.hero-refresh-text {
	font-size: 24rpx;
	color: #fff;
}
.hero-bottom {
	display: flex;
	flex-direction: column;
}
.hero-dish {
	font-size: 36rpx;
	font-weight: 700;
	color: #fff;
}
.hero-reason {
	font-size: 24rpx;
	color: #fff;
	opacity: 0.85;
	margin-top: 6rpx;
	line-height: 1.4;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
}
.hero-actions {
	margin-top: 12rpx;
	display: flex;
}
.hero-vote-btn {
	align-self: flex-start;
	background: rgba(255, 255, 255, 0.25);
	color: #fff;
	padding: 8rpx 24rpx;
	border-radius: 24rpx;
	font-size: 24rpx;
}
.hero-vote-btn:active {
	opacity: 0.8;
}

/* ===== 场景推荐辅助区 ===== */
.scene-section {
	margin-bottom: var(--wj-space-lg);
}
.scene-buttons {
	display: flex;
	gap: 16rpx;
}
.scene-btn {
	flex: 1;
	text-align: center;
	padding: 12rpx 0;
	font-size: 24rpx;
	color: var(--wj-text);
	background: rgba(255, 255, 255, 0.6);
	border: 1rpx solid rgba(255, 107, 53, 0.15);
	border-radius: 32rpx;
}
.scene-btn.is-active {
	background: var(--wj-primary);
	color: #fff;
	border-color: var(--wj-primary);
}
.scene-loading {
	margin-top: 16rpx;
	padding: 20rpx;
	font-size: 24rpx;
	color: var(--wj-text-muted);
	text-align: center;
	background: rgba(255, 255, 255, 0.6);
	border-radius: var(--wj-radius-sm);
}
.scene-result {
	margin-top: 16rpx;
	padding: 20rpx;
	background: rgba(255, 255, 255, 0.6);
	border-radius: var(--wj-radius-sm);
}
.scene-fallback {
	font-size: 22rpx;
	color: #faad14;
	margin-bottom: 8rpx;
}
.scene-dish-name {
	display: block;
	font-size: 28rpx;
	font-weight: 600;
	color: var(--wj-text);
	margin-bottom: 8rpx;
}
.scene-dish-reason {
	display: block;
	font-size: 24rpx;
	color: var(--wj-text-muted);
	line-height: 1.5;
}
.scene-reasons {
	margin-top: 8rpx;
}
.scene-reason-item {
	display: block;
	font-size: 22rpx;
	color: var(--wj-text-muted);
	line-height: 1.5;
}
.scene-used {
	margin-top: 8rpx;
	display: flex;
	flex-wrap: wrap;
	gap: 8rpx;
	align-items: center;
}
.scene-used-label {
	font-size: 22rpx;
	color: var(--wj-text-muted);
}
.scene-used-item {
	font-size: 22rpx;
	color: var(--wj-primary);
	background: rgba(255, 107, 53, 0.08);
	padding: 2rpx 12rpx;
	border-radius: 8rpx;
}

/* ===== Task 8: 快捷入口（透明网格 + 圆形容器） ===== */
.quick-grid {
	display: grid;
	grid-template-columns: repeat(4, 1fr);
	gap: 16rpx;
	margin-bottom: var(--wj-space-lg);
}
.quick-item {
	background: transparent;
	border-radius: var(--wj-radius);
	padding: 16rpx 8rpx;
	text-align: center;
	display: flex;
	flex-direction: column;
	align-items: center;
}
.quick-item:active {
	transform: scale(0.92);
}
.quick-icon {
	width: 80rpx;
	height: 80rpx;
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
	margin-bottom: 8rpx;
}
.quick-icon-orange {
	background: rgba(255, 107, 53, 0.12);
}
.quick-icon-yellow {
	background: rgba(255, 214, 102, 0.18);
}
.quick-icon-green {
	background: rgba(158, 215, 168, 0.2);
}
.quick-icon-emoji {
	font-size: 40rpx;
	line-height: 1;
}
.quick-text {
	display: block;
	font-size: 24rpx;
	color: var(--wj-text);
}

/* ===== Task 7: 美食记录卡片（横向） ===== */
.record-list {
	display: flex;
	flex-direction: column;
	gap: 0;
}
.record-card {
	display: flex;
	flex-direction: row;
	align-items: center;
	padding: 20rpx;
	overflow: hidden;
	margin-bottom: var(--wj-space-lg);
	background: rgba(255, 193, 7, 0.06);
	box-shadow: none;
	border-radius: var(--wj-radius);
}
.record-cover {
	width: 180rpx;
	height: 180rpx;
	border-radius: 12px;
	flex-shrink: 0;
	background: #f0f0f0;
	display: block;
}
.record-cover-placeholder {
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 56rpx;
	color: var(--wj-text-muted);
	background: rgba(255, 193, 7, 0.1);
}
.record-content {
	flex: 1;
	padding-left: 20rpx;
	display: flex;
	flex-direction: column;
	min-width: 0;
}
.record-name {
	font-size: 28rpx;
	font-weight: 600;
	color: var(--wj-text);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.record-cook-text {
	font-size: 24rpx;
	color: #999;
	margin-top: 8rpx;
}
.record-time {
	font-size: 22rpx;
	color: #999;
	margin-top: 6rpx;
}
/* 美食日记标题栏 + 查看全部右上角入口 */
.diary-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin: 16rpx 4rpx;
}
.diary-header .section-title {
	margin: 0;
}
.diary-more {
	font-size: 24rpx;
	color: var(--wj-primary);
}

/* ===== Task 12: 成长奖励入口 ===== */
.growth-entry {
	display: flex;
	align-items: center;
	padding: 24rpx 28rpx;
	margin-top: 16rpx;
}
.growth-icon {
	font-size: 44rpx;
	margin-right: 16rpx;
}
.growth-info {
	flex: 1;
}
.growth-title {
	display: block;
	font-size: 28rpx;
	font-weight: 600;
	color: var(--wj-text);
}
.growth-desc {
	display: block;
	font-size: 22rpx;
	color: var(--wj-text-muted);
	margin-top: 4rpx;
}
.growth-action {
	font-size: 28rpx;
	color: var(--wj-primary);
}

.section-title {
	font-size: 28rpx;
	font-weight: 600;
	color: #ffa000;
	margin: 16rpx 4rpx;
}
.empty-tip {
	font-size: 24rpx;
	color: var(--wj-text-muted);
	text-align: center;
	padding: 40rpx 0;
}

/* ===== 家庭今日动态 feed ===== */
.today-feed-card {
	padding: 24rpx 28rpx;
	background: rgba(158, 215, 168, 0.08);
	box-shadow: none;
}
.today-feed-card .section-title-text {
	color: var(--wj-family-green);
}
.today-feed-empty {
	text-align: center;
	padding: 32rpx 24rpx;
	background: rgba(158, 215, 168, 0.08);
	box-shadow: none;
}
.today-feed-card .section-title-bar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 16rpx;
}
.today-feed-card .section-more {
	font-size: 24rpx;
	color: var(--wj-text-muted);
}
.feed-list {
	display: flex;
	flex-direction: column;
	gap: 20rpx;
}
.feed-item {
	display: flex;
	align-items: flex-start;
	padding: 12rpx 0;
	animation: fadeInUp 0.4s ease both;
}
.feed-avatar {
	width: 56rpx;
	height: 56rpx;
	border-radius: 50%;
	margin-right: 16rpx;
	background: var(--wj-card-bg);
	flex-shrink: 0;
}
.feed-avatar-emoji {
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 28rpx;
	background: rgba(255, 107, 53, 0.1);
}
.feed-content {
	flex: 1;
	display: flex;
	flex-direction: column;
}
.feed-text {
	font-size: 26rpx;
	color: var(--wj-text);
	line-height: 1.4;
}
.feed-name {
	font-weight: 600;
	color: var(--wj-primary);
}
.feed-time {
	font-size: 22rpx;
	color: var(--wj-text-muted);
	margin-top: 4rpx;
}
.today-feed-empty .empty-text {
	display: block;
	font-size: 26rpx;
	color: var(--wj-text-muted);
	margin-bottom: 20rpx;
}
.today-feed-empty .empty-btn {
	height: 64rpx;
	line-height: 64rpx;
	padding: 0 32rpx;
	font-size: 26rpx;
	border-radius: 32rpx;
}

/* ===== Task 2: 今日家庭任务清单 ===== */
.today-tasks {
	margin-top: 20rpx;
	padding-top: 20rpx;
	border-top: 1rpx solid rgba(255, 107, 53, 0.15);
}
.tasks-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 12rpx;
}
.tasks-title {
	font-size: 26rpx;
	font-weight: 600;
	color: var(--wj-primary);
}
.tasks-level {
	font-size: 22rpx;
	color: var(--wj-text-muted);
}
.tasks-list {
	display: flex;
	flex-direction: column;
	gap: 8rpx;
}
.task-item {
	display: flex;
	align-items: center;
	gap: 12rpx;
}
.task-check {
	width: 36rpx;
	height: 36rpx;
	border-radius: 50%;
	border: 2rpx solid #ccc;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	font-size: 24rpx;
	color: transparent;
	flex-shrink: 0;
}
.task-check.is-done {
	background: var(--wj-family-green);
	border-color: var(--wj-family-green);
	color: #fff;
}
.task-name {
	font-size: 24rpx;
	color: var(--wj-text);
}
.task-name.is-done {
	color: var(--wj-family-green);
	text-decoration: line-through;
}
.tasks-complete {
	margin-top: 12rpx;
	padding: 12rpx;
	text-align: center;
	font-size: 24rpx;
	color: #fff;
	background: var(--wj-primary);
	border-radius: 8rpx;
	animation: pulse 1.5s ease infinite;
}

/* ===== Task 4: feed emoji ===== */
.feed-emoji {
	font-size: 24rpx;
	margin-right: 4rpx;
}
</style>
