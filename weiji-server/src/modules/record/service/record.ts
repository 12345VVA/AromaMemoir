import { Inject, Provide } from '@midwayjs/core';
import { BaseService, CoolCommException } from '@cool-midway/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { In, Repository } from 'typeorm';
import * as _ from 'lodash';
import { RecordEntity } from '../entity/record';
import { RecordLikeEntity } from '../entity/like';
import { RecordCommentEntity } from '../entity/comment';
import { AppUserEntity } from '../../account/entity/user';
import { FamilyMemberEntity } from '../../family/entity/member';
import { ChallengeService } from '../../challenge/service/challenge';
import { AchievementService } from '../../achievement/service/achievement';
import { todayStr, daysAgoStr } from '../../../comm/date';

/**
 * 美食记录服务
 * 提供记录的增删查、家庭动态、点赞、评论能力
 *
 * B 端 cl-crud 直接调用 list / delete（委托 BaseService，走回收站）；
 * C 端请调用 appList / appDelete / save 等专用方法，避免与 B 端 CRUD 签名冲突。
 */
@Provide()
export class RecordService extends BaseService {
  @InjectEntityModel(RecordEntity)
  recordEntity: Repository<RecordEntity>;

  @InjectEntityModel(RecordLikeEntity)
  recordLikeEntity: Repository<RecordLikeEntity>;

  @InjectEntityModel(RecordCommentEntity)
  recordCommentEntity: Repository<RecordCommentEntity>;

  @InjectEntityModel(AppUserEntity)
  appUserEntity: Repository<AppUserEntity>;

  @InjectEntityModel(FamilyMemberEntity)
  familyMemberEntity: Repository<FamilyMemberEntity>;

  @Inject()
  challengeService: ChallengeService;

  @Inject()
  achievementService: AchievementService;

  /**
   * 分页查询（B 端 cl-crud）
   * C 端请直接调用 appList(userId, query)
   */
  async list(a: any, b?: any, c?: any) {
    return super.list(a, b, c);
  }

  /**
   * 删除（B 端 cl-crud，走回收站）
   * C 端请直接调用 appDelete(userId, id)
   */
  async delete(...args: any[]) {
    return super.delete(args[0]);
  }

  /**
   * 分页查询当前用户记录（C 端）
   * 支持 tag（tags JSON 包含）/ rating（相等）/ keyword（dishName LIKE）筛选
   * 按 createTime 降序
   */
  async appList(userId: number, query: any) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.max(1, Number(query.pageSize) || 20);

    const qb = this.recordEntity
      .createQueryBuilder('r')
      .where('r.userId = :userId', { userId })
      .orderBy('r.createTime', 'DESC');

    if (query.tag) {
      qb.andWhere('JSON_CONTAINS(r.tags, JSON_QUOTE(:tag)) = 1', {
        tag: String(query.tag),
      });
    }
    if (query.rating !== undefined && query.rating !== null && query.rating !== '') {
      qb.andWhere('r.rating = :rating', { rating: Number(query.rating) });
    }
    if (query.keyword) {
      qb.andWhere('r.dishName LIKE :kw', { kw: `%${String(query.keyword)}%` });
    }

    const [list, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { list, total, page, pageSize };
  }

  /**
   * 记录详情（C 端，做归属校验防 IDOR）
   * 本人可查看；同家庭成员可查看（记录含 familyId 时校验成员归属）
   * 返回值附带 likeCount / likedByMe 供前端展示点赞状态
   */
  async get(userId: number, id: number) {
    const record = await this.recordEntity.findOneBy({ id });
    if (!record) return null;
    if (record.userId !== userId) {
      // 非本人：校验是否为同家庭成员
      if (record.familyId != null) {
        const membership = await this.familyMemberEntity.findOneBy({
          familyId: record.familyId,
          userId,
        });
        if (!membership) {
          throw new CoolCommException('无权访问该记录', 403);
        }
      } else {
        throw new CoolCommException('无权访问该记录', 403);
      }
    }
    // 附带点赞状态
    const likeCount = await this.recordLikeEntity.count({
      where: { recordId: id },
    });
    const likedByMe = !!(await this.recordLikeEntity.findOneBy({
      recordId: id,
      userId,
    }));
    return { ...record, likeCount, likedByMe };
  }

  /**
   * 裸查记录（不校验归属，供 family report 等内部使用）
   */
  async getById(id: number) {
    return this.recordEntity.findOneBy({ id });
  }

