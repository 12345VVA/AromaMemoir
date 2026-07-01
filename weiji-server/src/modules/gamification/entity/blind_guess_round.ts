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
}
