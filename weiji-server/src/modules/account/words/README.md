# 用户名校验词库

本目录存放用户名注册校验所需的词库文件，由 `src/modules/account/util/username-policy.ts` 在模块加载时一次性读取并构建 DFA 词树缓存于内存。

## 文件结构

### reserved-words.json

保留用户名词库。JSON 对象格式：

```json
{
  "_comment": "说明",
  "_version": "1.0.0",
  "_updatedAt": "2026-07-07",
  "words": ["admin", "root", "system", "..."]
}
```

校验时对输入用户名做 `toLowerCase()` 后做**精确匹配**（完整相等才命中）。`_` 前缀字段为元数据，加载时忽略。

### sensitive-words.json

敏感词库，按分类组织。JSON 对象格式：

```json
{
  "_comment": "说明",
  "_disclaimer": "免责声明",
  "_version": "1.0.0",
  "_updatedAt": "2026-07-07",
  "categories": {
    "political":      { "comment": "...", "words": ["..."] },
    "ethnic_religion":{ "comment": "...", "words": ["..."] },
    "violence_terror":{ "comment": "...", "words": ["..."] },
    "pornography":    { "comment": "...", "words": ["..."] },
    "gambling_drug":  { "comment": "...", "words": ["..."] },
    "gender_discrimination": { "comment": "...", "words": ["..."] },
    "insult_defamation":     { "comment": "...", "words": ["..."] },
    "other_illegal":  { "comment": "...", "words": ["..."] }
  }
}
```

校验时对输入用户名做归一化（全角半角、小写、繁简、去符号）后做 **DFA 子串匹配**（用户名包含任一敏感词即命中）。`_` 前缀字段与每个分类下的 `comment` 字段加载时忽略。

## 分类说明

| 分类 key | 说明 |
| --- | --- |
| `political` | 政治敏感：反动、颠覆国家政权、辱华 |
| `ethnic_religion` | 民族宗教：煽动民族仇恨、民族歧视、破坏民族团结、邪教 |
| `violence_terror` | 暴恐：暴力、凶杀、恐怖、教唆犯罪 |
| `pornography` | 色情低俗：淫秽、色情 |
| `gambling_drug` | 赌博毒品 |
| `gender_discrimination` | 男女对立、性别歧视、煽动性别仇恨 |
| `insult_defamation` | 辱骂诽谤、人身攻击 |
| `other_illegal` | 其他法律法规禁止内容（诈骗、传销、违禁品等） |

## 更新方式

1. 编辑对应 JSON 文件（增删词条）
2. 重启 weiji-server 服务使新词库生效
3. 当前版本**不支持热重载**，热重载接口将在后续独立 spec 处理

## 来源声明

本词库为以下来源的汇总与自整理：

- 公开开源敏感词库（如 `sensitive-word-go`、`mintool` 等公开项目）
- 《互联网用户账号名称管理规定》(2015) 第六条"九不准"分类对照
- 中央网信办"清朗·整治账号名称信息乱象"专项行动要求
- 项目运维自整理的常见变体与谐音词

## 合规声明

> **本词库为技术方案最小可行集**，仅含代表性词汇与常见变体，**不构成完整合规词库**。
>
> 生产环境应由**法务/合规团队**提供完整词库并定期更新。本词库的准确性与完整性不构成法律合规保证。
>
> 词库中的脱敏形式（如 `f*lx`、`se*情`）仅用于技术检测，不代表平台认可该词汇的任何含义。

## 与代码的关系

| 文件 | 加载方 | 用途 |
| --- | --- | --- |
| `reserved-words.json` | `src/modules/account/util/username-policy.ts` | 构建保留词 `Set<string>`，精确匹配 |
| `sensitive-words.json` | `src/modules/account/util/username-policy.ts` | 构建敏感词 DFA 词树，子串匹配 |

加载失败（文件缺失或 JSON 解析失败）时，服务启动不阻塞，降级为：

- 保留词降级为内置最小集合 `['admin', 'root', 'system']`
- 敏感词 DFA 降级为空（不阻塞注册流程，仅记录 error 日志）