  /**
   * 删除记录（C 端）
   * 直接物理删除，不走 B 端回收站
   */
  async appDelete(userId: number, id: number) {
    await this.recordEntity.delete(id);
  }

  /**
   * 创建记录（C 端）
   * 自动填充 userId / recordDate（缺省取今天）
   * newAchievements 占位，由 achievement 模块注入
   */
  async save(userId: number, body: any) {
    if (!body || !body.dishName || !String(body.dishName).trim()) {
      throw new CoolCommException('菜品名称不能为空');
    }
    // 校验家庭归属：若指定 familyId，当前用户必须是该家庭成员
    let familyId = body.familyId != null ? Number(body.familyId) : null;
    if (familyId != null) {
      const membership = await this.familyMemberEntity.findOneBy({
        familyId,
        userId,
      });
      if (!membership) {
        throw new CoolCommException('无权操作该家庭', 403);
      }
    } else {
      // 兜底：body 未传 familyId 时，查询当前用户家庭组自动填充
      // 多家庭用户取最近加入的家庭（id DESC 确定性排序，避免归属不确定）
      const membership = await this.familyMemberEntity.findOne({
        where: { userId },
        order: { id: 'DESC' },
      });
      if (membership) {
        familyId = membership.familyId;
      }
    }
    const today = todayStr();
    const record = await this.recordEntity.save({
      userId,
      dishName: String(body.dishName).trim(),
      cookingMethod: body.cookingMethod,
      rating: typeof body.rating === 'number' ? body.rating : 0,
      note: body.note,
      nutrition: body.nutrition,
      ingredients: Array.isArray(body.ingredients) ? body.ingredients : [],
      tags: Array.isArray(body.tags) ? body.tags : [],
      mealType: body.mealType,
      cookId: typeof body.cookId === 'number' ? body.cookId : null,
      nutritionTags: Array.isArray(body.nutritionTags) ? body.nutritionTags : null,
      kidFriendly: typeof body.kidFriendly === 'boolean' ? body.kidFriendly : false,
      recordDate: body.recordDate || today,
      imageUrl: this.sanitizeImageUrl(body.imageUrl),
      beautifiedUrl: this.sanitizeImageUrl(body.beautifiedUrl),
      source: body.source || 'manual',
      familyId,
    });

    // 触发挑战进度更新（失败不阻塞记录保存）
    let newRecordCount = 0;
    try {
      newRecordCount = await this.recordEntity.count({
        where: { userId },
      });
      await this.challengeService.checkAndComplete(
        userId,
        'record_count',
        newRecordCount
      );
    } catch (e) {
      // 挑战更新失败不阻塞记录保存
    }

    // 触发成就解锁（失败不阻塞记录保存）
    let newAchievements: any[] = [];
    try {
      const recordAchievements = await this.achievementService.checkAndUnlock(
        userId,
        { type: 'record_count', value: newRecordCount }
      );
      newAchievements.push(...recordAchievements);

      // 菜系多样性：统计用户不同烹饪方式数量
      const cuisineResult = await this.recordEntity
        .createQueryBuilder('r')
        .select('COUNT(DISTINCT r.cookingMethod)', 'count')
        .where('r.userId = :userId', { userId })
        .andWhere('r.cookingMethod IS NOT NULL')
        .getRawOne();
      const cuisineCount = Number(cuisineResult?.count) || 0;
      const cuisineAchievements = await this.achievementService.checkAndUnlock(
        userId,
        { type: 'cuisine_count', value: cuisineCount }
      );
      newAchievements.push(...cuisineAchievements);

      // 早餐达人：统计最近30天有 breakfast 记录的去重天数
      // 简化逻辑：统计最近30天符合条件的去重天数，非严格连续
      const breakfastSince = daysAgoStr(30);
      const breakfastRows = await this.recordEntity
        .createQueryBuilder('r')
        .select('DISTINCT r.recordDate', 'recordDate')
        .where('r.userId = :userId', { userId })
        .andWhere('r.mealType = :mealType', { mealType: 'breakfast' })
        .andWhere('r.recordDate >= :since', { since: breakfastSince })
        .getRawMany();
      const breakfastDays = breakfastRows.length;
      const breakfastAchievements = await this.achievementService.checkAndUnlock(
        userId,
        { type: 'breakfast_streak', value: breakfastDays }
      );
      newAchievements.push(...breakfastAchievements);

      // 厨神：统计该用户作为 cookId 的记录总数
      const cookCount = await this.recordEntity.count({
        where: { cookId: userId },
      });
      const cookAchievements = await this.achievementService.checkAndUnlock(
        userId,
        { type: 'cook_count', value: cookCount }
      );
      newAchievements.push(...cookAchievements);

      // 营养大师：统计最近30天 nutritionTags 同时包含'蔬菜'和'蛋白'的去重天数
      // 简化逻辑：统计最近30天符合条件的去重天数，非严格连续
      const nutritionRows = await this.recordEntity
        .createQueryBuilder('r')
        .select('DISTINCT r.recordDate', 'recordDate')
        .where('r.userId = :userId', { userId })
        .andWhere('r.recordDate >= :since', { since: breakfastSince })
        .andWhere(
          'JSON_CONTAINS(r.nutritionTags, JSON_QUOTE(:tag1)) = 1',
          { tag1: '蔬菜' }
        )
        .andWhere(
          'JSON_CONTAINS(r.nutritionTags, JSON_QUOTE(:tag2)) = 1',
          { tag2: '蛋白' }
        )
        .getRawMany();
      const nutritionDays = nutritionRows.length;
      const nutritionAchievements = await this.achievementService.checkAndUnlock(
        userId,
        { type: 'nutrition_streak', value: nutritionDays }
      );
      newAchievements.push(...nutritionAchievements);
    } catch (e) {
      // 成就解锁失败不阻塞记录保存
    }

    return { record, newAchievements };
  }

