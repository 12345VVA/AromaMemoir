import { Rule, RuleType } from '@midwayjs/validate';

/**
 * 注册参数校验
 */
export class RegisterDTO {
  // 用户名
  @Rule(RuleType.string().required().min(3).max(50).alphanum())
  username: string;

  // 密码
  @Rule(RuleType.string().required().min(6).max(64))
  password: string;

  // 昵称
  @Rule(RuleType.string().max(50).allow(null, ''))
  nickName: string;
}
