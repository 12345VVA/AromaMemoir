<template>
	<cl-page>
		<cl-topbar title="成就中心" />

		<view class="page-content">
			<!-- 等级卡片 -->
			<view class="wj-card level-card">
				<view class="level-top">
					<view class="level-badge">
						<text class="level-num">{{ level.level || 1 }}</text>
						<text class="level-label">LV</text>
					</view>
					<view class="level-meta">
						<text class="level-title">{{ level.title || "美食新秀" }}</text>
						<text class="level-exp">{{ level.exp || 0 }} / {{ level.nextLevelExp || 100 }} EXP</text>
					</view>
				</view>
				<view class="progress-bar">
					<view class="progress-inner" :style="{ width: progressPercent + '%' }"></view>
				</view>
				<text class="progress-tip">距下一级还差 {{ expRemaining }} 经验</text>
			</view>

			<!-- 徽章网格 -->
			<view class="section-title">我的徽章</view>
			<view class="badge-grid">
				<view v-for="b in achievements" :key="b.id" class="badge-item" :class="{ locked: !b.unlocked }">
					<view class="badge-icon">{{ b.unlocked ? (b.icon || "🏅") : "🔒" }}</view>
					<text class="badge-name">{{ b.name }}</text>
					<text class="badge-desc">{{ b.description || "" }}</text>
				</view>
				<view v-if="!achievements.length" class="empty-tip">暂无成就数据</view>
			</view>

			<!-- 挑战列表 -->
			<view class="section-title">进行中的挑战</view>
			<view v-if="challenges.length" class="challenge-list">
				<view v-for="c in challenges" :key="c.id" class="wj-card challenge-card">
					<view class="challenge-header">
						<text class="challenge-name">{{ c.name }}</text>
						<text v-if="c.userCompleted" class="challenge-status done">已完成 ✓</text>
						<text v-else-if="c.userJoined" class="challenge-status">进行中</text>
					</view>
					<text class="challenge-desc">{{ c.description || "" }}</text>
					<view v-if="c.userJoined && !c.userCompleted" class="challenge-progress">
						<view class="progress-bar">
							<view class="progress-inner" :style="{ width: challengePercent(c) + '%' }"></view>
						</view>
						<text class="progress-text">进度: {{ c.userProgress || 0 }}/{{ c.userTarget || 0 }}</text>
					</view>
					<button v-if="!c.userJoined" class="wj-btn join-btn" @click="joinChallenge(c)">参与</button>
				</view>
			</view>
			<view v-else class="empty-tip">暂无挑战</view>
		</view>
	</cl-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { api } from "/@/utils/api";

const level = ref<any>({});
const achievements = ref<any[]>([]);
const challenges = ref<any[]>([]);

const progressPercent = computed(() => {
	const cur = Number(level.value.exp || 0);
	const total = Number(level.value.nextLevelExp || 100);
	if (!total) return 0;
	return Math.min(100, Math.round((cur / total) * 100));
});
const expRemaining = computed(() => {
	const cur = Number(level.value.exp || 0);
	const total = Number(level.value.nextLevelExp || 100);
	return Math.max(0, total - cur);
});

function challengePercent(c: any) {
	const target = Number(c.userTarget || c.target || 0);
	if (!target) return 0;
	return Math.min(100, Math.round((Number(c.userProgress || c.progress || 0) / target) * 100));
}

