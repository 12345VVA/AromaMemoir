<template>
	<cl-page>
		<cl-topbar title="今天吃什么" />
		<view class="page-content">
			<view class="mode-tabs">
				<view
					v-for="item in modes"
					:key="item.mode"
					class="mode-tab"
					:class="{ active: currentMode === item.mode }"
					@click="switchMode(item.mode)"
				>
					{{ item.label }}
				</view>
			</view>

			<view class="recommend-area">
				<view v-if="status === 'empty'" class="empty-state">
					<text class="empty-emoji">🤔</text>
					<text class="empty-text">{{ emptyText }}</text>
					<button v-if="emptyActionText" class="wj-btn empty-btn" @click="handleEmptyAction">
						{{ emptyActionText }}
					</button>
				</view>

				<view v-else-if="status === 'initial'" class="initial-state" @click="startRecommend">
					<text class="big-emoji">🍜</text>
					<text class="initial-title">点击开始</text>
					<text class="initial-sub">让命运决定今天吃什么</text>
				</view>

				<view v-else-if="status === 'animating'" class="animating-state">
					<text class="animating-emoji">{{ animatingEmoji }}</text>
					<text class="animating-text">正在为你选择...</text>
				</view>

				<view v-else-if="status === 'result'" class="result-card">
					<image v-if="result.cover" class="result-cover" :src="resolveImg(result.cover)" mode="aspectFill" />
					<text class="result-emoji">{{ result.emoji }}</text>
					<text class="result-name">{{ result.name }}</text>
					<text class="result-funny">{{ result.funnyText }}</text>
					<text class="result-source">{{ result.sourceText }}</text>
					<view class="result-buttons">
						<button class="wj-btn btn-primary" @click="startRecommend">
							🔄 再来一次
						</button>
						<button v-if="result.source !== 'ai'" class="wj-btn btn-secondary" @click="viewDetail">
							📖 查看详情
						</button>
					</view>
				</view>
			</view>
		</view>
	</cl-page>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { api, resolveImg } from "/@/utils/api";

type Mode = "random" | "records" | "recipes" | "ai";
type Status = "initial" | "animating" | "result" | "empty";

const modes = [
	{ mode: "random" as Mode, label: "🎲 随机" },
	{ mode: "records" as Mode, label: "📝 我的记录" },
	{ mode: "recipes" as Mode, label: "👨‍👩‍👧 家庭菜谱" },
	{ mode: "ai" as Mode, label: "✨ AI灵感" },
];

const funnyTexts = [
	"就决定是你了！",
	"今天就宠它！",
	"美味在召唤~",
	"味蕾的选择！",
	"不会错的选择！",
	"看起来很好吃！",
];

const animatingEmojis = ["🍜", "🍕", "🍔", "🍣", "🥗", "🍲", "🥩", "🍝", "🍱", "🍛", "🍤", "🍰"];

const currentMode = ref<Mode>("random");
const status = ref<Status>("initial");
const records = ref<any[]>([]);
const recipes = ref<any[]>([]);
const hasFamily = ref(false);
const aiRecommendations = ref<any[]>([]);
const animatingEmoji = ref(animatingEmojis[0]);
const result = ref({
	id: "",
	name: "",
	emoji: "🍽️",
	funnyText: "",
	sourceText: "",
	source: "" as "record" | "recipe" | "ai" | "",
	cover: "",
});
const lastResultId = ref<string | number | null>(null);
let animationTimer: number | null = null;

const emptyText = computed(() => {
	if (currentMode.value === "records") {
		return "你还没有美食记录哦~";
	}
	if (currentMode.value === "recipes") {
		return "还没有家庭菜谱，先去创建家庭或添加菜谱吧~";
	}
	return "还没有可推荐的内容，先去记录美食吧~";
});

const emptyActionText = computed(() => {
	if (currentMode.value === "records") {
		return "去AI记录";
	}
	return "";
});

function getDishEmoji(name: string): string {
	const n = name.toLowerCase();
	if (n.includes("火锅")) return "🍲";
	if (n.includes("披萨")) return "🍕";
	if (n.includes("汉堡")) return "🍔";
	if (n.includes("寿司")) return "🍣";
	if (n.includes("饺子")) return "🥟";
	if (n.includes("面包")) return "🍞";
	if (n.includes("蛋糕") || n.includes("甜")) return "🍰";
	if (n.includes("水果")) return "🍎";
	if (n.includes("牛肉") || n.includes("面")) return "🍜";
	if (n.includes("饭")) return "🍚";
	if (n.includes("鸡")) return "🍗";
	if (n.includes("鱼")) return "🐟";
	if (n.includes("虾")) return "🦐";
	if (n.includes("蛋")) return "🍳";
	if (n.includes("肉") || n.includes("排")) return "🥩";
	if (n.includes("菜") || n.includes("沙拉")) return "🥗";
	if (n.includes("汤")) return "🍲";
	return "🍽️";
}

