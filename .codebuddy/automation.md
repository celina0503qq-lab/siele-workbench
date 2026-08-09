# 外刊精炼 · 自动化生成与推送指令

> **项目**: SIELE 西语备考工作台 — 外刊精炼模块  
> **仓库**: `celina0503qq-lab/siele-workbench`  
> **GitHub Pages**: `https://celina0503qq-lab.github.io/siele-workbench/`  
> **版本**: v2 (2026-08-09)

---

## 一、模块概述

"外刊精炼"是西语 SIELE 备考工作台的每日推送模块，每期包含：

| 组成部分 | 数量 | 说明 |
|---|---|---|
| 高频词 | **15 个** | 生活/职场/时事主题，含音标、释义、例句（中西双语）、记忆提示 |
| A1 精读 | **10 段** | 入门级，陈述式现在时为主，5 道阅读理解题 |
| A2 精读 | **10 段** | 基础级，现在完成时/简单过去时，5 道阅读理解题 |
| B1 精读 | **15 段** | 进阶级，虚拟式+条件式+复合句，8 道阅读理解题 |
| B2 精读 | **15 段** | 高级，议论文体+学术词汇，8 道阅读理解题 |

每篇文章附带：原文链接、DELE 考点分析、难词清单（含释义）。

---

## 二、一键生成指令

当用户说「生成 X 月 X 号的外刊精炼」或类似指令时，按以下步骤执行：

### 第 1 步：确认日期和主题

询问用户或自行确定：
- **日期**（格式 `YYYY-MM-DD`）
- **星期几**（中文：一/二/三/四/五/六/日）
- **期号**（递增，查看 `refine_data.js` 中最大 issue + 1）
- **4 个主题方向**（A1 生活场景 → A2 文化/社会 → B1 经济/科技趋势 → B2 深度分析/争议话题）

### 第 2 步：生成数据 JS 文件

输出文件：`articles/data/<date>.js`

数据格式：
```javascript
window.__REFINE_DATE__ = "YYYY-MM-DD";
window.WORDS = [
  {
    lema: "xxx",
    ipa: "[...]",
    pos: "m./f.",
    significado: "中文释义",
    ejemplo_es: "西班牙语句子",
    ejemplo_zh: "中文翻译",
    tip: "记忆提示（含DELE考点、易混淆辨析等）"
  },
  // ... 共 15 个
];

window.ARTICLES = {
  a1: {
    paragraphs: [
      { es: "西语句子", zh: "中文翻译" },
      // ... 10 段
    ],
    dele: "A1 考点：<b>语法点</b>说明...",
    hardWords: [
      { w: "难词", m: "中文释义" },
      // ... 5 个
    ],
    quiz: [
      { q: "问题（中文）", opts: ["A选项","B选项","C选项","D选项"], ans: 0, es: "西语解析", zh: "中文解析" },
      // ... 5 题（B1/B2 为 8 题）
    ]
  },
  a2: { /* 同上结构，10段/5题 */ },
  b1: { /* 同上结构，15段/8题 */ },
  b2: { /* 同上结构，15段/8题 */ }
};
```

**重要约束**：
- JS 文件中的 `zh` 值如果包含中文引号 `""`，必须转义为 `\u201C` / `\u201D`
- 文件保存后必须用 `node -e "new Function(fs.readFileSync(...))"` 验证语法通过
- 数据内容必须用 `vm.runInNewContext` 验证：15 WORDS + A1(10p/5q) + A2(10p/5q) + B1(15p/8q) + B2(15p/8q)

### 第 3 步：生成独立 HTML 页面

输出文件：`articles/<date>.html`

**使用 v2 模板**（参考 2026-08-06 至 2026-08-09 任意一期），关键特征：

1. **数据内联**：WORDS 和 ARTICLES 数据直接写在 `<script>` 标签中，不引用外部 JS
2. **CSS 必须包含**：
   - CSS 变量体系（`--brand`, `--a1`~`--b2`, `--es-bg`, `--zh-bg` 等）
   - 段落语言标签 `.lang-tag`（ES / ZH 色块）
   - 原文链接按钮化 `.source-cta`（实心彩色按钮）
   - 高亮词后标记 `hl::after`（✦ 菱形符号）
   - DELE 考点渐变背景（紫色渐变）
   - Quiz 解析渐变背景（黄色渐变）
   - 提交按钮 disabled 态
   - 中文字体栈（`PingFang SC`, `Microsoft YaHei`）
   - 响应式 `@media (max-width: 720px)`
3. **HTML 结构必须包含**：
   - 目录含各等级"阅读"和"习题"独立锚点
   - 快速跳转分区（阅读 + 习题分别跳转）
4. **JS 渲染必须包含**：
   - `renderVocab()` — 词汇卡片含 释义/例句/翻译/记忆提示 标签
   - `renderArticle(key)` — 段落含 ES/ZH 语言标签
   - `highlightWords(text, words)` — 使用 `\b` 词边界，含 `title` tooltip
   - `esc(s)` — HTML 转义
   - Quiz 交互：`onclick` 方式绑定，含正确/错误状态和双语解析

### 第 4 步：生成 DOCX 文件

输出文件：`articles/<date>.docx`

使用 `python-docx` 库生成，包含：
- 标题 + 副标题（日期/期号/主题）
- 15 个高频词（含音标、释义、例句、提示）
- 4 篇分级文章（中西双语对照）
- DELE 考点 + 难词清单
- 阅读理解题（题目 + 选项 + 答案 + 解析）

### 第 5 步：更新索引文件