  /**
   * 清洗图片 URL：去除首尾空白与 LLM 输出可能带的反引号包裹
   * 防止 weiji-ai 返回 `https://xxx.jpg` 这类 markdown 包裹污染数据
   */
  private sanitizeImageUrl(url: any): string {
    if (typeof url !== 'string') return url ?? '';
    let cleaned = url.trim();
    while (cleaned.startsWith('`') || cleaned.endsWith('`')) {
      if (cleaned.startsWith('`')) cleaned = cleaned.slice(1);
      if (cleaned.endsWith('`')) cleaned = cleaned.slice(0, -1);
      cleaned = cleaned.trim();
    }
    return cleaned;
  }

  /**
   * 家庭组记录动态（C 端，familyId 由调用方解析传入）
   * 关联 AppUser 补全昵称/头像，附 likeCount/commentCount/likedByMe
   * 按 createTime 降序
   */
  async listFamilyRecords(userId: number, familyId: number, query: any) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.max(1, Number(query.pageSize) || 20);
    // 可选成员过滤：按 userId 或 cookId 命中（任一匹配即返回）。
    // familyId 已在上层校验归属，此处仅缩小范围，不存在跨家庭越权。
    const qUserId = Number(query.userId);
    const memberUid = !isNaN(qUserId) && qUserId > 0 ? qUserId : null;
    const keyword = String(query.keyword || '').trim();

