<template>
  <Layout>
    <div class="page-content">
      <!-- 家庭成员 -->
      <div class="members-section">
        <div class="section-header">
          <span class="section-title inline">家人</span>
          <el-button text type="primary" size="small" :loading="inviteLoading" @click="handleInvite">
            <el-icon><Plus /></el-icon>
            邀请家人
          </el-button>
        </div>
        <div v-loading="membersLoading" class="members-list no-scrollbar">
          <div v-for="m in members" :key="m.id || m.userId" class="member-item">
            <el-avatar :size="44" :src="m.avatar">{{ (m.nickname || m.username || '?').slice(0, 1) }}</el-avatar>
            <span class="member-name">{{ m.nickname || m.username || '成员' }}</span>
            <el-tag v-if="m.role" size="small" type="warning" effect="plain">{{ m.role }}</el-tag>
          </div>
          <div v-if="!members.length && !membersLoading" class="empty-tip small">还没有家庭成员</div>
        </div>
      </div>

      <!-- 邀请码弹窗 -->
      <el-dialog v-model="inviteVisible" title="邀请家人" width="90%">
        <div class="invite-code-box">
          <p class="invite-tip">将以下邀请码分享给家人，即可加入家庭</p>
          <div class="invite-code">{{ inviteCode || '生成中...' }}</div>
        </div>
        <template #footer>
          <el-button type="primary" @click="copyCode">复制邀请码</el-button>
        </template>
      </el-dialog>

      <!-- 功能 Tab 区 -->
      <el-tabs v-model="activeTab" class="family-tabs" @tab-change="handleTabChange">
        <!-- ===== 菜谱 Tab ===== -->
        <el-tab-pane label="菜谱" name="recipes">
          <!-- 工具栏：搜索 + 添加菜谱 -->
          <div class="recipe-toolbar">
            <el-input
              v-model="recipeKeyword"
              placeholder="搜索菜名"
              clearable
              size="small"
              @keyup.enter="loadRecipes"
              @clear="loadRecipes"
            >
              <template #append>
                <el-button :icon="Search" @click="loadRecipes" />
              </template>
            </el-input>
            <el-button type="primary" size="small" :icon="Plus" @click="goCreateRecipe">添加菜谱</el-button>
          </div>
          <!-- 分类按钮组 -->
          <div class="category-bar no-scrollbar">
            <el-button
              v-for="c in categories"
              :key="c.value"
              size="small"
              :type="recipeCategory === c.value ? 'primary' : ''"
              @click="selectCategory(c.value)"
            >{{ c.label }}</el-button>
          </div>
          <!-- 菜谱网格 -->
          <div v-loading="recipesLoading">
            <div v-if="recipes.length" class="recipe-grid">
              <div v-for="r in recipes" :key="r.id" class="wj-card recipe-card" @click="goRecipeDetail(r)">
                <div class="recipe-header">
                  <span class="recipe-name">{{ r.dishName || r.name || '未命名菜谱' }}</span>
                  <el-button
                    text
                    size="small"
                    @click.stop="toggleVisibility(r)"
                  >
                    <el-icon>
                      <View v-if="r.visibility === 'family'" />
                      <Hide v-else />
                    </el-icon>
                  </el-button>
                </div>
                <div v-if="r.ingredients" class="recipe-tags">
                  <el-tag
                    v-for="(ing, idx) in toArray(r.ingredients).slice(0, 3)"
                    :key="idx"
                    size="small"
                    type="info"
                    effect="plain"
                  >
                    {{ ing }}
                  </el-tag>
                </div>
                <div class="recipe-meta">
                  <el-tag size="small" :type="r.visibility === 'family' ? 'success' : 'info'" effect="plain">
                    {{ r.visibility === 'family' ? '家庭共享' : '我的私厨' }}
                  </el-tag>
                  <span v-if="r.author" class="recipe-author">by {{ r.author }}</span>
                </div>
              </div>
            </div>
            <div v-else-if="!recipesLoading" class="empty-tip">还没有家庭菜谱</div>
          </div>
        </el-tab-pane>

        <!-- ===== 本周菜单 Tab ===== -->
        <el-tab-pane label="本周菜单" name="menu">
          <div v-loading="menuLoading">
            <template v-if="!menuLoading">
              <div class="menu-week">
                <div v-for="d in weekDays" :key="d.value" class="wj-card menu-day">
                  <div class="menu-day-title">{{ d.label }}</div>
                  <div class="menu-meals">
                    <div v-for="m in mealTypes" :key="m.value" class="menu-meal">
                      <span class="meal-label">{{ m.label }}</span>
                      <div class="meal-content">
                        <template v-if="getMenuCell(d.value, m.value)">
                          <div class="meal-item">
                            <span class="meal-name">{{ getMenuCell(d.value, m.value).recipeName }}</span>
                            <div class="meal-votes">
                              <el-button
                                size="small"
                                text
                                @click="voteMenu(getMenuCell(d.value, m.value), 'like')"
                              >👍 {{ getMenuCell(d.value, m.value).votes?.likes || 0 }}</el-button>
                              <el-button
                                size="small"
                                text
                                @click="voteMenu(getMenuCell(d.value, m.value), 'dislike')"
                              >👎 {{ getMenuCell(d.value, m.value).votes?.dislikes || 0 }}</el-button>
                            </div>
                          </div>
                        </template>
                        <span v-else class="meal-empty">未安排</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div v-if="!weeklyMenu.length" class="empty-tip">本周还没有安排菜单</div>
            </template>
          </div>
        </el-tab-pane>

        <!-- ===== 购物清单 Tab ===== -->
        <el-tab-pane label="购物清单" name="shopping">
          <div class="shopping-toolbar">
            <el-button size="small" type="primary" :icon="Plus" @click="openShoppingAdd">添加</el-button>
            <el-button size="small" :loading="generating" @click="generateShopping">按菜单自动生成</el-button>
          </div>
          <div v-loading="shoppingLoading">
            <template v-if="shoppingList.length">
              <div v-for="cat in shoppingCategories" :key="cat" class="shopping-group">
                <template v-if="shoppingGroups[cat]?.length">
                  <div class="shopping-group-title">{{ cat }}</div>
                  <div class="shopping-items">
                    <div v-for="item in shoppingGroups[cat]" :key="item.id" class="shopping-item">
                      <el-checkbox :model-value="!!item.checked" @change="toggleShopping(item)" />
                      <span class="shopping-name" :class="{ done: item.checked }">{{ item.name }}</span>
                      <span v-if="item.quantity" class="shopping-qty">{{ item.quantity }}</span>
                      <el-button text size="small" :icon="Delete" @click="removeShopping(item)" />
                    </div>
                  </div>
                </template>
              </div>
            </template>
            <div v-else-if="!shoppingLoading" class="empty-tip">购物清单为空</div>
          </div>

          <!-- 添加购物项弹窗 -->
          <el-dialog v-model="shoppingAddVisible" title="添加购物项" width="90%">
            <el-form label-position="top">
              <el-form-item label="名称">
                <el-input v-model="shoppingForm.name" placeholder="如：西红柿" />
              </el-form-item>
              <el-form-item label="品类">
                <el-select v-model="shoppingForm.category" placeholder="选择品类" clearable style="width: 100%">
                  <el-option v-for="c in shoppingCategories" :key="c" :label="c" :value="c" />
                </el-select>
              </el-form-item>
              <el-form-item label="数量">
                <el-input v-model="shoppingForm.quantity" placeholder="如：2个" />
              </el-form-item>
            </el-form>
            <template #footer>
              <el-button @click="shoppingAddVisible = false">取消</el-button>
              <el-button type="primary" :loading="shoppingAddLoading" @click="submitShoppingAdd">添加</el-button>
            </template>
          </el-dialog>
        </el-tab-pane>

        <!-- ===== 家庭动态 Tab ===== -->
        <el-tab-pane label="家庭动态" name="records">
          <div v-loading="recordsLoading">
            <div v-if="records.length" class="record-list">
              <div v-for="r in records" :key="r.id" class="wj-card record-card">
                <div class="record-head">
                  <el-avatar :size="32" :src="r.userAvatar">{{ (r.userNickname || '?').slice(0, 1) }}</el-avatar>
                  <div class="record-head-info">
                    <span class="record-user">{{ r.userNickname || '成员' }}</span>
                    <span class="record-time">{{ formatTime(r.createdAt) }}</span>
                  </div>
                </div>
                <div class="record-dish">{{ r.dishName || '未命名' }}</div>
                <img v-if="r.imageUrl" :src="r.imageUrl" class="record-img" />
                <div v-if="r.note" class="record-note">{{ r.note }}</div>
                <div class="record-actions">
                  <el-button
                    size="small"
                    text
                    :type="r.liked ? 'primary' : ''"
                    @click="toggleLike(r)"
                  >👍 {{ r.likeCount || 0 }}</el-button>
                  <el-button size="small" text @click="toggleComment(r)">💬 {{ r.commentCount || 0 }}</el-button>
                </div>
                <!-- 评论输入框 -->
                <div v-if="expandedComment === r.id" class="comment-box">
                  <el-input
                    v-model="commentText"
                    type="textarea"
                    :rows="2"
                    placeholder="写下你的评论..."
                  />
                  <div class="comment-actions">
                    <el-button size="small" @click="expandedComment = null">取消</el-button>
                    <el-button size="small" type="primary" :loading="commentSubmitting" @click="submitComment(r)">发送</el-button>
                  </div>
                </div>
              </div>
            </div>
            <div v-else-if="!recordsLoading" class="empty-tip">还没有家庭动态</div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </Layout>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Plus, View, Hide, Search, Delete } from '@element-plus/icons-vue';
