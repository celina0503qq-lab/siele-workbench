# 外刊精炼 · 自动化生成与推送指令

> **项目**: SIELE 西语备考工作台 — 外刊精炼模块  
> **仓库**: `celina0503qq-lab/siele-workbench`  
> **GitHub Pages**: `https://celina0503qq-lab.github.io/siele-workbench/`  
> **版本**: v4.4 (2026-08-20 · 阅读题题干/选项纯西语 + 解析定位原文 + B1/B2 难词提升至 8–10 个 + B1/B2 选文来源硬约束：El País/BBC Mundo 真实原文)

---

## 〇、调度安排（重要）

> **更新频率：每 4 天更新一期**（自 2026-08-13 起，由原先的周一周四调整为按间隔触发）
> **v4.3 变更（2026-08-16）**：B1 段落 ≥18 段、B2 段落 ≥20 段、B2 难题 ≥4/8、B1/B2 难词含详细分析字段。**自第 14 期（2026-08-20）起生效。**

- **调度时间**：每 4 天 **09:00**（Asia/Shanghai），由 WorkBuddy 自动化任务 `siele-v3`（id=5100839）触发
- **Cron 表达式**：`0 0 9 */4 * *`
- **每期对应日期**：触发当天即为当期日期，不再按自然周划分覆盖范围
- **期号连续性**：依然严格遵守"在线读取 refine_data.js 最大 issue + 1"的规则，期号按实际推送次数递增
- **手动触发**：如需手动补推某一期，可临时创建 once 任务或手动执行生成流程（仍须遵守 v4 全部安全规则）
- **频率变更说明**：2026-08-13 当天仍会触发（8.13 正好落在 `*/4` 序列），下一期为 8.17，之后每 4 天一更

---

## 一、模块概述

"外刊精炼"是西语 SIELE 备考工作台的定期推送模块（每 4 天更新一期），每期包含：

| 组成部分 | 数量 | 说明 |
|---|---|---|
| 高频词 | **15 个** | 生活/职场/时事主题，含音标、释义、例句（中西双语）、记忆提示 |
| A1 精读 | **10 段** | 入门级，陈述式现在时为主，5 道阅读理解题 |
| A2 精读 | **10 段** | 基础级，现在完成时/简单过去时，5 道阅读理解题 |
| B1 精读 | **≥18 段** | 进阶级，虚拟式+条件式+复合句，8 道阅读理解题 |
| B2 精读 | **≥20 段** | 高级，议论文体+学术词汇，8 道阅读理解题（其中 ≥4 题为难题） |

每篇文章附带：原文链接、DELE 考点分析、难词清单（含释义）、**课后习题持久化 + 笔记功能**。

### 1.1 Quiz 持久化与云同步（v3 新增）

所有做题记录和笔记通过 `localStorage` 持久化，并通过工作台 `admin.html` 的云同步功能跨设备同步。

**存储键**: `swa_quiz_v1`

**数据结构**:
```json
{
  "version": 1,
  "updatedAt": "2026-08-10T...",
  "quizzes": {
    "2026-08-10": {
      "a1": {
        "totalQuestions": 5,
        "attempts": [
          {
            "id": "timestamp-base36",
            "timestamp": 1723300000000,
            "answers": [
              { "idx": 0, "chosen": 2, "correct": 2 },
              { "idx": 1, "chosen": 1, "correct": 3 }
            ],
            "score": 1,
            "total": 5,
            "completed": false
          }
        ],
        "notes": "用户笔记内容",
        "notesTs": 1723300000000
      },
      "a2": { },
      "b1": { },
      "b2": { }
    }
  }
}
```

