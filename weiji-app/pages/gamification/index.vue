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

					<view v-if="pokedexStats" class="stats-bar">
						已收集 {{ pokedexStats.unlocked }}/{{ pokedexStats.total }} · 稀有 {{ pokedexStats.rare }} · 隐藏 {{ pokedexStats.hidden }}
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
					<button
						v-if="personality.shareText"
						class="wj-btn wj-btn-ghost share-btn"
						@click="copyShareText"
					>复制分享文案</button>
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
							:src="resolveImg(m.coverImage)"
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
				<!-- 玩法选择面板 -->
				<view class="section-title">选择玩法</view>
				<view class="mode-panel">
					<button
						class="wj-btn mode-btn"
						:class="{ active: currentMode === 'chef' }"
						:disabled="modeLoading"
						@click="openModeConfig('chef')"
					>猜厨师</button>
					<button
						class="wj-btn mode-btn"
						:class="{ active: currentMode === 'rating' }"
						:disabled="modeLoading"
						@click="openModeConfig('rating')"
					>猜评分</button>
					<button
						class="wj-btn mode-btn"
						:class="{ active: currentMode === 'date' }"
						:disabled="modeLoading"
						@click="openModeConfig('date')"
					>猜日期</button>
				</view>

				<!-- 玩法发起配置面板：猜厨师含有效期，猜评分/猜日期无需有效期 -->
			<view v-if="modeConfigVisible" class="wj-card chef-config-card">
				<view class="chef-config-title">发起{{ modeLabel(pendingMode) }}挑战</view>
				<view v-if="pendingMode === 'chef'" class="form-item">
					<text class="form-label">有效期</text>
					<view class="expire-options">
						<view
							v-for="d in expireDayOptions"
							:key="d"
							class="expire-option"
							:class="{ active: chefExpireDays === d }"
							@click="chefExpireDays = d"
						>{{ d }} 天</view>
					</view>
					<text class="form-hint">到期后活动自动关闭，可再发起新一轮；同一家庭同一时间仅允许一个未完成的猜厨师活动</text>
				</view>
				<view v-else class="form-item">
					<text class="form-hint">{{ modeConfigHint }}</text>
				</view>
				<view class="chef-config-actions">
					<button class="wj-btn wj-btn-ghost" @click="modeConfigVisible = false">取消</button>
					<button
						class="wj-btn"
						:disabled="modeLoading"
						:loading="modeLoading"
						@click="startModeRound"
					>开始挑战</button>
				</view>
			</view>

				<!-- 未完成活动冲突提示 -->
				<view v-if="conflictRound" class="modal-mask" @click="conflictRound = null">
					<view class="conflict-modal" @click.stop>
						<text class="conflict-title">存在未完成的猜厨师活动</text>
						<text class="conflict-desc">
							「{{ conflictRound.roundName || '盲猜挑战' }}」仍未揭晓，请先揭晓上一轮后再发起新活动。
						</text>
						<view class="conflict-actions">
							<button class="wj-btn wj-btn-ghost" @click="conflictRound = null">稍后再说</button>
							<button class="wj-btn" @click="goConflictRound">去揭晓</button>
						</view>
					</view>
				</view>

				<view v-if="modeLoading" class="empty-tip">加载中...</view>
				<view v-else-if="modeRound" class="wj-card mode-round-card">
					<image
						v-if="modeRound.coverUrl"
						class="mode-cover"
						:src="resolveImg(modeRound.coverUrl)"
						mode="aspectFill"
					/>
					<view v-else class="mode-cover placeholder">
						<text class="thumb-emoji">🍽️</text>
					</view>
					<text v-if="modeRound.dishName" class="mode-dish">{{ modeRound.dishName }}</text>
					<text class="mode-prompt">{{ modePromptText }}</text>
					<view v-if="modeRound.options && modeRound.options.length" class="mode-options">
						<button
							v-for="opt in modeRound.options"
							:key="opt.value"
							class="wj-btn wj-btn-ghost mode-option"
							:disabled="modeGuessSubmitted || modeRevealed || modeSubmitting || isModeRoundExpired"
							:class="{
								selected: modeSelectedAnswer === opt.value,
								correct: modeRevealed && opt.value === modeCorrectAnswer,
								wrong: modeRevealed && modeSelectedAnswer === opt.value && opt.value !== modeCorrectAnswer
							}"
							@click="selectModeAnswer(opt.value)"
						>{{ opt.label }}</button>
					</view>
					<button
						v-if="modeSelectedAnswer !== '' && !modeGuessSubmitted && !modeRevealed"
						class="wj-btn mode-submit-btn"
						:disabled="modeSubmitting"
						:loading="modeSubmitting"
						@click="submitModeGuess"
					>提交猜测</button>
					<!-- 已提交、等待发起人揭晓 -->
				<view v-if="modeGuessSubmitted && !modeRevealed" class="mode-pending">
					<text class="mode-pending-text">已提交，等待发起人揭晓</text>
					<button
						v-if="isModeRoundCreator"
						class="wj-btn mode-reveal-btn"
						:disabled="modeSubmitting"
						:loading="modeSubmitting"
						@click="handleModeReveal"
					>揭晓结果</button>
				</view>
				<!-- 活动已过期：不再接受猜测，发起人仍可揭晓查看结果 -->
				<view v-if="isModeRoundExpired && !modeRevealed" class="mode-pending">
					<text class="mode-pending-text">活动已过期</text>
					<button
						v-if="isModeRoundCreator"
						class="wj-btn mode-reveal-btn"
						:disabled="modeSubmitting"
						:loading="modeSubmitting"
						@click="handleModeReveal"
					>揭晓结果</button>
				</view>
					<view v-if="modeRevealed" class="mode-result">
						<text class="mode-result-text">
							{{ modeIsCorrect ? "✅ 猜对了！" : "❌ 猜错了" }}
						</text>
						<text class="mode-answer-text">正确答案：{{ modeCorrectAnswerLabel ?? '—' }}</text>
					</view>
					<button
						v-if="modeRevealed"
						class="wj-btn wj-btn-ghost mode-restart-btn"
						@click="resetModeGuess"
					>返回列表</button>
				</view>
				<view v-else-if="modeFallback" class="empty-tip">
					数据不足，建议先记录更多美食
				</view>

				<!-- 盲猜轮次列表 -->
				<view class="section-title">盲猜轮次</view>
				<view v-if="roundsLoading" class="empty-tip">加载中...</view>
				<view v-else-if="roundsList.length" class="round-list">
					<view
						v-for="r in roundsList"
						:key="r.id"
						class="round-list-item"
						@click="onRoundItemClick(r)"
					>
						<view class="round-list-info">
						<view class="round-list-title">
							<text class="round-list-name">{{ r.roundName || '盲猜挑战' }}</text>
							<text v-if="r.mode" class="mode-tag">{{ modeLabel(r.mode) }}</text>
							<text v-if="expireTag(r)" class="expire-tag" :class="{ expired: expireTag(r)?.expired }">{{ expireTag(r)?.text }}</text>
						</view>
						<text class="round-list-meta">
							{{ roundStatusText(r) }} · {{ r.creatorName || '未知' }} · {{ r.participantCount || 0 }} 人参与
						</text>
					</view>
					<text v-if="r.hasMyGuess" class="guessed-tag">已猜</text>
					</view>
				</view>
				<view v-else class="empty-tip clickable" @click="scrollToCreate">暂无进行中的盲猜，去发起一轮</view>

				<view v-if="roundLoading" class="empty-tip">加载中...</view>
				<view v-else-if="round" class="wj-card round-card">
					<view class="round-header">
						<text class="round-name">{{ round.roundName || '本轮盲猜' }}</text>
						<text class="round-status" :class="{ revealed: round.status === 'revealed' }">
							{{ roundStatusText(round) }}
						</text>
					</view>
					<text v-if="expireTag(round)" class="round-expire-tip" :class="{ expired: expireTag(round)?.expired }">
						{{ expireTag(round)?.text }}
					</text>

					<view v-if="round.items && round.items.length" class="round-items">
						<view
							v-for="(item, idx) in round.items"
							:key="item.recordId || idx"
							class="round-item"
						>
							<image
								v-if="item.coverUrl"
								class="round-thumb"
								:src="resolveImg(item.coverUrl)"
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
								<view v-if="round.status === 'active' && guessForms[item.recordId]" class="guess-form">
									<input
										class="guess-input"
										v-model="guessForms[item.recordId].dish"
										placeholder="猜菜名"
										placeholder-class="ph"
									/>
									<picker
										class="guess-picker"
										:range="familyMembers"
										range-key="nickName"
										@change="(e: any) => onAuthorPick(item.recordId, e)"
									>
										<view class="guess-input author author-pick">
											{{ guessForms[item.recordId].authorName || '选择作者' }}
										</view>
									</picker>
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
				<view id="create-round-section" class="section-title">发起新轮次</view>
				<view class="wj-card create-form">
					<view class="form-item">
						<text class="form-label">家庭组</text>
						<view v-if="createForm.familyId" class="form-input readonly">
							{{ familyInfo.name || `家庭组 #${createForm.familyId}` }}
						</view>
						<view v-else class="form-tip empty-family">
							<text>请先加入或创建家庭</text>
							<button class="wj-btn wj-btn-ghost go-create-btn" @click="goCreateFamily">去创建</button>
						</view>
					</view>
					<view class="form-item">
						<text class="form-label">轮次名称</text>
						<input class="form-input" v-model="createForm.roundName" placeholder="选填，留空自动生成" placeholder-class="ph" />
						<text class="form-hint">用于区分不同轮次，不填将自动生成默认名称</text>
					</view>
					<view class="form-item">
					<text class="form-label">参与菜品（3-10 道）</text>
					<button class="wj-btn wj-btn-ghost pick-btn" @click="openRecordPicker">
						{{
							createForm.recordIds.length
								? `已选 ${createForm.recordIds.length} 道，点击修改`
								: "选择菜品"
						}}
					</button>
				</view>
				<button class="wj-btn create-btn" :disabled="creating" :loading="creating" @click="handleCreate">
					发起轮次
				</button>
			</view>

			<!-- 菜品选择器弹窗 -->
			<view v-if="recordPickerVisible" class="modal-mask" @click="recordPickerVisible = false">
				<view class="record-picker" @click.stop>
					<view class="picker-header">
						<text class="picker-title">选择菜品</text>
						<text class="picker-close" @click="recordPickerVisible = false">×</text>
					</view>
					<scroll-view scroll-y class="picker-list">
						<view v-if="recordPickerLoading" class="picker-empty">加载中...</view>
						<view v-else-if="familyRecords.length">
							<view
								v-for="r in familyRecords"
								:key="r.id"
								class="picker-item"
								:class="{ selected: isSelected(r.id) }"
								@click="toggleRecord(r.id)"
							>
								<view class="picker-checkbox">
									<text v-if="isSelected(r.id)" class="check-mark">✓</text>
								</view>
								<view class="picker-info">
									<text class="picker-dish">{{ r.dishName || "未知菜品" }}</text>
									<text class="picker-author">
										{{ r.userNickname || "未知" }}{{ r.recordDate ? " · " + r.recordDate : "" }}
									</text>
								</view>
							</view>
						</view>
						<view v-else class="picker-empty">暂无家庭菜品记录</view>
					</scroll-view>
					<view class="picker-footer">
						<text class="picker-count">已选 {{ createForm.recordIds.length }} / 10 道</text>
						<button class="wj-btn picker-confirm" @click="confirmRecords">确认</button>
					</view>
				</view>
			</view>
			</view>
		</view>
	</cl-page>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from "vue";