import Layout from '../components/Layout.vue';
import { api } from '../api/client';

const router = useRouter();

// ===== 家庭成员 =====
const members = ref<any[]>([]);
const membersLoading = ref(false);
const inviteLoading = ref(false);
const inviteVisible = ref(false);
const inviteCode = ref('');

// ===== Tab 状态 =====
const activeTab = ref('recipes');

// ===== 菜谱 Tab =====
const recipes = ref<any[]>([]);
const recipesLoading = ref(false);
const recipeKeyword = ref('');
const recipeCategory = ref('');
const categories = [
  { label: '全部', value: '' },
  { label: '家常菜', value: '家常菜' },
  { label: '面食', value: '面食' },
  { label: '烘焙', value: '烘焙' },
  { label: '汤品', value: '汤品' },
  { label: '凉菜', value: '凉菜' },
  { label: '其他', value: '其他' },
];

// ===== 本周菜单 Tab =====
const weeklyMenu = ref<any[]>([]);
const menuLoading = ref(false);
const menuLoaded = ref(false);
const weekDays = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 7, label: '周日' },
];
const mealTypes = [
  { value: 'breakfast', label: '早餐' },
  { value: 'lunch', label: '午餐' },
  { value: 'dinner', label: '晚餐' },
];

// 菜单按 day-meal 建立索引
const menuMap = computed(() => {
  const map: Record<string, any> = {};
  for (const m of weeklyMenu.value) {
    map[`${m.dayOfWeek}-${m.mealType}`] = m;
  }
  return map;
});
function getMenuCell(day: number, meal: string) {
  return menuMap.value[`${day}-${meal}`];
}

