<template>
  <div class="page-content">
    <el-tabs v-model="activeTab" class="gameplay-tabs">
      <!-- ========== Tab 1: 美食图鉴 ========== -->
      <el-tab-pane label="美食图鉴" name="pokedex">
        <div v-loading="pokedexLoading">
          <!-- 完成度卡片 -->
          <div class="wj-card pokedex-summary-card">
            <div class="summary-header">
              <el-icon :size="22" class="summary-icon"><Reading /></el-icon>
              <span class="summary-title">图鉴完成度</span>
            </div>
            <div class="summary-count">
              {{ pokedex.unlockedSlots || 0 }} / {{ pokedex.totalSlots || 0 }}
            </div>
            <el-progress :percentage="completionPercent" :stroke-width="8" />
          </div>

          <!-- 分类分组 -->
          <div
            v-for="cat in pokedexCategories"
            :key="cat.category"
            class="pokedex-category"
          >
            <div class="category-header">
              <span class="category-name">{{ cat.category }}</span>
              <span class="category-rate">{{ cat.unlockedSlots }}/{{ cat.totalSlots }}</span>
            </div>
            <div class="pokedex-grid">
              <div
                v-for="item in cat.items"
                :key="item.dishName"
                class="pokedex-cell"
                :class="[rarityClass(item.rarity), { locked: !item.unlocked }]"
              >
                <template v-if="item.unlocked">
                  <div class="cell-emoji">{{ rarityEmoji(item.rarity) }}</div>
                  <div class="cell-name">{{ item.dishName }}</div>
                  <div class="cell-meta">记录 {{ item.recordCount }} 次</div>
                </template>
                <template v-else>
                  <el-icon :size="22" class="lock-icon"><Lock /></el-icon>
                  <div class="cell-name">未点亮</div>
                </template>
              </div>
            </div>
          </div>

          <div v-if="!pokedexLoading && !pokedexCategories.length" class="empty-tip">
            暂无图鉴数据
          </div>
        </div>
      </el-tab-pane>

      <!-- ========== Tab 2: 食物人格 ========== -->
      <el-tab-pane label="食物人格" name="personality">
        <div v-loading="personalityLoading">
          <template v-if="personality.available">
            <div class="wj-card personality-card">
              <div class="personality-cover" v-if="personality.coverImage">
                <img :src="personality.coverImage" alt="人格封面" class="cover-img" />
              </div>
              <div class="personality-type">{{ personality.personalityType }}</div>
              <p class="personality-desc">{{ personality.description }}</p>
              <div v-if="personality.traits && personality.traits.length" class="trait-tags">
                <el-tag
                  v-for="(t, idx) in personality.traits"
                  :key="idx"
                  size="small"
                  effect="plain"
                >
                  {{ t }}
                </el-tag>
              </div>
              <div class="share-box">
                <div class="share-text">{{ personality.shareText }}</div>
                <el-button size="small" type="primary" @click="copyShareText">
                  <el-icon><CopyDocument /></el-icon>
                  复制分享
                </el-button>
              </div>
            </div>
          </template>
          <template v-else>
            <div class="wj-card empty-card">
              <el-icon :size="40" class="empty-icon"><MagicStick /></el-icon>
              <p class="empty-desc">
                {{ personality.description || '记录更多美食以解锁你的专属食物人格' }}
              </p>
              <el-progress :percentage="personalityProgress" :stroke-width="6" />
              <div class="empty-meta">已记录 {{ personality.recordCount || 0 }} / 3</div>
            </div>
          </template>
        </div>
      </el-tab-pane>

      <!-- ========== Tab 3: 美食时光机 ========== -->
      <el-tab-pane label="美食时光机" name="timemachine">
        <div v-loading="timemachineLoading">
          <template v-if="timemachineMemories.length">
            <div
              v-for="m in timemachineMemories"
              :key="m.year"
              class="wj-card memory-card"
            >
              <div class="memory-header">
                <span class="memory-year">{{ m.year }} 年</span>
                <span class="memory-date">{{ m.date }}</span>
              </div>
              <p v-if="m.caption" class="memory-caption">{{ m.caption }}</p>
              <div class="memory-records no-scrollbar">
                <div
                  v-for="(r, idx) in (m.records || [])"
                  :key="idx"
                  class="memory-record"
                >
                  <img
                    :src="recordThumb(r)"
                    :alt="r.dishName || ''"
                    class="record-thumb"
                  />
                  <span class="record-name">{{ r.dishName || r.title || '' }}</span>
                </div>
              </div>
            </div>
          </template>
          <div v-else-if="!timemachineLoading" class="empty-tip">
            <div class="empty-emoji">🕰️</div>
            暂无往年今日回忆，再记录一年就有啦
          </div>
        </div>
      </el-tab-pane>

      <!-- ========== Tab 4: 家庭盲猜 ========== -->
      <el-tab-pane label="家庭盲猜" name="blindguess">
        <!-- 详情视图 -->
        <div v-if="blindguessDetail" class="bg-detail">
          <el-button
            text
            size="small"
            class="back-btn"
            @click="blindguessDetail = null"
          >
            <el-icon><ArrowLeft /></el-icon>
            返回列表
          </el-button>

          <div class="wj-card round-detail-card">
            <div class="round-header">
              <span class="round-name">{{ blindguessDetail.roundName }}</span>
              <el-tag
                size="small"
                :type="blindguessDetail.status === 'revealed' ? 'success' : 'warning'"
              >
                {{ blindguessDetail.status === 'revealed' ? '已揭晓' : '进行中' }}
              </el-tag>
            </div>

            <!-- 菜品列表 -->
            <div class="round-items">
              <div
                v-for="item in blindguessDetail.items"
                :key="item.recordId"
                class="round-item"
              >
                <img
                  :src="item.coverUrl"
                  :alt="item.dishName"
                  class="round-item-img"
                />
                <div class="round-item-info">
                  <div class="round-item-name">{{ item.dishName }}</div>
                  <div class="round-item-author">
                    作者：{{
                      blindguessDetail.status === 'revealed'
                        ? (item.realAuthorName || '未知')
                        : '???（待揭晓）'
                    }}
                  </div>
                  <!-- active 状态提交猜测 -->
                  <div v-if="blindguessDetail.status === 'active'" class="guess-form">
                    <el-input
                      v-model="guessInputs[item.recordId]"
                      size="small"
                      placeholder="猜菜名"
                    />
                    <el-button
                      size="small"
                      type="primary"
                      :loading="guessLoading === item.recordId"
                      @click="handleSubmitGuess(item.recordId)"
                    >
                      提交
                    </el-button>
                  </div>
                </div>
              </div>
            </div>

            <!-- 揭晓按钮（仅创建者可点） -->
            <el-button
              v-if="blindguessDetail.status === 'active' && isCreator"
              type="primary"
              :loading="revealLoading"
              class="reveal-btn"
              @click="handleReveal"
            >
              揭晓结果
            </el-button>

            <!-- 排名（revealed 且 sessionStorage 有） -->
            <div
              v-if="blindguessDetail.status === 'revealed' && roundRanking.length"
              class="ranking-section"
            >
              <div class="ranking-title">
                <el-icon><Trophy /></el-icon> 排名
              </div>
              <div
                v-for="r in roundRanking"
                :key="r.userId"
                class="rank-item"
              >
                <span class="rank-no">第 {{ r.rank }} 名</span>
                <span class="rank-name">{{ r.userNickname }}</span>
                <span class="rank-score">
                  {{ r.totalScore }} 分 · {{ r.correctCount }} 道正确
                </span>
                <el-tag v-if="r.isChef" size="small" type="warning">厨神</el-tag>
              </div>
            </div>
          </div>
        </div>

        <!-- 列表 + 发起表单 -->
        <div v-else v-loading="blindguessLoading">
          <!-- 发起盲猜表单 -->
          <div class="wj-card create-round-card">
            <div class="section-title inline">发起盲猜</div>
            <el-input
              v-model="newRoundName"
              placeholder="轮次名称"
              size="small"
              class="round-name-input"
            />
            <div v-if="recipes.length" class="recipe-check-list">
              <el-checkbox-group v-model="selectedRecipeIds">
                <el-checkbox
                  v-for="r in recipes"
                  :key="r.id"
                  :value="r.id"
                >
                  {{ r.dishName || r.name || '未命名菜谱' }}
                </el-checkbox>
              </el-checkbox-group>
            </div>
            <div v-else class="empty-tip small">暂无可选菜谱</div>
            <div class="selected-count">
              已选 {{ selectedRecipeIds.length }} 道菜（需 3-10 道）
            </div>
            <el-button
              type="primary"
              size="small"
              :loading="createRoundLoading"
              @click="handleCreateRound"
            >
              发起
            </el-button>
          </div>

          <!-- 历史轮次 -->
          <div class="section-title">历史轮次</div>
          <div class="round-list">
            <div
              v-for="r in historyRounds"
              :key="r.id"
              class="wj-card round-card"
              @click="openRoundDetail(r)"
            >
              <div class="round-header">
                <span class="round-name">{{ r.roundName }}</span>
                <el-tag
                  size="small"
                  :type="r.status === 'revealed' ? 'success' : 'warning'"
                >
                  {{ r.status === 'revealed' ? '已揭晓' : '进行中' }}
                </el-tag>
              </div>
              <div class="round-meta">
                {{ (r.items || []).length }} 道菜 · {{ (r.guesses || []).length }} 次猜测
              </div>
            </div>
            <div v-if="!historyRounds.length && !blindguessLoading" class="empty-tip">
              暂无盲猜轮次，发起一个吧
            </div>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import {
  Reading,
  MagicStick,
  CopyDocument,
  Trophy,
  Lock,
  ArrowLeft,
} from '@element-plus/icons-vue';
import { appApi } from '/@/modules/business/utils/app-api';

