<template>
	<cl-page>
		<cl-topbar title="趣味玩法" />

		<view class="page-content">
			<!-- Tab 切换 -->
			<view class="tab-bar">
				<view
					v-for="t in tabs"
					:key="t.key"
					class="tab-item"
					:class="{ active: activeTab === t.key }"
					@click="switchTab(t.key)"
				>
					{{ t.label }}
				</view>
			</view>

			<!-- 1. 美食图鉴 -->
			<view v-if="activeTab === 'pokedex'">
				<view v-if="loading" class="empty-tip">加载中...</view>
				<view v-else>
					<view class="wj-card status-card">
						<text class="status-title">美食图鉴</text>
						<text class="status-sub">
							已解锁 {{ pokedex.unlockedSlots || 0 }} / {{ pokedex.totalSlots || 0 }}
							（{{ pokedexCompletion }}%）
						</text>
						<view class="progress-bar">
							<view class="progress-inner" :style="{ width: pokedexCompletion + '%' }"></view>
						</view>
					</view>

					<view
						v-for="cat in pokedex.categories || []"
						:key="cat.category"
						class="section-title"
					>
						{{ cat.category }}（{{ cat.unlockedSlots }}/{{ cat.totalSlots }}）
						<view class="pokedex-grid">
							<view
								v-for="item in cat.items"
								:key="item.dishName"
								class="pokedex-item"
								:class="{ locked: !item.unlocked }"
							>
								<text class="pokedex-emoji">{{ rarityEmoji(item.rarity) }}</text>
								<text class="pokedex-name">{{ item.unlocked ? item.dishName : '？？？' }}</text>
								<text v-if="item.unlocked && item.recordCount" class="pokedex-count">
									×{{ item.recordCount }}
								</text>
							</view>
						</view>
					</view>
					<view v-if="!(pokedex.categories && pokedex.categories.length)" class="empty-tip">
						暂无图鉴数据
					</view>
				</view>
			</view>

			<!-- 2. 食物人格 -->
			<view v-else-if="activeTab === 'personality'">
				<view v-if="loading" class="empty-tip">加载中...</view>
				<view v-else-if="personality.available" class="wj-card personality-card">
					<view class="personality-badge">{{ personalityEmoji }}</view>
					<text class="personality-type">{{ personality.personalityType || '神秘食客' }}</text>
					<text class="personality-desc">{{ personality.description || '' }}</text>
					<view class="trait-list">
						<text v-for="(t, i) in personality.traits || []" :key="i" class="trait-tag">{{ t }}</text>
					</view>
					<text class="personality-stat">基于近 {{ personality.recordCount || 0 }} 条记录生成</text>
				</view>
				<view v-else class="empty-tip">
					{{ personality.description || '记录不足 3 条，暂无法生成人格报告' }}
				</view>
			</view>

			<!-- 3. 美食时光机 -->
			<view v-else-if="activeTab === 'timemachine'">
				<view v-if="loading" class="empty-tip">加载中...</view>
				<view v-else-if="timemachine.memories && timemachine.memories.length">
					<view
						v-for="m in timemachine.memories"
						:key="m.year"
						class="wj-card memory-card"
					>
						<image
							v-if="m.coverImage"
							class="memory-cover"
							:src="m.coverImage"
							mode="aspectFill"
						/>
						<view v-else class="memory-cover placeholder">
							<text class="thumb-emoji">🍱</text>
						</view>
						<view class="memory-info">
							<text class="memory-year">{{ m.year }} 年</text>
							<text class="memory-caption">{{ m.caption || '' }}</text>
							<text class="memory-date">{{ m.date || '' }} · {{ (m.records || []).length }} 条记录</text>
						</view>
					</view>
				</view>
				<view v-else class="empty-tip">
					暂无往年今日记录，继续记录留下美食回忆吧～
				</view>
			</view>

			<!-- 4. 家庭盲猜 -->
			<view v-else-if="activeTab === 'blindguess'">
				<!-- 查看轮次 -->
				<view class="section-title">查看盲猜轮次</view>
				<view class="round-search">
					<input
						class="round-input"
						v-model="roundIdInput"
						placeholder="输入轮次 ID"
						placeholder-class="ph"
					/>
					<button class="wj-btn round-btn" :disabled="roundLoading" @click="loadRound">查看</button>
				</view>

				<view v-if="roundLoading" class="empty-tip">加载中...</view>
				<view v-else-if="round" class="wj-card round-card">
					<view class="round-header">
						<text class="round-name">{{ round.roundName || '本轮盲猜' }}</text>
						<text class="round-status" :class="{ revealed: round.status === 'revealed' }">
							{{ round.status === 'revealed' ? '已揭晓' : '进行中' }}
						</text>
					</view>

					<view v-if="round.items && round.items.length" class="round-items">
						<view
							v-for="(item, idx) in round.items"
							:key="item.recordId || idx"
							class="round-item"
						>
							<image
								v-if="item.coverUrl"
								class="round-thumb"
								:src="item.coverUrl"
								mode="aspectFill"
							/>
							<view v-else class="round-thumb placeholder">
								<text class="thumb-emoji">🍽️</text>
							</view>
							<view class="round-item-info">
								<text class="round-item-name">
									{{ round.status === 'revealed' ? (item.dishName || '未知菜品') : '???（待揭晓）' }}
								</text>
								<text class="round-item-author">
									作者：{{
										round.status === 'revealed'
											? (item.realAuthorName || '未知')
											: '???（待揭晓）'
									}}
								</text>

								<!-- 进行中：提交猜测 -->
								<view v-if="round.status === 'active'" class="guess-form">
									<input
										class="guess-input"
										v-model="guessForms[item.recordId].dish"
										placeholder="猜菜名"
										placeholder-class="ph"
									/>
									<input
										class="guess-input author"
										v-model="guessForms[item.recordId].authorId"
										placeholder="作者 ID"
										placeholder-class="ph"
									/>
									<button
										class="wj-btn guess-btn"
										:disabled="guessLoading === item.recordId"
										:loading="guessLoading === item.recordId"
										@click="handleSubmitGuess(item)"
									>
										提交
									</button>
								</view>
							</view>
						</view>
					</view>

					<!-- 已揭晓：展示排名 -->
					<view
						v-if="round.status === 'revealed' && roundRanking.length"
						class="ranking-section"
					>
						<text class="ranking-title">🏆 排名</text>
						<view v-for="r in roundRanking" :key="r.userId" class="ranking-row">
							<text class="ranking-no">第 {{ r.rank }} 名</text>
							<text class="ranking-name">{{ r.userNickname || '未知' }}</text>
							<text class="ranking-score">
								{{ r.totalScore }} 分 · {{ r.correctCount }} 道正确
							</text>
							<text v-if="r.isChef" class="chef-tag">厨神</text>
						</view>
					</view>

					<!-- 揭晓按钮（仅 creator） -->
					<button
						v-if="round.status === 'active' && isRoundCreator"
						class="wj-btn reveal-btn"
						:disabled="revealing"
						:loading="revealing"
						@click="handleReveal"
					>
						揭晓结果
					</button>
				</view>

				<!-- 发起新轮次 -->
				<view class="section-title">发起新轮次</view>
				<view class="wj-card create-form">
					<view class="form-item">
						<text class="form-label">家庭组 ID</text>
						<input class="form-input" v-model="createForm.familyId" placeholder="familyId" placeholder-class="ph" />
					</view>
					<view class="form-item">
						<text class="form-label">轮次名称</text>
						<input class="form-input" v-model="createForm.roundName" placeholder="如：周末盲猜" placeholder-class="ph" />
					</view>
					<view class="form-item">
						<text class="form-label">记录 ID（3-10 个，逗号分隔）</text>
						<input class="form-input" v-model="createForm.recordIdsStr" placeholder="1,2,3" placeholder-class="ph" />
					</view>
					<button class="wj-btn create-btn" :disabled="creating" :loading="creating" @click="handleCreate">
						发起轮次
					</button>
				</view>
			</view>
		</view>
	</cl-page>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { useStore } from "/@/cool";