// ===== 购物清单 Tab =====
const shoppingList = ref<any[]>([]);
const shoppingLoading = ref(false);
const shoppingLoaded = ref(false);
const shoppingCategories = ['蔬菜', '肉类', '调味品', '主食', '其他'];
const shoppingAddVisible = ref(false);
const shoppingAddLoading = ref(false);
const generating = ref(false);
const shoppingForm = reactive({ name: '', category: '', quantity: '' });

// 购物项按品类分组
const shoppingGroups = computed(() => {
  const groups: Record<string, any[]> = {};
  for (const cat of shoppingCategories) groups[cat] = [];
  for (const item of shoppingList.value) {
    const cat = item.category && shoppingCategories.includes(item.category) ? item.category : '其他';
    groups[cat].push(item);
  }
  return groups;
});

// ===== 家庭动态 Tab =====
const records = ref<any[]>([]);
const recordsLoading = ref(false);
const recordsLoaded = ref(false);
const expandedComment = ref<string | null>(null);
const commentText = ref('');
const commentSubmitting = ref(false);

// ===== 加载家庭成员 =====
async function loadMembers() {
  membersLoading.value = true;
  try {
    const data: any = await api.getFamilyMembers();
    members.value = Array.isArray(data) ? data : data?.list || data?.members || [];
  } catch (err) {
    members.value = [];
  } finally {
    membersLoading.value = false;
  }
}