**关键规则**:
- Level key **必须全小写**（`a1`/`a2`/`b1`/`b2`），工作台内置页面和独立 HTML 页面共用同一存储键，大小写不一致会导致数据不互通
- `attempts[0]` 始终是最新一次尝试；重新做题时旧 attempt 标记 `completed: true`，新 attempt 插入数组头部
- `notesTs` 是笔记的时间戳，用于云同步合并冲突解决（取较新版本）
- 独立 HTML 页面的 `QuizData` 对象和工作台内置页面的 `RefineQuizDB` 对象都使用同一个 `swa_quiz_v1` 键

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
      // ... 5 个（A1/A2 仅需 w + m）
    ],
    quiz: [
      { q: "问题（中文）", opts: ["A选项","B选项","C选项","D选项"], ans: 0, es: "西语解析", zh: "中文解析" },
      // ... 5 题（B1/B2 为 8 题）
    ]
  },
  a2: { /* 同上结构，10段/5题 */ },
  b1: {
    paragraphs: [ /* ... ≥18 段 */ ],
    dele: "...",
    hardWords: [
      // B1/B2 难词需详细分析：增加 ejemplo（西语例句）和 analisis（详细分析）字段
      {
        w: "难词",
        m: "中文释义",
        ejemplo: "包含该难词的西语例句（来自原文或补充）",
        analisis: "详细分析：词源/词根词缀、常见搭配、语法行为（性数变化/变位/格）、语境义辨析、DELE 考查角度、易混淆词对比等（至少 2-3 句话）"
      },
      // ... B1/B2 各 ≥6 个难词
    ],
    quiz: [ /* ... 8 题 */ ]
  },
  b2: { /* 同上结构，≥20段/8题（≥4题难题）；hardWords 含详细分析字段 */ }
};
```

**重要约束**：
- JS 文件中的 `zh` 值如果包含中文引号 `""`，必须转义为 `\u201C` / `\u201D`
- 文件保存后必须用 `node -e "new Function(fs.readFileSync(...))"` 验证语法通过
- 数据内容必须用 `vm.runInNewContext` 验证：15 WORDS + A1(10p/5q) + A2(10p/5q) + B1(≥18p/8q) + B2(≥20p/8q)
- **B1/B2 hardWords 详细分析字段验证**：B1/B2 的每个 hardWords 项必须包含 `ejemplo`（西语例句）和 `analisis`（详细分析）字段

### 第 3 步：生成独立 HTML 页面

输出文件：`articles/<date>.html`

**使用 v3 模板**（参考 2026-08-06 至 2026-08-09 任意一期），关键特征：

1. **数据内联**：WORDS 和 ARTICLES 数据直接写在 `<script>` 标签中，不引用外部 JS
   - 早期（08-02~05）使用外部 `articles/data/<date>.js` + `loadRefineData()` 动态加载
   - v2+（08-06 起）改为数据内联，独立页面不再依赖外部 JS 文件
   - **新生成页面一律使用内联模式**；外部 data JS 文件仅在工作台内置页面 `index.html` 中通过 `loadRefineData()` 使用
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
   - **Quiz 持久化控件样式**（`.quiz-controls`, `.quiz-reset-btn`, `.quiz-notes-btn`, `.quiz-history` 等）
3. **HTML 结构必须包含**：
   - 目录含各等级"阅读"和"习题"独立锚点
   - 快速跳转分区（阅读 + 习题分别跳转）
   - **Quiz 控件区**（重新做题、历史记录、笔记区按钮）
4. **JS 渲染必须包含**：
   - `renderVocab()` — 词汇卡片含 释义/例句/翻译/记忆提示 标签
   - `renderArticle(key)` — 段落含 ES/ZH 语言标签
   - `highlightWords(text, words)` — 使用 `\b` 词边界，含 `title` tooltip
   - `esc(s)` — HTML 转义
   - Quiz 交互：`onclick` 方式绑定，含正确/错误状态和双语解析
   - **错题自动记录**：答错时调用 `autoLogLowScore('refineQuiz', { level, question, correct, chosen })`（如存在该函数）
   - **`QuizData` 对象**（见下方 2.1 节）

> **注意**：旧版页面（v1/v2）若缺少 QuizData 持久化功能，可用 `devext/patch_quiz_persistence.py` 批量打补丁。该脚本通过 4 个锚点（`</style>` 插入 CSS、词汇数据标记前插入 QuizData、quiz block 替换为 `bindQuizInteraction` + `renderQuizControls`、`forEach(renderArticle)` 后插入恢复逻辑）注入代码。新生成页面应直接在模板中包含这些功能，不依赖补丁。

### 2.1 QuizData 对象（独立 HTML 页面）

每个独立 HTML 页面必须包含 `QuizData` 对象，实现以下方法：

```javascript
const QuizData = {
  STORAGE_KEY: 'swa_quiz_v1',
  load() { /* 从 localStorage 读取 swa_quiz_v1，返回 {version,updatedAt,quizzes:{}} */ },
  save(data) { /* 写入 localStorage，设置 updatedAt = ISO 时间 */ },
  getDate() { /* 从 document.title 提取日期 */ },
  getRecord(date, level) { /* 获取 {totalQuestions, attempts, notes} */ },
  recordAnswer(level, idx, chosen, isCorrect) { /* 记录答题，自动创建/更新 attempt */ },
  restoreQuizUI(date, level) { /* 页面加载时恢复答题状态（选项高亮、成绩、解析） */ },
  doResetQuiz(level) { /* 重置 UI + 标记旧 attempt 完成 */ },
  toggleNotes(level) { /* 切换笔记区显示 */ },
  saveNotes(level) { /* 保存笔记到 quizzes[date][level].notes + notesTs */ }
};
```

**初始化调用**（在 `renderArticle` 之后）：
```javascript
// 恢复已保存的答题状态
QuizData.restoreQuizUI(date, level);
// 渲染 quiz 控件（重新做题、笔记等）
renderQuizControls(level);
// 绑定 quiz 交互
bindQuizInteraction(level);
```

**提交答案时**：
```javascript
submit.onclick = function() {
  // ... 现有判定逻辑 ...
  QuizData.recordAnswer(level, idx, chosen, isCorrect);
};
```

### 第 4 步：生成 DOCX 文件

输出文件：`articles/<date>.docx`

使用 `python-docx` 库生成，包含：
- 标题 + 副标题（日期/期号/主题）
- 15 个高频词（含音标、释义、例句、提示）
- 4 篇分级文章（中西双语对照）
- DELE 考点 + 难词清单
- **B1/B2 难词清单含详细分析**：每个难词除释义外，增加西语例句（ejemplo）和详细分析（analisis）行
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

使用 `gh` CLI 或 GitHub Contents API 推送：

```bash
# 认证（使用有 contents:write 权限的 PAT）
echo "<TOKEN>" | gh auth login --with-token

# 上传文件（逐个）
python3 -c "
import json, base64
with open('<file>', 'rb') as f:
    content = base64.b64encode(f.read()).decode()
payload = {
    'message': 'add: <date> 外刊精炼',
    'content': content
    # 如更新已有文件需加 'sha': '<existing-sha>'
}
with open('/tmp/payload.json', 'w') as f:
    json.dump(payload, f)
"

gh api -X PUT repos/celina0503qq-lab/siele-workbench/contents/<path> \
  --input /tmp/payload.json
