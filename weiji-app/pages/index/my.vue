<template>
	<cl-page>
		<view class="page-content">
			<view class="page-header">
				<text class="page-title">家庭成长中心</text>
			</view>

			<!-- 用户信息卡片（家庭角色身份） -->
			<view class="wj-card profile-card">
				<view class="avatar-wrap" @click="toSet">
					<image v-if="avatar" class="avatar-img" :src="resolveImg(avatar)" mode="aspectFill" />
					<view v-else class="avatar-placeholder">{{ nickName.charAt(0) || "?" }}</view>
					<view class="avatar-edit">📷</view>
				</view>
				<view class="profile-meta">
					<text class="profile-name">{{ familyDisplayName }}</text>
					<text v-if="hasFamily" class="profile-level">{{ familyLevelText }}</text>
					<text v-else class="profile-level profile-level-muted">未加入家庭</text>
					<view v-if="hasFamily" class="exp-row">
						<view class="exp-bar">
							<view class="exp-inner" :style="{ width: expPercent + '%' }"></view>
						</view>
						<text class="exp-text">{{ familyLevel.exp || 0 }}/{{ familyLevel.nextLevelExp || 100 }} EXP</text>
					</view>
					<button v-else class="join-family-btn" @click="goFamily">去加入家庭</button>
				</view>
			</view>

			<!-- 统计数据 -->
			<view class="wj-card stats-card">
				<view class="stat-item">
					<text class="stat-value">{{ newStats.records }}</text>
					<text class="stat-label">累计记录（餐）</text>
				</view>
				<view class="stat-divider"></view>
				<view class="stat-item">
					<text class="stat-value">{{ newStats.collected }}</text>
					<text class="stat-label">收藏美食（道）</text>
				</view>
				<view class="stat-divider"></view>
				<view class="stat-item">
					<text class="stat-value">{{ newStats.interactions }}</text>
					<text class="stat-label">家庭互动（次）</text>
				</view>
			</view>

			<!-- AI 服务在线状态（从首页迁移） -->
			<view class="wj-card ai-status-card">
				<view class="ai-status-item">
					<text class="ai-status-icon">{{ aiStatus === 'online' ? '🟢' : aiStatus === 'offline' ? '🔴' : '⚪' }}</text>
					<text class="ai-status-text">AI 服务{{ aiStatus === 'online' ? '在线' : aiStatus === 'offline' ? '离线' : '检测中' }}</text>
				</view>
			</view>

			<!-- 家庭成员展示区 -->
			<view v-if="hasFamily" class="wj-card members-card">
				<view class="members-avatars">
					<view
						v-for="(m, i) in displayMembers"
						:key="m.userId || m.id || i"
						class="member-avatar-item"
					>
						<image
							v-if="m.avatarUrl"
							class="member-avatar-img"
							:src="resolveImg(m.avatarUrl)"
							mode="aspectFill"
						/>
						<view v-else class="member-avatar-placeholder">
							{{ (m.nickName || m.nickname || m.username || "?").charAt(0) }}
						</view>
					</view>
					<view v-if="extraMembersCount > 0" class="member-avatar-item">
						<view class="member-extra-placeholder">+{{ extraMembersCount }}</view>
					</view>
				</view>
				<view class="family-points">
					<text class="points-label">家庭积分</text>
					<text class="points-value">{{ familyExp }}</text>
				</view>
			</view>

			<!-- 徽章 Top 3 -->
			<view class="wj-card badges-card" @click="goAchievement">
				<view class="badges-header">
					<text class="badges-title">我的徽章</text>
					<text class="badges-arrow">›</text>
				</view>
				<view v-if="topBadges.length" class="badges-list">
					<view v-for="b in topBadges" :key="b.id" class="badge-item">
						<text class="badge-icon">{{ b.icon || "🏅" }}</text>
						<text class="badge-name">{{ b.name }}</text>
					</view>
				</view>
				<view v-else class="badges-empty">
					<text class="badges-empty-text">快去解锁第一个徽章吧</text>
				</view>
			</view>

			<!-- 功能菜单 -->
			<view class="wj-card menu-card">
				<view class="menu-item" @click="goFamily">
					<text class="menu-icon">👨‍👩‍👧</text>
					<text class="menu-text">我的家庭</text>
					<text class="menu-arrow">›</text>
				</view>
				<view class="menu-item" @click="goAchievement">
					<text class="menu-icon">🏆</text>
					<text class="menu-text">成就中心</text>
					<text class="menu-arrow">›</text>
				</view>
				<view class="menu-item" @click="goBadges">
					<text class="menu-icon">🏅</text>
					<text class="menu-text">我的徽章</text>
					<text class="menu-arrow">›</text>
				</view>
				<view class="menu-item" @click="goGamification">
					<text class="menu-icon">🎮</text>
					<text class="menu-text">家庭挑战</text>
					<text class="menu-arrow">›</text>
				</view>
				<view class="menu-item" @click="toEdit">
					<text class="menu-icon">✏️</text>
					<text class="menu-text">修改昵称</text>
					<text class="menu-arrow">›</text>
				</view>
				<view class="menu-item" @click="toSet">
					<text class="menu-icon">⚙️</text>
					<text class="menu-text">设置</text>
					<text class="menu-arrow">›</text>
				</view>
			</view>

			<!-- 退出登录 -->
			<button class="wj-btn logout-btn" @click="handleLogout">退出登录</button>
		</view>

		<tabbar />
	</cl-page>
