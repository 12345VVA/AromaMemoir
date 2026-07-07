<template>
	<cl-page>
		<cl-topbar title="家庭菜谱" />

		<view class="page-content">
			<!-- 已有家庭：家庭信息 + 邀请/加入入口 -->
			<view v-if="loading" class="wj-card family-loading">
				<text>加载中...</text>
			</view>
			<view v-else-if="error" class="wj-card family-error">
				<text class="error-text">{{ error }}</text>
				<button class="wj-btn wj-btn-ghost" @click="refreshAll">重试</button>
			</view>
			<view v-else-if="hasFamily" class="wj-card family-header">
				<view class="family-meta">
					<text class="family-name">{{ familyInfo.name || '未命名家庭' }}</text>
					<text class="family-desc">{{ members.length }} 位成员</text>
				</view>
				<view class="family-actions">
					<button class="wj-btn wj-btn-ghost invite-btn" @click="handleInvite">邀请家人</button>
					<button class="wj-btn wj-btn-ghost join-btn" @click="handleJoinFamily">加入家庭</button>
				</view>
				<view class="family-danger-actions">
					<button v-if="!isOwner" class="wj-btn wj-btn-ghost leave-btn" @click="handleLeaveFamily">退出家庭组</button>
					<template v-else>
						<button class="wj-btn wj-btn-ghost transfer-btn" @click="handleTransferOwner">转让家庭组</button>
						<button class="wj-btn wj-btn-danger disband-btn" @click="handleDisbandFamily">解散家庭组</button>
					</template>
				</view>
			</view>

			<!-- 无家庭：突出显示 创建/加入 家庭 CTA -->
			<view v-else class="wj-card family-empty">
				<text class="empty-title">还没有加入家庭</text>
				<text class="empty-desc">创建家庭或输入邀请码加入家庭，与家人共享美食菜谱</text>
				<view class="empty-actions">
					<button class="wj-btn create-family-btn" @click="handleCreateFamily">创建家庭</button>
					<button class="wj-btn wj-btn-ghost join-family-btn" @click="handleJoinFamily">加入家庭</button>
				</view>
			</view>

			<!-- 家庭成员横向列表 -->
			<view v-if="hasFamily" class="section-title">家庭成员</view>
			<scroll-view v-if="hasFamily" class="member-list no-scrollbar" scroll-x>
				<view v-for="m in members" :key="m.userId || m.id" class="member-item">
					<view class="member-avatar">
						<image v-if="m.avatarUrl" :src="resolveImg(m.avatarUrl)" mode="aspectFill" class="avatar-img" />
						<text v-else>{{ (m.nickName || m.nickname || m.username || "?").charAt(0) }}</text>
					</view>
					<text class="member-name">{{ m.nickName || m.nickname || m.username || "成员" }}</text>
					<text class="member-role">{{ roleText(m.role) }}</text>
					<button v-if="isTransferable(m)" class="wj-btn wj-btn-ghost member-transfer-btn" @click="handleTransferOwnership(m)">转让给TA</button>
				</view>
				<view v-if="!members.length" class="empty-tip">还没有家庭成员</view>
			</scroll-view>

			<!-- 分类筛选 -->
			<view v-if="hasFamily" class="section-title">家庭菜谱</view>
			<scroll-view v-if="hasFamily" class="category-bar no-scrollbar" scroll-x>
				<view
					v-for="c in categories"
					:key="c.value"
					class="category-item"
					:class="{ active: currentCategory === c.value }"
					@click="switchCategory(c.value)"
				>
					{{ c.label }}
				</view>
			</scroll-view>

			<!-- 菜谱网格 -->
			<template v-if="hasFamily">
				<view v-if="recipesLoading" class="empty-tip">加载中...</view>
				<view v-else-if="recipes.length" class="recipe-grid">
					<view v-for="r in recipes" :key="r.id" class="recipe-card" @click="goDetail(r.id)">
						<view class="recipe-cover">
							<image v-if="r.coverUrl" class="cover-img" :src="resolveImg(r.coverUrl)" mode="aspectFill" />
							<view v-else class="cover-placeholder">🍽️</view>
						</view>
						<view class="recipe-info">
							<text class="recipe-name">{{ r.name }}</text>
							<view class="recipe-meta">
								<text class="recipe-cat">{{ r.category || "其他" }}</text>
								<text class="recipe-vis" @click.stop="toggleVisibility(r)">{{ visibilityText(r.visibility) }}</text>
							</view>
						</view>
					</view>
				</view>
				<view v-else class="empty-tip">暂无菜谱，快去添加吧～</view>

				<!-- 新增菜谱入口 -->
				<button class="wj-btn add-btn" @click="goCreate">+ 新建菜谱</button>
			</template>

			<!-- 邀请码弹窗 -->
			<view v-if="inviteVisible" class="modal-mask" @click="inviteVisible = false">
				<view class="modal-content" @click.stop>
					<text class="modal-title">家庭邀请码</text>
					<text class="modal-desc">将邀请码分享给家人，24 小时内有效</text>
					<view class="invite-code-box">
						<text class="invite-code">{{ inviteCode }}</text>
					</view>
					<button class="wj-btn copy-btn" @click="copyInviteCode">复制邀请码</button>
					<text class="modal-close" @click="inviteVisible = false">关闭</text>
				</view>
			</view>
		</view>
	</cl-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { api, resolveImg } from "/@/utils/api";