```

需要上传的文件清单：
1. `articles/data/<date>.js`（如有外部数据文件）
2. `articles/<date>.html`
3. `articles/<date>.docx`
4. `refine_data.js`

推送完成后，GitHub Pages 会自动构建（约 1-2 分钟）。

---

## 三、工作台内置页面 Quiz 持久化

工作台主页面 `index.html` 中的外刊精炼模块也内置了 quiz 持久化功能，使用 `RefineQuizDB` 对象（与独立页面的 `QuizData` 对等），共用 `swa_quiz_v1` 存储键。

### 3.1 RefineQuizDB 对象

```javascript
const RefineQuizDB = {
  STORAGE_KEY: 'swa_quiz_v1',
  load() { /* 同 QuizData.load() */ },
  save(data) { /* 同 QuizData.save() */ },
  recordAnswer(date, level, qIdx, chosen, correct, totalQuestions) { /* 记录答题 */ },
  getAttempts(date, level) { /* 获取全部 attempts */ },
  getLatestAttempt(date, level) { /* 获取最新 attempt */ },
  resetQuiz(date, level) { /* 标记当前 attempt 完成 */ }
};
```

### 3.2 关键函数

- `window.submitRefineQuiz(levelKey, qIdx)` — 提交答案后调用 `RefineQuizDB.recordAnswer()`，同时调用 `autoLogLowScore('refineQuiz', ...)` 记录错题
- `window.restoreRefineQuizUI(levelKey, attempt)` — 页面渲染后恢复答题状态
- `window.redoRefineQuiz(levelKey)` — 重新做题（保留历史）
- `window.toggleRefineQuizHistory(levelKey)` — 查看/折叠历史记录
- `window.bindRefineQuizClicks()` — 为所有 quiz 选项绑定 click 事件
- `window.bindRefineSpeaks()` — 绑定单词/段落/全文发音按钮

### 3.3 renderRefineBody Wrapper Hook

工作台内置页面通过 wrapper 模式 hook 渲染时机：

```javascript
const _origRenderRefineBody = renderRefineBody;
window.renderRefineBody = async function() {
  await _origRenderRefineBody.apply(this, arguments);
  setTimeout(() => {
    window.bindRefineQuizClicks();   // 绑定 quiz 选项点击
    window.bindRefineSpeaks();        // 绑定发音按钮
    // 恢复已保存的答题状态
    if (typeof RefineQuizDB !== 'undefined' && currentRefineDate) {
      const lvs = currentRefineLevel ? [currentRefineLevel] : ['A1','A2','B1','B2'];
      lvs.forEach(lv => {
        var att = RefineQuizDB.getLatestAttempt(currentRefineDate, lv.toLowerCase());
        if (att && att.answers && att.answers.length > 0)
          window.restoreRefineQuizUI(lv.toLowerCase(), att);
      });
    }
  }, 0);
};
```

### 3.4 TTS 发音功能

工作台内置页面包含完整的 TTS 发音体系（独立 HTML 页面可选实现）：

| 功能 | 函数 | 说明 |
|------|------|------|
| 单词/例句发音 | `_bindRefineWordSpeak()` | 点击 🔊 按钮朗读单个单词或例句 |
| 段落发音 | `_bindRefineParaSpeak()` | 点击段落旁 🔊 按钮朗读该段 |
| 全文通读 | `_bindRefinePlayAll()` | ▶ 按钮逐段朗读全文，段间 0.5s 间隔 |
| 跟读评分 | `_bindRefineScore()` | 🎤 录音后对比评分（需 Web Speech API） |
| 语速控制 | `_bindRefineRate()` | 1.0x / 0.7x 慢速 / 0.5x 特慢 |

状态管理：`window.__refineSpeakRate`（每等级语速）、`window.__refineSpeakQueue`（通读队列，可 cancel）

### 3.5 笔记系统

工作台内置页面的笔记通过 `_getRefineNote(noteKey)` / `_setRefineNote(noteKey, text)` 函数读写，数据存储在 `swa_quiz_v1` 的 `quizzes[date][level].notes` 字段（不再使用独立的 `refine_notes_v1` 键）。

启动时自动迁移旧 `refine_notes_v1` 数据到 `swa_quiz_v1`。

### 3.6 Level Key 规范

> **重要**：所有 level key 必须使用小写（`a1`/`a2`/`b1`/`b2`）

| 来源 | 正确写法 | 错误写法 |
|------|----------|----------|
| 独立 HTML 页面 QuizData | `a1` (小写) | ~~`A1`~~ |
| 工作台 RefineQuizDB | `a1` (小写) | ~~`A1`~~ |
| swa_quiz_v1 JSON 键 | `a1` (小写) | ~~`A1`~~ |

不一致会导致云同步时同一日期同一等级的数据被当作不同条目，无法互通。

---

## 四、云同步机制

### 4.1 admin.html 云同步流程

工作台 `admin.html` 的 `serializeCloud()` / `mergeData()` 负责云同步：

1. **上传** (`serializeCloud()`)：将 `swa_quiz_v1` 的全部内容（含做题记录和笔记）打包到云端 JSON
2. **下载** (`mergeData()`)：拉取云端数据，通过 `mergeQuizzes()` 合并到本地
3. **写回** (`saveQuizDataToLocal()`)：将合并后的数据写回 `swa_quiz_v1`

### 4.2 mergeQuizzes 合并逻辑

```javascript
function mergeQuizzes(localQ, remoteQ) {
  // 按 date → level 遍历
  // attempts: 按 attempt.id 去重合并，按 timestamp 降序排列
  // notes: 按 notesTs 时间戳取较新版本
  //   - 内容相同 → 取任意
  //   - 一端为空 → 取非空端
  //   - 两端都有 → 取 notesTs 更大的
}
```

### 4.3 支持的云同步 Provider

| Provider | 说明 |
|----------|------|
| GitHub Gist | 全球通用，需要 PAT（gist 权限） |
| Gitee 代码片段 | 国内访问快，推荐 |
| 腾讯云 CloudBase | 账号体系同源 |
| JSONBin.io | 配置最简单 |

---

## 五、模板升级检查清单

旧版 HTML 升级到 v3 模板时，必须逐项检查：

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
| 15 | hardWords title tooltip + B1/B2 详细分析字段渲染 | JS |
| 16 | `\b` 词边界匹配 | JS |
| 17 | **QuizData 对象 + STORAGE_KEY: 'swa_quiz_v1'** | JS |
| 18 | **renderQuizControls(level) 控件渲染** | JS |
| 19 | **bindQuizInteraction(level) 交互绑定** | JS |
| 20 | **restoreQuizUI 页面加载恢复** | JS |
| 21 | **recordAnswer 提交后持久化** | JS |
| 22 | **doResetQuiz 重新做题功能** | JS |
| 23 | **toggleNotes + saveNotes 笔记持久化** | JS |
| 24 | **Level key 全小写（a1/a2/b1/b2）** | JS |
| 25 | **sourceUrl 返回 HTTP 200（非首页/列表页）** | 数据 |
| 26 | **sourceUrl 不可编造，无可用链接时留空** | 数据 |
| 27 | **错题自动记录 autoLogLowScore('refineQuiz', ...)** | JS |
| 28 | **renderRefineBody wrapper hook（绑定+恢复）** | 架构 |
| 29 | **TTS 发音按钮绑定（单词/段落/全文）** | JS |
| 30 | **数据内联模式（非外部 JS 引用）** | 架构 |
| 31 | **B1 段落数 ≥18、B2 段落数 ≥20（v4.3）** | 数据 |
| 32 | **B2 难题 ≥4/8、B1 难题 ≥2/8（v4.3）** | 数据 |
| 33 | **B1/B2 hardWords 含 ejemplo + analisis 字段（v4.3）** | 数据 |

---

## 六、已知坑点与注意事项

### 6.1 JS 引号问题
- JS 数据文件中 `zh` 字段值如果包含中文引号 `""`（Unicode `\u201C`/`\u201D`），在 JS 双引号字符串中会破坏语法
- **解决方案**：写入前将 `zh` 值内的 ASCII 双引号替换为 `\u201C` / `\u201D` 转义序列
- **验证方法**：`node -e "new Function(fs.readFileSync('path','utf8'))"` 检查语法

### 6.2 GitHub 推送
- 沙箱环境 DNS 将 `github.com` 劫持到内网 IP，需通过 `/etc/hosts` 指定真实 IP
- 可用的 API IP：`140.82.121.5`（已验证）、`140.82.121.6`
- 必须使用有 `contents:write` 权限的 fine-grained PAT
- Git 命令使用 GnuTLS 可能失败（TLS 握手错误），改用 `gh` CLI + GitHub API 更可靠
- 上传大文件（>1MB）时，Contents API 返回的 `content` 字段可能为空；用 HTTP Range 请求分块下载

### 6.3 数据一致性
- 高频词应在文章段落中自然出现（用于 `highlightWords` 高亮）
- 每篇文章的 `hardWords` 应对应段落中的实际难点
- 阅读题答案必须能从对应段落中直接定位（在解析中标注段落号）
- 期号必须连续递增

### 6.4 Level Key 大小写
- `swa_quiz_v1` 中的 level key **必须全小写**（`a1`/`a2`/`b1`/`b2`）
- 工作台内置页面使用 `lvKey`（已是小写），但早期代码中曾用 `levelKey.toUpperCase()` 导致大小写不一致
- **后果**：大小写不同的 key 在云同步 `mergeQuizzes` 中被当作不同条目，做题记录和笔记无法跨设备/跨页面同步
- **修复**：所有 `RefineQuizDB` 调用必须使用小写 level key

### 6.5 笔记云同步
- 笔记存储在 `swa_quiz_v1` 的 `quizzes[date][level].notes` 字段，附带 `notesTs` 时间戳
- 云同步合并时按 `notesTs` 取较新版本（而非简单覆盖）
- 工作台内置页面旧版使用独立的 `refine_notes_v1` 键，启动时自动迁移到 `swa_quiz_v1`
- 独立 HTML 页面的笔记始终存储在 `swa_quiz_v1` 中

### 6.6 原文链接准确性
- `sourceUrl` 必须指向**实际文章页面**，不能填网站首页、频道页或列表页
- 生成时必须用 `curl -s -o /dev/null -w "%{http_code}" <url>` 验证返回 **200**，404/403/301 跳首页均不可用
- 若来源为付费墙（El País 等），链接仍可填，但页面应标注"可能需要订阅"
- 同一篇文章不得跨等级复用（A1 和 B2 不能用同一篇原文，难度适配不同）
- 若临时无法找到可用原文链接，`sourceUrl` 留空 `""`，前端会降级显示来源名（无跳转按钮），**不可编造链接**

### 6.6.1 B1/B2 选文来源硬性约束（v4.4 · 第 14 期教训）
- **B1/B2 选文必须取自可打开的真实西语媒体原文**，优先 **El País** 或 **BBC Mundo**（西语版）。**严禁**使用日语/英语等他语种媒体（第 14 期 B2 曾误用 Japan Times，已被纠正）。
- **「尽量不改原文」的准确含义**（用户最终确认）：
  1. `sourceUrl` 必须指向**真实可打开的文章**（真实链接）；
  2. 正文必须基于**真实新闻事实**编写（真实原文选段/事实依据）；
  3. 在此基础上**按难度分级**改写/精简，**尽量不大改**原意、数据、引语、机构名。
- **三级来源优先级**（B1/B2 尤其 B2 严格执行）：El País 原文 > BBC Mundo 原文 > RTVE 原文。找不到 El País/BBC 的可用原文时，宁可降低难度适配或用 RTVE，**也不得换用非西语媒体**。
- **验证闭环**：推送前必须用 `WebFetch`（或 curl，若沙箱可直连）实际打开 `sourceUrl`，确认返回 200 且正文确为该主题，再写入数据。若 curl 因 TLS 直连失败（沙箱常见），**改用 WebFetch 工具**（走不同网络路径）获取原文，不可因 curl 失败就改用其他来源凑数。

### 6.6.2 内置页与独立页「双入口」来源一致性（v4.4 · 第 14 期教训）
- **工作台有两条展示路径，必须同时改对**：
  1. **内置页**（`index.html`）：运行时通过 `<script src="./refine_data.js" defer>` 加载索引 `REFINE_PACKS`，再按 `currentRefineDate` 动态 fetch `articles/data/<date>.js` 渲染正文。**内置页的「来源名 + sourceUrl」取自 `refine_data.js` 的 `sources[]`，正文取自 `articles/data/<date>.js`。**
  2. **独立页**（`articles/<date>.html`）：数据内联，`<h2>` 标题与 `.source-cta` 的 href 硬编码在 HTML 中。
- **致命坑（第 14 期实测）**：只改了本地 `refine_data.js` 但**漏推送**，导致内置页线上仍跳旧来源（Japan Times）。教训：**任何本地改动的文件都必须逐个确认已推送到线上**，不能"以为改过了"。
- **强制校验**：每期推送后，必须**分别核对**以下三处的四个等级（A1/A2/B1/B2）来源名 + sourceUrl **逐字一致**：
  1. `refine_data.js` 中该期 `sources[level].source` / `.sourceUrl`
  2. `articles/<date>.html` 中 `.source-cta` 的 href 与可见来源名
  3. `articles/data/<date>.js` 的正文主题与上述来源相符
- **校验脚本**：用正则抽取两处的 sourceUrl 做全等比对（含 A1/A2/B1/B2 四级），不一致即报错拦截，禁止发布。
- **内置页默认展示期**：由 `currentRefineDate` 决定（优先取 `REFINE_PACKS` 中最新 key），推送新期后内置页会自动切到最新期，无需改 `index.html`。

### 6.7 内容质量
- A1 文章：日常生活场景，词汇基础，句式简单，10 段
- A2 文章：社会生活，引入简单时态变化，10 段
- B1 文章：社会/经济议题，复合句，含数据/引语，**≥18 段**（v4.3）
- B2 文章：深度分析/争议话题，学术词汇，多观点呈现，**≥20 段**（v4.3）
- 来源优先选择：DELE Ahora（A1/A2）→ RTVE（A2/B1）→ BBC Mundo（B1/B2）→ El País（B2）

### 6.7.1 B1/B2 阅读题难度要求（v4.3 更新）
- **B2 难题占比提升**：B2 每篇 8 题中，**至少 4 题必须为难题**（难题率 ≥ 4/8 = 50%），较 v4.2 的"B1+B2 合计 16 题至少 4 题"大幅提升
- **B1 难题要求**：B1 每篇 8 题中，至少 2 题为难题（难题率 ≥ 2/8 = 25%）
- **难题标准**：必须出现以下至少一种能力考查，不能仅考查字面信息定位：
  - **推理判断**：根据段落信息推断作者态度、隐含结论或未来趋势
  - **观点辨析**：区分不同人物/机构的观点，或识别反方论点
  - **长句/复合句理解**：涉及虚拟式、条件式、关系从句、倒装等复杂语法结构
  - **跨段落综合**：答案需要整合两段或以上信息（B1/B2 段落数增加后跨段综合尤为重要）
  - **词汇深度**：考查一词多义、学术词汇、语境义辨析（非简单词典释义）
- **A1/A2 保持基础**：以段落直接定位和简单同义替换为主，不盲目加难
- **hardWords 与难题匹配**：B1/B2 的 hardWords 应包含难题答案所依赖的高阶词汇，确保词汇学习→阅读挑战形成闭环
- **B1/B2 段落数量要求（v4.3 新增）**：
  - B1 ≥ 18 段（原 15 段），为跨段落综合题提供更丰富的信息源
  - B2 ≥ 20 段（原 15 段），为深度分析、多观点对比提供充足文本基础
- **B1/B2 难词分析细化（v4.3 新增）**：
  - B1/B2 的 hardWords 每项除 `w`（难词）和 `m`（释义）外，必须包含：
    - `ejemplo`：该难词的西语例句（优先取自原文段落，可补充）
    - `analisis`：详细分析（至少 2-3 句话），涵盖以下 ≥2 项：
      - 词源/词根词缀解析
      - 常见搭配与用法（搭配的介词、名词、动词等）
      - 语法行为（性数变化、变位特点、格关系等）
      - 语境义辨析（在该文章语境中的特定含义 vs 词典义）
      - DELE 考查角度（该词在 DELE B1/B2 中常考的用法）
      - 易混淆词对比（形近词/近义词辨析）
  - A1/A2 的 hardWords 保持原有 `{w, m}` 结构不变
  - B1/B2 难词数量建议各 ≥6 个（原 5 个），以匹配增加的段落和难题

---

## 六之二、v4.3 变更记录（2026-08-16）

> **自第 14 期（2026-08-20）起生效。** 第 13 期（2026-08-16）仍按 v4.2 标准执行。

### 6.7.2 B1/B2 段落数量提升
| 等级 | v4.2（旧） | v4.3（新） | 变更原因 |
|---|---|---|---|
| B1 | 15 段 | **≥18 段** | 为跨段落综合题提供更丰富的信息源；B1 文章需包含更多数据引用和趋势分析 |
| B2 | 15 段 | **≥20 段** | 为深度分析、多观点对比、专家引语提供充足文本基础；B2 文章需展示更复杂的论证结构 |

- A1/A2 段落数不变（各 10 段）
- 段落数增加后，`vm.runInNewContext` 验证断言相应更新：B1 `paragraphs.length >= 18`、B2 `paragraphs.length >= 20`

### 6.7.3 B2 难题占比提升
| 指标 | v4.2（旧） | v4.3（新） |
|---|---|---|
| 难题要求 | B1+B2 合计 16 题中 ≥4 题难题 | **B2 单独 8 题中 ≥4 题难题**（50%） |
| B1 难题要求 | 包含在合计中 | B1 8 题中 ≥2 题难题（25%） |
| 总难题数 | ≥4/16 | ≥6/16（B2 ≥4 + B1 ≥2） |

- 难题标准不变（推理判断/观点辨析/长句复合句/跨段落综合/词汇深度）
- B2 段落数增加至 ≥20 段后，跨段落综合题的出题空间更大，应充分利用

### 6.7.4 B1/B2 难词分析细化
- **A1/A2 hardWords**：保持 `{w, m}` 结构（5 个）
- **B1/B2 hardWords**：扩展为 `{w, m, ejemplo, analisis}` 结构（各 ≥6 个）
  - `ejemplo`：西语例句（优先取自原文，可补充）
  - `analisis`：详细分析（≥2-3 句话），涵盖词源/搭配/语法/语境义/DELE 考点/易混淆词中的 ≥2 项
- **HTML/DOCX 渲染适配**：
  - 独立 HTML 页面的 `hardWords` 渲染函数需兼容新字段：有 `ejemplo`/`analisis` 时展开显示，无时保持原样（向后兼容旧期数据）
  - DOCX 生成脚本需为 B1/B2 难词增加例句和分析行
- **JSON.stringify 内联**：新字段通过 `JSON.stringify` 自动序列化，无需特殊处理引号

---

## 六之三、第 11 期实战修订（2026-08-12）

> 本节收录 8.11（第10期）和 8.12（第11期）两轮实战中发现的问题与修复方案，是 **v3.2 → v4** 的核心升级依据。**所有自动化生成流程必须严格遵守本节规则。**

### 6.8 HTML 数据内联引号安全（最高优先级）
- **问题**：8.11 独立 HTML 曾因数据字段值内含未转义的 ASCII 双引号 `"`（U+0022）导致 `missing ) after argument list` JS 语法错误，页面无法打开。
- **根因**：人工手写/拼接 HTML 内联数据时，`zh`/`es`/`m` 等字段中的英文引号与 JS 字符串分隔符冲突，破坏了字符串字面量。
- **禁止的修复方式**（已踩坑，勿再尝试）：
  - `rfind('"')` 跨字段匹配 → 会误改 `es` 字符串边界
  - 正则 `([^"]*)` → 在第一个内部引号处截断
  - 逐行扫描 → 无法区分内容引号和分隔符引号
