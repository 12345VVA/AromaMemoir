<template>
	<cl-page>
		<view class="page-content">
			<view class="page-header">
				<text class="page-title">我的</text>
			</view>

			<!-- 用户信息卡片 -->
			<view class="wj-card profile-card">
				<view class="avatar-wrap" @click="toSet">
					<image v-if="avatar" class="avatar-img" :src="resolveImg(avatar)" mode="aspectFill" />
					<view v-else class="avatar-placeholder">{{ nickName.charAt(0) || "?" }}</view>
					<view class="avatar-edit">📷</view>
				</view>
				<view class="profile-meta">
					<text class="profile-name">{{ nickName || "味记用户" }}</text>
					<text class="profile-sub">@{{ username || "unknown" }}</text>
				</view>
			</view>

			<!-- 统计数据 -->
			<view class="wj-card stats-card">
				<view class="stat-item">
					<text class="stat-value">{{ stats.records }}</text>
					<text class="stat-label">美食记录</text>
				</view>
				<view class="stat-divider"></view>
				<view class="stat-item">
					<text class="stat-value">{{ stats.recipes }}</text>
					<text class="stat-label">家庭菜谱</text>
				</view>
				<view class="stat-divider"></view>
				<view class="stat-item">
					<text class="stat-value">{{ stats.streak }}</text>
					<text class="stat-label">连续打卡</text>
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
				<view class="menu-item" @click="goGamification">
					<text class="menu-icon">🎮</text>
					<text class="menu-text">游戏化</text>
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
import { reactive, computed } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { useStore } from "/@/cool";
import { api, resolveImg } from "/@/utils/api";
import Tabbar from "./components/tabbar.vue";

const { user } = useStore();
const stats = reactive({ records: 0, recipes: 0, streak: 0 });

// 后端字段 → cool store 字段桥接展示
const nickName = computed(() => user.info?.nickName || user.info?.nickname || "");
const username = computed(() => user.info?.username || "");
const avatar = computed(() => user.info?.avatarUrl || user.info?.avatar || "");

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
		stats.records = data?.recordCount || data?.stats?.records || 0;
		stats.recipes = data?.recipeCount || data?.stats?.recipes || 0;
		stats.streak = data?.streak || data?.checkinStreak || 0;
	} catch {
		// 静默
	}
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
.profile-sub {
	display: block;
	font-size: 24rpx;
	color: var(--wj-text-muted);
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