import { api } from "/@/utils/api";

const { user } = useStore();

const tabs = [
	{ key: "pokedex", label: "图鉴" },
	{ key: "personality", label: "人格" },
	{ key: "timemachine", label: "时光机" },
	{ key: "blindguess", label: "盲猜" },
];
const activeTab = ref<"pokedex" | "personality" | "timemachine" | "blindguess">("pokedex");
const loading = ref(false);

// 图鉴
const pokedex = ref<any>({});
// 人格
const personality = ref<any>({});
// 时光机
const timemachine = ref<any>({});
// 盲猜
const roundIdInput = ref("");
const round = ref<any>(null);
const roundLoading = ref(false);
const guessForms = reactive<Record<string, { dish: string; authorId: string }>>({});
const guessLoading = ref<any>("");
const roundRanking = ref<any[]>([]);
const revealing = ref(false);
const createForm = reactive({
	familyId: "",
	roundName: "",
	recordIdsStr: "",
});
const creating = ref(false);

const pokedexCompletion = computed(() => {
	const r = Number(pokedex.value.completionRate || 0);
	return Math.round(r * 100);
});

const personalityEmoji = computed(() => {
	const name = String(personality.value.personalityType || "");
	if (name.includes("碳水")) return "🍜";
	if (name.includes("辣")) return "🌶️";
	if (name.includes("健康")) return "🥗";
	if (name.includes("肉")) return "🥩";
	if (name.includes("甜")) return "🍰";
	if (name.includes("清淡")) return "🍵";
	if (name.includes("厨神")) return "👨‍🍳";
	return "🍽️";
});

