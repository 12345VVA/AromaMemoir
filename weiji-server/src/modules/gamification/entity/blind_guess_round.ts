import { BaseEntity } from '../../base/entity/base';
import { Column, Index, Entity } from 'typeorm';

/**
 * 盲猜轮次
 */
@Entity('weiji_blind_guess_round')
export class BlindGuessRoundEntity extends BaseEntity {
  @Index()
  @Column({ comment: '家庭组ID' })
  familyId: number;

  @Column({ comment: '轮次名称' })
  roundName: string;

  @Index()
  @Column({ comment: '发起人ID' })
  creatorId: number;

  @Column({ comment: '状态 active/revealed', default: 'active' })
  status: string;

  @Column({ comment: '参与记录ID数组 JSON', type: 'json' })
  recordIds: number[];

  @Column({ comment: '轮次 items JSON（含脱敏后字段）', type: 'json', nullable: true })
  items: any;

  @Column({ comment: '猜测记录 JSON', type: 'json', nullable: true })
  guesses: any;

  @Column({ comment: '揭晓排名 JSON', type: 'json', nullable: true })
  rankings: any;

  @Column({
    comment: '盲猜玩法模式 chef/rating/date',
    default: 'chef',
    nullable: true,
  })
  mode: string;

  @Column({
    comment: '有效期截止时间（猜厨师模式，过期自动关闭）',
    type: 'datetime',
    nullable: true,
  })
  expiresAt: Date;
  // 注意：不设顶层 correctAnswer 列。
  // date 模式下正确答案为字符串标量（如 'this_week'），存入 type:'json' 列后，
  // mysql2 自动解析为 JS 字符串，typeorm prepareHydratedValue 再次 JSON.parse 会抛
  // "Unexpected token ... is not valid JSON"，导致任何 getMany/find（含 /app/family/today-feed
  // 与 admin page/info）整行水合失败。正确答案已冗余存于 items[].correctAnswer（json 数组，水合安全）。
}
