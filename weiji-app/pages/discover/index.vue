<template>
	<cl-page>
		<view class="page-content">
			<view class="page-header">
				<text class="page-title">发现</text>
			</view>

			<!-- 今日家庭挑战聚合卡 -->
			<view class="wj-card challenge-card">
				<view v-if="levelData && levelData.hasFamily" class="challenge-info">
					<view class="challenge-meta">
						<text class="challenge-family">{{ levelData.familyName }}</text>
						<text class="challenge-level">Lv{{ levelData.level }} · {{ levelData.currentTitle }}</text>
					</view>
					<view class="challenge-recommend">
						<text class="recommend-label">今日推荐</text>
						<text class="recommend-game">🎮 家庭盲猜 · 猜厨师</text>
						<text v-if="todayRemain > 0" class="recommend-remain">剩余 {{ todayRemain }} 次</text>
						<text v-else class="recommend-remain">今日挑战已完成</text>
					</view>
					<view class="challenge-progress">
						<view class="progress-bar">
							<view class="progress-fill" :style="{ width: ((levelData.progress || 0) * 100) + '%' }"></view>
						</view>
						<text class="progress-text">{{ levelData.exp }}/{{ levelData.nextLevelExp }} EXP</text>
					</view>
					<button class="wj-btn challenge-btn" :disabled="todayRemain === 0" @click="goBlindGuess">今日挑战</button>
				</view>
				<view v-else class="challenge-empty">
					<text class="empty-text">加入家庭，开启每日挑战</text>
					<button class="wj-btn" @click="goFamily">去加入</button>
				</view>
			</view>

			<!-- 图鉴卡片 -->
			<view class="wj-card feature-card" @click="goPokedex">
				<text class="card-emoji">📖</text>
				<view class="card-info">
					<text class="card-title">美食图鉴</text>
					<text class="card-desc" v-if="pokedexStats">已收集 {{ pokedexStats.unlocked }}/{{ pokedexStats.total }} · 稀有{{ pokedexStats.rare }} · 隐藏{{ pokedexStats.hidden }}</text>
					<text class="card-desc" v-else>收集你尝过的每一道美味</text>
				</view>
				<text class="card-arrow">→</text>
			</view>

			<!-- 人格卡片 -->
			<view class="wj-card feature-card" @click="goPersonality">
				<text class="card-emoji">🎭</text>
				<view class="card-info">
					<text class="card-title">食物人格</text>
					<text class="card-desc" v-if="personalityData">{{ personalityData.title }}</text>
					<text class="card-desc" v-else>查看你的美食人格</text>
				</view>
				<text class="card-arrow">→</text>
			</view>

			<!-- 时光机卡片 -->
			<view class="wj-card feature-card" @click="goTimeMachine">
				<text class="card-emoji">🕰️</text>
				<view class="card-info">
					<text class="card-title">美食时光机</text>
					<text class="card-desc" v-if="timemachinePreview">{{ timemachinePreview }}</text>
					<text class="card-desc" v-else>回顾往年今日的美食记忆</text>
				</view>
				<text class="card-arrow">→</text>
			</view>

			<!-- 盲猜卡片 -->
			<view class="wj-card feature-card" @click="goBlindGuess">
				<text class="card-emoji">🎮</text>
				<view class="card-info">
					<text class="card-title">家庭盲猜</text>
					<text class="card-desc">猜厨师 · 猜评分 · 猜日期 · 3种玩法</text>
				</view>
				<text class="card-arrow">→</text>
			</view>
		</view>

		<tabbar />
	</cl-page>
</template>

<script lang="ts" setup>
import { ref, onMounted } from "vue";
import Tabbar from "/@/pages/index/components/tabbar.vue";
import { api } from "/@/utils/api";

// 家庭等级数据（含 hasFamily/familyName/level/exp/currentTitle/nextLevelExp/progress）
const levelData = ref<any>(null);
// 图鉴统计（unlocked/total/rare/hidden）
const pokedexStats = ref<any>(null);
// 人格数据（已测时含 title）
const personalityData = ref<{ title: string } | null>(null);
// 时光机预览文案
const timemachinePreview = ref("");
// 今日剩余挑战次数（从 getFamilyLevel 读取，默认 0）
const todayRemain = ref(0);

// 并行加载所有数据，各接口独立降级，互不阻塞
async function loadLevelData() {
	try {
		const data = await api.getFamilyLevel();
		levelData.value = data || null;
		todayRemain.value = Number(data?.todayRemain) || 0;
	} catch {
		levelData.value = null;
	}
}

async function loadPokedex() {
	try {
		const data = await api.getPokedex();
		// 后端返回 { totalSlots, unlockedSlots, stats: { total, unlocked, rare, hidden, ... } }
		pokedexStats.value = (data && data.stats) || null;
	} catch {
		pokedexStats.value = null;
	}
}

async function loadPersonality() {
	try {
		const data = await api.getPersonality();
		// available=true 时 personalityType 为类型名
		if (data && data.available && data.personalityType) {
			personalityData.value = { title: data.personalityType };
		} else {
			personalityData.value = null;
		}
	} catch {
		personalityData.value = null;
	}
}