function getRandomItem<T>(arr: T[], excludeId?: string | number | null, idKey = "id"): T | null {
	if (!arr.length) return null;
	let pool = arr;
	if (excludeId !== null && excludeId !== undefined) {
		const filtered = arr.filter((item: any) => item[idKey] !== excludeId);
		pool = filtered.length ? filtered : arr;
	}
	return pool[Math.floor(Math.random() * pool.length)];
}

function switchMode(mode: Mode) {
	if (currentMode.value === mode) return;
	currentMode.value = mode;
	if (animationTimer) {
		clearInterval(animationTimer);
		animationTimer = null;
	}
	checkEmpty();
}

function checkEmpty() {
	if (currentMode.value === "records") {
		status.value = records.value.length ? "initial" : "empty";
	} else if (currentMode.value === "recipes") {
		status.value = recipes.value.length ? "initial" : "empty";
	} else if (currentMode.value === "ai") {
		status.value = records.value.length ? "initial" : "empty";
	} else {
		const hasData = records.value.length > 0 || recipes.value.length > 0;
		status.value = hasData ? "initial" : "empty";
	}
}

function handleEmptyAction() {
	if (currentMode.value === "records") {
		uni.navigateTo({ url: "/pages/record/ai-record" });
	}
}

async function loadData() {
	try {
		const [recordsRes, familyInfoRes]: any[] = await Promise.allSettled([
			api.getRecords({ pageSize: 100 }),
			api.getFamilyInfo(),
		]);

		if (recordsRes.status === "fulfilled") {
			const data = recordsRes.value;
			records.value = Array.isArray(data) ? data : data?.list || data?.records || [];
		}

		if (familyInfoRes.status === "fulfilled" && familyInfoRes.value) {
			hasFamily.value = true;
			try {
				const recipeData: any = await api.getFamilyRecipes({ pageSize: 100 });
				recipes.value = Array.isArray(recipeData) ? recipeData : recipeData?.list || recipeData?.recipes || [];
			} catch {
				recipes.value = [];
			}
		} else {
			hasFamily.value = false;
			recipes.value = [];
		}
	} catch {
		records.value = [];
		recipes.value = [];
		hasFamily.value = false;
	}
	checkEmpty();
}

function startAnimation() {
	status.value = "animating";
	let idx = 0;
	animationTimer = setInterval(() => {
		idx = (idx + 1) % animatingEmojis.length;
		animatingEmoji.value = animatingEmojis[idx];
	}, 100) as unknown as number;
}

function stopAnimation() {
	if (animationTimer) {
		clearInterval(animationTimer);
		animationTimer = null;
	}
}

async function startRecommend() {
	startAnimation();
	await new Promise((resolve) => setTimeout(resolve, 1500));
	stopAnimation();
	await generateRecommendation();
}

async function generateRecommendation() {
	let item: any = null;
	let source: "record" | "recipe" | "ai" = "record";

	if (currentMode.value === "ai") {
		const lastRecord = records.value[0];
		if (lastRecord) {
			try {
				const dishName = lastRecord.dishName || lastRecord.title || "";
				const data: any = await api.getRecommendations(dishName);
				aiRecommendations.value = Array.isArray(data) ? data : data?.list || [];
				if (aiRecommendations.value.length) {
					const aiItem = getRandomItem(aiRecommendations.value);
					if (aiItem) {
						item = aiItem;
						source = "ai";
					}
				}
			} catch {
			}
		}
		if (!item) {
			item = getRandomItem(records.value, lastResultId.value);
			source = "record";
		}
	} else if (currentMode.value === "records") {
		item = getRandomItem(records.value, lastResultId.value);
		source = "record";
	} else if (currentMode.value === "recipes") {
		item = getRandomItem(recipes.value, lastResultId.value);
		source = "recipe";
	} else {
		const pool: any[] = [];
		records.value.forEach((r) => pool.push({ ...r, _source: "record" }));
		recipes.value.forEach((r) => pool.push({ ...r, _source: "recipe" }));
		const picked = getRandomItem(pool, lastResultId.value);
		if (picked) {
			item = picked;
			source = picked._source;
		}
	}

	if (!item) {
		checkEmpty();
		return;
	}

	const name = item.dishName || item.name || item.title || "神秘菜品";
	const id = item.id || "";
	lastResultId.value = id;

	result.value = {
		id,
		name,
		emoji: getDishEmoji(name),
		funnyText: funnyTexts[Math.floor(Math.random() * funnyTexts.length)],
		sourceText:
			source === "record"
				? "来自你的美食记录"
				: source === "recipe"
				? "来自家庭菜谱"
				: "AI为你推荐",
		source,
		cover: item.imageUrl || item.image || item.coverUrl || item.cover || "",
	};
	status.value = "result";
}