- **唯一可靠方案（必须采用）**：
  1. 先在独立数据文件 `articles/data/<date>.js` 中**生成并验证数据**（该文件用 `window.WORDS`/`window.ARTICLES` 结构）
  2. 用 `node -e` + `vm.runInContext` 提取数据为 JSON 对象
  3. 用 **`JSON.stringify`** 将 WORDS/ARTICLES 序列化为内联数据，插入 HTML 的 `<script>` 中
  4. `JSON.stringify` 会自动把 ASCII `"` 转义为 `\"`，天然保证 JS 语法正确，**无需手工处理引号**
- **验证**：`node -e "new Function('<script>内容</script>')"` 检查整个 script 块语法；再 `vm.runInContext` 验证数据完整（15词 + 4级段/题数）。

### 6.9 期号连续性与索引覆盖防护（防止覆盖前期）
- **问题**：曾出现 8.10（第9期）索引条目缺失、8.11 被误标为第9期，导致期号错乱。
- **在线期号计算（必须）**：生成前**强制读取线上 `refine_data.js`**，找到当前最大 issue 编号，新期号 = `max + 1`。禁止凭本地记忆或猜测。
- **期号校验（推送前）**：用 `vm.runInContext` 读取 `window.REFINE_PACKS`，断言期号从最新到最旧严格递减且连续（如 11,10,9,...,1）。任何断裂/跳号都视为错误，不得推送。
- **索引覆盖防护**：新日期条目**只插入 `REFINE_PACKS` 最前面**，绝不删除/覆盖任何已存在的前期条目。推送 `refine_data.js` 前必须带上**线上最新 SHA**（先 `GET` 拿 sha，再 `PUT` 带 sha），避免并发覆盖。
- **日期对应期号对照**（防错参考）：08-02(1) … 08-10(9) 08-11(10) 08-12(11)。weekday 同步核对：08-12 为星期三。