import { onShow, onLoad } from "@dcloudio/uni-app";
import { useStore } from "/@/cool";
import { api, resolveImg } from "/@/utils/api";

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
const guessForms = reactive<Record<string, { dish: string; authorId: string; authorName: string }>>({});
const guessLoading = ref<any>("");
const roundRanking = ref<any[]>([]);
const revealing = ref(false);
// 家庭组信息（用于自动填充 familyId 与展示名称）
const familyInfo = ref<any>({});
// 家庭成员列表（用于传统轮次猜作者选择器）
const familyMembers = ref<any[]>([]);
// 盲猜轮次列表
const roundsList = ref<any[]>([]);
const roundsLoading = ref(false);
// 记录选择器
const recordPickerVisible = ref(false);
const familyRecords = ref<any[]>([]);
const recordPickerLoading = ref(false);
const createForm = reactive({
	familyId: "" as string | number,
	roundName: "",
	recordIds: [] as number[],
});
const creating = ref(false);

// 盲猜玩法（猜厨师/猜评分/猜日期）
type BlindGuessMode = "chef" | "rating" | "date";
const currentMode = ref<BlindGuessMode>("chef");
// 配置面板中"待发起"的玩法模式，与 currentMode 解耦：currentMode 跟随当前答题轮次，
// pendingMode 仅用于发起配置面板，取消不再影响答题区文案
const pendingMode = ref<BlindGuessMode>("chef");
const modeLoading = ref(false);
const modeRound = ref<any>(null);
const modeFallback = ref(false);
const modeSelectedAnswer = ref<string | number>("");
const modeSubmitting = ref(false);
const modeRevealed = ref(false);
const modeIsCorrect = ref(false);
const modeGuessSubmitted = ref(false);
const revealData = ref<any>(null);
// 玩法发起配置：猜厨师含有效期，猜评分/猜日期仅确认；未完成活动冲突提示
const modeConfigVisible = ref(false);
const chefExpireDays = ref(7);
const expireDayOptions = [1, 3, 7, 14, 30];
const conflictRound = ref<any>(null);

