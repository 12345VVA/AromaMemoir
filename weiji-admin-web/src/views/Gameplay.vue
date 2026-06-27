<template>
  <Layout>
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

            <!-- 空状态引导：未点亮任何格子 -->
            <div
              v-if="!pokedexLoading && (pokedex.unlockedSlots || 0) === 0"
              class="wj-card pokedex-empty-guide"
            >
              <div class="empty-emoji">📖</div>
              <p class="empty-desc">你的图鉴还是空的，去记录第一道美食点亮它吧</p>
              <el-button
                type="primary"
                size="small"
                @click="goToRecord"
              >
                <el-icon><Camera /></el-icon>
                去记录解锁更多
              </el-button>
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
                  :class="[
                    rarityClass(item.rarity),
                    { locked: !item.unlocked, 'just-unlocked': item.unlocked && justUnlockedNames.has(item.dishName) }
                  ]"
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

            <!-- 跨玩法 CTA：去人格 -->
            <div v-if="!pokedexLoading && (pokedex.unlockedSlots || 0) > 0" class="cross-cta">
              <el-button text type="primary" @click="activeTab = 'personality'">
                探索你的食物人格
                <el-icon class="el-icon--right"><ArrowRight /></el-icon>
              </el-button>
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
                  <el-button
                    size="small"
                    type="primary"
                    :loading="personalityShareLoading"
                    @click="sharePersonality"
                  >
                    <el-icon><Share /></el-icon>
                    分享
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
            <!-- 跨玩法 CTA：去时光机 -->
            <div class="cross-cta">
              <el-button text type="primary" @click="activeTab = 'timemachine'">
                回顾往年今日
                <el-icon class="el-icon--right"><ArrowRight /></el-icon>
              </el-button>
            </div>
          </div>
        </el-tab-pane>

        <!-- ========== Tab 3: 美食时光机 ========== -->
        <el-tab-pane label="美食时光机" name="timemachine">
          <div v-loading="timemachineLoading">
            <!-- 节日 banner -->
            <div v-if="timemachineFestival" class="wj-card festival-banner">
              <el-icon :size="18" class="festival-icon"><Calendar /></el-icon>
              <span class="festival-name">{{ timemachineFestival.name }}</span>
              <el-tag v-if="timemachineFestival.isFamilyFeast" size="small" type="warning">
                家宴日
              </el-tag>
            </div>
            <template v-if="timemachineMemories.length">
              <div
                v-for="m in timemachineMemories"
                :key="m.year"
                class="wj-card memory-card"
              >
                <div class="memory-header">
                  <span class="memory-year">{{ m.year }} 年</span>
                  <span class="memory-date">{{ m.date }}</span>
                  <el-button
                    text
                    size="small"
                    class="memory-share-btn"
                    @click="shareMemory(m)"
                  >
                    <el-icon><Share /></el-icon>
                    分享
                  </el-button>
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
                  :class="{ 'is-guessed': blindguessDetail.status === 'active' && isItemGuessed(item) }"
                >
                  <img
                    :src="item.coverUrl"
                    :alt="blindguessDetail.status === 'active' ? '待猜菜品' : (item.dishName || '')"
                    class="round-item-img"
                  />
                  <div class="round-item-info">
                    <div class="round-item-name">
                      {{
                        blindguessDetail.status === 'revealed'
                          ? (item.dishName || '未知菜名')
                          : '???（待猜）'
                      }}
                    </div>
                    <div class="round-item-author">
                      作者：{{
                        blindguessDetail.status === 'revealed'
                          ? (item.realAuthorName || '未知')
                          : '???（待揭晓）'
                      }}
                    </div>
                    <!-- 已猜测标记 -->
                    <div
                      v-if="blindguessDetail.status === 'active' && isItemGuessed(item)"
                      class="guess-done"
                    >
                      <el-icon><Check /></el-icon> 已猜测
                    </div>
                    <!-- active 状态提交猜测（每题独立） -->
                    <div
                      v-else-if="blindguessDetail.status === 'active'"
                      class="guess-form"
                    >
                      <el-select
                        v-if="useMemberSelect"
                        v-model="guessInputs[item.recordId].authorId"
                        size="small"
                        placeholder="猜作者"
                        class="guess-author"
                        filterable
                      >
                        <el-option
                          v-for="m in familyMembers"
                          :key="m.id || m.userId"
                          :label="m.nickname || m.username || '成员'"
                          :value="String(m.id || m.userId)"
                        />
                      </el-select>
                      <el-input
                        v-else
                        v-model="guessInputs[item.recordId].authorId"
                        size="small"
                        placeholder="猜作者名"
                        class="guess-author"
                      />
                      <el-input
                        v-model="guessInputs[item.recordId].dishName"
                        size="small"
                        placeholder="猜菜名"
                        class="guess-dish"
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
                <el-table
                  :data="sortedRanking"
                  size="small"
                  border
                  class="ranking-table"
                >
                  <el-table-column prop="rank" label="名次" width="64" align="center">
                    <template #default="{ row }">
                      <span class="rank-no">第 {{ row.rank }} 名</span>
                    </template>
                  </el-table-column>
                  <el-table-column prop="userNickname" label="成员" />
                  <el-table-column label="成绩" align="center">
                    <template #default="{ row }">
                      <span class="rank-score">
                        {{ row.totalScore }} 分 · {{ row.correctCount }} 道正确
                      </span>
                    </template>
                  </el-table-column>
                  <el-table-column label="头衔" width="72" align="center">
                    <template #default="{ row }">
                      <el-tag v-if="row.isChef" size="small" type="warning">厨神</el-tag>
                    </template>
                  </el-table-column>
                </el-table>

                <!-- 跨玩法 CTA：揭晓后去图鉴 -->
                <div class="cross-cta">
                  <el-button text type="primary" @click="activeTab = 'pokedex'">
                    去图鉴看看点亮了什么
                    <el-icon class="el-icon--right"><ArrowRight /></el-icon>
                  </el-button>
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
                    :value="String(r.id)"
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
  </Layout>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import {
  Reading,
  MagicStick,
  Trophy,
  Lock,
  ArrowLeft,
  ArrowRight,
  Share,
  Calendar,
  Camera,
  Check,
} from '@element-plus/icons-vue';
import Layout from '../components/Layout.vue';
import { api } from '../api/client';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const router = useRouter();

