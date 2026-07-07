/**
 * 客户端保留词列表
 * 与服务端 reserved-words.json 保持同步，仅用于前端预校验
 * 敏感词库不下发到客户端，敏感词最终拦截以后端为准
 */
export const RESERVED_WORDS: string[] = [
  'admin', 'administrator', 'admin1', 'admin2', 'admin123',
  'root', 'rootuser',
  'system', 'sysadmin', 'sysadm',
  'superadmin', 'superuser', 'supervisor',
  'weiji', 'weijiadmin', 'weijiapp', 'weijiserver', 'weiji-admin',
  'official', 'officer',
  'kefu', 'service',
  'support', 'help', 'helper',
  'operator', 'moderator', 'mod', 'gm',
  'test', 'tester', 'testing',
  'null', 'undefined', 'void',
  'console', 'terminal', 'shell',
  'api', 'apis',
  'config', 'configuration',
  'backup', 'restore',
  'security', 'audit',
  'login', 'logout', 'signin', 'signout', 'signup', 'register',
  'password', 'passwd', 'pwd',
  'token', 'secret',
  'public', 'private',
  'anonymous', 'guest', 'visitor',
  'default', 'demo', 'sample', 'example',
  'staff', 'employee', 'hr',
  'ceo', 'cto', 'cio', 'cfo', 'coo',
  'boss', 'owner', 'master',
  '客服', '官方', '管理员', '超管', '系统管理员', '后台管理员', '平台管理员', '官方账号', '官方客服'
];

/**
 * 判断用户名是否命中保留词（前端预校验）
 * 对输入做 toLowerCase 后精确匹配
 * @returns true 表示命中保留词，应阻止提交
 */
export function isReservedUsername(username: string): boolean {
  if (!username || typeof username !== 'string') return false;
  const normalized = username.toLowerCase().trim();
  return RESERVED_WORDS.includes(normalized);
}