// 非猜厨师模式的配置提示文案
const modeConfigHint = computed(() => {
	if (pendingMode.value === "rating") return "系统将随机抽取一道有评论的菜品，让你猜它的评分";
	if (pendingMode.value === "date") return "系统将随机抽取一道菜品，让你猜它的记录时间所属区间";
	return "";
});

const pokedexCompletion = computed(() => {
	const r = Number(pokedex.value.completionRate || 0);
	// 后端返回 0~1（unlockedSlots/totalSlots），×100 转百分比；
	// 若误返 0~100 则视为已转好；min/max 兜底到 0~100 防溢出
	const pct = r > 1 ? r : Math.round(r * 100);
	return Math.min(100, Math.max(0, pct));
});

// 图鉴统计条：仅当后端返回 stats 且含 unlocked/total/rare/hidden 时展示
const pokedexStats = computed(() => {
	const s = pokedex.value?.stats;
	if (!s) return null;
	const unlocked = Number(s.unlocked ?? s.unlockedSlots ?? 0);
	const total = Number(s.total ?? s.totalSlots ?? 0);
	const rare = Number(s.rare ?? 0);
	const hidden = Number(s.hidden ?? 0);
	if (!unlocked && !total && !rare && !hidden) return null;
	return { unlocked, total, rare, hidden };
});