async function loadLevel() {
	try {
		const data: any = await api.getLevel();
		level.value = data || {};
	} catch {
		// 静默
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

async function loadChallenges() {
	try {
		const [list, progressList] = await Promise.all([
			api.getChallenges(),
			api.getChallengeProgress().catch(() => [] as any[]),
		]);
		const listArr: any[] = Array.isArray(list) ? list : list?.list || list?.challenges || [];
		const progressArr: any[] = Array.isArray(progressList) ? progressList : [];
		// 以 challengeId 为键建立进度索引
		const progressMap = new Map<number, any>();
		progressArr.forEach((p: any) => {
			const ch = p?.challenge || {};
			const id = ch.id ?? p.challengeId;
			if (id !== undefined && id !== null) {
				progressMap.set(Number(id), p);
			}
		});
		// 合并：找到进度记录则标记已参与，否则为未参与
		challenges.value = listArr.map((c: any) => {
			const p = progressMap.get(Number(c.id));
			if (p) {
				return {
					...c,
					userJoined: true,
					userProgress: Number(p.progress || 0),
					userTarget: Number(p.target || c.target || 0),
					userCompleted: !!p.completed,
				};
			}
			return {
				...c,
				userJoined: false,
				userProgress: 0,
				userTarget: Number(c.target || 0),
				userCompleted: false,
			};
		});
	} catch {
		challenges.value = [];
	}
}

async function joinChallenge(c: any) {
	try {
		await api.joinChallenge(c.id);
		c.userJoined = true;
		c.userProgress = 0;
		uni.showToast({ title: "参与成功", icon: "success" });
	} catch {
		// 错误已由 api 层 toast
	}
}

onMounted(() => {
	loadLevel();
	loadAchievements();
	loadChallenges();
});

onShow(() => {
	loadLevel();
});
</script>

<style scoped>
.level-card {
	background: linear-gradient(135deg, var(--wj-primary) 0%, var(--wj-primary-dark) 100%);
	color: #fff;
	margin-bottom: 16rpx;
}
.level-top {
	display: flex;
	align-items: center;
	margin-bottom: 20rpx;
}
.level-badge {
	width: 112rpx;
	height: 112rpx;
	border-radius: 50%;
	background: rgba(255, 255, 255, 0.2);
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	margin-right: 24rpx;
	border: 4rpx solid rgba(255, 255, 255, 0.4);
}
.level-num {
	font-size: 48rpx;
	font-weight: 700;
	line-height: 1;
}
.level-label {
	font-size: 22rpx;
	opacity: 0.9;
}
.level-meta {
	flex: 1;
}
.level-title {
	display: block;
	font-size: 34rpx;
	font-weight: 600;
	margin-bottom: 8rpx;
}
.level-exp {
	display: block;
	font-size: 24rpx;
	opacity: 0.9;
}
.progress-bar {
	width: 100%;
	height: 16rpx;
	background: rgba(255, 255, 255, 0.25);
	border-radius: 8rpx;
	overflow: hidden;
	margin-bottom: 8rpx;
}
.progress-inner {
	height: 100%;
	background: #fff;
	border-radius: 8rpx;
	transition: width 0.3s;
}
.progress-tip {
	font-size: 22rpx;
	opacity: 0.9;
}

.badge-grid {
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	gap: 16rpx;
	margin-bottom: 16rpx;
}
.badge-item {
	background: #fff;
	border-radius: var(--wj-radius);
	box-shadow: var(--wj-shadow);
	padding: 24rpx 16rpx;
	text-align: center;
}
.badge-item.locked {
	opacity: 0.5;
}
.badge-icon {
	font-size: 56rpx;
	margin-bottom: 8rpx;
}
.badge-name {
	display: block;
	font-size: 24rpx;
	font-weight: 600;
	color: var(--wj-text);
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
}
.badge-desc {
	display: block;
	font-size: 20rpx;
	color: var(--wj-text-muted);
	margin-top: 4rpx;
	line-height: 1.3;
	overflow: hidden;
	display: -webkit-box;
	-webkit-box-orient: vertical;
	-webkit-line-clamp: 2;
}

.challenge-list {
	display: flex;
	flex-direction: column;
}
.challenge-card {
	padding: 24rpx 28rpx;
}
.challenge-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 8rpx;
}
.challenge-name {
	font-size: 30rpx;
	font-weight: 600;
	color: var(--wj-text);
}
.challenge-status {
	font-size: 24rpx;
	color: var(--wj-text-muted);
	padding: 4rpx 16rpx;
	border-radius: 8rpx;
	background: var(--wj-bg);
}
.challenge-status.done {
	color: #fff;
	background: var(--wj-primary);
}
.challenge-desc {
	display: block;
	font-size: 26rpx;
	color: var(--wj-text-muted);
	margin-bottom: 16rpx;
	line-height: 1.5;
}
.challenge-progress {
	display: flex;
	align-items: center;
	gap: 16rpx;
}
.challenge-progress .progress-bar {
	flex: 1;
	height: 12rpx;
	background: var(--wj-bg);
}
.challenge-progress .progress-inner {
	background: var(--wj-primary);
}
.progress-text {
	font-size: 22rpx;
	color: var(--wj-text-muted);
}
.join-btn {
	width: 100%;
	height: 72rpx;
	line-height: 72rpx;
	font-size: 28rpx;
	border-radius: 12rpx;
	margin-top: 16rpx;
}
</style>