const isRoundCreator = computed(() => {
	const uid = user.info?.id;
	return !!uid && String(round.value?.creatorId || "") === String(uid);
});

function rarityEmoji(rarity: string) {
	if (rarity === "legendary") return "🌟";
	if (rarity === "epic") return "💎";
	if (rarity === "rare") return "✨";
	return "🍽️";
}

function switchTab(key: typeof activeTab.value) {
	if (activeTab.value === key) return;
	activeTab.value = key;
	loadTab();
}

async function loadTab() {
	loading.value = true;
	try {
		if (activeTab.value === "pokedex") {
			pokedex.value = (await api.getPokedex()) || {};
		} else if (activeTab.value === "personality") {
			personality.value = (await api.getPersonality()) || {};
		} else if (activeTab.value === "timemachine") {
			timemachine.value = (await api.getTimemachine()) || {};
		}
		// blindguess 不自动加载，等待用户输入轮次 ID
	} catch {
		// api.ts 已统一 toast
	} finally {
		loading.value = false;
	}
}

async function loadRound() {
	const id = roundIdInput.value.trim();
	if (!id) {
		uni.showToast({ title: "请输入轮次 ID", icon: "none" });
		return;
	}
	roundLoading.value = true;
	try {
		const data: any = await api.getBlindGuessRoundDetail(id);
		round.value = data || null;
		roundRanking.value = extractRanking(data);
		// 初始化猜测表单
		if (data && Array.isArray(data.items)) {
			data.items.forEach((it: any) => {
				if (!guessForms[it.recordId]) {
					guessForms[it.recordId] = { dish: "", authorId: "" };
				}
			});
		}
	} catch {
		round.value = null;
		roundRanking.value = [];
	} finally {
		roundLoading.value = false;
	}
}

function extractRanking(data: any): any[] {
	if (!data) return [];
	if (data.status === "revealed") {
		if (Array.isArray(data.rankings)) return data.rankings;
		if (Array.isArray(data.ranking)) return data.ranking;
	}
	return [];
}

async function handleSubmitGuess(item: any) {
	if (!round.value) return;
	const roundId = round.value.id || round.value.roundId;
	const form = guessForms[item.recordId] || { dish: "", authorId: "" };
	const dish = (form.dish || "").trim();
	const authorId = (form.authorId || "").trim();
	if (!dish || !authorId) {
		uni.showToast({ title: "请填写菜名与作者 ID", icon: "none" });
		return;
	}
	guessLoading.value = item.recordId;
	try {
		await api.submitBlindGuess(roundId, {
			itemId: item.recordId,
			guessAuthorId: authorId,
			guessDishName: dish,
		});
		uni.showToast({ title: "已提交猜测", icon: "success" });
		guessForms[item.recordId] = { dish: "", authorId: "" };
		await loadRound();
	} catch {
		// api.ts 已统一 toast
	} finally {
		guessLoading.value = "";
	}
}

async function handleReveal() {
	if (!round.value) return;
	const roundId = round.value.id || round.value.roundId;
	revealing.value = true;
	try {
		await api.revealBlindGuessRound(roundId);
		uni.showToast({ title: "已揭晓", icon: "success" });
		await loadRound();
	} catch {
		// api.ts 已统一 toast
	} finally {
		revealing.value = false;
	}
}

async function handleCreate() {
	const familyId = createForm.familyId.trim();
	const roundName = createForm.roundName.trim();
	const recordIds = createForm.recordIdsStr
		.split(/[,，\s]+/)
		.map(s => s.trim())
		.filter(Boolean);
	if (!familyId || !roundName) {
		uni.showToast({ title: "请填写家庭组 ID 与轮次名称", icon: "none" });
		return;
	}
	if (recordIds.length < 3 || recordIds.length > 10) {
		uni.showToast({ title: "记录 ID 需 3-10 个", icon: "none" });
		return;
	}
	creating.value = true;
	try {
		const data: any = await api.createBlindGuessRound({
			familyId,
			roundName,
			recordIds,
		});
		uni.showToast({ title: "已发起轮次", icon: "success" });
		// 跳转到新轮次详情
		if (data && (data.id || data.roundId)) {
			roundIdInput.value = String(data.id || data.roundId);
			await loadRound();
		}
		createForm.familyId = "";
		createForm.roundName = "";
		createForm.recordIdsStr = "";
	} catch {
		// api.ts 已统一 toast
	} finally {
		creating.value = false;
	}
}

