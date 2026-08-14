---
name: siele-daily-refine-pack
description: SIELE 工作台外刊精炼推送流程 v4.2 — 每 4 天一期 · 15 词 + 4 篇分级精读 (A1:10段5题/A2:10段5题/B1:15段8题/B2:15段8题，共26题) + Word 下载 + 在线阅读 + 原文链接, 落到 GitHub Pages siele-workbench-deploy/articles/<date>/。含 B1/B2 难度要求(≥25%难题率)、期号连续性防护、HTML 内联 JSON.stringify 引号安全、模板复用、两种推送方式(git push / gh CLI)
read_when:
  - 用户要求生成西语外刊精炼推送
  - 自动化 (每 4 天 09:00) 推送触发
  - 需要把外刊内容接入 📚外刊精炼 菜单
  - 排查外刊期号错乱 / 引号语法错误 / 推送 404 / 链接失效
---

# SIELE 外刊精炼推送 (Daily Refine Pack) v4.2

> 权威源：`automation.md`（v4.2, 2026-08-13）。本 skill 是其执行版，冲突时以 v4.2 为准。

## 调度安排

- **频率**：每 4 天一期（自 2026-08-13 起）
- **时间**：每 4 天 **09:00**（Asia/Shanghai），cron `0 0 9 */4 * *`
- **自动化任务**：rrule `FREQ=DAILY;INTERVAL=4;BYHOUR=9;BYMINUTE=0`
- **期号**：严格"在线读 refine_data.js 最大 issue + 1"，按实际推送次数递增，不按自然周
- **手动触发**：临时 once 任务或手动执行生成流程（仍须遵守全部安全规则）

## 模块概述（每期产出）

| 部分 | 数量 | 说明 |
|---|---|---|
| 高频词 | 15 个 | 生活/职场/时事，含 IPA/释义/双语例句/记忆提示 |
| A1 精读 | 10 段 / 5 题 | 入门，陈述式现在时为主 |
| A2 精读 | 10 段 / 5 题 | 基础，现在完成时/简单过去时 |
| B1 精读 | 15 段 / **8 题** | 进阶，虚拟式+条件式+复合句 |
| B2 精读 | 15 段 / **8 题** | 高级，议论文体+学术词汇 |

合计 **26 题**（5+5+8+8）。每篇含原文链接、DELE 考点、难词清单、**做题持久化 + 笔记**。

## 一键生成流程（6 步）

### 第 1 步：确认日期 / 星期 / 期号 / 主题
- 日期 `YYYY-MM-DD`；星期中文（一~日）
- **期号必须在线读 `refine_data.js` 最大 issue + 1**（禁止凭记忆）
- 4 主题方向：A1 生活场景 → A2 文化/社会 → B1 经济/科技 → B2 深度分析/争议

### 第 2 步：生成数据 JS（`articles/data/<date>.js`）
数据格式见下方「数据 Schema」。**关键约束**：
- `zh` 值含中文引号 `""` 必须 `\u201C`/`\u201D` 转义
- 用 `node -e "new Function(fs.readFileSync(...))"` 验证语法
- 用 `vm.runInNewContext` 验证：15 WORDS + A1(10p/5q) + A2(10p/5q) + B1(15p/8q) + B2(15p/8q)

### 第 3 步：生成独立 HTML（`articles/<date>.html`）
**用最近一期已验证的 v3 模板为基准**（如 `2026-08-11.html`），复制后仅替换 title/topbar/4 篇 h2/来源链接/footer 日期/数据块。**禁止手工从零写 HTML，禁止沿用 v1/v2 模板。**

**HTML 数据内联引号安全（最高优先级，v4.2 核心）**：
- 唯一可靠方案：先独立 `data/<date>.js` 生成验证数据 → `node` + `vm.runInContext` 提取 JSON → **`JSON.stringify`** 序列化插入 `<script>`。JSON.stringify 自动转义 `"` 为 `\"`，无需手工处理引号
- 禁止 rfind / 正则 `([^"]*)` / 逐行扫描（都会误改 es 字符串边界）
- 完成后用 Playwright 无头渲染，断言 JS 运行时错误=0、词汇卡=15、各级段/题数正确

### 第 4 步：生成 DOCX（`articles/<date>.docx`）
python-docx 生成：标题/15 词/4 篇中西对照/DELE 考点/难词/阅读题。原文链接用**真实 `<w:hyperlink>` XML**（见下）。