const activeTab = ref<'pokedex' | 'personality' | 'timemachine' | 'blindguess'>('pokedex');

// ---- Tab 1: 美食图鉴 ----
const pokedex = ref<any>({});
const pokedexLoading = ref(false);
const pokedexLoaded = ref(false);
const pokedexCategories = computed<any[]>(() => pokedex.value?.categories || []);
const completionPercent = computed(() =>
  Math.round((pokedex.value?.completionRate || 0) * 100)
);

function rarityClass(rarity: string) {
  return `rarity-${rarity || 'common'}`;
}
function rarityEmoji(rarity: string) {
  switch (rarity) {
    case 'rare':
      return '⭐';
    case 'epic':
      return '💫';
    case 'legendary':
      return '👑';
    default:
      return '🍽️';
  }
}

async function loadPokedex() {
  pokedexLoading.value = true;
  try {
    const data: any = await appApi.getPokedex();
    pokedex.value = data || {};
  } catch (err) {
    pokedex.value = {};
  } finally {
    pokedexLoading.value = false;
    pokedexLoaded.value = true;
  }
}

// ---- Tab 2: 食物人格 ----
const personality = ref<any>({});
const personalityLoading = ref(false);
const personalityLoaded = ref(false);
const personalityProgress = computed(() =>
  Math.min(100, Math.round(((personality.value?.recordCount || 0) / 3) * 100))
);