onMounted(() => {
	loadTab();
});

onShow(() => {
	if (activeTab.value !== "blindguess") loadTab();
});
</script>

<style scoped>
.tab-bar {
	display: flex;
	background: #fff;
	border-radius: var(--wj-radius);
	box-shadow: var(--wj-shadow);
	margin-bottom: 16rpx;
	overflow: hidden;
}
.tab-item {
	flex: 1;
	text-align: center;
	padding: 24rpx 0;
	font-size: 28rpx;
	color: var(--wj-text-muted);
	border-bottom: 4rpx solid transparent;
}
.tab-item.active {
	color: var(--wj-primary);
	border-bottom-color: var(--wj-primary);
	font-weight: 600;
}

.status-card {
	background: linear-gradient(135deg, var(--wj-primary) 0%, var(--wj-primary-dark) 100%);
	color: #fff;
	margin-bottom: 16rpx;
}
.status-title {
	display: block;
	font-size: 32rpx;
	font-weight: 600;
	margin-bottom: 8rpx;
}
.status-sub {
	display: block;
	font-size: 24rpx;
	opacity: 0.9;
	margin-bottom: 16rpx;
}
.progress-bar {
	width: 100%;
	height: 16rpx;
	background: rgba(255, 255, 255, 0.25);
	border-radius: 8rpx;
	overflow: hidden;
}
.progress-inner {
	height: 100%;
	background: #fff;
	border-radius: 8rpx;
	transition: width 0.3s;
}

.pokedex-grid {
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	gap: 16rpx;
}
.pokedex-item {
	background: #fff;
	border-radius: var(--wj-radius);
	box-shadow: var(--wj-shadow);
	padding: 24rpx 12rpx;
	text-align: center;
}
.pokedex-item.locked {
	opacity: 0.45;
}
.pokedex-emoji {
	display: block;
	font-size: 48rpx;
	margin-bottom: 8rpx;
}
.pokedex-name {
	display: block;
	font-size: 24rpx;
	font-weight: 600;
	color: var(--wj-text);
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
}
.pokedex-count {
	display: block;
	font-size: 20rpx;
	color: var(--wj-text-muted);
	margin-top: 4rpx;
}

.personality-card {
	text-align: center;
	padding: 48rpx 32rpx;
}
.personality-badge {
	font-size: 96rpx;
	margin-bottom: 16rpx;
}
.personality-type {
	display: block;
	font-size: 36rpx;
	font-weight: 700;
	color: var(--wj-primary);
	margin-bottom: 16rpx;
}
.personality-desc {
	display: block;
	font-size: 26rpx;
	color: var(--wj-text);
	line-height: 1.6;
	margin-bottom: 24rpx;
}
.trait-list {
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
	justify-content: center;
	margin-bottom: 24rpx;
}
.trait-tag {
	font-size: 24rpx;
	color: var(--wj-primary);
	background: rgba(255, 107, 53, 0.08);
	padding: 8rpx 20rpx;
	border-radius: 24rpx;
}
.personality-stat {
	display: block;
	font-size: 22rpx;
	color: var(--wj-text-muted);
}

.memory-card {
	display: flex;
	gap: 20rpx;
	padding: 20rpx 24rpx;
	margin-bottom: 16rpx;
}
.memory-cover {
	width: 160rpx;
	height: 160rpx;
	border-radius: 12rpx;
	flex-shrink: 0;
	background: var(--wj-bg);
}
.memory-cover.placeholder {
	display: flex;
	align-items: center;
	justify-content: center;
}
.memory-info {
	flex: 1;
	min-width: 0;
}
.memory-year {
	display: block;
	font-size: 32rpx;
	font-weight: 700;
	color: var(--wj-primary);
	margin-bottom: 8rpx;
}
.memory-caption {
	display: block;
	font-size: 26rpx;
	color: var(--wj-text);
	line-height: 1.5;
	margin-bottom: 8rpx;
}
.memory-date {
	display: block;
	font-size: 22rpx;
	color: var(--wj-text-muted);
}