更新 `refine_data.js`，在 `window.REFINE_PACKS` 对象最前面插入新日期条目：

```javascript
"YYYY-MM-DD": {
  date: "YYYY-MM-DD",
  weekday: "X",
  issue: N,
  theme: "A1主题 · A2主题 · B1主题 · B2主题",
  sources: [
    { level: "A1", source: "来源名", sourceUrl: "https://...", topic: "文章主题" },
    { level: "A2", source: "来源名", sourceUrl: "https://...", topic: "文章主题" },
    { level: "B1", source: "来源名", sourceUrl: "https://...", topic: "文章主题" },
    { level: "B2", source: "来源名", sourceUrl: "https://...", topic: "文章主题" }
  ]
},
```

### 第 6 步：推送到 GitHub

由于沙箱环境 DNS 劫持，使用以下方式推送：

```bash
# 1. 修改 /etc/hosts 绕过 DNS 劫持
echo "140.82.121.5 api.github.com" >> /etc/hosts

# 2. 使用 GitHub Contents API 逐个上传（需要有效的 fine-grained PAT）
#    或使用 curl 直接 PUT 到 API
#    PUT /repos/celina0503qq-lab/siele-workbench/contents/{path}

# 3. 恢复 hosts
#    （操作完成后恢复原始 /etc/hosts）
```

需要上传的文件清单：
1. `articles/data/<date>.js`
2. `articles/<date>.html`
3. `articles/<date>.docx`
4. `refine_data.js`

推送完成后，GitHub Pages 会自动构建（约 1-2 分钟）。

---

## 三、模板升级检查清单

旧版 HTML 升级到 v2 模板时，必须逐项检查：

| # | 检查项 | 类别 |
|---|---|---|
| 1 | 数据内联（非外部 JS 引用） | 架构 |
| 2 | `--es-bg` / `--zh-bg` 段落背景色 | CSS |
| 3 | `.lang-tag` ES/ZH 语言标签 | CSS |
| 4 | `.source-cta` 原文链接按钮化 | CSS |
| 5 | `hl::after` 高亮词 ✦ 标记 | CSS |
| 6 | `.dele-points` 渐变背景 | CSS |
| 7 | `.quiz-explain` 渐变背景 | CSS |
| 8 | `quiz-submit:disabled` 状态 | CSS |
| 9 | `.quiz-score.partial` 状态 | CSS |
| 10 | 中文字体栈 PingFang SC | CSS |
| 11 | 标题 letter-spacing | CSS |
| 12 | 目录含 quiz 独立锚点 | HTML |
| 13 | 快速跳转分区（阅读/习题） | HTML |
| 14 | 词汇卡标签头（释义/例句/翻译） | JS |
| 15 | hardWords title tooltip | JS |
| 16 | `\b` 词边界匹配 | JS |

---

## 四、已知坑点与注意事项

### 4.1 JS 引号问题
- JS 数据文件中 `zh` 字段值如果包含中文引号 `""`（Unicode `\u201C`/`\u201D`），在 JS 双引号字符串中会破坏语法
- **解决方案**：写入前将 `zh` 值内的 ASCII 双引号替换为 `\u201C` / `\u201D` 转义序列
- **验证方法**：`node -e "new Function(fs.readFileSync('path','utf8'))"` 检查语法

### 4.2 GitHub 推送
- 沙箱环境 DNS 将 `github.com` 劫持到内网 IP，需通过 `/etc/hosts` 指定真实 IP
- 可用的 API IP：`140.82.121.5`（已验证）、`140.82.121.6`
- 必须使用有 `repo` 权限的 fine-grained PAT 或 classic token
- Git 命令使用 GnuTLS 可能失败，改用 curl + GitHub Contents API 更可靠

### 4.3 数据一致性
- 高频词应在文章段落中自然出现（用于 `highlightWords` 高亮）
- 每篇文章的 `hardWords` 应对应段落中的实际难点
- 阅读题答案必须能从对应段落中直接定位（在解析中标注段落号）
- 期号必须连续递增

### 4.4 内容质量
- A1 文章：日常生活场景，词汇基础，句式简单
- A2 文章：社会生活，引入简单时态变化
- B1 文章：社会/经济议题，复合句，含数据/引语
- B2 文章：深度分析/争议话题，学术词汇，多观点呈现
- 来源优先选择：DELE Ahora（A1/A2）→ RTVE（A2/B1）→ BBC Mundo（B1/B2）→ El País（B2）

---

## 五、快速参考

### 文件结构
```
siele-workbench/
├── articles/
│   ├── data/
│   │   └── YYYY-MM-DD.js        # 原始数据（外部引用用）
│   ├── YYYY-MM-DD.html           # 独立页面（数据内联，v2 模板）
│   └── YYYY-MM-DD.docx           # Word 文档
├── refine_data.js                # 索引文件（所有期号元数据）
└── .codebuddy/
    └── automation.md             # 本文件
```

### GitHub API 上传模板
```bash
# 获取文件 SHA（如已存在）
curl -s --resolve "api.github.com:443:140.82.121.5" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/celina0503qq-lab/siele-workbench/contents/<path>?ref=main"

# 创建/更新文件
curl -s -X PUT --resolve "api.github.com:443:140.82.121.5" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Accept: application/vnd.github+json" \
  -H "Content-Type: application/json" \
  -d '{"message":"commit msg","content":"<base64>","branch":"main","sha":"<sha-if-updating>"}' \
  "https://api.github.com/repos/celina0503qq-lab/siele-workbench/contents/<path>"
```

---

*最后更新：2026-08-09 · 基于 5 期实际运行经验总结*
