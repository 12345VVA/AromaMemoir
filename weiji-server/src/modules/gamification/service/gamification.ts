import { Inject, Provide } from '@midwayjs/core';
import { BaseService, CoolCommException } from '@cool-midway/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { In, Repository } from 'typeorm';
import { RecordEntity } from '../../record/entity/record';
import { RecordCommentEntity } from '../../record/entity/comment';
import { AppUserEntity } from '../../account/entity/user';
import { FamilyMemberEntity } from '../../family/entity/member';
import { BlindGuessRoundEntity } from '../entity/blind_guess_round';
import { AchievementService } from '../../achievement/service/achievement';
import { todayStr, formatDateStr } from '../../../comm/date';

/**
 * 趣味玩法服务
 * 提供美食图鉴、食物人格、时光机、家庭盲猜能力
 *
 * 说明：
 * - pokedexCatalog / personalityTypes 为静态数据，无对应 entity，
 *   cool-admin db.json 导入会因表无 entity 而跳过，故在此静态内联，
 *   与 gamification/db.json 保持一致（db.json 作为文档化种子参考）。
 * - userId / recordId 在新架构下为 bigint（number），盲猜 items/guesses
 *   内的作者与记录 ID 同步为 number。
 * - createRound 改用 RecordEntity（weiji_record）组织盲猜题目，替代旧
 *   family_recipes，item.coverUrl 取 record.imageUrl。
 */
@Provide()
export class GamificationService extends BaseService {
  @InjectEntityModel(RecordEntity)
  recordEntity: Repository<RecordEntity>;

  @InjectEntityModel(AppUserEntity)
  appUserEntity: Repository<AppUserEntity>;

  @InjectEntityModel(BlindGuessRoundEntity)
  blindGuessRoundEntity: Repository<BlindGuessRoundEntity>;

  @InjectEntityModel(FamilyMemberEntity)
  familyMemberEntity: Repository<FamilyMemberEntity>;

  @InjectEntityModel(RecordCommentEntity)
  recordCommentEntity: Repository<RecordCommentEntity>;

  @Inject()
  achievementService: AchievementService;

  // 肉类食材关键词（用于 meat_enthusiast 判定）
  private static readonly MEAT_KEYWORDS = [
    '牛肉', '猪肉', '鸡肉', '羊肉', '鸭肉', '鹅肉',
    '鱼肉', '鱼', '虾', '蟹', '贝', '排骨', '五花肉',
    '牛腩', '里脊', '培根', '香肠', '火腿', '鸡腿', '鸡胸',
  ];

  // 图鉴静态目录（与 db.json weiji_pokedex_catalog 一致）
  private static readonly POKEDEX_CATALOG = [
    { dishName: '西红柿鸡蛋面', category: '面食', rarity: 'common' },
    { dishName: '红烧肉', category: '家常菜', rarity: 'common' },
    { dishName: '清炒西兰花', category: '家常菜', rarity: 'common' },
    { dishName: '蒸蛋羹', category: '家常菜', rarity: 'common' },
    { dishName: '糖醋里脊', category: '家常菜', rarity: 'rare' },
    { dishName: '板栗烧鸡', category: '家常菜', rarity: 'rare' },
    { dishName: '八宝鸭', category: '家常菜', rarity: 'epic' },
    { dishName: '麻婆豆腐', category: '川菜', rarity: 'common' },
    { dishName: '宫保鸡丁', category: '川菜', rarity: 'common' },
    { dishName: '回锅肉', category: '川菜', rarity: 'common' },
    { dishName: '辣子鸡', category: '川菜', rarity: 'common' },
    { dishName: '水煮鱼', category: '川菜', rarity: 'rare' },
    { dishName: '夫妻肺片', category: '川菜', rarity: 'rare' },
    { dishName: '白切鸡', category: '粤菜', rarity: 'common' },
    { dishName: '蒸排骨', category: '粤菜', rarity: 'common' },
    { dishName: '叉烧', category: '粤菜', rarity: 'common' },
    { dishName: '虾饺', category: '粤菜', rarity: 'rare' },
    { dishName: '烧鹅', category: '粤菜', rarity: 'rare' },
    { dishName: '老火靓汤', category: '粤菜', rarity: 'epic' },
    { dishName: '红烧牛肉面', category: '面食', rarity: 'common' },
    { dishName: '阳春面', category: '面食', rarity: 'common' },
    { dishName: '担担面', category: '面食', rarity: 'common' },
    { dishName: '兰州拉面', category: '面食', rarity: 'rare' },
    { dishName: '重庆小面', category: '面食', rarity: 'rare' },
    { dishName: '意大利面', category: '面食', rarity: 'epic' },
    { dishName: '桂花糕', category: '烘焙', rarity: 'common' },
    { dishName: '戚风蛋糕', category: '烘焙', rarity: 'common' },
    { dishName: '曲奇饼干', category: '烘焙', rarity: 'common' },
    { dishName: '马卡龙', category: '烘焙', rarity: 'rare' },
    { dishName: '提拉米苏', category: '烘焙', rarity: 'rare' },
    { dishName: '法式千层', category: '烘焙', rarity: 'epic' },
    { dishName: '寿司', category: '日料', rarity: 'common' },
    { dishName: '刺身', category: '日料', rarity: 'common' },
    { dishName: '天妇罗', category: '日料', rarity: 'common' },
    { dishName: '寿喜烧', category: '日料', rarity: 'rare' },
    { dishName: '怀石料理', category: '日料', rarity: 'legendary' },
  ];