    const qb = this.recordEntity
      .createQueryBuilder('r')
      .where('r.familyId = :familyId', { familyId });
    if (memberUid) {
      qb.andWhere('(r.userId = :qUid OR r.cookId = :qUid)', { qUid: memberUid });
    }
    if (keyword) {
      qb.andWhere('r.dishName LIKE :kw', { kw: `%${keyword}%` });
    }
    const [records, total] = await qb
      .orderBy('r.createTime', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    if (records.length === 0) {
      return { list: [], total, page, pageSize };
    }

    // 批量预加载作者信息（同时包含 cookId 对应的用户，用于 cookName 展示）
    const userIds = [
      ...new Set(
        [
          ...records.map(r => r.userId),
          ...records.map(r => r.cookId),
        ].filter(v => v != null)
      ),
    ];
    const users =
      userIds.length > 0
        ? await this.appUserEntity.find({ where: { id: In(userIds) } })
        : [];
    const userMap = new Map(users.map(u => [u.id, u]));

    // 批量预加载点赞/评论
    const recordIds = records.map(r => r.id);
    const likes = await this.recordLikeEntity.find({
      where: { recordId: In(recordIds) },
    });
    const comments = await this.recordCommentEntity.find({
      where: { recordId: In(recordIds) },
    });
    const likesByRecord = new Map<number, RecordLikeEntity[]>();
    for (const l of likes) {
      const arr = likesByRecord.get(l.recordId) ?? [];
      arr.push(l);
      likesByRecord.set(l.recordId, arr);
    }
    const commentsByRecord = new Map<number, RecordCommentEntity[]>();
    for (const c of comments) {
      const arr = commentsByRecord.get(c.recordId) ?? [];
      arr.push(c);
      commentsByRecord.set(c.recordId, arr);
    }

    // 聚合家庭内各 dishName 的记录数（单次聚合，不影响现有分页性能）
    const dishCountStats = await this.recordEntity
      .createQueryBuilder('r')
      .select('r.dishName', 'dishName')
      .addSelect('COUNT(*)', 'count')
      .where('r.familyId = :familyId', { familyId })
      .groupBy('r.dishName')
      .getRawMany();
    const dishCountMap = new Map<string, number>();
    dishCountStats.forEach((s: any) => {
      dishCountMap.set(s.dishName, Number(s.count));
    });

    const list = records.map(r => {
      const u = userMap.get(r.userId);
      const cook = r.cookId != null ? userMap.get(r.cookId) : null;
      const rl = likesByRecord.get(r.id) ?? [];
      const rc = (commentsByRecord.get(r.id) ?? []).slice().sort((a, b) =>
        a.createTime < b.createTime ? -1 : a.createTime > b.createTime ? 1 : 0
      );
      // 最新一条评论摘要：评论已按 createTime 升序排序，取末尾元素
      const lastComment = rc.length > 0 ? rc[rc.length - 1] : null;
      return {
        id: r.id,
        userId: r.userId,
        userNickname: u?.nickName ?? '',
        userAvatar: u?.avatarUrl ?? '',
        dishName: r.dishName,
        cookCount: dishCountMap.get(r.dishName) || 1,
        imageUrl: r.imageUrl,
        beautifiedUrl: r.beautifiedUrl,
        rating: r.rating,
        tags: r.tags,
        recordDate: r.recordDate,
        cookingMethod: r.cookingMethod,
        mealType: r.mealType,
        cookId: r.cookId,
        cookName: cook?.nickName ?? '',
        cookAvatar: cook?.avatarUrl ?? '',
        nutritionTags: r.nutritionTags,
        kidFriendly: r.kidFriendly,
        likeCount: rl.length,
        commentCount: rc.length,
        likedByMe: rl.some(l => l.userId === userId),
        comments: rc,
        latestComment: lastComment
          ? { content: lastComment.content, nickName: lastComment.nickName }
          : null,
      };
    });

    return { list, total, page, pageSize };
  }

  /**
   * 切换点赞（toggle）
   * 返回 { liked, likes }
   */
  async toggleLike(userId: number, recordId: number) {
    const record = await this.recordEntity.findOneBy({ id: recordId });
    if (!record) {
      throw new CoolCommException('记录不存在', 404);
    }
    // 校验家庭归属：若记录属于某家庭，当前用户必须是该家庭成员
    if (record.familyId != null) {
      const membership = await this.familyMemberEntity.findOneBy({
        familyId: record.familyId,
        userId,
      });
      if (!membership) {
        throw new CoolCommException('无权操作该家庭', 403);
      }
    }
    const existing = await this.recordLikeEntity.findOneBy({
      recordId,
      userId,
    });
    if (existing) {
      await this.recordLikeEntity.delete(existing.id);
      const likes = await this.recordLikeEntity.count({
        where: { recordId },
      });
      return { liked: false, likes };
    }
    await this.recordLikeEntity.save({ recordId, userId });
    const likes = await this.recordLikeEntity.count({
      where: { recordId },
    });
    return { liked: true, likes };
  }

  /**
   * 新增评论
   * content 做 escapeHtml，从 AppUser 取昵称/头像快照
   */
  async comment(userId: number, recordId: number, content: string) {
    if (!content || !String(content).trim()) {
      throw new CoolCommException('评论内容不能为空');
    }
    const record = await this.recordEntity.findOneBy({ id: recordId });
    if (!record) {
      throw new CoolCommException('记录不存在', 404);
    }
    // 校验家庭归属：若记录属于某家庭，当前用户必须是该家庭成员
    if (record.familyId != null) {
      const membership = await this.familyMemberEntity.findOneBy({
        familyId: record.familyId,
        userId,
      });
      if (!membership) {
        throw new CoolCommException('无权操作该家庭', 403);
      }
    }
    const user = await this.appUserEntity.findOneBy({ id: userId });
    const saved = await this.recordCommentEntity.save({
      recordId,
      userId,
      content: _.escape(String(content).trim()),
      nickName: user?.nickName ?? '',
      avatarUrl: user?.avatarUrl ?? '',
    });
    return saved;
  }
}