const modePromptText = computed(() => {
	if (currentMode.value === "chef") return "猜猜这道菜是哪位厨师做的？";
	if (currentMode.value === "rating") return "猜猜这道菜的评分是多少？";
	return "猜猜这道菜是哪天记录的？";
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

// mode 轮次：当前用户是否为发起人（用于显示"揭晓结果"按钮）
const isModeRoundCreator = computed(() => {
	const uid = user.info?.id;
	return !!uid && String(modeRound.value?.creatorId || "") === String(uid);
});

// mode 轮次是否已过期（猜厨师活动到期自动关闭，不再接受猜测）
const isModeRoundExpired = computed(() => {
	return modeRound.value?.status === "expired";
});

// mode 轮次揭晓后的正确答案（兼容 answer / items[0].correctAnswer / revealData.answer）
const modeCorrectAnswer = computed<any>(() => {
	if (!modeRevealed.value) return undefined;
	return modeRound.value?.answer
		?? modeRound.value?.items?.[0]?.correctAnswer
		?? revealData.value?.answer;
});

// 揭晓后正确答案的展示文案：从 options 反查 label（厨师昵称/中文区间），
// 避免直接渲染 cookId 数字或 'this_week' 等内部枚举
const modeCorrectAnswerLabel = computed(() => {
	if (!modeRevealed.value) return undefined;
	const raw = modeCorrectAnswer.value;
	if (raw == null) return undefined;
	const opts: any[] = modeRound.value?.options || [];
	const hit = opts.find((o: any) => String(o.value) === String(raw));
	return hit?.label ?? raw;
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
		} else if (activeTab.value === "blindguess") {
			// 盲猜 Tab：自动加载轮次列表
			await loadRounds();
		}
	} catch {
		// api.ts 已统一 toast
	} finally {
		loading.value = false;
	}
}

// 自动获取当前家庭组信息，填充 familyId
async function loadFamilyInfo() {
	try {
		const data: any = await api.getFamilyInfo();
		familyInfo.value = data || {};
		if (data && (data.id || data.familyId)) {
			createForm.familyId = data.id || data.familyId;
		}
		// 同时加载家庭成员列表，用于传统轮次猜作者选择器
		try {
			const members: any = await api.getFamilyMembers();
			familyMembers.value = Array.isArray(members) ? members : (members?.list || []);
		} catch {
			familyMembers.value = [];
		}
	} catch {
		// api.ts 已统一 toast
	}
}

// 加载盲猜轮次列表
async function loadRounds() {
	roundsLoading.value = true;
	try {
		const data: any = await api.getBlindGuessRounds();
		roundsList.value = Array.isArray(data) ? data : (data?.list || []);
	} catch {
		roundsList.value = [];
	} finally {
		roundsLoading.value = false;
	}
}

// mode 轮次模式标签文本
function modeLabel(mode: string) {
	if (mode === "chef") return "猜厨师";
	if (mode === "rating") return "猜评分";
	if (mode === "date") return "猜日期";
	return "传统盲猜";
}

// 轮次列表项点击：mode 轮次进入 mode 答题；传统轮次进入详情
function onRoundItemClick(r: any) {
	if (!r) return;
	if (r.mode) {
		loadModeRoundFromList(r);
	} else {
		roundIdInput.value = String(r.id || r.roundId || "");
		loadRound();
	}
}

// 滚动到发起新轮次区域
function scrollToCreate() {
	uni.pageScrollTo({
		selector: "#create-round-section",
		duration: 300,
	});
}

// 主动拉取用户资料，确保 user.info 可用（gamification 依赖 userId 等字段）
async function loadUserProfile() {
	try {
		const data: any = await api.getUserProfile();
		if (data) {
			user.set(data);
		}
	} catch (e) {
		console.warn("[gamification] getUserProfile failed:", e);
	}
}

// 跳转到家庭组页面创建/加入家庭
function goCreateFamily() {
	uni.navigateTo({ url: "/pages/family/index" });
}

function isSelected(id: number | string) {
	return createForm.recordIds.includes(Number(id));
}

async function openRecordPicker() {
	if (!createForm.familyId) {
		uni.showToast({ title: "请先创建或加入家庭组", icon: "none" });
		return;
	}
	recordPickerVisible.value = true;
	recordPickerLoading.value = true;
	try {
		const data: any = await api.getFamilyFeed({ pageSize: 50 });
		const list = Array.isArray(data) ? data : data?.list || [];
		familyRecords.value = list;
	} catch {
		familyRecords.value = [];
	} finally {
		recordPickerLoading.value = false;
	}
}

function toggleRecord(id: number | string) {
	const numId = Number(id);
	const idx = createForm.recordIds.indexOf(numId);
	if (idx >= 0) {
		createForm.recordIds.splice(idx, 1);
	} else {
		if (createForm.recordIds.length >= 10) {
		uni.showToast({ title: "最多选择 10 道", icon: "none" });
		return;
	}
		createForm.recordIds.push(numId);
	}
}

function confirmRecords() {
	if (createForm.recordIds.length < 3) {
		uni.showToast({ title: "至少选择 3 道", icon: "none" });
		return;
	}
	recordPickerVisible.value = false;
}

async function loadRound() {
	const id = roundIdInput.value.trim();
	if (!id) {
		uni.showToast({ title: "请输入轮次 ID", icon: "none" });
		return;
	}
	// 切换轮次前清空旧的猜测表单，避免上一轮残留数据污染本轮
	Object.keys(guessForms).forEach((k) => delete guessForms[k]);
	// 切换到传统轮次时清空 mode 轮次详情，避免两个卡片同时显示
	modeRound.value = null;
	modeFallback.value = false;
	modeRevealed.value = false;
	modeGuessSubmitted.value = false;
	roundLoading.value = true;
	try {
		const data: any = await api.getBlindGuessRoundDetail(id);
		round.value = data || null;
		// 校验当前用户是否属于该家庭组
		const currentFamilyId = familyInfo.value?.id || familyInfo.value?.familyId;
		const roundFamilyId = data?.familyId || data?.groupId;
		if (currentFamilyId && roundFamilyId && String(currentFamilyId) !== String(roundFamilyId)) {
			uni.showToast({ title: "您无权访问该轮次，仅家庭成员可参与", icon: "none" });
			round.value = null;
			roundRanking.value = [];
			return;
		}
		roundRanking.value = extractRanking(data);
		// 初始化猜测表单
		if (data && Array.isArray(data.items)) {
			data.items.forEach((it: any) => {
				if (!guessForms[it.recordId]) {
					guessForms[it.recordId] = { dish: "", authorId: "", authorName: "" };
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

// 传统轮次：作者选择器回调
function onAuthorPick(recordId: number | string, e: any) {
	const idx = Number(e?.detail?.value);
	if (isNaN(idx) || idx < 0 || idx >= familyMembers.value.length) return;
	const member = familyMembers.value[idx];
	if (!member) return;
	if (!guessForms[recordId]) {
		guessForms[recordId] = { dish: "", authorId: "", authorName: "" };
	}
	guessForms[recordId].authorId = String(member.userId ?? member.id ?? "");
	guessForms[recordId].authorName = member.nickName || member.nickname || "";
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
	const form = guessForms[item.recordId] || { dish: "", authorId: "", authorName: "" };
	const dish = (form.dish || "").trim();
	const authorId = (form.authorId || "").trim();
	if (!dish || !authorId) {
		uni.showToast({ title: "请填写菜名并选择作者", icon: "none" });
		return;
	}
	guessLoading.value = item.recordId;
	try {
		await api.submitBlindGuess(roundId, {
			itemId: item.recordId,
			guessAuthorId: authorId,
			guessAuthorName: form.authorName || "",
			guessDishName: dish,
		});
		uni.showToast({ title: "已提交猜测", icon: "success" });
		guessForms[item.recordId] = { dish: "", authorId: "", authorName: "" };
		await loadRound();
		// 刷新轮次列表，更新 hasMyGuess
		await loadRounds();
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
		// 刷新轮次列表，更新状态
		await loadRounds();
	} catch {
		// api.ts 已统一 toast
	} finally {
		revealing.value = false;
	}
}

async function handleCreate() {
	if (!createForm.familyId) {
		uni.showToast({ title: "请先创建或加入家庭组", icon: "none" });
		return;
	}
	if (createForm.recordIds.length < 3 || createForm.recordIds.length > 10) {
		uni.showToast({ title: "菜品需 3-10 道", icon: "none" });
		return;
	}
	creating.value = true;
	try {
		const data: any = await api.createBlindGuessRound({
			familyId: createForm.familyId,
			roundName: createForm.roundName.trim(),
			recordIds: createForm.recordIds,
		});
		uni.showToast({ title: "已发起轮次", icon: "success" });
		// 刷新轮次列表
		await loadRounds();
		// 跳转到新轮次详情
		if (data && (data.id || data.roundId)) {
			roundIdInput.value = String(data.id || data.roundId);
			await loadRound();
		}
		createForm.roundName = "";
		createForm.recordIds = [];
	} catch {
		// createBlindGuessRound 为 showError:false（mode 创建有多种非错误返回需前端特判），
		// 传统 handleCreate 失败需自行提示
		uni.showToast({ title: "发起失败，请重试", icon: "none" });
	} finally {
		creating.value = false;
	}
}

// ===== 盲猜单题玩法（猜厨师/猜评分/猜日期） =====

// 轮次状态文本：revealed/expired/active
function roundStatusText(r: any) {
	if (!r) return "";
	if (r.status === "revealed") return "已揭晓";
	if (r.status === "expired") return "已过期";
	return "进行中";
}

// 猜厨师轮次有效期标签：进行中显示倒计时，过期显示"已过期"
function expireTag(r: any): { text: string; expired: boolean } | null {
	if (!r) return null;
	// 仅猜厨师模式有有效期概念
	if (r.mode && r.mode !== "chef") return null;
	if (r.status === "revealed") return null;
	if (!r.expiresAt) {
		// 无 expiresAt 但状态为 expired（兼容历史数据）
		if (r.status === "expired") return { text: "已过期", expired: true };
		return null;
	}
	const ms = new Date(r.expiresAt).getTime() - Date.now();
	if (r.status === "expired" || ms <= 0) {
		return { text: "已过期", expired: true };
	}
	// 不足 1 天按小时显示，否则按天（原 Math.ceil 会让 <1 天误进"剩 1 天"）
	const days = Math.floor(ms / (24 * 60 * 60 * 1000));
	if (days >= 1) {
		return { text: `剩 ${days} 天`, expired: false };
	}
	const hours = Math.max(1, Math.ceil(ms / (60 * 60 * 1000)));
	return { text: `剩 ${hours} 小时`, expired: false };
}

// 打开发起配置面板（仅设置模式与默认值，不创建轮次）
function openModeConfig(mode: BlindGuessMode) {
	if (!createForm.familyId) {
		uni.showToast({ title: "请先创建或加入家庭组", icon: "none" });
		return;
	}
	pendingMode.value = mode;
	if (mode === "chef") chefExpireDays.value = 7;
	modeConfigVisible.value = true;
}

// 发起挑战：用户在配置面板点"开始挑战"后才调用后端创建轮次
async function startModeRound() {
	if (!createForm.familyId) {
		uni.showToast({ title: "请先创建或加入家庭组", icon: "none" });
		return;
	}
	const mode = pendingMode.value;
	modeLoading.value = true;
	modeFallback.value = false;
	try {
		const payload: any = { familyId: createForm.familyId, mode };
		// 仅猜厨师模式支持有效期
		if (mode === "chef") payload.expireDays = chefExpireDays.value;
		const data: any = await api.createBlindGuessRound(payload);
		// 未完成活动冲突：提示先揭晓上一轮（仅猜厨师模式）
		if (data && data.conflict) {
			conflictRound.value = data.activeRound || null;
			uni.showToast({ title: data.message || "存在未完成的活动", icon: "none" });
		} else if (!data || data.fallback) {
			modeFallback.value = true;
			uni.showToast({ title: "数据不足，建议先记录更多美食", icon: "none" });
		} else {
			uni.showToast({ title: "已创建新挑战", icon: "success" });
			modeConfigVisible.value = false;
			// 创建成功：直接进入新轮次答题
			if (data && (data.id || data.roundId)) {
				await loadModeRoundFromList({ id: data.id || data.roundId, mode });
			}
		}
		// 刷新轮次列表
		await loadRounds();
	} catch {
		uni.showToast({ title: "发起失败，请重试", icon: "none" });
	} finally {
		modeLoading.value = false;
	}
}

// 跳转到冲突轮次（未完成的猜厨师活动），便于发起人去揭晓
async function goConflictRound() {
	const r = conflictRound.value;
	conflictRound.value = null;
	if (!r) return;
	modeConfigVisible.value = false;
	await loadModeRoundFromList({ id: r.id, mode: "chef" });
}

// 从轮次列表加载 mode 轮次详情到 modeRound
async function loadModeRoundFromList(item: any) {
	const id = item?.id || item?.roundId;
	if (!id) return;
	const m = item?.mode;
	if (m === "chef" || m === "rating" || m === "date") {
		currentMode.value = m;
	}
	// 切换到 mode 轮次时清空传统轮次详情，避免两个卡片同时显示
	round.value = null;
	roundRanking.value = [];
	modeLoading.value = true;
	modeFallback.value = false;
	modeSelectedAnswer.value = "";
	modeRevealed.value = false;
	modeIsCorrect.value = false;
	modeGuessSubmitted.value = false;
	revealData.value = null;
	try {
		const data: any = await api.getBlindGuessRoundDetail(id);
		// 后端 sanitizeRound 返回 { items: [{ recordId, dishName, coverUrl, options }] }
		// mode 轮次仅 1 道题，从 items[0] 提取展示字段到顶层
		const firstItem = data?.items?.[0];
		if (!data || !firstItem || !firstItem.options || !firstItem.options.length) {
			modeFallback.value = true;
			modeRound.value = null;
		} else {
			// 前端防御：删除 answer 字段，避免抓包作弊
			const { answer, ...safeRound } = data;
			modeRound.value = {
				...safeRound,
				coverUrl: firstItem.coverUrl,
				dishName: firstItem.dishName,
				options: firstItem.options,
				recordId: firstItem.recordId,
			};
			// 已揭晓的轮次：直接进入揭晓态展示结果
			if (data.status === "revealed") {
				modeRevealed.value = true;
				// 恢复当前用户的选择与正误，避免揭晓态恒显示"猜错"
				const myGuess = (Array.isArray(data.guesses) ? data.guesses : [])
					.find((g: any) => Number(g.userId) === Number(user.info?.id));
				if (myGuess && myGuess.guessAnswer != null) {
					modeSelectedAnswer.value = myGuess.guessAnswer;
				}
				modeIsCorrect.value =
					modeCorrectAnswer.value != null &&
					String(modeSelectedAnswer.value) === String(modeCorrectAnswer.value);
			}
			// 当前用户已猜测：进入"等待揭晓"态
			if (item.hasMyGuess || data.hasMyGuess) {
				modeGuessSubmitted.value = true;
			}
		}
	} catch {
		modeFallback.value = true;
	} finally {
		modeLoading.value = false;
	}
}

function selectModeAnswer(opt: string | number) {
	if (modeRevealed.value || modeSubmitting.value || modeGuessSubmitted.value) return;
	modeSelectedAnswer.value = opt;
}

async function submitModeGuess() {
	if (!modeRound.value || modeSelectedAnswer.value === "") return;
	if (modeGuessSubmitted.value) return;
	const roundId = modeRound.value.id || modeRound.value.roundId;
	if (!roundId) {
		uni.showToast({ title: "轮次信息异常", icon: "none" });
		return;
	}
	modeSubmitting.value = true;
	try {
		await api.guessBlindGuess(roundId, {
			itemId: modeRound.value.recordId,
			guessAnswer: modeSelectedAnswer.value,
		});
		// 提交后仅设置 submitted，等待发起人揭晓
		modeGuessSubmitted.value = true;
		uni.showToast({ title: "已提交，等待发起人揭晓", icon: "none" });
		// 刷新轮次列表，更新 hasMyGuess
		await loadRounds();
	} catch {
		// api.ts 已统一 toast
	} finally {
		modeSubmitting.value = false;
	}
}

// mode 轮次：发起人点击揭晓
async function handleModeReveal() {
	if (!modeRound.value) return;
	const roundId = modeRound.value.id || modeRound.value.roundId;
	if (!roundId) return;
	modeSubmitting.value = true;
	try {
		await api.revealBlindGuessRound(roundId);
		// 揭晓后重新拉取轮次详情，获取 revealed 状态的完整数据（含 correctAnswer / ranking）
		const fresh: any = await api.getBlindGuessRoundDetail(roundId);
		if (fresh) {
			// 保留展示用的 options（fresh 也应包含，兜底用旧值）
			const oldOptions = modeRound.value?.options;
			modeRound.value = { ...fresh, options: fresh.options || oldOptions };
		}
		modeRevealed.value = true;
		// 对比用户选择与正确答案判断是否猜对
		const correctAnswer = modeCorrectAnswer.value;
		modeIsCorrect.value = correctAnswer !== undefined
			? String(modeSelectedAnswer.value) === String(correctAnswer)
			: false;
		// 刷新轮次列表
		await loadRounds();
	} catch {
		// api.ts 已统一 toast
	} finally {
		modeSubmitting.value = false;
	}
}

function resetModeGuess() {
	modeRound.value = null;
	modeSelectedAnswer.value = "";
	modeRevealed.value = false;
	modeIsCorrect.value = false;
	modeFallback.value = false;
	modeGuessSubmitted.value = false;
	revealData.value = null;
}

// ===== 人格分享文案复制 =====
function copyShareText() {
	const text = personality.value?.shareText;
	if (!text) return;
	uni.setClipboardData({
		data: String(text),
		success: () => {
			uni.showToast({ title: "已复制分享文案", icon: "success" });
		},
	});
}

onMounted(() => {
	// 仅初始化家庭/用户信息；列表加载统一交给 onShow，避免 onMounted 与首次 onShow 双触发
	loadFamilyInfo();
	loadUserProfile();
});

onLoad((options: any) => {
	const tab = options?.tab;
	const validTabs = ["pokedex", "personality", "timemachine", "blindguess"] as const;
	if (tab && validTabs.includes(tab)) {
		activeTab.value = tab;
	}
	// discover 跳转可能带 mode=chef/rating/date，预选盲猜玩法模式（仅高亮，开局仍需点按钮）
	const mode = options?.mode;
	if (mode === "chef" || mode === "rating" || mode === "date") {
		currentMode.value = mode;
	}
});

onShow(() => {
	// 首次显示与每次返回均刷新当前 tab（替代原 onMounted 的 loadTab，杜绝重复请求）
	loadTab();
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

/* 盲猜轮次列表 */
.round-list {
	display: flex;
	flex-direction: column;
	gap: 16rpx;
	margin-bottom: 16rpx;
}
.round-list-item {
	display: flex;
	align-items: center;
	gap: 16rpx;
	padding: 24rpx 28rpx;
	background: #fff;
	border-radius: var(--wj-radius);
	box-shadow: var(--wj-shadow);
}
.round-list-info {
	flex: 1;
	min-width: 0;
}
.round-list-title {
	display: flex;
	align-items: center;
	gap: 12rpx;
	margin-bottom: 8rpx;
}
.round-list-name {
	font-size: 28rpx;
	font-weight: 600;
	color: var(--wj-text);
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
}
.mode-tag {
	font-size: 20rpx;
	color: var(--wj-primary);
	background: rgba(255, 107, 53, 0.08);
	padding: 2rpx 12rpx;
	border-radius: 8rpx;
	flex-shrink: 0;
}
.round-list-meta {
	display: block;
	font-size: 22rpx;
	color: var(--wj-text-muted);
}
.guessed-tag {
	font-size: 20rpx;
	color: #fff;
	background: var(--wj-primary);
	padding: 4rpx 14rpx;
	border-radius: 12rpx;
	flex-shrink: 0;
}
.empty-tip.clickable {
	color: var(--wj-primary);
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
.guess-input.author-pick {
	display: flex;
	align-items: center;
	color: var(--wj-text-muted);
}
.guess-picker {
	max-width: 220rpx;
	flex-shrink: 0;
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
.form-hint {
	display: block;
	font-size: 22rpx;
	color: var(--wj-text-muted);
	margin-top: 8rpx;
}
.form-input.readonly {
	display: flex;
	align-items: center;
	background: var(--wj-bg);
	color: var(--wj-text);
	border-color: transparent;
	font-weight: 500;
}
.form-tip {
	font-size: 26rpx;
	color: var(--wj-text-muted);
	padding: 12rpx 4rpx;
}
.form-tip.empty-family {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16rpx;
}
.go-create-btn {
	flex-shrink: 0;
	height: 64rpx;
	line-height: 64rpx;
	padding: 0 28rpx;
	font-size: 26rpx;
	border-radius: 12rpx;
}
.pick-btn {
	width: 100%;
	height: 72rpx;
	line-height: 72rpx;
	font-size: 28rpx;
	border-radius: 12rpx;
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

/* 记录选择器弹窗 */
.modal-mask {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background: rgba(0, 0, 0, 0.5);
	z-index: 999;
	display: flex;
	align-items: flex-end;
}
.record-picker {
	width: 100%;
	background: #fff;
	border-radius: 24rpx 24rpx 0 0;
	max-height: 80vh;
	display: flex;
	flex-direction: column;
}
.picker-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 24rpx 28rpx;
	border-bottom: 1rpx solid var(--wj-bg);
}
.picker-title {
	font-size: 30rpx;
	font-weight: 600;
	color: var(--wj-text);
}
.picker-close {
	font-size: 40rpx;
	color: var(--wj-text-muted);
	padding: 0 12rpx;
	line-height: 1;
}
.picker-list {
	max-height: 60vh;
}
.picker-item {
	display: flex;
	align-items: center;
	gap: 20rpx;
	padding: 24rpx 28rpx;
	border-bottom: 1rpx solid var(--wj-bg);
}
.picker-item.selected {
	background: rgba(255, 107, 53, 0.04);
}
.picker-checkbox {
	width: 40rpx;
	height: 40rpx;
	border: 2rpx solid var(--wj-border);
	border-radius: 8rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	background: #fff;
}
.picker-item.selected .picker-checkbox {
	background: var(--wj-primary);
	border-color: var(--wj-primary);
}
.check-mark {
	color: #fff;
	font-size: 28rpx;
	font-weight: 700;
	line-height: 1;
}
.picker-info {
	flex: 1;
	min-width: 0;
}
.picker-dish {
	display: block;
	font-size: 28rpx;
	color: var(--wj-text);
	font-weight: 500;
	margin-bottom: 4rpx;
}
.picker-author {
	display: block;
	font-size: 24rpx;
	color: var(--wj-text-muted);
}
.picker-empty {
	text-align: center;
	color: var(--wj-text-muted);
	font-size: 26rpx;
	padding: 60rpx 0;
}
.picker-footer {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 20rpx 28rpx;
	border-top: 1rpx solid var(--wj-bg);
}
.picker-count {
	font-size: 26rpx;
	color: var(--wj-text-muted);
}
.picker-confirm {
	height: 72rpx;
	line-height: 72rpx;
	padding: 0 48rpx;
	font-size: 28rpx;
	border-radius: 12rpx;
}

.empty-tip {
	text-align: center;
	color: var(--wj-text-muted);
	font-size: 26rpx;
	padding: 48rpx 0;
}

/* 图鉴统计条 */
.stats-bar {
	background: #fff;
	border-radius: var(--wj-radius);
	box-shadow: var(--wj-shadow);
	padding: 20rpx 24rpx;
	font-size: 26rpx;
	color: var(--wj-text);
	text-align: center;
	margin-bottom: 16rpx;
}

/* 人格分享按钮 */
.share-btn {
	margin-top: 32rpx;
	width: 100%;
	height: 72rpx;
	line-height: 72rpx;
	font-size: 28rpx;
	border-radius: 12rpx;
}

/* 盲猜玩法面板 */
.mode-panel {
	display: flex;
	gap: 16rpx;
	margin-bottom: 16rpx;
}
.mode-btn {
	flex: 1;
	height: 80rpx;
	line-height: 80rpx;
	font-size: 28rpx;
	border-radius: 12rpx;
	background: #fff;
	color: var(--wj-text);
	border: 2rpx solid var(--wj-border);
}
.mode-btn.active {
	background: var(--wj-primary);
	color: #fff;
	border-color: var(--wj-primary);
}
.mode-btn[disabled] {
	opacity: 0.6;
}

.mode-round-card {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 32rpx 28rpx;
	margin-bottom: 16rpx;
	text-align: center;
}
.mode-cover {
	width: 280rpx;
	height: 280rpx;
	border-radius: 16rpx;
	margin-bottom: 20rpx;
	background: var(--wj-bg);
}
.mode-cover.placeholder {
	display: flex;
	align-items: center;
	justify-content: center;
}
.mode-dish {
	display: block;
	font-size: 32rpx;
	font-weight: 700;
	color: var(--wj-text);
	margin-bottom: 8rpx;
}
.mode-prompt {
	display: block;
	font-size: 26rpx;
	color: var(--wj-text-muted);
	margin-bottom: 24rpx;
}
.mode-options {
	display: flex;
	flex-direction: column;
	gap: 16rpx;
	width: 100%;
	margin-bottom: 8rpx;
}
.mode-option {
	width: 100%;
	height: 80rpx;
	line-height: 80rpx;
	font-size: 28rpx;
	border-radius: 12rpx;
	background: #fff;
	color: var(--wj-text);
	border: 2rpx solid var(--wj-border);
}
.mode-option.selected {
	border-color: var(--wj-primary);
	color: var(--wj-primary);
	background: rgba(255, 107, 53, 0.06);
}
.mode-option.correct {
	border-color: #34c759;
	color: #34c759;
	background: rgba(52, 199, 89, 0.08);
}
.mode-option.wrong {
	border-color: #ff3b30;
	color: #ff3b30;
	background: rgba(255, 59, 48, 0.08);
}
.mode-option[disabled] {
	opacity: 1;
}
.mode-submit-btn {
	width: 100%;
	height: 84rpx;
	line-height: 84rpx;
	font-size: 30rpx;
	border-radius: 12rpx;
	margin-top: 16rpx;
}
/* mode 轮次：已提交等待揭晓 */
.mode-pending {
	margin-top: 16rpx;
	padding: 20rpx 24rpx;
	background: var(--wj-bg);
	border-radius: 12rpx;
	width: 100%;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 16rpx;
}
.mode-pending-text {
	display: block;
	font-size: 28rpx;
	font-weight: 600;
	color: var(--wj-text);
}
.mode-reveal-btn {
	width: 100%;
	height: 80rpx;
	line-height: 80rpx;
	font-size: 28rpx;
	border-radius: 12rpx;
}
.mode-result {
	margin-top: 24rpx;
	padding: 20rpx 24rpx;
	background: var(--wj-bg);
	border-radius: 12rpx;
	width: 100%;
}
.mode-result-text {
	display: block;
	font-size: 30rpx;
	font-weight: 700;
	color: var(--wj-text);
	margin-bottom: 8rpx;
}
.mode-answer-text {
	display: block;
	font-size: 26rpx;
	color: var(--wj-text-muted);
}
.mode-restart-btn {
	width: 100%;
	height: 80rpx;
	line-height: 80rpx;
	font-size: 28rpx;
	border-radius: 12rpx;
	margin-top: 20rpx;
}

/* 猜厨师发起配置面板 */
.chef-config-card {
	padding: 28rpx;
	margin: 20rpx 0;
}
.chef-config-title {
	font-size: 30rpx;
	font-weight: 600;
	color: var(--wj-text);
	margin-bottom: 20rpx;
}
.expire-options {
	display: flex;
	flex-wrap: wrap;
	gap: 16rpx;
	margin: 16rpx 0 8rpx;
}
.expire-option {
	min-width: 120rpx;
	text-align: center;
	padding: 14rpx 24rpx;
	border-radius: 12rpx;
	font-size: 26rpx;
	color: var(--wj-text);
	background: rgba(0, 0, 0, 0.04);
	border: 2rpx solid transparent;
}
.expire-option.active {
	color: var(--wj-primary);
	background: rgba(255, 107, 53, 0.08);
	border-color: var(--wj-primary);
	font-weight: 600;
}
.chef-config-actions {
	display: flex;
	gap: 20rpx;
	margin-top: 24rpx;
}
.chef-config-actions .wj-btn {
	flex: 1;
}

/* 未完成活动冲突弹窗 */
.conflict-modal {
	width: 580rpx;
	background: #fff;
	border-radius: 20rpx;
	padding: 40rpx 36rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
}
.conflict-title {
	font-size: 32rpx;
	font-weight: 600;
	color: var(--wj-text);
	margin-bottom: 20rpx;
}
.conflict-desc {
	font-size: 26rpx;
	color: var(--wj-text-muted);
	line-height: 1.6;
	margin-bottom: 32rpx;
	text-align: center;
}
.conflict-actions {
	display: flex;
	gap: 20rpx;
	width: 100%;
}
.conflict-actions .wj-btn {
	flex: 1;
}

/* 有效期标签 */
.expire-tag {
	font-size: 20rpx;
	color: var(--wj-primary);
	background: rgba(255, 107, 53, 0.08);
	padding: 2rpx 12rpx;
	border-radius: 8rpx;
	flex-shrink: 0;
}
.expire-tag.expired {
	color: #999;
	background: rgba(0, 0, 0, 0.05);
}
.round-expire-tip {
	display: block;
	font-size: 22rpx;
	color: var(--wj-primary);
	margin-bottom: 16rpx;
}
.round-expire-tip.expired {
	color: #999;
}
</style>