  // 人格类型静态定义（与 db.json weiji_personality_types 一致）
  private static readonly PERSONALITY_TYPES = [
    {
      code: 'carb_lover',
      name: '碳水爱好者',
      emoji: '🍚',
      description: '你是碳水的忠实粉丝，每一口米饭与面条都是幸福的味道',
      traits: ['米饭党', '面条控', '能量满载'],
    },
    {
      code: 'spice_explorer',
      name: '辣味探险家',
      emoji: '🌶️',
      description: '无辣不欢的你，用每一次舌尖的刺激探索美食的边界',
      traits: ['无辣不欢', '重口偏好', '味蕾冒险'],
    },
    {
      code: 'health_guru',
      name: '健康达人',
      emoji: '🥗',
      description: '你追求轻盈与营养的平衡，每一餐都是对身体最好的告白',
      traits: ['轻食主义', '营养均衡', '自律人生'],
    },
    {
      code: 'meat_enthusiast',
      name: '肉食主义者',
      emoji: '🥩',
      description: '肉食是你的信仰，每一块鲜嫩的肉类都是无法抗拒的诱惑',
      traits: ['无肉不欢', '高蛋白', '能量爆炸'],
    },
    {
      code: 'sweet_tooth',
      name: '甜品控',
      emoji: '🍰',
      description: '甜食是你的快乐源泉，每一口甜品都是治愈心灵的良药',
      traits: ['甜品爱好', '甜味至上', '快乐源泉'],
    },
    {
      code: 'light_eater',
      name: '清淡派',
      emoji: '🍵',
      description: '你崇尚清淡饮食，用最简单的烹饪还原食材本真的味道',
      traits: ['清淡饮食', '少油少盐', '本味追求'],
    },
    {
      code: 'family_chef',
      name: '家庭厨神',
      emoji: '👨‍🍳',
      description: '你是家里的掌勺大厨，用一道道家常菜温暖整个家庭的胃',
      traits: ['家常菜大师', '温暖厨艺', '家的味道'],
    },
    {
      code: 'adventurer',
      name: '美食冒险家',
      emoji: '🌍',
      description: '你的味蕾永远在路上，乐于尝试各种风格与新颖的菜品',
      traits: ['多元尝试', '美食探险', '不设边界'],
    },
  ];

  /**
   * 美食图鉴：聚合静态目录与当前用户实际记录
   * - 按 dishName 小写聚合用户已记录菜品（首次记录时间、记录次数）
   * - 遍历目录匹配则 unlocked=true，按 category 分组统计完成率
   */
  async pokedex(userId: number) {
    const records = await this.recordEntity.find({
      where: { userId },
    });

    // 聚合用户已记录的菜品（按 dishName 小写做 key）
    interface DishAgg {
      dishName: string;
      firstRecordedAt: string;
      recordCount: number;
    }
    const dishMap = new Map<string, DishAgg>();
    for (const r of records) {
      if (!r.dishName) continue;
      const key = String(r.dishName).toLowerCase();
      const existing = dishMap.get(key);
      const dateStr = r.recordDate || '';
      if (existing) {
        existing.recordCount += 1;
        if (dateStr && dateStr < existing.firstRecordedAt) {
          existing.firstRecordedAt = dateStr;
        }
      } else {
        dishMap.set(key, {
          dishName: r.dishName,
          firstRecordedAt: dateStr,
          recordCount: 1,
        });
      }
    }

    // 遍历目录构建 PokedexItem，并按 category 分组
    const categoryMap = new Map<
      string,
      { totalSlots: number; unlockedSlots: number; items: any[] }
    >();
    let totalSlots = 0;
    let unlockedSlots = 0;

    for (const entry of GamificationService.POKEDEX_CATALOG) {
      const matched = dishMap.get(entry.dishName.toLowerCase());
      const item = {
        dishName: entry.dishName,
        category: entry.category,
        rarity: entry.rarity,
        unlocked: !!matched,
        firstRecordedAt: matched ? matched.firstRecordedAt : null,
        recordCount: matched ? matched.recordCount : 0,
      };
      totalSlots += 1;
      if (item.unlocked) unlockedSlots += 1;

      let bucket = categoryMap.get(entry.category);
      if (!bucket) {
        bucket = { totalSlots: 0, unlockedSlots: 0, items: [] };
        categoryMap.set(entry.category, bucket);
      }
      bucket.totalSlots += 1;
      if (item.unlocked) bucket.unlockedSlots += 1;
      bucket.items.push(item);
    }

    const categories = Array.from(categoryMap.entries()).map(
      ([category, bucket]) => ({
        category,
        totalSlots: bucket.totalSlots,
        unlockedSlots: bucket.unlockedSlots,
        items: bucket.items,
      })
    );

    // 按 rarity 聚合统计
    const rarityStats = { common: 0, rare: 0, epic: 0, legend: 0 };
    for (const entry of GamificationService.POKEDEX_CATALOG) {
      if (entry.rarity === 'common') rarityStats.common += 1;
      else if (entry.rarity === 'rare') rarityStats.rare += 1;
      else if (entry.rarity === 'epic') rarityStats.epic += 1;
      else if (entry.rarity === 'legendary') rarityStats.legend += 1;
    }

    const stats = {
      total: totalSlots,
      unlocked: unlockedSlots,
      common: rarityStats.common,
      rare: rarityStats.rare,
      epic: rarityStats.epic,
      legend: rarityStats.legend,
      hidden: Math.max(totalSlots - unlockedSlots, 0),
    };

    return {
      totalSlots,
      unlockedSlots,
      completionRate: totalSlots > 0 ? unlockedSlots / totalSlots : 0,
      categories,
      stats,
    };
  }