### 6.10 模板复用与 HTML 生成
- **禁止**：不要手工从零写 HTML，更不要沿用旧版（v1/v2）模板——旧模板用 `var QuizData = (function(){})()` 结构且无完整 QuizData 持久化，易产生语法错误、功能缺失。
- **必须**：以**最近一期已验证可用的 v3 模板**（如 `2026-08-11.html`，含完整 QuizData、swa_quiz_v1 持久化、渲染函数）为基准，复制后仅替换：
  - `<title>` / topbar h1 / topbar sub（期号、星期、4主题）
  - 4 篇文章的 `<h2>` 标题、`.source-cta` 的 href 来源链接
  - footer 日期、`articles/<date>.docx` 链接
  - WORDS / ARTICLES 数据块（用 6.8 的 JSON.stringify 方案）
- **完成后**：用 playwright/chromium 无头渲染实际打开页面，断言 `JS 运行时错误数 = 0`、词汇卡 = 15、各级段落/题目数正确。**这一步是"页面能否打开"的最终裁决。**

### 6.11 推送与 GitHub Pages 部署验证
- **token 必须显式传入**：沙箱中 `GH_TOKEN` 环境变量通常为空，需在命令中直接写入 PAT，或用 `export GH_TOKEN="<pat>"` 后调用 API。
- **认证检查**：先 `GET` 仓库某个已知文件（如 `refine_data.js`）拿到 sha；若返回 `Bad credentials`(401)，说明 token 未生效，先修复再继续。
- **新文件 / 更新文件**：
  - 新增文件（data JS、HTML、DOCX）：`PUT` 不带 sha
  - 更新已有文件（refine_data.js）：`PUT` 必须带线上 sha，否则报 409 冲突