function viewDetail() {
	if (result.value.source === "record") {
		uni.navigateTo({ url: `/pages/record/detail?id=${result.value.id}` });
	} else if (result.value.source === "recipe") {
		uni.navigateTo({ url: `/pages/family/recipe-detail?id=${result.value.id}` });
	} else {
		uni.showToast({ title: "这是AI灵感推荐", icon: "none" });
	}
}

onMounted(() => {
	loadData();
});

// 页面销毁时清理动画定时器，避免泄漏与退出后仍触发推荐请求
onUnmounted(() => {
	stopAnimation();
});
</script>

<style scoped>
.page-content {
	padding: 24rpx;
}

.mode-tabs {
	display: flex;
	gap: 12rpx;
	margin-bottom: 32rpx;
}

.mode-tab {
	flex: 1;
	text-align: center;
	padding: 16rpx 8rpx;
	border-radius: 32rpx;
	font-size: 26rpx;
	border: 2rpx solid #e0e0e0;
	color: var(--wj-text-muted);
	background: var(--wj-card-bg);
	transition: all 0.3s;
	white-space: nowrap;
	overflow: hidden;
}

.mode-tab.active {
	background: var(--wj-primary);
	color: #fff;
	border-color: var(--wj-primary);
}

.recommend-area {
	min-height: 500rpx;
}

.initial-state {
	height: 400rpx;
	background: var(--wj-bg);
	border-radius: 24rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	transition: transform 0.2s;
}

.initial-state:active {
	transform: scale(0.98);
}

.big-emoji {
	font-size: 100rpx;
	margin-bottom: 24rpx;
}

.initial-title {
	font-size: 36rpx;
	font-weight: 600;
	color: var(--wj-text);
	margin-bottom: 12rpx;
}

.initial-sub {
	font-size: 26rpx;
	color: var(--wj-text-muted);
}

.animating-state {
	height: 400rpx;
	background: var(--wj-bg);
	border-radius: 24rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
}

.animating-emoji {
	font-size: 120rpx;
	margin-bottom: 24rpx;
	animation: bounce 0.1s infinite alternate;
}

.animating-text {
	font-size: 28rpx;
	color: var(--wj-text-muted);
}

@keyframes bounce {
	from {
		transform: scale(1);
	}
	to {
		transform: scale(1.1);
	}
}

.result-card {
	background: var(--wj-card-bg);
	border-radius: 24rpx;
	padding: 32rpx;
	box-shadow: var(--wj-shadow);
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
}

.result-cover {
	width: 100%;
	height: 280rpx;
	border-radius: 16rpx;
	margin-bottom: 24rpx;
	background: #f0f0f0;
}

.result-emoji {
	font-size: 120rpx;
	margin-bottom: 16rpx;
}

.result-name {
	font-size: 40rpx;
	font-weight: 700;
	color: var(--wj-text);
	margin-bottom: 16rpx;
}

.result-funny {
	font-size: 28rpx;
	color: var(--wj-primary);
	margin-bottom: 12rpx;
	font-weight: 500;
}

.result-source {
	font-size: 24rpx;
	color: var(--wj-text-muted);
	margin-bottom: 32rpx;
	padding: 6rpx 20rpx;
	background: rgba(0, 0, 0, 0.04);
	border-radius: 16rpx;
}

.result-buttons {
	width: 100%;
	display: flex;
	flex-direction: column;
	gap: 16rpx;
}

.btn-primary {
	width: 100%;
	margin: 0;
	height: 88rpx;
	line-height: 88rpx;
	font-size: 30rpx;
	border-radius: 44rpx;
	background: var(--wj-primary);
	color: #fff;
}
.btn-primary::after {
	border: none;
}

.btn-secondary {
	width: 100%;
	margin: 0;
	height: 80rpx;
	line-height: 80rpx;
	font-size: 28rpx;
	border-radius: 40rpx;
	background: var(--wj-bg);
	color: var(--wj-text);
	border: none;
}
.btn-secondary::after {
	border: none;
}

.empty-state {
	padding: 60rpx 32rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
}

.empty-emoji {
	font-size: 100rpx;
	margin-bottom: 24rpx;
}

.empty-text {
	font-size: 28rpx;
	color: var(--wj-text-muted);
	margin-bottom: 32rpx;
}

.empty-btn {
	margin: 0;
	padding: 0 48rpx;
	height: 80rpx;
	line-height: 80rpx;
	font-size: 28rpx;
	border-radius: 40rpx;
	background: var(--wj-primary);
	color: #fff;
}
.empty-btn::after {
	border: none;
}
</style>