  /**
   * 食物人格测试：基于近 30 天记录生成人格报告
   * - 记录数 < 3 时返回 available:false
   * - 按规则优先级推断人格类型
   */
  async personality(userId: number) {
    const now = new Date();
    const thirtyAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const cutoff = formatDateStr(thirtyAgo); // YYYY-MM-DD 本地时区

    const records = await this.recordEntity
      .createQueryBuilder('r')
      .where('r.userId = :userId', { userId })
      .andWhere('r.recordDate >= :cutoff', { cutoff })
      .getMany();

    const recordCount = records.length;

    if (recordCount < 3) {
      return {
        available: false,
        personalityType: null,
        description: '记录不足 3 条，暂无法生成人格报告，再记录几餐试试吧',
        traits: [],
        shareText: '',
        coverImage: '',
        recordCount,
      };
    }

    let hasSpice = false;
    let hasSweet = false;
    let hasHealth = false;
    let meatRecordCount = 0;
    let carbsSum = 0;
    let carbsCount = 0;
    let caloriesSum = 0;
    let caloriesCount = 0;

    const meatKws = GamificationService.MEAT_KEYWORDS;
    for (const r of records) {
      // tag 检测
      const tags: any[] = Array.isArray(r.tags) ? r.tags : [];
      for (const tag of tags) {
        const t = String(tag || '');
        if (t.includes('辣') || t.includes('重口')) hasSpice = true;
        if (t.includes('甜品') || t.includes('甜')) hasSweet = true;
        if (t.includes('健康') || t.includes('轻食')) hasHealth = true;
      }
      // 食材肉类检测
      const ingredients: any[] = Array.isArray(r.ingredients)
        ? r.ingredients
        : [];
      const ingredientNames = ingredients.map(i =>
        typeof i === 'string' ? i : String((i && i.name) || '')
      );
      const hasMeat = ingredientNames.some(name =>
        meatKws.some(kw => name.includes(kw))
      );
      if (hasMeat) meatRecordCount += 1;

      // 营养统计
      const nutrition = r.nutrition;
      if (nutrition && typeof nutrition === 'object') {
        if (typeof nutrition.carbs === 'number') {
          carbsSum += nutrition.carbs;
          carbsCount += 1;
        }
        if (typeof nutrition.calories === 'number') {
          caloriesSum += nutrition.calories;
          caloriesCount += 1;
        }
      }
    }

    const meatRatio = meatRecordCount / recordCount;
    const avgCarbs = carbsCount > 0 ? carbsSum / carbsCount : 0;
    const avgCalories = caloriesCount > 0 ? caloriesSum / caloriesCount : 0;

    // 按 spec 顺序判定
    let code = 'adventurer';
    if (hasSpice) {
      code = 'spice_explorer';
    } else if (meatRatio > 0.5) {
      code = 'meat_enthusiast';
    } else if (avgCarbs > 50) {
      code = 'carb_lover';
    } else if (avgCalories > 0 && avgCalories < 300) {
      code = 'light_eater';
    } else if (hasSweet) {
      code = 'sweet_tooth';
    } else if (hasHealth) {
      code = 'health_guru';
    }

    const typeDef =
      GamificationService.PERSONALITY_TYPES.find(p => p.code === code) ||
      GamificationService.PERSONALITY_TYPES.find(p => p.code === 'adventurer');

    if (!typeDef) {
      return {
        available: false,
        personalityType: null,
        description: '人格类型生成失败',
        traits: [],
        shareText: '',
        coverImage: '',
        recordCount,
      };
    }

    const trait0 = typeDef.traits[0] || '';
    const trait1 = typeDef.traits[1] || '';
    const shareText = `我是${typeDef.emoji}${typeDef.name}，喜欢${trait0}和${trait1}，来味记测测你的美食人格吧~`;

    return {
      available: true,
      personalityType: typeDef.name,
      emoji: typeDef.emoji,
      description: typeDef.description,
      traits: typeDef.traits,
      shareText,
      coverImage: '',
      recordCount,
    };
  }