.round-search {
	display: flex;
	gap: 16rpx;
	margin-bottom: 16rpx;
}
.round-input {
	flex: 1;
	height: 72rpx;
	font-size: 28rpx;
	padding: 0 20rpx;
	background: #fff;
	border-radius: 12rpx;
	border: 2rpx solid var(--wj-border);
	color: var(--wj-text);
}
.round-btn {
	flex-shrink: 0;
	height: 72rpx;
	line-height: 72rpx;
	padding: 0 28rpx;
	font-size: 26rpx;
	border-radius: 12rpx;
}

.round-card {
	padding: 24rpx 28rpx;
	margin-bottom: 16rpx;
}
.round-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 16rpx;
}
.round-name {
	font-size: 30rpx;
	font-weight: 600;
	color: var(--wj-text);
}
.round-status {
	font-size: 24rpx;
	color: var(--wj-text-muted);
	padding: 4rpx 16rpx;
	border-radius: 8rpx;
	background: var(--wj-bg);
}
.round-status.revealed {
	color: #fff;
	background: var(--wj-primary);
}
.round-items {
	display: flex;
	flex-direction: column;
	gap: 20rpx;
}
.round-item {
	display: flex;
	gap: 20rpx;
}
.round-thumb {
	width: 144rpx;
	height: 144rpx;
	border-radius: 12rpx;
	flex-shrink: 0;
	background: var(--wj-bg);
}
.round-thumb.placeholder {
	display: flex;
	align-items: center;
	justify-content: center;
}
.thumb-emoji {
	font-size: 56rpx;
}
.round-item-info {
	flex: 1;
	min-width: 0;
}
.round-item-name {
	display: block;
	font-size: 28rpx;
	font-weight: 600;
	color: var(--wj-text);
	margin-bottom: 8rpx;
}
.round-item-author {
	display: block;
	font-size: 24rpx;
	color: var(--wj-text-muted);
	margin-bottom: 16rpx;
}
.guess-form {
	display: flex;
	gap: 12rpx;
	align-items: center;
	flex-wrap: wrap;
}
.guess-input {
	flex: 1;
	min-width: 160rpx;
	height: 64rpx;
	font-size: 26rpx;
	padding: 0 20rpx;
	background: var(--wj-bg);
	border-radius: 12rpx;
	color: var(--wj-text);
}
.guess-input.author {
	max-width: 180rpx;
}
.guess-btn {
	flex-shrink: 0;
	height: 64rpx;
	line-height: 64rpx;
	padding: 0 24rpx;
	font-size: 26rpx;
	border-radius: 12rpx;
}

.ranking-section {
	margin-top: 24rpx;
	padding-top: 20rpx;
	border-top: 1rpx solid var(--wj-bg);
}
.ranking-title {
	display: block;
	font-size: 28rpx;
	font-weight: 600;
	color: var(--wj-text);
	margin-bottom: 16rpx;
}
.ranking-row {
	display: flex;
	align-items: center;
	gap: 16rpx;
	padding: 12rpx 0;
	font-size: 26rpx;
	color: var(--wj-text);
	border-bottom: 1rpx dashed var(--wj-bg);
}
.ranking-row:last-child {
	border-bottom: none;
}
.ranking-no {
	font-weight: 600;
	color: var(--wj-primary);
	min-width: 120rpx;
}
.ranking-name {
	flex: 1;
	font-weight: 500;
}
.ranking-score {
	font-size: 22rpx;
	color: var(--wj-text-muted);
}
.chef-tag {
	font-size: 20rpx;
	color: #fff;
	background: var(--wj-primary-dark);
	padding: 2rpx 12rpx;
	border-radius: 8rpx;
}

.reveal-btn {
	width: 100%;
	height: 80rpx;
	line-height: 80rpx;
	font-size: 28rpx;
	border-radius: 12rpx;
	margin-top: 20rpx;
}

.create-form {
	padding: 24rpx 28rpx;
}
.create-form .form-item {
	margin-bottom: 20rpx;
}
.form-label {
	display: block;
	font-size: 26rpx;
	color: var(--wj-text);
	margin-bottom: 12rpx;
	font-weight: 500;
}
.form-input {
	width: 100%;
	height: 72rpx;
	border: 2rpx solid var(--wj-border);
	border-radius: 12rpx;
	padding: 0 20rpx;
	font-size: 28rpx;
	background: #fff;
	color: var(--wj-text);
}
.ph {
	color: var(--wj-text-muted);
}
.create-btn {
	width: 100%;
	height: 80rpx;
	line-height: 80rpx;
	font-size: 28rpx;
	border-radius: 12rpx;
	margin-top: 8rpx;
}

.empty-tip {
	text-align: center;
	color: var(--wj-text-muted);
	font-size: 26rpx;
	padding: 48rpx 0;
}
</style>