async function loadPersonality() {
  personalityLoading.value = true;
  try {
    const data: any = await appApi.getPersonality();
    personality.value = data || {};
  } catch (err) {
    personality.value = {};
  } finally {
    personalityLoading.value = false;
    personalityLoaded.value = true;
  }
}

async function copyShareText() {
  const text = personality.value?.shareText || '';
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    ElMessage.success('已复制分享文案');
  } catch {
    ElMessage.warning('复制失败，请手动复制');
  }
}

// ---- Tab 3: 美食时光机 ----
const timemachine = ref<any>({});
const timemachineLoading = ref(false);
const timemachineLoaded = ref(false);
const timemachineMemories = computed<any[]>(() => {
  const list = timemachine.value?.memories;
  if (!Array.isArray(list)) return [];
  // 按年份从新到旧
  return [...list].sort((a, b) => (b.year || 0) - (a.year || 0));
});

function recordThumb(r: any) {
  return r?.imageUrl || r?.beautifiedUrl || r?.coverUrl || '';
}

async function loadTimemachine() {
  timemachineLoading.value = true;
  try {
    const data: any = await appApi.getTimemachine();
    timemachine.value = data || {};
  } catch (err) {
    timemachine.value = {};
  } finally {
    timemachineLoading.value = false;
    timemachineLoaded.value = true;
  }
}

