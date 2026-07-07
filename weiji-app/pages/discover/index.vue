<template>
	<cl-page>
		<view class="page-content">
			<view class="page-header">
				<text class="page-title">发现</text>
			</view>

			<view class="feature-card primary-card" @click="goWhatToEat">
				<text class="card-emoji">🎰</text>
				<view class="card-info">
					<text class="card-title">今天吃什么</text>
					<text class="card-desc">还在纠结？一键帮你决定</text>
				</view>
				<text class="card-action">去看看 →</text>
			</view>

			<view class="wj-card feature-card" @click="goPokedex">
				<text class="card-emoji">📖</text>
				<view class="card-info">
					<text class="card-title">美食图鉴</text>
					<text class="card-desc">收集你尝过的每一道美味</text>
				</view>
				<text class="card-arrow">→</text>
			</view>

			<view class="wj-card feature-card" @click="goPersonality">
				<text class="card-emoji">🎭</text>
				<view class="card-info">
					<text class="card-title">食物人格</text>
					<text class="card-desc">看看你的饮食性格是什么</text>
				</view>
				<text class="card-arrow">→</text>
			</view>

			<view class="wj-card feature-card" @click="goTimeMachine">
				<text class="card-emoji">🕰️</text>
				<view class="card-info">
					<text class="card-title">美食时光机</text>
					<text class="card-desc">回顾往年今日的美食记忆</text>
				</view>
				<text class="card-arrow">→</text>
			</view>

			<view class="wj-card feature-card" @click="goBlindGuess">
				<text class="card-emoji">🎮</text>
				<view class="card-info">
					<text class="card-title">家庭盲猜</text>
					<text class="card-desc">和家人一起猜猜这是谁做的菜</text>
				</view>
				<text class="card-arrow">→</text>
			</view>
		</view>

		<tabbar />
	</cl-page>
</template>

<script lang="ts" setup>
import Tabbar from "/@/pages/index/components/tabbar.vue";

function goWhatToEat() {
	uni.navigateTo({ url: "/pages/what-to-eat/index" });
}

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
	uni.navigateTo({ url: "/pages/gamification/index?tab=blindguess" });
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

.primary-card {
	background: linear-gradient(135deg, var(--wj-primary) 0%, #e55a2b 100%);
	color: #fff;
	box-shadow: 0 8rpx 24rpx rgba(255, 107, 53, 0.3);
}
.primary-card .card-title,
.primary-card .card-desc,
.primary-card .card-action {
	color: #fff;
}
.primary-card .card-action {
	font-size: 26rpx;
	font-weight: 500;
	flex-shrink: 0;
}
</style>