  /**
   * 美食时光机：查询往年今日记录
   * - 找 recordDate 月-日 = 今天、年份 < 今年的记录
   * - 按年份分组，年份降序
   */
  async timemachine(userId: number) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const todayDate = todayStr(); // YYYY-MM-DD 本地时区
    const todayMonthDay = todayDate.slice(5); // MM-DD

    const records = await this.recordEntity.find({
      where: { userId },
    });

    const pastRecords = records.filter(r => {
      if (!r.recordDate || r.recordDate.length < 10) return false;
      const recordYear = parseInt(r.recordDate.slice(0, 4), 10);
      const recordMonthDay = r.recordDate.slice(5, 10);
      return recordYear < currentYear && recordMonthDay === todayMonthDay;
    });

    // 按年份分组
    const yearMap = new Map<number, RecordEntity[]>();
    for (const r of pastRecords) {
      const year = parseInt(r.recordDate.slice(0, 4), 10);
      const arr = yearMap.get(year);
      if (arr) {
        arr.push(r);
      } else {
        yearMap.set(year, [r]);
      }
    }

    const memories = Array.from(yearMap.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([year, recs]) => {
        const first = recs[0];
        const coverImage = first.imageUrl || first.beautifiedUrl || '';
        const yearsAgo = currentYear - year;
        const caption =
          yearsAgo >= 1
            ? `${yearsAgo} 年前的今天，你吃了${first.dishName}`
            : `今天的回忆，你吃了${first.dishName}`;
        return {
          year,
          date: first.recordDate,
          records: recs,
          coverImage,
          caption,
        };
      });

