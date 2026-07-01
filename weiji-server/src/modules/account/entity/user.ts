import { BaseEntity } from '../../base/entity/base';
import { Column, Index, Entity } from 'typeorm';

/**
 * C端用户
 */
@Entity('weiji_app_user')
export class AppUserEntity extends BaseEntity {
  @Index({ unique: true })
  @Column({ comment: '用户名', length: 50 })
  username: string;

  @Column({ comment: '密码（bcrypt 哈希）' })
  password: string;

  @Column({ comment: '昵称', nullable: true })
  nickName: string;

  @Column({ comment: '头像', nullable: true })
  avatarUrl: string;

  @Column({ comment: '状态 0-禁用 1-启用', default: 1 })
  status: number;

  @Column({
    comment: '密码版本，改密码后让原 token 失效',
    default: 1,
  })
  passwordV: number;
}