async function loadTimemachine() {
	try {
		const data = await api.getTimemachine();
		// memories 按年份降序，首条为最近一年的今日回忆
		if (data && data.memories && data.memories.length) {
			const first = data.memories[0];
			const currentYear = new Date().getFullYear();
			const yearsAgo = currentYear - (first.year || currentYear);
			const dishName = first.records && first.records[0] ? first.records[0].dishName : "";
			if (yearsAgo >= 1 && dishName) {
				timemachinePreview.value = `${yearsAgo}年前今天 · ${dishName}`;
			} else if (dishName) {
				timemachinePreview.value = `今天 · ${dishName}`;
			} else {
				timemachinePreview.value = "";
			}
		} else {
			timemachinePreview.value = "";
		}
	} catch {
		timemachinePreview.value = "";
	}
}

onMounted(() => {
	// 并行触发，各 catch 内部降级，不阻塞其他卡片
	loadLevelData();
	loadPokedex();
	loadPersonality();
	loadTimemachine();
});

function goPokedex() {
	uni.navigateTo({ url: "/pages/gamification/index?tab=pokedex" });
}

function goPersonality() {
	uni.navigateTo({ url: "/pages/gamification/index?tab=personality" });
}

function goTimeMachine() {
	uni.navigateTo({ url: "/pages/gamification/index?tab=timemachine" });
}

function goBlindGuess() {
	uni.navigateTo({ url: "/pages/gamification/index?tab=blindguess&mode=chef" });
}

function goFamily() {
	uni.navigateTo({ url: "/pages/family/index" });
}
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

/* ===== 今日家庭挑战聚合卡 ===== */
.challenge-card {
	background: linear-gradient(135deg, var(--wj-primary) 0%, var(--wj-primary-dark) 100%);
	padding: 36rpx 32rpx;
	margin-bottom: 20rpx;
	box-shadow: 0 8rpx 24rpx rgba(255, 107, 53, 0.3);
}

.challenge-info {
	display: flex;
	flex-direction: column;
	gap: 20rpx;
}

.challenge-meta {
	display: flex;
	flex-direction: column;
	gap: 8rpx;
}

.challenge-family {
	font-size: 36rpx;
	font-weight: 700;
	color: #fff;
}

.challenge-level {
	font-size: 26rpx;
	color: rgba(255, 255, 255, 0.9);
}

.challenge-progress {
	display: flex;
	flex-direction: column;
	gap: 10rpx;
}

.progress-bar {
	height: 14rpx;
	background: rgba(255, 255, 255, 0.25);
	border-radius: 8rpx;
	overflow: hidden;
}

.progress-fill {
	height: 100%;
	background: #fff;
	border-radius: 8rpx;
	transition: width 0.3s ease;
	min-width: 8rpx;
}

.progress-text {
	font-size: 22rpx;
	color: rgba(255, 255, 255, 0.85);
}

.challenge-btn {
	align-self: flex-start;
	background: #fff;
	color: var(--wj-primary);
	font-size: 28rpx;
	font-weight: 600;
	padding: 14rpx 40rpx;
	border-radius: var(--wj-radius);
}

.challenge-empty {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 20rpx;
}

.empty-text {
	font-size: 30rpx;
	color: #fff;
	font-weight: 500;
}

.challenge-empty .wj-btn {
	background: #fff;
	color: var(--wj-primary);
	font-size: 28rpx;
	padding: 14rpx 40rpx;
}

/* ===== 玩法卡片 ===== */
.feature-card {
	display: flex;
	align-items: center;
	padding: 32rpx 28rpx;
	margin-bottom: 16rpx;
	gap: 24rpx;
}

.card-emoji {
	font-size: 56rpx;
	flex-shrink: 0;
}

.card-info {
	flex: 1;
	min-width: 0;
}

.card-title {
	display: block;
	font-size: 32rpx;
	font-weight: 600;
	color: var(--wj-text);
	margin-bottom: 8rpx;
}

.card-desc {
	display: block;
	font-size: 24rpx;
	color: var(--wj-text-muted);
	line-height: 1.4;
}

.card-arrow {
	font-size: 32rpx;
	color: var(--wj-text-muted);
	flex-shrink: 0;
}

/* ===== 今日推荐玩法区 ===== */
.challenge-recommend {
	display: flex;
	align-items: center;
	gap: 16rpx;
	padding: 16rpx 20rpx;
	background: rgba(255, 255, 255, 0.18);
	border-radius: var(--wj-radius);
}

.recommend-label {
	font-size: 22rpx;
	color: #fff;
	background: rgba(255, 255, 255, 0.3);
	padding: 4rpx 12rpx;
	border-radius: 8rpx;
	flex-shrink: 0;
}

.recommend-game {
	flex: 1;
	font-size: 26rpx;
	color: #fff;
	font-weight: 500;
}

.recommend-remain {
	font-size: 22rpx;
	color: rgba(255, 255, 255, 0.85);
	flex-shrink: 0;
}
</style>