- **GitHub Pages 部署延迟**：推送后 Pages 自动构建，**约 1-2 分钟**。期间访问新页面返回 404（"Page not found"）是**正常现象**，需等待构建状态变为 `built`/`deployed` 后再验证。
  - 检查构建状态：`GET /repos/<repo>/pages/builds/latest` 的 `status` 字段
  - 不要因 404 就误判推送失败而重复推送（会产生冲突）
- **DNS 处理**：
  - API：`api.github.com` → hosts 已配 `140.82.121.5`
  - Pages：`*.github.io` 也需 `--resolve <host>:443:185.199.108.153`（或 185.199.109.153/110/111），否则 curl 返回 000
- **最终验证**：线上页面 `curl` 应返回 200，且 grep 到正确 title / 期号 / 主题文字；DOCX、data JS 同样返回 200。

### 6.12 数据字段结构对齐（v3 模板）
- 独立页面内联数据与工作台内置页面的数据文件**结构一致**：`WORDS` 数组项为 `{lema, ipa, pos, significado, ejemplo_es, ejemplo_zh, tip}`；`ARTICLES[level]` 为 `{paragraphs[{es,zh}], dele, hardWords, quiz[{q,opts,ans,es,zh}]}`。
- **hardWords 结构分等级（v4.3）**：
  - A1/A2：`hardWords[{w, m}]`（仅难词+释义，5 个）
  - B1/B2：`hardWords[{w, m, ejemplo, analisis}]`（难词+释义+西语例句+详细分析，≥6 个）