const familyInfo = ref<any>({});
const members = ref<any[]>([]);
const recipes = ref<any[]>([]);
const recipesLoading = ref(false);
const inviteVisible = ref(false);
const inviteCode = ref("");
const loading = ref(false);
const error = ref("");

// 是否已加入家庭（用于切换空状态 CTA）
const hasFamily = computed(() => !!familyInfo.value?.id);

// 当前用户是否为家庭 owner（基于 familyInfo.role）
const isOwner = computed(() => familyInfo.value?.role === "owner");

// 是否可将家庭组转让给该成员（owner 且目标非 owner）
function isTransferable(m: any) {
	return isOwner.value && m.role !== "owner";
}

const categories = [
	{ value: "", label: "全部" },
	{ value: "breakfast", label: "早餐" },
	{ value: "lunch", label: "午餐" },
	{ value: "dinner", label: "晚餐" },
	{ value: "snack", label: "小食" },
	{ value: "dessert", label: "甜点" },
];
const currentCategory = ref("");

function roleText(role: string) {
	const map: Record<string, string> = { owner: "家长", admin: "管理员", member: "成员" };
	return map[role] || "成员";
}
function visibilityText(v: string) {
	return v === "private" ? "🔒仅自己" : v === "family" ? "👨‍👩‍👧家庭" : "🌍公开";
}

async function loadFamily() {
	try {
		const data: any = await api.getFamilyInfo();
		familyInfo.value = data || {};
	} catch (err: any) {
		error.value = err?.message || "加载失败";
	}
}

async function loadMembers() {
	try {
		const data: any = await api.getFamilyMembers();
		members.value = Array.isArray(data) ? data : data?.list || data?.members || [];
	} catch (err: any) {
		error.value = err?.message || "加载失败";
		members.value = [];
	}
}

async function loadRecipes() {
	recipesLoading.value = true;
	try {
		const params = currentCategory.value ? { category: currentCategory.value } : undefined;
		const data: any = await api.getFamilyRecipes(params);
		recipes.value = Array.isArray(data) ? data : data?.list || data?.recipes || [];
	} catch (err: any) {
		error.value = err?.message || "加载失败";
		recipes.value = [];
	} finally {
		recipesLoading.value = false;
	}
}

function switchCategory(v: string) {
	currentCategory.value = v;
	loadRecipes();
}

// 邀请码
async function handleInvite() {
	try {
		const data: any = await api.createInvitation();
		inviteCode.value = data.code || data.invitationCode || "";
		inviteVisible.value = true;
	} catch (err: any) {
		error.value = err?.message || "加载失败";
	}
}