### 第 5 步：更新索引 `refine_data.js`（期号连续性防护）
- 新日期条目**只插入 `REFINE_PACKS` 最前面**，绝不删除/覆盖任何已有条目
- 推送前 `vm.runInContext` 断言期号从新到旧**严格递减且连续**（如 11,10,9,...,1），断裂/跳号不得推送
- 推送 `refine_data.js` 前先 GET 拿线上 sha，再 PUT 带 sha，避免并发覆盖

### 第 6 步：推送（两种方式，按环境选）

**方式 A：本机 git push**（用户手动生成时）：
```bash
cd siele-workbench-deploy
git status --short   # 必跑！?? 文件立即 add
git add articles/data/<DATE>.js articles/<DATE>.html articles/<DATE>.docx refine_data.js
git -c user.name='celina0503qq-lab' -c user.email='celina0503qq-lab@users.noreply.github.com' \
  commit -m "refine: <DATE> 第N期"
GIT_TERMINAL_PROMPT=0 git -c credential.helper= push origin main
```

**方式 B：沙箱自动化 gh CLI + GitHub Contents API**（自动化任务环境）：
- token 必须显式传入（沙箱 `GH_TOKEN` 常为空）：`export GH_TOKEN="<pat>"`
- 认证检查：先 GET 已知文件拿 sha，401 Bad credentials 说明 token 未生效
- 新增文件 PUT 不带 sha；更新 `refine_data.js` PUT 必须带线上 sha（否则 409）
- DNS：API 走 `api.github.com`（hosts 配 `140.82.121.5`）；Pages 校验 `--resolve <host>:443:185.199.108.153`
- GitHub Pages 延迟 1-2 分钟，期间 404 正常，查 `/repos/<repo>/pages/builds/latest` 的 status

推送后等 60s CDN，curl 验证 200。

## B1/B2 阅读题难度要求（v4.2 新增，必须遵守）

- B1/B2 各 8 题，合计 16 题，**至少 4/16 难题率（≥25%）**
- 难题标准（至少一种，不能只考字面定位）：
  1. 推理判断（作者态度/隐含结论/未来趋势）
  2. 观点辨析（区分不同人物/机构观点，识别反方论点）
  3. 长句/复合句理解（虚拟式/条件式/关系从句/倒装）
  4. 跨段落综合（整合两段以上信息）
  5. 词汇深度（一词多义/学术词汇/语境义辨析）
- A1/A2 保持基础（段落直接定位 + 简单同义替换），不盲目加难
- B1/B2 的 hardWords 应包含难题答案依赖的高阶词汇，形成词汇→阅读闭环

## 原文链接准确性（用户会问，硬性）

- `sourceUrl` 指向**实际文章页**，禁填首页/频道页/列表页
- 生成时必须 `curl -s -o /dev/null -w "%{http_code}" <url>` 验证 **200**；404/403/301 跳首页不可用
- 付费墙（El País 等）可填但标"可能需要订阅"
- 同一篇原文不得跨等级复用；临时无可用链接则 `sourceUrl=""` 留空（前端降级显示来源名），**不可编造**
- 来源偏好：DELE Ahora（A1/A2）→ RTVE（A2/B1）→ BBC Mundo（B1/B2）→ El País（B2）
- 链接必现 3 处：工作台 refine 卡片 `.refine-source-cta` / HTML 文章 header `.source-cta` / DOCX 真实 `<w:hyperlink>`

## 数据 Schema（`articles/data/<date>.js`）

```js
window.__REFINE_DATE__ = "YYYY-MM-DD";
window.WORDS = [
  { lema:"...", ipa:"[...]", pos:"m./f.", significado:"中文释义",
    ejemplo_es:"西语句子", ejemplo_zh:"中文翻译", tip:"记忆提示（含DELE考点/易混淆辨析）" }
  // 共 15 个
];
window.ARTICLES = {
  a1: { paragraphs:[{es:"",zh:""},...10], dele:"A1 考点:<b>...</b>",
        hardWords:[{w:"难词",m:"释义"},...], quiz:[{q:"问题(中文)",opts:["A","B","C","D"],ans:0,es:"西语解析",zh:"中文解析"},...5] },
  a2: { /* 同上，10段/5题 */ },
  b1: { /* 同上，15段/8题 */ },
  b2: { /* 同上，15段/8题 */ }
};
```
- level key 全小写 `a1/a2/b1/b2`
- 文章标题/来源名/链接**不内嵌数据**，硬编码在 HTML `<h2>` 与 `.source-cta`，替换模板时一并更新
- `dele` 字段兼容 string（HTML）或 array（chips）