</template>

<script lang="ts" setup>
import { reactive, computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { useStore } from "/@/cool";
import { api, resolveImg } from "/@/utils/api";
import Tabbar from "./components/tabbar.vue";

const { user } = useStore();

// AI 服务在线状态（从首页迁移）
const aiStatus = ref<"checking" | "online" | "offline">("checking");

// 家庭等级与信息
const familyLevel = ref<any>({});
const familyInfo = ref<any>({});

// 新统计数据：累计记录 / 收藏美食 / 家庭互动
const newStats = reactive({ records: 0, collected: 0, interactions: 0 });

// 家庭成员列表
const members = ref<any[]>([]);

// 徽章列表
const achievements = ref<any[]>([]);

// 后端字段 → cool store 字段桥接展示
const nickName = computed(() => user.info?.nickName || user.info?.nickname || "");
const username = computed(() => user.info?.username || "");
const avatar = computed(() => user.info?.avatarUrl || user.info?.avatar || "");

// 是否已加入家庭（familyLevel 优先，familyInfo 兜底）
const hasFamily = computed(() => !!(familyLevel.value?.hasFamily || familyInfo.value?.id));

// 家庭展示名：有家庭用家庭名，无家庭用昵称
const familyDisplayName = computed(() => {
	if (hasFamily.value) {
		return familyLevel.value?.familyName || familyInfo.value?.name || "我的家庭";
	}
	return nickName.value || "味记用户";
});

// 家庭等级文案：Lv{level} · {currentTitle}
const familyLevelText = computed(() => {
	if (!hasFamily.value) return "";
	const lv = familyLevel.value?.level || 1;
	const title = familyLevel.value?.currentTitle || "新手家庭";
	return `Lv${lv} · ${title}`;
});

// 经验进度百分比（后端 progress 为 0~1 的本级进度）
const expPercent = computed(() => {
	if (!hasFamily.value) return 0;
	const progress = Number(familyLevel.value?.progress || 0);
	return Math.min(100, Math.max(0, Math.round(progress * 100)));
});

// 家庭积分（exp）
const familyExp = computed(() => Number(familyLevel.value?.exp || 0));

// 展示的成员（最多 5 个）
const displayMembers = computed(() => (members.value || []).slice(0, 5));
const extraMembersCount = computed(() => Math.max(0, (members.value?.length || 0) - 5));

// 已解锁徽章前 3
const topBadges = computed(() => {
	return (achievements.value || [])
		.filter((b: any) => b.unlocked)
		.slice(0, 3);
});

async function checkAiStatus() {
	aiStatus.value = "checking";
	try {
		const res: any = await api.health();
		aiStatus.value = res.ai === "up" ? "online" : "offline";
	} catch {
		aiStatus.value = "offline";
	}
}

async function loadProfile() {
	try {
		const data: any = await api.getUserProfile();
		if (data) {
			// 只同步用户资料字段到 cool store，不混入统计字段
			user.set({
				...user.info,
				nickName: data.nickName || data.nickname || user.info?.nickName,
				avatarUrl: data.avatarUrl || data.avatar || user.info?.avatarUrl,
				username: data.username || user.info?.username,
			});
		}
	} catch {
		// 静默
	}
}

async function loadFamilyLevel() {
	try {
		const data: any = await api.getFamilyLevel();
		familyLevel.value = data || {};
	} catch {
		familyLevel.value = {};
	}
}

async function loadFamilyInfo() {
	try {
		const data: any = await api.getFamilyInfo();
		familyInfo.value = data || {};
	} catch {
		familyInfo.value = {};
	}
}

async function loadMembers() {
	try {
		const data: any = await api.getFamilyMembers();
		members.value = Array.isArray(data) ? data : data?.list || data?.members || [];
	} catch {
		members.value = [];
	}
}

async function loadAchievements() {
	try {
		const data: any = await api.getAchievements();
		achievements.value = Array.isArray(data) ? data : data?.list || data?.achievements || [];
	} catch {
		achievements.value = [];
	}
}

async function loadStats() {
	// 累计记录（餐）：取 records 总数
	try {
		const data: any = await api.getRecords({ page: 1, pageSize: 1 });
		const total = data?.total ?? (Array.isArray(data) ? data.length : 0);
		newStats.records = Number(total) || 0;
	} catch {
		newStats.records = 0;
	}

	// 收藏美食（道）：取图鉴已解锁数
	try {
		const data: any = await api.getPokedex();
		newStats.collected =
			Number(data?.stats?.unlocked ?? data?.unlockedSlots ?? 0) || 0;
	} catch {
		newStats.collected = 0;
	}

	// 家庭互动（次）：点赞数 + 评论数 + 盲猜参与数（由后端 getFamilyLevel 聚合返回）
	// 依赖 loadFamilyLevel 已执行；若未加载或无家庭则降级为 0
	newStats.interactions = Number(familyLevel.value?.interactions) || 0;
}

function goFamily() {
	uni.navigateTo({ url: "/pages/family/index" });
}
function goAchievement() {
	uni.navigateTo({ url: "/pages/achievement/index" });
}
function goBadges() {
	uni.navigateTo({ url: "/pages/achievement/index" });
}
function goGamification() {
	uni.navigateTo({ url: "/pages/gamification/index" });
}
function toEdit() {
	uni.navigateTo({ url: "/pages/user/edit" });
}
function toSet() {
	uni.navigateTo({ url: "/pages/user/set" });
}

async function handleLogout() {
	uni.showModal({
		title: "退出登录",
		content: "确定要退出登录吗？",
		confirmColor: "#FF6B35",
		success: async (res) => {
			if (!res.confirm) return;
			await api.logout();
			uni.showToast({ title: "已退出", icon: "success" });
			setTimeout(() => {
				uni.reLaunch({ url: "/pages/user/login" });
			}, 400);
		},
	});
}

onShow(() => {
	loadProfile();
	checkAiStatus();
	loadFamilyLevel();
	loadFamilyInfo();
	loadMembers();
	loadAchievements();
	loadStats();
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

.profile-card {
	display: flex;
	align-items: center;
	padding: 32rpx 28rpx;
}
.avatar-wrap {
	position: relative;
	width: 128rpx;
	height: 128rpx;
	margin-right: 24rpx;
	flex-shrink: 0;
}
.avatar-img {
	width: 128rpx;
	height: 128rpx;
	border-radius: 50%;
	border: 4rpx solid var(--wj-border);
}
.avatar-placeholder {
	width: 128rpx;
	height: 128rpx;
	border-radius: 50%;
	background: var(--wj-primary);
	color: #fff;
	font-size: 56rpx;
	line-height: 128rpx;
	text-align: center;
}
.avatar-edit {
	position: absolute;
	right: 0;
	bottom: 0;
	width: 44rpx;
	height: 44rpx;
	border-radius: 50%;
	background: var(--wj-primary);
	color: #fff;
	font-size: 24rpx;
	line-height: 44rpx;
	text-align: center;
	border: 2rpx solid #fff;
}
.profile-meta {
	flex: 1;
}
.profile-name {
	display: block;
	font-size: 36rpx;
	font-weight: 600;
	color: var(--wj-text);
	margin-bottom: 8rpx;
}
.profile-level {
	display: block;
	font-size: 26rpx;
	color: var(--wj-primary);
	margin-bottom: 12rpx;
}
.profile-level-muted {
	color: var(--wj-text-muted);
}
.exp-row {
	display: flex;
	align-items: center;
	gap: 12rpx;
}
.exp-bar {
	flex: 1;
	height: 16rpx;
	background: var(--wj-bg);
	border-radius: 8rpx;
	overflow: hidden;
}
.exp-inner {
	height: 100%;
	background: var(--wj-primary);
	border-radius: 8rpx;
	transition: width 0.3s;
}
.exp-text {
	font-size: 22rpx;
	color: var(--wj-text-muted);
	flex-shrink: 0;
}
.join-family-btn {
	display: inline-block;
	height: 56rpx;
	line-height: 56rpx;
	padding: 0 24rpx;
	font-size: 24rpx;
	border-radius: 28rpx;
	background: var(--wj-primary);
	color: #fff;
	border: none;
	margin-top: 4rpx;
}

.stats-card {
	display: flex;
	align-items: center;
	padding: 32rpx 0;
}
.stat-item {
	flex: 1;
	text-align: center;
}
.stat-value {
	display: block;
	font-size: 44rpx;
	font-weight: 700;
	color: var(--wj-primary);
}
.stat-label {
	display: block;
	font-size: 24rpx;
	color: var(--wj-text-muted);
	margin-top: 4rpx;
}
.stat-divider {
	width: 2rpx;
	height: 64rpx;
	background: var(--wj-border);
}

.ai-status-card {
	padding: 24rpx 28rpx;
	margin-bottom: 16rpx;
}
.ai-status-item {
	display: flex;
	align-items: center;
}
.ai-status-icon {
	font-size: 32rpx;
	margin-right: 16rpx;
}
.ai-status-text {
	font-size: 28rpx;
	color: var(--wj-text);
}

.members-card {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 24rpx 28rpx;
}
.members-avatars {
	display: flex;
	align-items: center;
}
.member-avatar-item {
	width: 72rpx;
	height: 72rpx;
	margin-right: -16rpx;
	border-radius: 50%;
	border: 4rpx solid #fff;
	overflow: hidden;
	background: var(--wj-bg);
}
.member-avatar-item:last-child {
	margin-right: 0;
}
.member-avatar-img {
	width: 100%;
	height: 100%;
	display: block;
}
.member-avatar-placeholder {
	width: 100%;
	height: 100%;
	border-radius: 50%;
	background: var(--wj-primary);
	color: #fff;
	font-size: 28rpx;
	line-height: 72rpx;
	text-align: center;
}
.member-extra-placeholder {
	width: 100%;
	height: 100%;
	border-radius: 50%;
	background: var(--wj-bg);
	color: var(--wj-text-muted);
	font-size: 24rpx;
	line-height: 72rpx;
	text-align: center;
}
.family-points {
	display: flex;
	flex-direction: column;
	align-items: flex-end;
}
.points-label {
	font-size: 22rpx;
	color: var(--wj-text-muted);
}
.points-value {
	font-size: 36rpx;
	font-weight: 700;
	color: var(--wj-primary);
	margin-top: 4rpx;
}

.badges-card {
	padding: 24rpx 28rpx;
}
.badges-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 16rpx;
}
.badges-title {
	font-size: 30rpx;
	font-weight: 600;
	color: var(--wj-text);
}
.badges-arrow {
	font-size: 36rpx;
	color: var(--wj-text-muted);
}
.badges-list {
	display: flex;
	gap: 24rpx;
}
.badge-item {
	display: flex;
	flex-direction: column;
	align-items: center;
	flex: 1;
}
.badge-icon {
	font-size: 56rpx;
	margin-bottom: 8rpx;
}
.badge-name {
	font-size: 24rpx;
	color: var(--wj-text);
	text-align: center;
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
	max-width: 100%;
}
.badges-empty {
	padding: 16rpx 0;
}
.badges-empty-text {
	font-size: 26rpx;
	color: var(--wj-text-muted);
}

.menu-card {
	padding: 0;
	overflow: hidden;
}
.menu-item {
	display: flex;
	align-items: center;
	padding: 28rpx;
	border-bottom: 2rpx solid var(--wj-border);
}
.menu-item:last-child {
	border-bottom: none;
}
.menu-icon {
	font-size: 36rpx;
	margin-right: 20rpx;
}
.menu-text {
	flex: 1;
	font-size: 30rpx;
	color: var(--wj-text);
}
.menu-arrow {
	font-size: 36rpx;
	color: var(--wj-text-muted);
}

.logout-btn {
	width: 100%;
	height: 96rpx;
	line-height: 96rpx;
	font-size: 32rpx;
	border-radius: 16rpx;
	margin: 32rpx 0;
	background: #fff;
	color: #e54848;
	border: 2rpx solid #e54848;
}
</style>