// ===== 加载家庭菜谱（支持 keyword + category 过滤）=====
async function loadRecipes() {
  recipesLoading.value = true;
  try {
    const params: any = {};
    if (recipeKeyword.value.trim()) params.keyword = recipeKeyword.value.trim();
    if (recipeCategory.value) params.category = recipeCategory.value;
    const data: any = await api.getFamilyRecipes(params);
    recipes.value = Array.isArray(data) ? data : data?.list || data?.recipes || [];
  } catch (err) {
    recipes.value = [];
  } finally {
    recipesLoading.value = false;
  }
}

// 选择分类后重新加载
function selectCategory(val: string) {
  recipeCategory.value = val;
  loadRecipes();
}

// 跳转菜谱详情
function goRecipeDetail(r: any) {
  router.push(`/recipe/${r.id}`);
}

// 跳转新建菜谱
function goCreateRecipe() {
  router.push('/recipe/create');
}

// 生成邀请码
async function handleInvite() {
  inviteLoading.value = true;
  try {
    const data: any = await api.createInvitation();
    inviteCode.value = data?.code || data?.invitationCode || data || '';
    inviteVisible.value = true;
  } catch (err: any) {
    ElMessage.error(err.message || '生成邀请码失败');
  } finally {
    inviteLoading.value = false;
  }
}

// 复制邀请码
async function copyCode() {
  if (!inviteCode.value) return;
  try {
    await navigator.clipboard.writeText(inviteCode.value);
    ElMessage.success('已复制邀请码');
  } catch {
    ElMessage.warning('复制失败，请手动复制');
  }
}

// 切换菜谱可见性
async function toggleVisibility(recipe: any) {
  const next = recipe.visibility === 'family' ? 'private' : 'family';
  try {
    await api.updateRecipeVisibility(recipe.id, next);
    recipe.visibility = next;
    ElMessage.success(next === 'family' ? '已设为家庭共享' : '已设为我的私厨');
  } catch (err: any) {
    ElMessage.error(err.message || '切换失败');
  }
}

// ===== 加载本周菜单 =====
async function loadWeeklyMenu() {
  menuLoading.value = true;
  try {
    const data: any = await api.getWeeklyMenu();
    weeklyMenu.value = Array.isArray(data) ? data : data?.list || [];
  } catch (err) {
    weeklyMenu.value = [];
  } finally {
    menuLoading.value = false;
    menuLoaded.value = true;
  }
}

// 投票菜单项
async function voteMenu(item: any, vote: 'like' | 'dislike') {
  try {
    await api.voteMenuItem(item.id, vote);
    await loadWeeklyMenu();
  } catch (err: any) {
    ElMessage.error(err.message || '投票失败');
  }
}

// ===== 加载购物清单 =====
async function loadShoppingList() {
  shoppingLoading.value = true;
  try {
    const data: any = await api.getShoppingList();
    shoppingList.value = Array.isArray(data) ? data : data?.list || [];
  } catch (err) {
    shoppingList.value = [];
  } finally {
    shoppingLoading.value = false;
    shoppingLoaded.value = true;
  }
}

// 打开添加购物项弹窗
function openShoppingAdd() {
  shoppingForm.name = '';
  shoppingForm.category = '';
  shoppingForm.quantity = '';
  shoppingAddVisible.value = true;
}

