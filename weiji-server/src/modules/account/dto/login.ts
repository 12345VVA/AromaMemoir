import { Rule, RuleType } from '@midwayjs/validate';

/**
 * 登录参数校验
 */
export class LoginDTO {
  // 用户名
  @Rule(RuleType.string().required().max(50))
  username: string;

  // 密码
  @Rule(RuleType.string().required().min(6).max(64))
  password: string;
}