// ---- Tab 4: 家庭盲猜 ----
const ROUNDS_KEY = 'admin_blindguess_rounds';
const familyId = ref<string>('');
const currentUserId = ref<string>('');
const recipes = ref<any[]>([]);
const blindguessLoading = ref(false);
const blindguessLoaded = ref(false);

const newRoundName = ref('');
const selectedRecipeIds = ref<number[]>([]);
const createRoundLoading = ref(false);

const historyRounds = ref<any[]>([]);
const blindguessDetail = ref<any>(null);
const guessInputs = ref<Record<string, string>>({});
const guessLoading = ref<string>('');
const revealLoading = ref(false);
const roundRanking = ref<any[]>([]);

const isCreator = computed(
  () =>
    !!currentUserId.value &&
    !!blindguessDetail.value?.creatorId &&
    String(currentUserId.value) === String(blindguessDetail.value.creatorId)
);

function readRoundIds(): string[] {
  try {
    const raw = localStorage.getItem(ROUNDS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x: any) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function saveRoundId(roundId: string) {
  const ids = readRoundIds().filter((id) => id !== roundId);
  ids.unshift(roundId);
  localStorage.setItem(ROUNDS_KEY, JSON.stringify(ids.slice(0, 20)));
}

async function loadBlindguess() {
  blindguessLoading.value = true;
  try {
    // 并行获取 family 信息、可选菜谱、当前用户身份
    const [family, recipeData, profile] = await Promise.all([
      appApi.getFamilyInfo().catch(() => null),
      appApi.getFamilyRecipes().catch(() => null),
      appApi.getUserProfile().catch(() => null),
    ]);
    familyId.value = (family as any)?.id || (family as any)?.familyId || '';
    recipes.value = Array.isArray(recipeData)
      ? recipeData
      : (recipeData as any)?.list || (recipeData as any)?.recipes || [];
    currentUserId.value =
      (profile as any)?.id || (profile as any)?.userId || '';

    // 并行拉取历史轮次
    const ids = readRoundIds();
    if (ids.length) {
      const results = await Promise.all(
        ids.map((id) => appApi.getBlindGuessRound(id).catch(() => null))
      );
      historyRounds.value = results.filter((r) => r) as any[];
    } else {
      historyRounds.value = [];
    }
  } catch (err) {
    historyRounds.value = [];
  } finally {
    blindguessLoading.value = false;
    blindguessLoaded.value = true;
  }
}

async function handleCreateRound() {
  const name = newRoundName.value.trim();
  if (!name) {
    ElMessage.warning('请填写轮次名称');
    return;
  }
  if (selectedRecipeIds.value.length < 3 || selectedRecipeIds.value.length > 10) {
    ElMessage.warning('请选择 3-10 道菜');
    return;
  }
  if (!familyId.value) {
    ElMessage.warning('未获取到家庭信息');
    return;
  }
  createRoundLoading.value = true;
  try {
    const data: any = await appApi.createBlindGuessRound({
      familyId: Number(familyId.value),
      roundName: name,
      recordIds: selectedRecipeIds.value.map(Number),
    });
    const roundId = data?.id || data?.roundId;
    if (roundId) saveRoundId(String(roundId));
    ElMessage.success('已发起盲猜轮次');
    // 重置表单
    newRoundName.value = '';
    selectedRecipeIds.value = [];
    // 刷新历史列表
    const ids = readRoundIds();
    const results = await Promise.all(
      ids.map((id) => appApi.getBlindGuessRound(id).catch(() => null))
    );
    historyRounds.value = results.filter((r) => r) as any[];
  } catch (err: any) {
    ElMessage.error(err.message || '发起失败');
  } finally {
    createRoundLoading.value = false;
  }
}

function openRoundDetail(round: any) {
  blindguessDetail.value = round;
  roundRanking.value = [];
  guessInputs.value = {};
  // revealed 状态：从 sessionStorage 读取排名
  if (round?.status === 'revealed' && round?.id) {
    try {
      const raw = sessionStorage.getItem(`admin_blindguess_result_${round.id}`);
      const result = raw ? JSON.parse(raw) : null;
      if (result?.ranking) roundRanking.value = result.ranking;
    } catch {
      roundRanking.value = [];
    }
  }
}

async function handleSubmitGuess(recordId: string) {
  const round = blindguessDetail.value;
  if (!round) return;
  const item = (round.items || []).find((it: any) => it.recordId === recordId);
  if (!item) return;
  const dishName = (guessInputs.value[recordId] || '').trim();
  if (!dishName) {
    ElMessage.warning('请输入猜测的菜名');
    return;
  }
  guessLoading.value = recordId;
  try {
    await appApi.submitBlindGuess(round.id, {
      itemId: item.recordId,
      guessDishName: dishName,
    });
    ElMessage.success('已提交猜测');
    guessInputs.value[recordId] = '';
    // 刷新轮次详情（更新 guesses 计数）
    const fresh: any = await appApi.getBlindGuessRound(round.id);
    if (fresh) blindguessDetail.value = fresh;
  } catch (err: any) {
    ElMessage.error(err.message || '提交失败');
  } finally {
    guessLoading.value = '';
  }
}

async function handleReveal() {
  const round = blindguessDetail.value;
  if (!round) return;
  revealLoading.value = true;
  try {
    const result: any = await appApi.revealBlindGuessRound(round.id);
    // 存入 sessionStorage 供后续查看
    if (result) {
      sessionStorage.setItem(
        `admin_blindguess_result_${round.id}`,
        JSON.stringify(result)
      );
      if (result.ranking) roundRanking.value = result.ranking;
    }
    ElMessage.success('已揭晓结果');
    // 刷新轮次详情（状态变为 revealed，items 含真实作者）
    const fresh: any = await appApi.getBlindGuessRound(round.id);
    if (fresh) blindguessDetail.value = fresh;
    // 同步历史列表中的状态
    const idx = historyRounds.value.findIndex((r) => r.id === round.id);
    if (idx >= 0 && fresh) historyRounds.value[idx] = fresh;
  } catch (err: any) {
    ElMessage.error(err.message || '揭晓失败');
  } finally {
    revealLoading.value = false;
  }
}

// ---- Tab 切换懒加载 ----
watch(activeTab, (tab) => {
  if (tab === 'pokedex' && !pokedexLoaded.value) loadPokedex();
  else if (tab === 'personality' && !personalityLoaded.value) loadPersonality();
  else if (tab === 'timemachine' && !timemachineLoaded.value) loadTimemachine();
  else if (tab === 'blindguess' && !blindguessLoaded.value) loadBlindguess();
});

onMounted(() => loadPokedex());
</script>

<style scoped>
.page-content {
  padding: 12px;
}
.wj-card {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  padding: 12px 16px;
  box-shadow: var(--el-box-shadow-light);
}
.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 12px 0 8px;
}
.empty-tip {
  padding: 24px;
  text-align: center;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.gameplay-tabs :deep(.el-tabs__header) {
  margin-bottom: 12px;
}
.gameplay-tabs :deep(.el-tabs__nav) {
  display: flex;
  gap: 4px;
}
.gameplay-tabs :deep(.el-tabs__item) {
  font-size: 13px;
  padding: 0 10px;
  height: 38px;
  line-height: 38px;
}

/* 图鉴 */
.pokedex-summary-card {
  margin-bottom: 16px;
}
.summary-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.summary-icon {
  color: var(--el-color-primary);
}
.summary-title {
  font-weight: 600;
  font-size: 15px;
  color: var(--el-text-color-primary);
}
.summary-count {
  font-size: 22px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  margin-bottom: 8px;
}
.pokedex-category {
  margin-bottom: 16px;
}
.category-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.category-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.category-rate {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.pokedex-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.pokedex-cell {
  border-radius: 8px;
  padding: 10px 6px;
  text-align: center;
  min-height: 84px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
}
.pokedex-cell.rarity-common {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}
.pokedex-cell.rarity-rare {
  background: var(--el-fill-color);
  color: var(--el-text-color-primary);
}
.pokedex-cell.rarity-epic {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}
.pokedex-cell.rarity-legendary {
  background: var(--el-color-success-light-7);
  color: var(--el-text-color-primary);
}
.pokedex-cell.locked {
  background: var(--el-fill-color);
  color: var(--el-text-color-secondary);
}
.cell-emoji {
  font-size: 20px;
  line-height: 1;
}
.cell-name {
  font-size: 11px;
  font-weight: 600;
  line-height: 1.2;
  word-break: break-all;
}
.cell-meta {
  font-size: 10px;
  opacity: 0.85;
}
.lock-icon {
  margin-bottom: 2px;
}

/* 人格 */
.personality-card {
  text-align: center;
}
.personality-cover {
  margin-bottom: 12px;
}
.cover-img {
  width: 100%;
  border-radius: 12px;
  max-height: 200px;
  object-fit: cover;
}
.personality-type {
  font-size: 24px;
  font-weight: 700;
  color: var(--el-color-primary);
  margin-bottom: 8px;
}
.personality-desc {
  font-size: 14px;
  color: var(--el-text-color-primary);
  line-height: 1.6;
  margin-bottom: 12px;
}
.trait-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
  margin-bottom: 16px;
}
.share-box {
  background: var(--el-fill-color-light);
  border-radius: 8px;
  padding: 12px;
  text-align: left;
}
.share-text {
  font-size: 13px;
  color: var(--el-text-color-primary);
  line-height: 1.6;
  margin-bottom: 8px;
  white-space: pre-wrap;
}
.empty-card {
  text-align: center;
  padding: 32px 16px;
}
.empty-icon {
  color: var(--el-color-primary-light-5);
  margin-bottom: 8px;
}
.empty-desc {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin-bottom: 12px;
}
.empty-meta {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 8px;
}

/* 时光机 */
.memory-card {
  margin-bottom: 12px;
}
.memory-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 4px;
}
.memory-year {
  font-size: 18px;
  font-weight: 700;
  color: var(--el-color-primary);
}
.memory-date {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.memory-caption {
  font-size: 13px;
  color: var(--el-text-color-primary);
  margin-bottom: 10px;
}
.memory-records {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 4px;
}
.memory-record {
  flex-shrink: 0;
  width: 90px;
  text-align: center;
}
.record-thumb {
  width: 90px;
  height: 90px;
  object-fit: cover;
  border-radius: 8px;
  background: var(--el-fill-color);
}
.record-name {
  display: block;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.empty-emoji {
  font-size: 36px;
  margin-bottom: 8px;
}

/* 盲猜 */
.section-title.inline {
  padding: 0 0 8px;
}
.back-btn {
  margin-bottom: 8px;
  padding-left: 0;
}
.create-round-card {
  margin-bottom: 8px;
}
.round-name-input {
  margin-bottom: 12px;
}
.recipe-check-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
  max-height: 220px;
  overflow-y: auto;
}
.selected-count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 12px;
}
.round-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.round-card {
  cursor: pointer;
  padding: 12px 14px;
  transition: box-shadow 0.15s;
}
.round-card:hover {
  box-shadow: var(--el-box-shadow);
}
.round-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.round-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--el-text-color-primary);
}
.round-meta {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.round-detail-card {
  padding: 14px 16px;
}
.round-items {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 8px 0;
}
.round-item {
  display: flex;
  gap: 12px;
}
.round-item-img {
  width: 72px;
  height: 72px;
  object-fit: cover;
  border-radius: 8px;
  flex-shrink: 0;
  background: var(--el-fill-color);
}
.round-item-info {
  flex: 1;
  min-width: 0;
}
.round-item-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--el-text-color-primary);
  margin-bottom: 4px;
}
.round-item-author {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
}
.guess-form {
  display: flex;
  gap: 8px;
  align-items: center;
}
.guess-form .el-input {
  flex: 1;
}
.reveal-btn {
  width: 100%;
  margin-top: 12px;
}
.ranking-section {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color);
}
.ranking-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  font-size: 14px;
  color: var(--el-text-color-primary);
  margin-bottom: 10px;
}
.rank-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  font-size: 13px;
  color: var(--el-text-color-primary);
  border-bottom: 1px dashed var(--el-border-color);
}
.rank-item:last-child {
  border-bottom: none;
}
.rank-no {
  font-weight: 600;
  color: var(--el-color-primary);
  min-width: 56px;
}
.rank-name {
  flex: 1;
  font-weight: 500;
}
.rank-score {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.empty-tip.small {
  padding: 16px;
  font-size: 13px;
}
</style>