    return {
      memories,
      todayDate,
    };
  }

  /**
   * 发起盲猜轮次：从家庭记录中选若干条让其他成员猜作者/菜名
   * - 校验 familyId/roundName/recordIds(3-10)
   * - 校验当前用户是该家庭组成员
   * - 按 recordIds 取记录，组装脱敏 items
   */
  async createRound(userId: number, body: any) {
    if (!body || !body.familyId || !body.roundName || !String(body.roundName).trim()) {
      throw new CoolCommException('familyId 和 roundName 不能为空', 400);
    }
    const recordIds: any[] = Array.isArray(body.recordIds) ? body.recordIds : [];
    if (recordIds.length < 3 || recordIds.length > 10) {
      throw new CoolCommException('recordIds 长度需在 3-10 之间', 400);
    }

    // 校验当前用户是该 family 成员
    await this.ensureFamilyMember(Number(body.familyId), userId);

    // 取出记录（按 familyId 过滤，防止跨家庭拉取记录）
    const ids = recordIds.map(v => Number(v)).filter(v => !Number.isNaN(v));
    const picked = ids.length > 0 ? await this.recordEntity.find({
      where: { id: In(ids), familyId: Number(body.familyId) },
    }) : [];
    if (picked.length !== ids.length) {
      throw new CoolCommException('部分记录不存在或无权访问', 400);
    }
    if (picked.length === 0) {
      throw new CoolCommException('未找到对应记录', 404);
    }

    // 批量取作者信息
    const authorIds = [...new Set(picked.map(r => r.userId).filter(v => v != null))];
    const authors =
      authorIds.length > 0
        ? await this.appUserEntity.find({ where: { id: In(authorIds) } })
        : [];
    const authorMap = new Map(authors.map(a => [a.id, a]));

    // 组装 items（含真实作者信息，揭晓后用于计分；active 状态对外脱敏）
    const items = picked.map(r => {
      const author = r.userId != null ? authorMap.get(r.userId) : null;
      return {
        recordId: r.id,
        dishName: r.dishName,
        coverUrl: r.imageUrl || r.beautifiedUrl || '',
        realAuthorId: r.userId,
        realAuthorName: author?.nickName ?? '',
      };
    });

    const round = await this.blindGuessRoundEntity.save({
      familyId: Number(body.familyId),
      roundName: String(body.roundName).trim(),
      creatorId: userId,
      status: 'active',
      recordIds: items.map(it => it.recordId),
      items,
      guesses: [],
      rankings: null,
    });

    // 创建后立即返回脱敏视图
    return this.sanitizeRound(round);
  }

  /**
   * 发起盲猜轮次（多玩法版）：根据 mode 自动选题并生成 4 个选项
   * - mode=chef：猜厨师（cookId），4 个家庭成员选项
   * - mode=rating：猜评分，4 个评分选项
   * - mode=date：猜日期区间，4 个时间区间选项
   * - 各玩法数据不足时返回 fallback
   */
  async createBlindGuessRound(userId: number, body: any) {
    const mode = String(body?.mode || 'chef').toLowerCase();
    if (!['chef', 'rating', 'date'].includes(mode)) {
      throw new CoolCommException('mode 参数无效，可选 chef/rating/date', 400);
    }
    if (!body || !body.familyId) {
      throw new CoolCommException('familyId 不能为空', 400);
    }
    const familyId = Number(body.familyId);
    await this.ensureFamilyMember(familyId, userId);

    let roundData: {
      recordId: number;
      item: any;
    } | null = null;

    if (mode === 'chef') {
      roundData = await this.buildChefModeRound(familyId);
    } else if (mode === 'rating') {
      roundData = await this.buildRatingModeRound(familyId);
    } else if (mode === 'date') {
      roundData = await this.buildDateModeRound(familyId);
    }

    if (!roundData) {
      return { fallback: true, message: '数据不足，建议先记录更多美食' };
    }

    const roundName = body.roundName
      ? String(body.roundName).trim()
      : `盲猜-${mode}`;

    const round = await this.blindGuessRoundEntity.save({
      familyId,
      roundName,
      creatorId: userId,
      status: 'active',
      recordIds: [roundData.recordId],
      items: [roundData.item],
      guesses: [],
      rankings: null,
      mode,
      correctAnswer: roundData.item.correctAnswer,
    });

    return this.sanitizeRound(round);
  }

  /**
   * chef 模式：选有 cookId 的记录，生成 4 个家庭成员选项
   */
  private async buildChefModeRound(
    familyId: number
  ): Promise<{ recordId: number; item: any } | null> {
    const records = await this.recordEntity.find({
      where: { familyId },
    });
    // 过滤出 cookId 不为空的记录
    const withCook = records.filter(r => r.cookId != null);
    if (withCook.length === 0) return null;

    const record = this.pickRandom(withCook)!;
    const cookId = record.cookId;

    // 取家庭成员列表
    const members = await this.familyMemberEntity.find({ where: { familyId } });
    if (members.length < 4) return null;

    const memberUserIds = members.map(m => m.userId);
    const users = await this.appUserEntity.find({
      where: { id: In(memberUserIds) },
    });
    const userMap = new Map(users.map(u => [u.id, u]));

    const memberOptions = members.map(m => ({
      value: m.userId,
      label: userMap.get(m.userId)?.nickName || `用户${m.userId}`,
    }));

    // 正确选项是 cookId
    const correctOption = memberOptions.find(o => o.value === cookId);
    if (!correctOption) return null; // cookId 不在当前家庭成员中

    // 其他 3 个随机
    const others = memberOptions.filter(o => o.value !== cookId);
    const pickedOthers = this.shuffle(others).slice(0, 3);
    if (pickedOthers.length < 3) return null;

    const options = this.shuffle([correctOption, ...pickedOthers]);

    return {
      recordId: record.id,
      item: {
        recordId: record.id,
        dishName: record.dishName,
        coverUrl: record.imageUrl || record.beautifiedUrl || '',
        options,
        correctAnswer: cookId,
      },
    };
  }

  /**
   * rating 模式：选有多评价的记录（count >= 2），生成 4 个评分选项
   */
  private async buildRatingModeRound(
    familyId: number
  ): Promise<{ recordId: number; item: any } | null> {
    // 找出评论数 >= 2 的记录
    const commentCounts = await this.recordCommentEntity
      .createQueryBuilder('c')
      .select('c.recordId', 'recordId')
      .addSelect('COUNT(*)', 'cnt')
      .groupBy('c.recordId')
      .having('COUNT(*) >= 2')
      .getRawMany<{ recordId: number; cnt: number }>();

    if (commentCounts.length === 0) return null;

    const candidateRecordIds = commentCounts.map(c => c.recordId);
    const records = await this.recordEntity.find({
      where: { id: In(candidateRecordIds), familyId },
    });
    if (records.length === 0) return null;

    const record = this.pickRandom(records)!;
    const correctRating = Math.round(record.rating * 2) / 2; // 取 0.5 的整数倍
    if (correctRating < 1) return null;

    // 生成评分选项池（0.5 步长，1.0-5.0）
    const allRatings = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0];
    const others = allRatings.filter(r => r !== correctRating);
    const pickedOthers = this.shuffle(others).slice(0, 3);
    if (pickedOthers.length < 3) return null;

    const options = this.shuffle([
      { value: correctRating, label: `${correctRating.toFixed(1)}` },
      ...pickedOthers.map(r => ({ value: r, label: `${r.toFixed(1)}` })),
    ]);

    return {
      recordId: record.id,
      item: {
        recordId: record.id,
        dishName: record.dishName,
        coverUrl: record.imageUrl || record.beautifiedUrl || '',
        options,
        correctAnswer: correctRating,
      },
    };
  }

  /**
   * date 模式：选记录，生成 4 个日期区间选项
   */
  private async buildDateModeRound(
    familyId: number
  ): Promise<{ recordId: number; item: any } | null> {
    const records = await this.recordEntity.find({ where: { familyId } });
    if (records.length === 0) return null;

    const record = this.pickRandom(records)!;
    const createTime = record.createTime
      ? new Date(record.createTime)
      : null;
    if (!createTime || isNaN(createTime.getTime())) return null;

    const now = Date.now();
    const diffMs = now - createTime.getTime();
    const diffDays = diffMs / (24 * 60 * 60 * 1000);

    let correctRange: string;
    if (diffDays <= 7) correctRange = 'this_week';
    else if (diffDays <= 30) correctRange = 'last_month';
    else if (diffDays <= 180) correctRange = 'half_year';
    else correctRange = 'year_ago';

    const options = [
      { value: 'this_week', label: '本周' },
      { value: 'last_month', label: '上月' },
      { value: 'half_year', label: '半年前' },
      { value: 'year_ago', label: '一年前' },
    ];

    return {
      recordId: record.id,
      item: {
        recordId: record.id,
        dishName: record.dishName,
        coverUrl: record.imageUrl || record.beautifiedUrl || '',
        options,
        correctAnswer: correctRange,
      },
    };
  }

  /**
   * 数组随机选取
   */
  private pickRandom<T>(arr: T[]): T | null {
    if (arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /**
   * Fisher-Yates 洗牌
   */
  private shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /**
   * 查看轮次详情：active 状态脱敏 items 真实作者信息
   * - 仅家庭成员可查看
   */
  async getRound(userId: number, id: number) {
    const round = await this.blindGuessRoundEntity.findOneBy({ id });
    if (!round) {
      throw new CoolCommException('轮次不存在', 404);
    }
    await this.ensureFamilyMember(round.familyId, userId);
    if (round.status === 'active') {
      return this.sanitizeRound(round);
    }
    return round;
  }

  /**
   * 提交猜测：当前用户对某 item 提交作者/菜名猜测
   * - 每题每用户仅一次
   */
  async guess(userId: number, id: number, body: any) {
    const round = await this.blindGuessRoundEntity.findOneBy({ id });
    if (!round) {
      throw new CoolCommException('轮次不存在', 404);
    }
    if (round.status !== 'active') {
      throw new CoolCommException('轮次已揭晓', 400);
    }
    await this.ensureFamilyMember(round.familyId, userId);

    if (!body || !body.itemId) {
      throw new CoolCommException('itemId 不能为空', 400);
    }
    const itemId = Number(body.itemId);
    const items: any[] = Array.isArray(round.items) ? round.items : [];
    const itemExists = items.some(it => Number(it.recordId) === itemId);
    if (!itemExists) {
      throw new CoolCommException('itemId 不存在于轮次中', 400);
    }

    if (!body.guessAuthorId || !body.guessDishName) {
      throw new CoolCommException('guessAuthorId 和 guessDishName 不能为空', 400);
    }

    const user = await this.appUserEntity.findOneBy({ id: userId });
    // 补全被猜作者昵称
    let guessAuthorName = body.guessAuthorName || '';
    if (!guessAuthorName) {
      const author = await this.appUserEntity.findOneBy({
        id: Number(body.guessAuthorId),
      });
      guessAuthorName = author?.nickName ?? '';
    }

    const guess = {
      userId,
      userNickname: user?.nickName ?? '',
      itemId,
      guessAuthorId: Number(body.guessAuthorId),
      guessAuthorName,
      guessDishName: String(body.guessDishName),
      correct: false,
      score: 0,
      createdAt: new Date().toISOString(),
    };

    // 悲观锁防 TOCTOU：并发提交同一题时，锁内重新判重，避免「判重-追加」竞态
    // 导致同一用户同一题被记录两次（参考 family.voteMenu 的锁用法）。
    // JSON_ARRAY_APPEND 保留以防空指针/丢失更新，加锁防重复，二者互补。
    await this.getOrmManager().transaction(async tx => {
      const locked = await tx
        .getRepository(BlindGuessRoundEntity)
        .createQueryBuilder('b')
        .setLock('pessimistic_write')
        .where('b.id = :id', { id })
        .getOne();
      if (!locked) {
        throw new CoolCommException('轮次不存在', 404);
      }
      if (locked.status !== 'active') {
        throw new CoolCommException('轮次已揭晓', 400);
      }
      const lockedGuesses: any[] = Array.isArray(locked.guesses) ? locked.guesses : [];
      const alreadyGuessed = lockedGuesses.some(
        g => Number(g.userId) === userId && Number(g.itemId) === itemId
      );
      if (alreadyGuessed) {
        throw new CoolCommException('已对该题目提交过猜测', 400);
      }
      await tx
        .getRepository(BlindGuessRoundEntity)
        .createQueryBuilder()
        .update()
        .set({
          guesses: () =>
            `JSON_ARRAY_APPEND(COALESCE(guesses, JSON_ARRAY()), '$', CAST(:guessJson AS JSON))`,
        })
        .where('id = :id', { id })
        .setParameter('guessJson', JSON.stringify(guess))
        .execute();
    });

    // pending 标记：揭晓前 correct/score 仅为占位，避免前端误判为「猜错」
    return { ...guess, pending: true };
  }

  /**
   * 提交猜测（多玩法版）：根据 round.mode 校验 guessAnswer
   * - mode 轮次要求 body.guessAnswer（chef: cookId, rating: 评分值, date: 区间标识）
   * - 每题每用户仅一次
   */
  async guessBlindGuess(userId: number, id: number, body: any) {
    const round = await this.blindGuessRoundEntity.findOneBy({ id });
    if (!round) {
      throw new CoolCommException('轮次不存在', 404);
    }
    if (round.status !== 'active') {
      throw new CoolCommException('轮次已揭晓', 400);
    }
    await this.ensureFamilyMember(round.familyId, userId);

    if (!body || body.itemId == null) {
      throw new CoolCommException('itemId 不能为空', 400);
    }
    const itemId = Number(body.itemId);
    const items: any[] = Array.isArray(round.items) ? round.items : [];
    const itemExists = items.some(it => Number(it.recordId) === itemId);
    if (!itemExists) {
      throw new CoolCommException('itemId 不存在于轮次中', 400);
    }

    if (body.guessAnswer == null) {
      throw new CoolCommException('guessAnswer 不能为空', 400);
    }

    const user = await this.appUserEntity.findOneBy({ id: userId });

    const guess = {
      userId,
      userNickname: user?.nickName ?? '',
      itemId,
      guessAnswer: body.guessAnswer,
      correct: false,
      score: 0,
      createdAt: new Date().toISOString(),
    };

    // 悲观锁防 TOCTOU：并发提交同一题时，锁内重新判重（参考 family.voteMenu）
    await this.getOrmManager().transaction(async tx => {
      const locked = await tx
        .getRepository(BlindGuessRoundEntity)
        .createQueryBuilder('b')
        .setLock('pessimistic_write')
        .where('b.id = :id', { id })
        .getOne();
      if (!locked) {
        throw new CoolCommException('轮次不存在', 404);
      }
      if (locked.status !== 'active') {
        throw new CoolCommException('轮次已揭晓', 400);
      }
      const lockedGuesses: any[] = Array.isArray(locked.guesses) ? locked.guesses : [];
      const alreadyGuessed = lockedGuesses.some(
        g => Number(g.userId) === userId && Number(g.itemId) === itemId
      );
      if (alreadyGuessed) {
        throw new CoolCommException('已对该题目提交过猜测', 400);
      }
      await tx
        .getRepository(BlindGuessRoundEntity)
        .createQueryBuilder()
        .update()
        .set({
          guesses: () =>
            `JSON_ARRAY_APPEND(COALESCE(guesses, JSON_ARRAY()), '$', CAST(:guessJson AS JSON))`,
        })
        .where('id = :id', { id })
        .setParameter('guessJson', JSON.stringify(guess))
        .execute();
    });

    // pending 标记：揭晓前 correct/score 仅为占位，避免前端误判为「猜错」
    return { ...guess, pending: true };
  }

  /**
   * 揭晓结果：仅 creator 可操作；计算排名并更新轮次状态为 revealed
   */
  async reveal(userId: number, id: number) {
    const round = await this.blindGuessRoundEntity.findOneBy({ id });
    if (!round) {
      throw new CoolCommException('轮次不存在', 404);
    }
    if (round.status !== 'active') {
      throw new CoolCommException('轮次已揭晓', 400);
    }
    if (round.creatorId !== userId) {
      throw new CoolCommException('仅轮次发起人可揭晓结果', 403);
    }

    // 先更新状态为 revealed，再计分，使返回结果携带正确的 status
    round.status = 'revealed';
    const result = this.scoreBlindGuess(round);

    // 持久化状态与排名
    round.rankings = result.ranking;
    await this.blindGuessRoundEntity.save(round);

    // 触发盲猜厨师成就解锁（失败不阻塞揭晓）
    if (result.chefWinner) {
      try {
        const newAchievements = await this.achievementService.checkAndUnlock(
          result.chefWinner.userId,
          { type: 'gameplay_blindguess', value: true }
        );
        (result as any).newAchievements = newAchievements;
      } catch (e) {
        // 成就解锁失败不阻塞揭晓
      }
    }

    return result;
  }

  /**
   * 计算盲猜轮次得分排名
   * - 传统轮次：guessAuthorId === item.realAuthorId → +1 分；
   *   guessDishName === item.dishName（大小写不敏感） → +1 分；单 guess 最高 2 分
   * - mode 轮次：guessAnswer === item.correctAnswer → +1 分；单 guess 最高 1 分
   * - 任一命中即 correct=true
   * - 按 userId 聚合 totalScore/correctCount，排序赋 rank（competition ranking）
   * - rank=1 标记 isChef
   */
  private scoreBlindGuess(round: BlindGuessRoundEntity) {
    const items: any[] = Array.isArray(round.items) ? round.items : [];
    let guesses: any[] = Array.isArray(round.guesses) ? round.guesses : [];
    const mode = round.mode || null;

    // 计算每个 guess 得分
    guesses = guesses.map(guess => {
      const item = items.find(
        it => Number(it.recordId) === Number(guess.itemId)
      );
      let score = 0;
      let correct = false;
      if (item) {
        if (mode) {
          // mode 轮次：比较 guessAnswer 与 correctAnswer
          if (
            guess.guessAnswer != null &&
            item.correctAnswer != null &&
            String(guess.guessAnswer) === String(item.correctAnswer)
          ) {
            score += 1;
            correct = true;
          }
        } else {
          // 传统轮次：作者 + 菜名
          if (
            guess.guessAuthorId != null &&
            Number(guess.guessAuthorId) === Number(item.realAuthorId)
          ) {
            score += 1;
            correct = true;
          }
          if (
            guess.guessDishName &&
            String(guess.guessDishName).toLowerCase() ===
              String(item.dishName).toLowerCase()
          ) {
            score += 1;
            correct = true;
          }
        }
      }
      return { ...guess, score, correct };
    });

    // 将计分后的 guesses 回写到 round，使后续 save(round) 持久化 score/correct
    round.guesses = guesses;

    // 按 userId 聚合
    const userMap = new Map<
      number,
      { userId: number; userNickname: string; totalScore: number; correctCount: number }
    >();
    for (const guess of guesses) {
      const uid = Number(guess.userId);
      let entry = userMap.get(uid);
      if (!entry) {
        entry = {
          userId: uid,
          userNickname: guess.userNickname ?? '',
          totalScore: 0,
          correctCount: 0,
        };
        userMap.set(uid, entry);
      }
      entry.totalScore += guess.score;
      if (guess.correct) entry.correctCount += 1;
    }

    // 排序：totalScore 降序 → correctCount 降序
    const sorted = Array.from(userMap.values()).sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      return b.correctCount - a.correctCount;
    });

    // 赋 rank（competition ranking：相同分同 rank，下一名跳号）
    const ranking: any[] = [];
    for (let i = 0; i < sorted.length; i++) {
      const entry = sorted[i];
      let rank = i + 1;
      if (i > 0) {
        const prev = sorted[i - 1];
        if (
          prev.totalScore === entry.totalScore &&
          prev.correctCount === entry.correctCount
        ) {
          rank = ranking[i - 1].rank;
        }
      }
      ranking.push({
        userId: entry.userId,
        userNickname: entry.userNickname,
        totalScore: entry.totalScore,
        correctCount: entry.correctCount,
        rank,
        isChef: rank === 1,
      });
    }

    const chefWinner = ranking.find(r => r.isChef) || null;

    const revealItems = items.map(it => {
      if (mode) {
        return {
          recordId: it.recordId,
          dishName: it.dishName,
          coverUrl: it.coverUrl,
          options: it.options,
          correctAnswer: it.correctAnswer,
        };
      }
      return {
        recordId: it.recordId,
        dishName: it.dishName,
        realAuthorName: it.realAuthorName,
        coverUrl: it.coverUrl,
      };
    });

    return {
      roundId: round.id,
      roundName: round.roundName,
      status: round.status,
      mode: mode || undefined,
      items: revealItems,
      ranking,
      chefWinner,
    };
  }

  /**
   * active 状态下脱敏轮次：
   * - 传统轮次：剔除 items 中的 realAuthorId / realAuthorName
   * - mode 轮次：保留 options 供前端展示，剔除 correctAnswer 防止泄露答案
   */
  private sanitizeRound(round: BlindGuessRoundEntity) {
    const items: any[] = Array.isArray(round.items) ? round.items : [];
    const mode = round.mode || null;
    const sanitizedItems = items.map(it => {
      if (mode) {
        // mode 轮次：保留 options，剔除 correctAnswer
        return {
          recordId: it.recordId,
          dishName: it.dishName,
          coverUrl: it.coverUrl,
          options: it.options,
        };
      }
      // 传统轮次：剔除 realAuthorId / realAuthorName
      return {
        recordId: it.recordId,
        dishName: it.dishName,
        coverUrl: it.coverUrl,
      };
    });
    return {
      id: round.id,
      familyId: round.familyId,
      roundName: round.roundName,
      creatorId: round.creatorId,
      status: round.status,
      recordIds: round.recordIds,
      items: sanitizedItems,
      guesses: round.guesses,
      rankings: round.rankings,
      mode: mode || undefined,
      createTime: round.createTime,
    };
  }

  /**
   * 校验当前用户是某家庭组成员，否则抛 403
   */
  private async ensureFamilyMember(familyId: number, userId: number) {
    const membership = await this.familyMemberEntity.findOneBy({
      familyId,
      userId,
    });
    if (!membership) {
      throw new CoolCommException('当前用户不是该家庭组成员', 403);
    }
  }
}