// 加入家庭（通过邀请码）
function handleJoinFamily() {
	uni.showModal({
		title: "加入家庭",
		editable: true,
		placeholderText: "请输入邀请码",
		success: async (res) => {
			if (!res.confirm) return;
			const code = (res.content || "").trim();
			if (!code) {
				uni.showToast({ title: "邀请码不能为空", icon: "none" });
				return;
			}
			try {
				await api.joinFamily(code);
				uni.showToast({ title: "加入成功", icon: "success" });
				uni.$emit("familyChanged");
			} catch (err: any) {
				error.value = err?.message || "加载失败";
			}
		},
	});
}

// 创建家庭
function handleCreateFamily() {
	uni.showModal({
		title: "创建家庭",
		editable: true,
		placeholderText: "请输入家庭名称",
		success: async (res) => {
			if (!res.confirm) return;
			const name = (res.content || "").trim();
			if (!name) {
				uni.showToast({ title: "家庭名称不能为空", icon: "none" });
				return;
			}
			try {
				await api.createFamily(name);
				uni.showToast({ title: "创建成功", icon: "success" });
				uni.$emit("familyChanged");
			} catch (err: any) {
				error.value = err?.message || "加载失败";
			}
		},
	});
}

// 复制邀请码（小程序适配）
function copyInviteCode() {
	if (!inviteCode.value) return;
	uni.setClipboardData({
		data: inviteCode.value,
		success: () => {
			uni.showToast({ title: "已复制邀请码", icon: "success" });
		},
	});
}

// 可见性切换
async function toggleVisibility(r: any) {
	const next = r.visibility === "private" ? "family" : "private";
	try {
		await api.updateRecipeVisibility(r.id, next);
		r.visibility = next;
		uni.showToast({ title: "已更新可见性", icon: "success" });
	} catch {
		// 静默
	}
}

function goDetail(id: string) {
	uni.navigateTo({ url: `/pages/family/recipe-detail?id=${id}` });
}
function goCreate() {
	uni.navigateTo({ url: "/pages/family/recipe-form" });
}

// 刷新全部家庭相关数据（EventBus 触发）
async function refreshAll() {
	error.value = "";
	loading.value = true;
	try {
		await Promise.all([loadFamily(), loadMembers(), loadRecipes()]);
	} finally {
		loading.value = false;
	}
}

// 退出家庭组（非 owner）
function handleLeaveFamily() {
	uni.showModal({
		title: "退出家庭组",
		content: "退出后将无法访问该家庭的菜谱，确认退出？",
		confirmText: "确认退出",
		confirmColor: "#e54d42",
		success: async (res) => {
			if (!res.confirm) return;
			try {
				await api.leaveFamily();
				uni.showToast({ title: "已退出家庭组", icon: "success" });
				familyInfo.value = {};
				members.value = [];
				recipes.value = [];
				uni.$emit("familyChanged");
			} catch (err: any) {
				error.value = err?.message || "加载失败";
			}
		},
	});
}

// 解散家庭组（owner 专用，需输入家庭名称匹配）
function handleDisbandFamily() {
	const familyName = familyInfo.value?.name || "";
	if (!familyName) {
		uni.showToast({ title: "家庭信息异常", icon: "none" });
		return;
	}
	uni.showModal({
		title: "解散家庭组",
		editable: true,
		placeholderText: `请输入家庭名称 "${familyName}" 以确认`,
		confirmText: "确认解散",
		confirmColor: "#e54d42",
		success: async (res) => {
			if (!res.confirm) return;
			const input = (res.content || "").trim();
			if (input !== familyName) {
				uni.showToast({ title: "家庭名称不匹配", icon: "none" });
				return;
			}
			try {
				await api.disbandFamily();
				uni.showToast({ title: "已解散家庭组", icon: "success" });
				familyInfo.value = {};
				members.value = [];
				recipes.value = [];
				uni.$emit("familyChanged");
			} catch (err: any) {
				error.value = err?.message || "加载失败";
			}
		},
	});
}