// 提交添加购物项
async function submitShoppingAdd() {
  if (!shoppingForm.name.trim()) {
    ElMessage.warning('请输入名称');
    return;
  }
  shoppingAddLoading.value = true;
  try {
    const data: any = { name: shoppingForm.name.trim() };
    if (shoppingForm.category) data.category = shoppingForm.category;
    if (shoppingForm.quantity.trim()) data.quantity = shoppingForm.quantity.trim();
    await api.addShoppingItem(data);
    ElMessage.success('已添加');
    shoppingAddVisible.value = false;
    await loadShoppingList();
  } catch (err: any) {
    ElMessage.error(err.message || '添加失败');
  } finally {
    shoppingAddLoading.value = false;
  }
}

// 勾选/取消勾选购物项（乐观更新，失败回滚）
async function toggleShopping(item: any) {
  const prev = !!item.checked;
  item.checked = !item.checked;
  try {
    await api.toggleShoppingItem(item.id, item.checked);
  } catch (err: any) {
    item.checked = prev;
    ElMessage.error(err.message || '操作失败');
  }
}

// 删除购物项
async function removeShopping(item: any) {
  try {
    await api.deleteShoppingItem(item.id);
    shoppingList.value = shoppingList.value.filter((i) => i.id !== item.id);
  } catch (err: any) {
    ElMessage.error(err.message || '删除失败');
  }
}

// 按菜单自动生成购物清单
async function generateShopping() {
  generating.value = true;
  try {
    const data: any = await api.generateShoppingFromMenu();
    ElMessage.success(data?.message || `已添加 ${data?.added ?? 0} 项`);
    await loadShoppingList();
  } catch (err: any) {
    ElMessage.error(err.message || '生成失败');
  } finally {
    generating.value = false;
  }
}

// ===== 加载家庭动态 =====
async function loadRecords() {
  recordsLoading.value = true;
  try {
    const data: any = await api.getFamilyRecords();
    records.value = data?.list || (Array.isArray(data) ? data : []);
  } catch (err) {
    records.value = [];
  } finally {
    recordsLoading.value = false;
    recordsLoaded.value = true;
  }
}

// 点赞/取消点赞记录（乐观更新）
async function toggleLike(r: any) {
  const prevLiked = !!r.liked;
  try {
    await api.toggleRecordLike(r.id);
    r.liked = !prevLiked;
    r.likeCount = Math.max(0, (r.likeCount || 0) + (prevLiked ? -1 : 1));
  } catch (err: any) {
    ElMessage.error(err.message || '操作失败');
  }
}

// 展开/收起评论输入框
function toggleComment(r: any) {
  if (expandedComment.value === r.id) {
    expandedComment.value = null;
  } else {
    expandedComment.value = r.id;
    commentText.value = '';
  }
}

// 提交评论
async function submitComment(r: any) {
  if (!commentText.value.trim()) {
    ElMessage.warning('请输入评论内容');
    return;
  }
  commentSubmitting.value = true;
  try {
    await api.addRecordComment(r.id, commentText.value.trim());
    ElMessage.success('评论成功');
    r.commentCount = (r.commentCount || 0) + 1;
    commentText.value = '';
    expandedComment.value = null;
  } catch (err: any) {
    ElMessage.error(err.message || '评论失败');
  } finally {
    commentSubmitting.value = false;
  }
}

// ===== Tab 切换按需加载 =====
function handleTabChange(name: string | number) {
  const tab = String(name);
  if (tab === 'menu' && !menuLoaded.value) loadWeeklyMenu();
  else if (tab === 'shopping' && !shoppingLoaded.value) loadShoppingList();
  else if (tab === 'records' && !recordsLoaded.value) loadRecords();
}

// 工具：转数组
function toArray(val: any): any[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') return val.split(/[,，、]/).filter(Boolean);
  return [];
}

// 工具：格式化时间
function formatTime(t: string) {
  if (!t) return '';
  return String(t).replace('T', ' ').slice(0, 16);
}