- 文章标题、来源名、来源链接**不内嵌在数据中**，而是硬编码在 HTML 的 `<h2>` 与 `.source-cta` 中，替换模板时需一并更新。
- level key 必须小写（`a1`/`a2`/`b1`/`b2`），与 `swa_quiz_v1` 存储键一致。

---

## 七、快速参考

### 文件结构
```
siele-workbench/
├── articles/
│   ├── data/
│   │   └── YYYY-MM-DD.js        # 原始数据（工作台内置页面外部引用用）
│   ├── YYYY-MM-DD.html           # 独立页面（数据内联，v3 模板）
│   └── YYYY-MM-DD.docx           # Word 文档
├── devext/
│   ├── gen_docx_YYYYMMDD.py      # DOCX 生成脚本（python-docx）
│   └── patch_quiz_persistence.py # 批量补丁脚本（给旧 HTML 注入 QuizData）
├── refine_data.js                # 索引文件（所有期号元数据 + loadRefineData）
├── index.html                    # 工作台主页面（含 RefineQuizDB + TTS 发音体系）
├── admin.html                    # 管理后台（含云同步 serializeCloud + mergeQuizzes）
└── .codebuddy/
    └── automation.md             # 本文件
```

### GitHub API 上传模板
```bash
# 认证
echo "<TOKEN>" | gh auth login --with-token

# 获取文件 SHA（如已存在）
gh api repos/celina0503qq-lab/siele-workbench/contents/<path> --jq '.sha'

# 构建 base64 payload 并上传
python3 -c "
import json, base64
with open('<file>', 'rb') as f:
    content = base64.b64encode(f.read()).decode()
payload = {'message': 'commit msg', 'content': content, 'sha': '<sha>'}
with open('/tmp/payload.json', 'w') as f:
    json.dump(payload, f)
"
gh api -X PUT repos/celina0503qq-lab/siele-workbench/contents/<path> \
  --input /tmp/payload.json
```