// 转让家庭组入口（owner 专用，提示选择成员）
function handleTransferOwner() {
	const candidates = members.value.filter((m: any) => m.role !== "owner");
	if (!candidates.length) {
		uni.showToast({ title: "没有可转让的成员", icon: "none" });
		return;
	}
	const names = candidates
		.map((m: any) => m.nickName || m.nickname || m.username || "成员")
		.join("、");
	uni.showModal({
		title: "转让家庭组",
		content: `请点击成员列表中的"转让给TA"按钮完成转让。可转让成员：${names}`,
		showCancel: false,
		confirmText: "知道了",
	});
}

// 转让家庭组给指定成员（owner 专用）
function handleTransferOwnership(m: any) {
	const targetName = m.nickName || m.nickname || m.username || "该成员";
	uni.showModal({
		title: "转让家庭组",
		content: `确认将家庭组转让给"${targetName}"？转让后你将变为普通成员。`,
		confirmText: "确认转让",
		confirmColor: "#e54d42",
		success: async (res) => {
			if (!res.confirm) return;
			const targetId = m.userId || m.id;
			if (!targetId) {
				uni.showToast({ title: "成员信息异常", icon: "none" });
				return;
			}
			try {
				await api.transferOwnership(targetId);
				uni.showToast({ title: "已转让家庭组", icon: "success" });
				uni.$emit("familyChanged");
			} catch (err: any) {
				error.value = err?.message || "加载失败";
			}
		},
	});
}

const familyLoadedOnce = ref(false);
onMounted(() => {
	refreshAll();
	uni.$on("familyChanged", refreshAll);
	familyLoadedOnce.value = true;
});

onUnmounted(() => {
	uni.$off("familyChanged", refreshAll);
});

onShow(() => {
	if (familyLoadedOnce.value) refreshAll();
});
</script>

<style scoped>
.family-loading {
	text-align: center;
	padding: 40rpx;
}
.family-error {
	text-align: center;
	padding: 40rpx;
}
.error-text {
	color: #e54d42;
	display: block;
	margin-bottom: 20rpx;
}
.family-header {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	justify-content: space-between;
}
.family-name {
	display: block;
	font-size: 32rpx;
	font-weight: 600;
	color: var(--wj-text);
}
.family-desc {
	display: block;
	font-size: 24rpx;
	color: var(--wj-text-muted);
	margin-top: 4rpx;
}
.invite-btn {
	height: 64rpx;
	line-height: 64rpx;
	padding: 0 24rpx;
	font-size: 26rpx;
	border-radius: 32rpx;
}
.family-actions {
	display: flex;
	align-items: center;
	gap: 16rpx;
}
.join-btn {
	height: 64rpx;
	line-height: 64rpx;
	padding: 0 24rpx;
	font-size: 26rpx;
	border-radius: 32rpx;
}

/* 无家庭空状态 CTA */
.family-empty {
	text-align: center;
	padding: 64rpx 32rpx;
}
.empty-title {
	display: block;
	font-size: 34rpx;
	font-weight: 600;
	color: var(--wj-text);
	margin-bottom: 12rpx;
}
.empty-desc {
	display: block;
	font-size: 26rpx;
	color: var(--wj-text-muted);
	line-height: 1.6;
	margin-bottom: 40rpx;
}
.empty-actions {
	display: flex;
	flex-direction: column;
	gap: 20rpx;
}
.create-family-btn {
	height: 88rpx;
	line-height: 88rpx;
	font-size: 30rpx;
	border-radius: 16rpx;
}
.join-family-btn {
	height: 88rpx;
	line-height: 88rpx;
	font-size: 30rpx;
	border-radius: 16rpx;
}

.member-list {
	white-space: nowrap;
	padding-bottom: 16rpx;
}
.member-item {
	display: inline-block;
	vertical-align: top;
	width: 140rpx;
	text-align: center;
	margin-right: 24rpx;
	white-space: normal;
}
.member-avatar {
	width: 96rpx;
	height: 96rpx;
	border-radius: 50%;
	background: var(--wj-primary);
	color: #fff;
	font-size: 40rpx;
	line-height: 96rpx;
	margin: 0 auto 12rpx;
	overflow: hidden;
}
.avatar-img {
	width: 100%;
	height: 100%;
	display: block;
}
.member-name {
	display: block;
	font-size: 26rpx;
	color: var(--wj-text);
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
}
.member-role {
	display: block;
	font-size: 22rpx;
	color: var(--wj-text-muted);
	margin-top: 4rpx;
}