const activeTab = ref<'pokedex' | 'personality' | 'timemachine' | 'blindguess'>('pokedex');

// ---- Tab 1: 美食图鉴 ----
const POKEDEX_SEEN_KEY = 'admin_pokedex_seen_unlocked';
const pokedex = ref<any>({});
const pokedexLoading = ref(false);
const pokedexLoaded = ref(false);
const pokedexCategories = computed<any[]>(() => pokedex.value?.categories || []);
const completionPercent = computed(() =>
  Math.round((pokedex.value?.completionRate || 0) * 100)
);
const justUnlockedNames = ref<Set<string>>(new Set());

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

function readSeenUnlocked(): Set<string> {
  try {
    const raw = localStorage.getItem(POKEDEX_SEEN_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? new Set(arr.filter((x: any) => typeof x === 'string')) : new Set();
  } catch {
    return new Set();
  }
}
function saveSeenUnlocked(names: string[]) {
  try {
    localStorage.setItem(POKEDEX_SEEN_KEY, JSON.stringify(names.slice(0, 200)));
  } catch {
    /* ignore */
  }
}

function goToRecord() {
  router.push('/ai-record');
}

async function loadPokedex() {
  pokedexLoading.value = true;
  try {
    const data: any = await api.getPokedex();
    pokedex.value = data || {};
    // 计算本次新点亮（与 localStorage 已见集合做差）
    const seen = readSeenUnlocked();
    const currentNames: string[] = [];
    const newlyUnlocked = new Set<string>();
    (pokedexCategories.value || []).forEach((cat: any) => {
      (cat?.items || []).forEach((item: any) => {
        if (item?.unlocked && item?.dishName) {
          currentNames.push(item.dishName);
          if (!seen.has(item.dishName)) newlyUnlocked.add(item.dishName);
        }
      });
    });
    justUnlockedNames.value = newlyUnlocked;
    saveSeenUnlocked(currentNames);
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
const personalityShareLoading = ref(false);
const personalityProgress = computed(() =>
  Math.min(100, Math.round(((personality.value?.recordCount || 0) / 3) * 100))
);

async function loadPersonality() {
  personalityLoading.value = true;
  try {
    const data: any = await api.getPersonality();
    personality.value = data || {};
  } catch (err) {
    personality.value = {};
  } finally {
    personalityLoading.value = false;
    personalityLoaded.value = true;
  }
}

async function copyTextFallback(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

async function sharePersonality() {
  const text = personality.value?.shareText || '';
  if (!text) {
    ElMessage.warning('暂无可分享内容');
    return;
  }
  personalityShareLoading.value = true;
  try {
    const personalityType = personality.value?.personalityType || '';
    // 优先调用原生分享
    const nav: any = navigator;
    if (nav.share) {
      try {
        await nav.share({ title: personalityType || '我的食物人格', text });
        api.trackEvent('personality_share', { personalityType }).catch(() => {});
        ElMessage.success('已分享');
        return;
      } catch {
        // 用户取消或失败，降级到复制
      }
    }
    const ok = await copyTextFallback(text);
    api.trackEvent('personality_share', { personalityType }).catch(() => {});
    if (ok) ElMessage.success('已复制分享文案');
    else ElMessage.warning('复制失败，请手动复制');
  } finally {
    personalityShareLoading.value = false;
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
const timemachineFestival = computed(() => {
  const f = timemachine.value?.festival;
  return f && typeof f === 'object' && f.name ? f : null;
});

function recordThumb(r: any) {
  return r?.imageUrl || r?.beautifiedUrl || r?.coverUrl || '';
}

async function shareMemory(m: any) {
  const year = m?.year || '';
  const caption = m?.caption || '';
  const names = (m?.records || [])
    .map((r: any) => r?.dishName || r?.title || '')
    .filter(Boolean)
    .join('、');
  const text = `${year}年的味记回忆：${caption}${names ? `（${names}）` : ''}`.trim();
  if (!text) {
    ElMessage.warning('暂无可分享内容');
    return;
  }
  const nav: any = navigator;
  if (nav.share) {
    try {
      await nav.share({ title: `${year}年的味记回忆`, text });
      api.trackEvent('timemachine_share', { year }).catch(() => {});
      return;
    } catch {
      // 降级到复制
    }
  }
  const ok = await copyTextFallback(text);
  api.trackEvent('timemachine_share', { year }).catch(() => {});
  if (ok) ElMessage.success('已复制回忆文案');
  else ElMessage.warning('复制失败，请手动复制');
}

async function loadTimemachine() {
  timemachineLoading.value = true;
  try {
    const data: any = await api.getTimemachine();
    timemachine.value = data || {};
  } catch (err) {
    timemachine.value = {};
  } finally {
    timemachineLoading.value = false;
    timemachineLoaded.value = true;
  }
  api.trackEvent('timemachine_view').catch(() => {});
}

// ---- Tab 4: 家庭盲猜 ----
const familyId = ref<string>('');
const currentUserId = ref<string>('');
const familyMembers = ref<any[]>([]);
const recipes = ref<any[]>([]);
const blindguessLoading = ref(false);
const blindguessLoaded = ref(false);

const newRoundName = ref('');
const selectedRecipeIds = ref<string[]>([]);
const createRoundLoading = ref(false);

const historyRounds = ref<any[]>([]);
const blindguessDetail = ref<any>(null);
const guessInputs = ref<Record<string, { authorId: string; dishName: string }>>({});
const guessLoading = ref<string>('');
const revealLoading = ref(false);
const roundRanking = ref<any[]>([]);
const guessedItemIds = ref<Set<string>>(new Set());

const useMemberSelect = computed(() => familyMembers.value.length > 0);

const isCreator = computed(
  () =>
    !!currentUserId.value &&
    !!blindguessDetail.value?.creatorId &&
    String(currentUserId.value) === String(blindguessDetail.value.creatorId)
);

const sortedRanking = computed(() => {
  const list = roundRanking.value ? [...roundRanking.value] : [];
  return list.sort((a, b) => (a?.rank || 0) - (b?.rank || 0));
});

function isItemGuessed(item: any): boolean {
  const key = String(item?.recordId || '');
  if (!key) return false;
  if (guessedItemIds.value.has(key)) return true;
  const round = blindguessDetail.value;
  if (round?.guesses && currentUserId.value) {
    return round.guesses.some(
      (g: any) =>
        String(g?.itemId || g?.recordId || '') === key &&
        String(g?.userId || g?.user?.id || '') === String(currentUserId.value)
    );
  }
  return false;
}

async function loadBlindguess() {
  blindguessLoading.value = true;
  try {
    // 并行获取 family 信息、可选菜谱、当前用户身份、家庭成员
    const [family, recipeData, profile, members] = await Promise.all([
      api.getFamilyInfo().catch(() => null),
      api.getFamilyRecipes().catch(() => null),
      api.getUserProfile().catch(() => null),
      api.getFamilyMembers().catch(() => null),
    ]);
    familyId.value = (family as any)?.id || (family as any)?.familyId || '';
    recipes.value = Array.isArray(recipeData)
      ? recipeData
      : (recipeData as any)?.list || (recipeData as any)?.recipes || [];
    currentUserId.value =
      (profile as any)?.id || (profile as any)?.userId || auth.user?.id || '';
    familyMembers.value = Array.isArray(members)
      ? members
      : (members as any)?.list || (members as any)?.members || [];

    // 拉取本 family 所有轮次
    if (familyId.value) {
      const rounds: any = await api.getBlindGuessRounds(familyId.value).catch(() => null);
      historyRounds.value = Array.isArray(rounds)
        ? rounds
        : (rounds as any)?.list || (rounds as any)?.rounds || [];
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

async function refreshHistoryRounds() {
  if (!familyId.value) return;
  const rounds: any = await api.getBlindGuessRounds(familyId.value).catch(() => null);
  historyRounds.value = Array.isArray(rounds)
    ? rounds
    : (rounds as any)?.list || (rounds as any)?.rounds || [];
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
    await api.createBlindGuessRound({
      familyId: familyId.value,
      roundName: name,
      recordIds: selectedRecipeIds.value,
    });
    ElMessage.success('已发起盲猜轮次');
    // 重置表单
    newRoundName.value = '';
    selectedRecipeIds.value = [];
    // 刷新历史列表
    await refreshHistoryRounds();
  } catch (err: any) {
    ElMessage.error(err.message || '发起失败');
  } finally {
    createRoundLoading.value = false;
  }
}

function openRoundDetail(round: any) {
  blindguessDetail.value = round;
  roundRanking.value = [];
  guessedItemIds.value = new Set();
  // 初始化每题的猜测输入
  const inputs: Record<string, { authorId: string; dishName: string }> = {};
  (round?.items || []).forEach((it: any) => {
    inputs[it.recordId] = { authorId: '', dishName: '' };
  });
  guessInputs.value = inputs;
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

function resolveAuthor(recordId: string) {
  const input = guessInputs.value[recordId];
  const authorId = (input?.authorId || '').trim();
  const dishName = (input?.dishName || '').trim();
  if (useMemberSelect.value) {
    const member = familyMembers.value.find(
      (m) => String(m.id || m.userId) === String(authorId)
    );
    const guessAuthorName = member?.nickname || member?.username || authorId;
    return { guessAuthorId: authorId, guessAuthorName, guessDishName: dishName };
  }
  // 无成员列表时，作者名作 fallback 作为 guessAuthorId
  return { guessAuthorId: authorId, guessAuthorName: authorId, guessDishName: dishName };
}

async function handleSubmitGuess(recordId: string) {
  const round = blindguessDetail.value;
  if (!round) return;
  const item = (round.items || []).find((it: any) => it.recordId === recordId);
  if (!item) return;
  const { guessAuthorId, guessAuthorName, guessDishName } = resolveAuthor(recordId);
  if (!guessAuthorId) {
    ElMessage.warning('请选择或输入猜测的作者');
    return;
  }
  if (!guessDishName) {
    ElMessage.warning('请输入猜测的菜名');
    return;
  }
  guessLoading.value = recordId;
  try {
    await api.submitBlindGuess(round.id, {
      itemId: item.recordId,
      guessAuthorId,
      guessAuthorName,
      guessDishName,
    });
    ElMessage.success('已提交猜测');
    // 标记该题已猜测并清空输入
    guessedItemIds.value.add(String(recordId));
    guessInputs.value[recordId] = { authorId: '', dishName: '' };
    // 刷新轮次详情（更新 guesses 计数）
    const fresh: any = await api.getBlindGuessRound(round.id);
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
    const result: any = await api.revealBlindGuessRound(round.id);
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
    const fresh: any = await api.getBlindGuessRound(round.id);
    if (fresh) blindguessDetail.value = fresh;
    // 同步历史列表中的状态
    await refreshHistoryRounds();
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
  color: var(--primary-500);
}
.summary-title {
  font-family: var(--font-heading);
  font-weight: 600;
  font-size: 15px;
  color: var(--foreground);
}
.summary-count {
  font-family: var(--font-heading);
  font-size: 22px;
  font-weight: 700;
  color: var(--foreground);
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
  font-family: var(--font-heading);
  font-size: 14px;
  font-weight: 600;
  color: var(--foreground);
}
.category-rate {
  font-size: 12px;
  color: var(--muted-foreground);
}
.pokedex-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.pokedex-cell {
  border-radius: var(--radius-md);
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
  background: var(--primary-100);
  color: var(--primary-700);
}
.pokedex-cell.rarity-rare {
  background: var(--surface-container-high);
  color: var(--neutral-800);
}
.pokedex-cell.rarity-epic {
  background: var(--accent-100);
  color: var(--accent-700);
}
.pokedex-cell.rarity-legendary {
  background: var(--accent-300);
  color: var(--neutral-900);
}
.pokedex-cell.locked {
  background: var(--surface-container);
  color: var(--neutral-400);
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
.pokedex-empty-guide {
  text-align: center;
  padding: 24px 16px;
  margin-bottom: 16px;
}
.pokedex-empty-guide .empty-emoji {
  font-size: 36px;
  margin-bottom: 8px;
}
.pokedex-empty-guide .empty-desc {
  margin-bottom: 12px;
}
/* 新点亮格子动效 */
.pokedex-cell.just-unlocked {
  animation: wj-just-unlocked 1.2s ease-out 1;
  box-shadow: 0 0 0 2px var(--primary-400);
}
@keyframes wj-just-unlocked {
  0% {
    transform: scale(0.6);
    opacity: 0;
    box-shadow: 0 0 0 0 var(--primary-400);
  }
  50% {
    transform: scale(1.12);
    opacity: 1;
    box-shadow: 0 0 0 6px var(--primary-200);
  }
  100% {
    transform: scale(1);
    opacity: 1;
    box-shadow: 0 0 0 2px var(--primary-400);
  }
}
/* 跨玩法 CTA */
.cross-cta {
  display: flex;
  justify-content: center;
  margin: 16px 0 4px;
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
  border-radius: var(--radius-lg);
  max-height: 200px;
  object-fit: cover;
}
.personality-type {
  font-family: var(--font-heading);
  font-size: 24px;
  font-weight: 700;
  color: var(--primary-600);
  margin-bottom: 8px;
}
.personality-desc {
  font-size: 14px;
  color: var(--foreground);
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
  background: var(--surface-container-low);
  border-radius: var(--radius-md);
  padding: 12px;
  text-align: left;
}
.share-text {
  font-size: 13px;
  color: var(--foreground);
  line-height: 1.6;
  margin-bottom: 8px;
  white-space: pre-wrap;
}
.empty-card {
  text-align: center;
  padding: 32px 16px;
}
.empty-icon {
  color: var(--primary-300);
  margin-bottom: 8px;
}
.empty-desc {
  font-size: 14px;
  color: var(--muted-foreground);
  margin-bottom: 12px;
}
.empty-meta {
  font-size: 12px;
  color: var(--muted-foreground);
  margin-top: 8px;
}

/* 时光机 */
.festival-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  margin-bottom: 12px;
  background: var(--accent-100);
  color: var(--accent-700);
}
.festival-icon {
  color: var(--accent-600);
}
.festival-name {
  font-family: var(--font-heading);
  font-weight: 600;
  font-size: 14px;
  flex: 1;
}
.memory-card {
  margin-bottom: 12px;
}
.memory-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 4px;
}
.memory-share-btn {
  margin-left: auto;
}
.memory-year {
  font-family: var(--font-heading);
  font-size: 18px;
  font-weight: 700;
  color: var(--primary-600);
}
.memory-date {
  font-size: 12px;
  color: var(--muted-foreground);
}
.memory-caption {
  font-size: 13px;
  color: var(--foreground);
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
  border-radius: var(--radius-md);
  background: var(--surface-container-high);
}
.record-name {
  display: block;
  font-size: 11px;
  color: var(--muted-foreground);
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
  color: var(--muted-foreground);
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
  box-shadow: var(--shadow-2);
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
  color: var(--foreground);
}
.round-meta {
  font-size: 12px;
  color: var(--muted-foreground);
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
.round-item.is-guessed {
  opacity: 0.7;
}
.round-item.is-guessed .round-item-img {
  filter: grayscale(0.4);
}
.round-item-img {
  width: 72px;
  height: 72px;
  object-fit: cover;
  border-radius: var(--radius-md);
  flex-shrink: 0;
  background: var(--surface-container-high);
}
.round-item-info {
  flex: 1;
  min-width: 0;
}
.round-item-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--foreground);
  margin-bottom: 4px;
}
.round-item-author {
  font-size: 12px;
  color: var(--muted-foreground);
  margin-bottom: 8px;
}
.guess-done {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--primary-600);
  padding: 4px 8px;
  background: var(--primary-100);
  border-radius: var(--radius-sm);
  width: fit-content;
}
.guess-form {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.guess-form .guess-author {
  flex: 1 1 110px;
  min-width: 110px;
}
.guess-form .guess-dish {
  flex: 1 1 120px;
  min-width: 120px;
}
.reveal-btn {
  width: 100%;
  margin-top: 12px;
}
.ranking-section {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}
.ranking-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-heading);
  font-weight: 600;
  font-size: 14px;
  color: var(--foreground);
  margin-bottom: 10px;
}
.ranking-table {
  margin-bottom: 8px;
}
.rank-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  font-size: 13px;
  color: var(--foreground);
  border-bottom: 1px dashed var(--border);
}
.rank-item:last-child {
  border-bottom: none;
}
.rank-no {
  font-weight: 600;
  color: var(--primary-600);
  min-width: 56px;
}
.rank-name {
  flex: 1;
  font-weight: 500;
}
.rank-score {
  font-size: 12px;
  color: var(--muted-foreground);
}
.empty-tip.small {
  padding: 16px;
  font-size: 13px;
}
</style>