### swa_quiz_v1 数据流
```
独立 HTML 页面                    工作台内置页面
    │                                  │
    ▼                                  ▼
QuizData.saveNotes()           _setRefineNote()
QuizData.recordAnswer()         RefineQuizDB.recordAnswer()
    │                              submitRefineQuiz()
    │                                  │  + autoLogLowScore() → 错题集
    │                                  │
    └──────────┬───────────────────────┘
               ▼
        localStorage['swa_quiz_v1']
               │
               ▼
      admin.html serializeCloud()
               │
               ▼
      云端 (GitHub Gist / Gitee / CloudBase)
               │
               ▼
      另一台设备 mergeData() → mergeQuizzes()
               │
               ▼
      localStorage['swa_quiz_v1'] (合并后)
```

---

## 六之四、第 14 期实战修订（2026-08-20 · v4.4）

> 本节收录第 14 期（2026-08-20）生成后用户反馈的问题与修复，是 **v4.3 → v4.4** 的核心升级依据。**自第 15 期起必须严格执行。**

### 6.13 阅读题语言规范（最高优先级，本次最大教训）

- **问题**：第 14 期把 A1–B2 所有阅读题的题干 `q` 和选项 `opts` 写成了**中文**，违反\u201C题干/选项纯西语\u201D的既定规范。
- **正确规范（必须）**：
  - **题干 `q`**：纯西语（问句用 `¿...?`，陈述式用完整西语句）
  - **选项 `opts`**：纯西语（4 个西语选项）
  - **解析 `es` + `zh`**：中西混合——`es` 用西语写解析，`zh` 用中文写解析
  - **解析必须定位回原文**：`es`/`zh` 中必须标注**段落号**（如 `(párrafo 5)` / `原文第 5 段`），并引用原句（用引号 `\u201C...\u201D` 包裹）
- **A1/A2 同样适用**：A1/A2 入门级也不例外，题干/选项也纯西语；A1/A2 的题干用最简西语（如 `¿Qué mete Carmen en las maletas?`），靠解析的中西对照帮助理解，**不得因\u201C怕入门者看不懂\u201D而退回中文题干**。
- **禁止的写法**：
  - ~~题干/选项写中文~~ ❌
  - ~~题干末尾加中文标记如\u201C（难题：推理判断）\u201D~~ ❌（难题的考查维度应写在 `zh` 解析末尾，如\u201C此题考查推理判断\u201D，而非题干里）
  - ~~解析不标段落号、不引用原句~~ ❌
- **验证方法**：生成后用正则 `[\u4e00-\u9fff]` 断言 `q` 和 `opts` 中**不含任何中文字符**；`es`/`zh` 允许中文但须含段落号。

### 6.14 B1/B2 难词数量提升

- **问题**：v4.3 规定 B1/B2 难词\u201C各 ≥6 个\u201D，第 14 期只做了 6 个，用户反馈\u201C太少\u201D。
- **新规范（必须）**：B1/B2 难词数量**各 8–10 个**（第 14 期最终定为各 10 个，与第 13 期对齐）。
- **与段落/难题的匹配**：B1 18 段、B2 20 段，难词 10 个能更好覆盖难题所依赖的高阶词汇，形成\u201C词汇学习→阅读挑战\u201D闭环。
- **A1/A2 不变**：仍各 5 个 `{w, m}`。

### 6.15 验证脚本的期望值要同步更新

- **问题**：第 14 期把难词从 6 加到 10 后，浏览器渲染验证脚本里 `.hw-item` 的期望值仍写死为 `12`（6+6），导致\u201C误报失败\u201D。
- **教训**：当数据规模参数（难词数、段落数、题目数）调整时，**验证脚本的期望值必须同步更新**，避免把正确结果判为失败。建议验证脚本从数据 JS 动态读取期望值，而非硬编码。

### 6.16 v4.4 检查清单补充

在原有 33 项检查清单基础上，**新增/强化**以下项：

| # | 检查项 | 类别 |
|---|---|---|
| 34 | **题干 `q` 纯西语（无中文字符）** | 数据 |
| 35 | **选项 `opts` 纯西语（无中文字符）** | 数据 |
| 36 | **解析 `es`/`zh` 含段落号 + 引用原句** | 数据 |
| 37 | **B1/B2 难词各 8–10 个（非仅 6 个）** | 数据 |
| 38 | **难题考查维度标注在 `zh` 解析，不在题干 `q`** | 数据 |
| 39 | **B1/B2 选文必须取自 El País / BBC Mundo 等西语媒体原文，禁用他语种媒体（v4.4 第 14 期教训）** | 数据 |
| 40 | **「尽量不改原文」= 真实链接 + 真实原文事实 + 按难度分级尽量不大改** | 数据 |
| 41 | **curl 因 TLS 直连失败时改用 WebFetch 获取原文，不可因此换用其他来源** | 数据 |
| 42 | **内置页 + 独立页四等级 sourceUrl 逐字一致（refine_data.js 必须实际推送，不能只改本地）** | 数据 |

---

*最后更新：2026-08-20 · v4.4：阅读题题干/选项纯西语 + 解析定位原文（标段落号）+ B1/B2 难词提升至 8–10 个 + B1/B2 选文来源硬约束（El País/BBC Mundo 真实原文）+ 内置页/独立页双入口来源一致性校验 · 基于 v4.3 演进*
