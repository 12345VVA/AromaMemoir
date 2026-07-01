import { BaseEntity } from '../../base/entity/base';
import { Column, Index, Entity } from 'typeorm';
import { transformerJson } from '../../base/entity/base';

/**
 * 家庭菜谱
 */
@Entity('weiji_family_recipe')
export class FamilyRecipeEntity extends BaseEntity {
  @Index()
  @Column({ comment: '家庭组ID' })
  familyId: number;

  @Index()
  @Column({ comment: '作者ID' })
  authorId: number;

  @Column({ comment: '菜谱名' })
  name: string;

  @Column({ comment: '分类', nullable: true })
  category: string;

  @Column({
    comment: '食材 JSON',
    type: 'json',
    nullable: true,
    transformer: transformerJson,
  })
  ingredients: any;

  @Column({
    comment: '步骤 JSON',
    type: 'json',
    nullable: true,
    transformer: transformerJson,
  })
  steps: any;

  @Column({ comment: '封面URL', nullable: true })
  coverUrl: string;

  @Column({ comment: '难度 easy/medium/hard', nullable: true })
  difficulty: string;

  @Column({ comment: '烹饪时长（分钟）', nullable: true })
  cookTime: number;

  @Column({ comment: '可见性 family/private', default: 'family' })
  visibility: string;
}