.category-bar {
	white-space: nowrap;
	margin-bottom: 16rpx;
}
.category-item {
	display: inline-block;
	padding: 12rpx 28rpx;
	margin-right: 16rpx;
	background: #fff;
	border-radius: 32rpx;
	font-size: 26rpx;
	color: var(--wj-text);
	border: 2rpx solid var(--wj-border);
}
.category-item.active {
	background: var(--wj-primary);
	color: #fff;
	border-color: var(--wj-primary);
}

.recipe-grid {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: 16rpx;
}
.recipe-card {
	background: #fff;
	border-radius: var(--wj-radius);
	box-shadow: var(--wj-shadow);
	overflow: hidden;
}
.recipe-cover {
	width: 100%;
	height: 220rpx;
	background: #f0f0f0;
}
.cover-img {
	width: 100%;
	height: 100%;
}
.cover-placeholder {
	width: 100%;
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 72rpx;
}
.recipe-info {
	padding: 16rpx 20rpx;
}
.recipe-name {
	display: block;
	font-size: 28rpx;
	font-weight: 600;
	color: var(--wj-text);
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
}
.recipe-meta {
	display: flex;
	justify-content: space-between;
	margin-top: 8rpx;
}
.recipe-cat {
	font-size: 22rpx;
	color: var(--wj-text-muted);
}
.recipe-vis {
	font-size: 22rpx;
	color: var(--wj-primary);
}

.add-btn {
	width: 100%;
	height: 88rpx;
	line-height: 88rpx;
	margin-top: 24rpx;
	font-size: 30rpx;
	border-radius: 16rpx;
}

/* 弹窗 */
.modal-mask {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background: rgba(0, 0, 0, 0.5);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 999;
}
.modal-content {
	width: 80%;
	max-width: 600rpx;
	background: #fff;
	border-radius: 24rpx;
	padding: 48rpx 32rpx;
	text-align: center;
}
.modal-title {
	display: block;
	font-size: 34rpx;
	font-weight: 600;
	color: var(--wj-text);
	margin-bottom: 12rpx;
}
.modal-desc {
	display: block;
	font-size: 24rpx;
	color: var(--wj-text-muted);
	margin-bottom: 32rpx;
}
.invite-code-box {
	background: var(--wj-bg);
	border-radius: 16rpx;
	padding: 32rpx;
	margin-bottom: 24rpx;
}
.invite-code {
	font-size: 56rpx;
	font-weight: 700;
	color: var(--wj-primary);
	letter-spacing: 8rpx;
}
.copy-btn {
	width: 100%;
	height: 88rpx;
	line-height: 88rpx;
	font-size: 30rpx;
	border-radius: 16rpx;
}
.modal-close {
	display: block;
	margin-top: 24rpx;
	font-size: 26rpx;
	color: var(--wj-text-muted);
}

/* danger actions */
.family-danger-actions {
	display: flex;
	align-items: center;
	justify-content: flex-end;
	gap: 16rpx;
	width: 100%;
	margin-top: 24rpx;
	padding-top: 24rpx;
	border-top: 2rpx solid var(--wj-border);
}
.leave-btn {
	height: 64rpx;
	line-height: 64rpx;
	padding: 0 24rpx;
	font-size: 26rpx;
	border-radius: 32rpx;
	color: var(--wj-text);
}
.transfer-btn {
	height: 64rpx;
	line-height: 64rpx;
	padding: 0 24rpx;
	font-size: 26rpx;
	border-radius: 32rpx;
}
.wj-btn-danger {
	background: #ee0a24;
	color: #fff;
	border: none;
}
.disband-btn {
	height: 64rpx;
	line-height: 64rpx;
	padding: 0 24rpx;
	font-size: 26rpx;
	border-radius: 32rpx;
}
.member-transfer-btn {
	height: 48rpx;
	line-height: 48rpx;
	padding: 0 16rpx;
	margin-top: 8rpx;
	font-size: 22rpx;
	border-radius: 24rpx;
}
</style>