## refine_data.js 索引模板

```js
window.REFINE_PACKS = {
  "<new date>": {   // 只插最前面，不覆盖
    date:"YYYY-MM-DD", weekday:"X", issue:N,
    theme:"A1主题 · A2主题 · B1主题 · B2主题",
    sources:[ {level:"A1",source:"来源名",sourceUrl:"https://...",topic:"文章主题"}, /* 4 个 */ ]
  },
  "<old date>": { /* 已存在条目绝不删除 */ }
};
```

## 颜色编码

A1=#2E7D32 绿 / A2=#1565C0 蓝 / B1=#C12A2A 红 / B2=#6A1B9A 紫

## Quiz 持久化与云同步（swa_quiz_v1）

- 存储键 `swa_quiz_v1`，独立页面 `QuizData` 与工作台 `RefineQuizDB` 对等共用
- **level key 必须全小写**（`a1/a2/b1/b2`），大小写不一致导致跨设备/跨页面数据不互通
- `attempts[0]` 恒为最新；重做时旧 attempt 标 `completed:true`，新 attempt 插头部
- `notes` 附 `notesTs`，云同步按 notesTs 取较新（mergeQuizzes）
- 笔记存 `quizzes[date][level].notes`；旧 `refine_notes_v1` 启动时自动迁移
- 云同步链路：serializeCloud 打包 swa_quiz_v1 → 云端 → mergeData/mergeQuizzes 合并 → 写回

## DOCX 真实超链接（python-docx）

```python
def add_hyperlink(paragraph, text, url, font_size=10, color="0066CC", bold=True, underline=True):
    part = paragraph.part
    r_id = part.relate_to(url, "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink", is_external=True)
    hyperlink = OxmlElement('w:hyperlink'); hyperlink.set(qn('r:id'), r_id)
    new_run = OxmlElement('w:r'); rPr = OxmlElement('w:rPr'); new_run.append(rPr)
    t = OxmlElement('w:t'); t.text = text; t.set(qn('xml:space'), 'preserve'); new_run.append(t)
    hyperlink.append(new_run); paragraph._p.append(hyperlink); return hyperlink
```
**验证用 Python zipfile**（Playwright fetch 读 docx 是二进制 ZIP，正则搜不到）：
```python
import zipfile, re
with zipfile.ZipFile('X.docx') as z:
    rels = z.read('word/_rels/document.xml.rels').decode()
    targets = re.findall(r'Target="(https?://[^"]+)"', rels)
    doc_xml = z.read('word/document.xml').decode()
    # target 数 == hyperlink 数 == 4
```

## 关键调试技巧

- nav 文本含 emoji → Playwright 用 `window.go('refine')` 走 SPA 路由
- GitHub Pages 404 → `node siele-test/probe_live_404.js`；未追踪文件 → `git status --short` 看 `??`
- 引号语法错误 → 用 6.8 的 JSON.stringify 方案，勿手工转义

## 工作台内置模块（index.html 内）

- `renderRefine()` 静态壳 + `renderRefineBody()` 异步（`loadRefineData(date)` → 渲染 15 词 + 4 篇 + 26 题）
- `selectRefineDate(d)` / `selectRefineLevel(l)` 切换；`_refineAutoLoad()` hook 包裹 renderMain
- `loadRefineData` 用 `__REFINE_CACHE` + `__REFINE_INFLIGHT` 缓存，动态 `<script>` 加载 `articles/data/<date>.js`
- TTS：`_bindRefineWordSpeak/_bindRefineParaSpeak/_bindRefinePlayAll/_bindRefineScore/_bindRefineRate`；`window.__refineSpeakRate/__refineSpeakQueue`
- 难词高亮：优先 `paragraphs[].vocab`，回退 `a.hardWords`；`\b` 词边界 + tooltip

## 验收标准（commit 前必查）

- [ ] 15 词卡完整 lemma/IPA/释义/例句/记忆提示
- [ ] 4 篇 10/10/15/15 段，26 题（5/5/8/8），B1/B2 难题率 ≥25%
- [ ] 4 个真实原文链接 curl 200（无则留空不编造）
- [ ] 期号在线读 max+1，REFINE_PACKS 严格递减连续，只插最前不覆盖
- [ ] HTML 数据 JSON.stringify 内联，Playwright 渲染 0 JS 错误
- [ ] 1 docx 下载 + 1 html 在线阅读链接
- [ ] `git status --short` 无 untracked；E2E 0 4xx + 菜单 PASS
- [ ] commit message 含日期