onMounted(() => {
  loadMembers();
  loadRecipes();
});
</script>

<style scoped>
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.section-title.inline {
  padding: 0;
}
.members-list {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  padding: 8px 0 16px;
}
.member-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.member-name {
  font-size: 12px;
  color: var(--foreground);
  max-width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.empty-tip.small {
  padding: 16px;
}
/* ===== Tabs ===== */
.family-tabs {
  margin-top: 4px;
}
.family-tabs :deep(.el-tabs__header) {
  margin-bottom: 12px;
}
/* ===== 菜谱 Tab ===== */
.recipe-toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}
.recipe-toolbar .el-input {
  flex: 1;
}
.category-bar {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 8px;
  margin-bottom: 4px;
}
.category-bar .el-button {
  flex-shrink: 0;
}
.recipe-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
.recipe-card {
  padding: 12px;
  cursor: pointer;
  transition: box-shadow 0.15s;
}
.recipe-card:hover {
  box-shadow: var(--shadow-2);
}
.recipe-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.recipe-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--foreground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.recipe-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}
.recipe-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.recipe-author {
  font-size: 11px;
  color: var(--muted-foreground);
}
/* ===== 本周菜单 Tab ===== */
.menu-week {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.menu-day {
  padding: 12px;
}
.menu-day-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--primary-600);
  margin-bottom: 8px;
}
.menu-meals {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.menu-meal {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.meal-label {
  font-size: 12px;
  color: var(--muted-foreground);
  width: 36px;
  flex-shrink: 0;
  line-height: 24px;
}
.meal-content {
  flex: 1;
  min-width: 0;
}
.meal-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}
.meal-name {
  font-size: 13px;
  color: var(--foreground);
  font-weight: 500;
}
.meal-votes {
  display: flex;
  gap: 4px;
}
.meal-votes .el-button {
  padding: 2px 6px;
  font-size: 12px;
}
.meal-empty {
  font-size: 12px;
  color: var(--neutral-400);
  font-style: italic;
}
/* ===== 购物清单 Tab ===== */
.shopping-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.shopping-group {
  margin-bottom: 16px;
}
.shopping-group-title {
  font-weight: 600;
  font-size: 13px;
  color: var(--muted-foreground);
  margin-bottom: 8px;
  padding-left: 4px;
}
.shopping-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.shopping-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--card);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-1);
}
.shopping-name {
  flex: 1;
  font-size: 14px;
  color: var(--foreground);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.shopping-name.done {
  color: var(--muted-foreground);
  text-decoration: line-through;
}
.shopping-qty {
  font-size: 12px;
  color: var(--muted-foreground);
  flex-shrink: 0;
}
/* ===== 家庭动态 Tab ===== */
.record-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.record-card {
  padding: 14px;
}
.record-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.record-head-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.record-user {
  font-size: 13px;
  font-weight: 600;
  color: var(--foreground);
}
.record-time {
  font-size: 11px;
  color: var(--muted-foreground);
}
.record-dish {
  font-weight: 600;
  font-size: 15px;
  color: var(--foreground);
  margin-bottom: 8px;
}
.record-img {
  width: 100%;
  max-height: 200px;
  object-fit: cover;
  border-radius: var(--radius-md);
  margin-bottom: 8px;
}
.record-note {
  font-size: 13px;
  color: var(--foreground);
  line-height: 1.5;
  margin-bottom: 8px;
}
.record-actions {
  display: flex;
  gap: 8px;
}
.comment-box {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.comment-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
/* ===== 邀请码弹窗 ===== */
.invite-code-box {
  text-align: center;
  padding: 16px 0;
}
.invite-tip {
  font-size: 13px;
  color: var(--muted-foreground);
  margin-bottom: 16px;
}
.invite-code {
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1.5px dashed var(--border);
  border-radius: var(--radius-lg);
  padding: 12px;
  font-family: var(--font-heading);
  font-size: 20px;
  font-weight: 600;
  color: var(--primary-500);
  letter-spacing: 2px;
  background: var(--primary-50);
  word-break: break-all;
}
</style>
