---
name: siele-daily-refine-pack
description: SIELE 工作台外刊精炼推送流程 v4.5 完整执行版 — 每 4 天一期（自动化 siele-v3 触发，也可手动触发）· 15 词 + 4 篇分级精读 (A1:10段5题/A2:10段5题/B1:≥18段8题/B2:≥20段8题，共26题) + Word 下载 + 在线阅读 + 原文链接，落到 GitHub Pages celina0503qq-lab.github.io/siele-workbench/articles/<date>/。硬性规范：题干/选项纯西语 + 解析标段落号、B1/B2 每段 35-50 词、B1/B2 难词 8-10 个含 ejemplo+analisis、B2 难题 ≥4/8 + B1 ≥2/8（此题考查…标签机器校验）、B1/B2 禁取材 RTVE（El País/BBC Mundo/官方专页）、内置页/独立页来源一致性、认证用 ~/.config/gh/hosts.yml oauth_token（禁明文 token/gh CLI/fine-grained PAT）、期号在线计算、HTML JSON.stringify 内联、四重验证、4 文件推送缺一不可
read_when:
  - 用户要求生成西语外刊精炼推送（手动触发）
  - 自动化 (每 4 天 00:00) 推送触发
  - 需要把外刊内容接入 📚外刊精炼 菜单
  - 排查外刊期号错乱 / 引号语法错误 / 推送 404 / 链接失效 / 来源错误 / 段落过短 / 难词过少 / 题干中文
---

# SIELE 外刊精炼推送 (Daily Refine Pack) v4.5 完整执行版

> **权威源**：仓库 `.codebuddy/automation.md`（v4.5, 2026-08-20）。本 skill 是可直接执行的浓缩版，两者冲突时以 automation.md 为准。
> **双触发**：① 自动化任务 `siele-v3`（id=5100839，cron `0 0 0 */4 * *` 即每 4 天 00:00 Asia/Shanghai）② 用户手动要求「生成 X 月 X 号外刊精炼」。
> **仓库**：`celina0503qq-lab/siele-workbench`（GitHub Pages: `celina0503qq-lab.github.io/siele-workbench/`）。

---

## 一、模块概述（每期产出）

| 部分 | 数量 | 说明 |
|---|---|---|
| 高频词 | **15 个** | 生活/职场/时事，含 IPA/释义/中西双语例句/记忆提示 |
| A1 精读 | 10 段 / 5 题 | 入门，陈述式现在时为主，段落直接定位 |
| A2 精读 | 10 段 / 5 题 | 基础，现在完成时/简单过去时 |
| B1 精读 | **≥18 段** / 8 题 | 进阶，虚拟式+条件式+复合句，含数据/引语 |
| B2 精读 | **≥20 段** / 8 题 | 高级，议论文体+学术词汇，多观点呈现 |

合计 **26 题**（5+5+8+8）。每篇含：原文链接（`.source-cta`）、DELE 考点分析、难词清单、阅读题（纯西语题干/选项 + 中西双语解析）、做题持久化 + 笔记（`swa_quiz_v1`）。

---

## 二、v4.5 硬性规范（自第 15 期起强制，违反即返工）

1. **题干 q / 选项 opts 必须纯西语**（A1–B2 全部等级），禁止中文题干/选项。解析 `es`/`zh` 中西混合，且必须标注段落号（`párrafo N` / `原文第 N 段`）并引用原句（引号 `\u201C...\u201D` 包裹）。
   - 验证：正则 `[\u4e00-\u9fff]` 断言 `q` 和 `opts` 无中文字符。
2. **B1/B2 每段西语 35–50 词**（用户明确指示）：**不要为了扩写而扩写**，35 词左右是正常水平；也不得为凑段数把长段拆成单句短段（第 14 期拆段教训）。
   - 验证：`段落 es.trim().split(/\s+/).length` 断言每段 ∈ [35, 50]。A1/A2 无此硬要求。
3. **B1/B2 难词各 8–10 个**，每项含 `w`/`m`/`ejemplo`（西语例句，优先取自原文）/`analisis`（详细分析 ≥2-3 句，涵盖词源、搭配、语法行为、语境义、DELE 考点、易混淆词中 ≥2 项）。A1/A2 保持 `{w, m}` 结构 5 个。
   - 难词必须在正文中自然出现（校验：`paragraphs.es` 拼接后 includes 每个难词）。
4. **难题率**：B2 ≥ 4/8（50%）、B1 ≥ 2/8（25%）。难题的 `zh` 解析末尾必须带固定标签：`此题考查推理判断` / `此题考查观点辨析` / `此题考查长句理解` / `此题考查跨段落综合` / `此题考查词汇深度`（**标签只能出现在 zh 解析里，禁止写进题干**）。
   - 验证：正则 `此题考查(推理判断|观点辨析|长句理解|跨段落综合|词汇深度)` 统计，断言 B2≥4、B1≥2。
   - 难题标准：推理判断（作者态度/隐含结论/趋势）/ 观点辨析（区分多方立场）/ 长句复合句（虚拟式/条件式/关系从句/倒装）/ 跨段落综合（整合两段以上）/ 词汇深度（一词多义/学术词/语境义）。
5. **B1/B2 禁取材 RTVE**（RTVE 链接长期只有频道页/列表页、溯源链接没有明确指向）。B1/B2 来源优先级：**El País 原文 > BBC Mundo 原文 > 官方机构/计划专页（如 IDAE）> 其他西语新闻媒体**。**严禁他语种媒体**（如 Japan Times，第 14 期曾误用被纠正）。
6. **内置页 + 独立页来源一致性**：`refine_data.js` 的 `sources[].sourceUrl` 与独立页 `.source-cta` href 必须逐字一致（A1/A2/B1/B2 四级），且 **refine_data.js 必须实际推送到线上**（不能只改本地，第 14 期曾因此内置页仍跳旧来源 Japan Times）。
7. **sourceUrl 必须可打开且内容与正文对应**：首页/频道页/列表页禁止；官方公告/计划专页（如 IDAE 的 `programa-energias-renovables-innovadoras`）可作为合法来源；无法找到时 `sourceUrl=""` 留空，**不可编造**。

---

## 三、完整执行流程（8 步）

### 第 1 步：确认日期 / 星期 / 期号 / 主题
- 日期 = 触发当天（`YYYY-MM-DD`）；星期中文（一~日）
- **期号必须在线读线上 `refine_data.js` 最大 issue + 1**（禁止凭记忆/猜测）
- 4 主题方向：A1 生活场景 → A2 文化/社会 → B1 经济/科技趋势（含数据引用）→ B2 深度分析/争议话题（含专家引语）

### 第 2 步：取材原文（内容多、可打开的链接）
- **B1/B2**：用 `WebFetch`（沙箱 curl 直连 El País/BBC 常 TLS 失败，WebFetch 走不同网络路径可用）打开候选文章，确认：① 返回 200 ② 正文确为该主题 ③ 内容足够（≥10 个事实点/数据/引语），再定稿选材
- **B1/B2 禁 RTVE、禁非西语媒体**；优先 El País > BBC Mundo > 官方专页（IDAE 等）
- **A1/A2**：DELE Ahora / RTVE 具体文章页（非频道页）
- **「尽量不改原文」**：真实链接 + 真实原文事实 + 按难度分级改写，尽量不大改原意、数据、引语、机构名

### 第 3 步：生成数据 JS（`articles/data/<date>.js`）
格式见「五、数据 Schema」。约束：
- B1/B2 每段西语 35–50 词；quiz 的 q/opts 纯西语；es/zh 解析标段落号引用原句；难题 zh 带标签；B1/B2 hardWords 各 8–10 含 ejemplo/analisis
- `zh` 值含中文引号 `""` 必须转义为 `\u201C`/`\u201D`
- 语法校验：`node -e "new Function(fs.readFileSync('articles/data/<date>.js','utf8'))"`
- 数据校验（vm）：15 WORDS + A1(10p/5q) + A2(10p/5q) + B1(≥18p/8q) + B2(≥20p/8q) + 每段 35-50 词 + 纯西语 + 难题标签数 + 难词数 + 难词在正文出现

### 第 4 步：生成独立 HTML（`articles/<date>.html`）
- **以最近一期已验证的 v3 模板为基准**（如 `2026-08-20.html`）复制，仅替换：title / topbar h1+sub（期号、星期、4 主题）/ 4 篇 `<h2>` 标题 / `.source-cta` href / footer 日期 / `articles/<date>.docx` 链接 / WORDS+ARTICLES 数据块
- **数据内联必须用 JSON.stringify**（最高优先级，第 11 期踩坑）：
  1. 先在 data JS 生成并验证数据
  2. `node -e` + `vm.runInContext` 提取 WORDS/ARTICLES 为 JSON
  3. `JSON.stringify` 序列化插入 `<script>`（自动转义 `"` 为 `\"`）
  4. **禁止** rfind / 正则 `([^"]*)` / 逐行扫描 / 手工拼接
- hardWords 渲染兼容 ejemplo/analisis 字段（有则展开，无则兼容旧数据）

### 第 5 步：生成 DOCX（`articles/<date>.docx`）
python-docx：标题副标题（日期/期号/主题）/ 15 词（含 IPA/释义/例句/提示）/ 4 篇中西对照 / DELE 考点 / 难词（B1/B2 含例句+分析）/ 阅读题（题目+选项+答案+解析）。原文链接用真实 `<w:hyperlink>`（代码见「八」）。

### 第 6 步：更新索引 `refine_data.js`（期号连续性防护）
- 新日期条目**只插入 `REFINE_PACKS` 最前面**，绝不删除/覆盖任何已有条目
- `sources` 四等级 `source/sourceUrl/topic` 与独立页 `.source-cta` 逐字一致
- 推送前 `vm.runInContext` 断言期号从新到旧**严格递减且连续**（14,13,...,1），断裂/跳号不得推送

### 第 7 步：四重验证（推送前必做）
1. **JS 语法**：HTML 每个 `<script>` 块 `new Function()` 通过
2. **数据完整性**：vm 验证 15 词 + 4 级段/题数 + 每段 35-50 词 + 难词 8-10 含字段 + 题干/选项纯西语 + 难题标签数达标
3. **期号连续性**：REFINE_PACKS 严格递减连续
4. **浏览器渲染**：playwright/chromium 无头打开 `file://` 页面，断言 JS 运行时错误数 = 0、词汇卡 = 15、各级段落/题目数正确、难词展开项数 = 难词总数（**期望值从数据动态读取，勿硬编码**——第 14 期曾因难词 6→10 后脚本期望仍写 12 而误报）

### 第 8 步：推送到 GitHub（Contents API）+ 验证部署

**认证（v4.4 修正，重要）**：
- **不要用 fine-grained PAT、不要依赖 gh CLI**（曾出现只读 403「Resource not accessible by personal access token」）
- **从 `~/.config/gh/hosts.yml` 的 `github.com.oauth_token` 读取 token**（有 contents:write，已验证）；回退环境变量 GH_TOKEN
- **禁止把 token 明文写进命令、脚本、git URL 或 commit message**

```python
# /tmp/push.py —— hosts.yml oauth_token + Contents API PUT
import subprocess, json, base64, yaml
TOKEN = yaml.safe_load(open("/root/.config/gh/hosts.yml"))["github.com"]["oauth_token"]
RESOLVE = ["--resolve", "api.github.com:443:140.82.121.5"]   # 必加，否则 TLS 失败
def get_sha(path):
    r = subprocess.run(["curl","-s","-H",f"Authorization: token {TOKEN}",
        "-H","Accept: application/vnd.github+json",*RESOLVE,
        f"https://api.github.com/repos/celina0503qq-lab/siele-workbench/contents/{path}"], capture_output=True, text=True)
    return json.loads(r.stdout).get("sha")
def put(path, msg):
    b64 = base64.b64encode(open(f"/workspace/siele-workbench/{path}","rb").read()).decode()
    payload = {"message": msg, "content": b64, "branch": "main"}
    sha = get_sha(path)
    if sha: payload["sha"] = sha        # 更新已有文件必须带 sha，否则 409
    r = subprocess.run(["curl","-s","-X","PUT","-H",f"Authorization: token {TOKEN}",
        "-H","Accept: application/vnd.github+json","-H","Content-Type: application/json",
        *RESOLVE,"-d",json.dumps(payload),
        f"https://api.github.com/repos/celina0503qq-lab/siele-workbench/contents/{path}"], capture_output=True, text=True)
    d = json.loads(r.stdout)
    assert "content" in d, f"推送 {path} 失败: {d.get('message')}"
    print(f"✅ {path} -> {d['content']['sha'][:12]}")
# 4 个文件缺一不可（漏推 refine_data.js 会导致内置页来源错误）
for p in ["articles/data/<date>.js", "articles/<date>.html",
          "articles/<date>.docx", "refine_data.js"]:
    put(p, f"refine: <date> 第N期")
```

**部署验证**：
- Pages 自动构建约 1-2 分钟，期间新页面 404 是**正常现象**，勿重复推送
- 查构建：`GET /repos/celina0503qq-lab/siele-workbench/pages/builds/latest` 的 status → 等 `built`
- Pages 访问：`--resolve celina0503qq-lab.github.io:443:185.199.108.153`
- 最终：curl 线上页面 200 且 grep 到正确 title/期号/主题；**回读 refine_data.js 确认四等级来源正确、无旧来源残留（Japan/RTVE）**

---

## 四、原文链接准确性（用户会问，硬性）

- `sourceUrl` 指向**内容与正文直接对应、可打开的页面**；**禁首页/频道页/列表页**（RTVE 的 `rtve.es/noticias/economia/` 即反例，第 14 期被否决）
- **官方公告/计划专页可作为合法来源**（v4.5）：如 IDAE `https://www.idae.es/ayudas-y-financiacion/programa-energias-renovables-innovadoras`
- 验证：`curl -s -o /dev/null -w "%{http_code}" <url>` 应 200；沙箱 curl 连不通（El País/BBC TLS 失败）时**改用 WebFetch 验证**
- 付费墙（El País 等）可填，页面标「可能需要订阅」
- 同一篇原文不得跨等级复用；无可用链接时 `sourceUrl=""`（前端降级显示来源名），**不可编造**
- 链接必现 3 处：工作台 refine 卡片 `.refine-source-cta` / 独立页 `.source-cta` / DOCX 真实 `<w:hyperlink>`

---

## 五、数据 Schema（`articles/data/<date>.js`）

```js
window.__REFINE_DATE__ = "YYYY-MM-DD";
window.WORDS = [
  { lema:"...", ipa:"[...]", pos:"m./f.", significado:"中文释义",
    ejemplo_es:"西语句子", ejemplo_zh:"中文翻译", tip:"记忆提示（含DELE考点/易混淆辨析）" }
  // 共 15 个，高频词应在文章段落中自然出现（用于 highlightWords 高亮）
];
window.ARTICLES = {
  a1: {
    paragraphs:[{es:"西语句子",zh:"中文翻译"},...10],
    dele:"A1 考点：<b>语法点</b>说明...",
    hardWords:[{w:"难词",m:"中文释义"},...5],      // A1/A2 仅 w+m
    quiz:[{q:"¿Pregunta en español?",opts:["Opción A","Opción B","Opción C","Opción D"],ans:0,es:"解析(西语,含 párrafo N)",zh:"解析(中文,含原文第N段)"},...5]
  },
  a2: { /* 同上，10段/5题 */ },
  b1: {
    paragraphs:[...≥18 段，每段 35-50 词],
    dele:"B1 考点：<b>...</b>",
    hardWords:[{w:"难词",m:"释义",ejemplo:"西语例句",analisis:"详细分析(≥2-3句)"},...8-10],
    quiz:[...8 题（≥2 难题，zh 带「此题考查…」标签）]
  },
  b2: { /* ≥20段/8题（≥4难题带标签）；hardWords 8-10 含详细分析 */ }
};
```

- **题干 q / 选项 opts 纯西语**；解析 es/zh 标段落号并引用原句
- **level key 全小写** `a1/a2/b1/b2`（与 swa_quiz_v1 存储键一致，大小写不一致导致数据不互通）
- 文章标题/来源名/链接**不内嵌数据**，硬编码在 HTML `<h2>` 与 `.source-cta`，替换模板时一并更新
- `dele` 字段兼容 string（HTML）或 array（chips）

---

## 六、refine_data.js 索引模板

```js
window.REFINE_PACKS = {
  "<new date>": {   // 只插最前面，绝不覆盖
    date:"YYYY-MM-DD", weekday:"X", issue:N,
    theme:"A1主题 · A2主题 · B1主题 · B2主题",
    sources:[
      { level:"A1", source:"来源名", sourceUrl:"https://...", topic:"文章主题" },
      { level:"A2", source:"来源名", sourceUrl:"https://...", topic:"文章主题" },
      { level:"B1", source:"来源名", sourceUrl:"https://...", topic:"文章主题" },
      { level:"B2", source:"来源名", sourceUrl:"https://...", topic:"文章主题" }
    ]
  },
  "<old date>": { /* 已存在条目绝不删除 */ }
};
```

---

## 七、Quiz 持久化与云同步（swa_quiz_v1）

- 存储键 `swa_quiz_v1`；独立页 `QuizData` 与工作台 `RefineQuizDB` 对等共用
- level key 必须全小写；`attempts[0]` 恒为最新；重做时旧 attempt 标 `completed:true`，新 attempt 插头部
- `notes` 附 `notesTs`，云同步按 notesTs 取较新（`mergeQuizzes`）
- 笔记存 `quizzes[date][level].notes`；旧 `refine_notes_v1` 启动时自动迁移
- 云同步链路：`serializeCloud` 打包 swa_quiz_v1 → 云端（Gist/Gitee/CloudBase/JSONBin）→ `mergeData`/`mergeQuizzes` 合并 → 写回

---

## 八、DOCX 真实超链接（python-docx）

```python
def add_hyperlink(paragraph, text, url, font_size=10, color="0066CC", bold=True, underline=True):
    part = paragraph.part
    r_id = part.relate_to(url, "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink", is_external=True)
    hyperlink = OxmlElement('w:hyperlink'); hyperlink.set(qn('r:id'), r_id)
    new_run = OxmlElement('w:r'); rPr = OxmlElement('w:rPr'); new_run.append(rPr)
    t = OxmlElement('w:t'); t.text = text; t.set(qn('xml:space'), 'preserve'); new_run.append(t)
    hyperlink.append(new_run); paragraph._p.append(hyperlink); return hyperlink
```
验证用 Python zipfile（Playwright 读 docx 是二进制 ZIP，正则搜不到）：
```python
import zipfile, re
with zipfile.ZipFile('X.docx') as z:
    rels = z.read('word/_rels/document.xml.rels').decode()
    targets = re.findall(r'Target="(https?://[^"]+)"', rels)
    doc_xml = z.read('word/document.xml').decode()
    # target 数 == hyperlink 数 == 4
```

---

## 九、已知坑点速查（从 automation.md 6.1-6.16 提炼）

| 坑 | 正确做法 |
|---|---|
| JS 中文引号破坏语法 | `zh` 内 `""` 转义 `\u201C`/`\u201D` |
| HTML 内联引号错误（missing ) after argument） | 必须 JSON.stringify，禁止手工拼接 |
| 期号错乱/覆盖前期 | 在线读 max+1；只插最前；PUT 带线上 sha |
| 难题率不可验证 | zh 解析带「此题考查…」标签，正则统计 |
| 难词过少 | B1/B2 各 8-10 个，含 ejemplo+analisis |
| 题干中文 | q/opts 纯西语，难题维度写 zh 解析 |
| 段落过短/拆段凑数 | 每段 35-50 词，勿为扩写而扩写 |
| 来源无明确指向（RTVE 频道页） | B1/B2 禁 RTVE；用 El País/BBC/官方专页 |
| 内置页跳旧来源 | refine_data.js 必须实际推送；三处 sourceUrl 逐字一致 |
| 验证脚本硬编码期望值 | 期望值从数据动态读取 |
| 推送 403 | 用 hosts.yml oauth_token，弃 fine-grained PAT/gh CLI |
| Pages 404 | 构建延迟 1-2 分钟，等 built 再验证，勿重复推送 |

---

## 十、工作台内置模块（index.html 内）

- `renderRefine()` 静态壳 + `renderRefineBody()` 异步（`loadRefineData(date)` → 渲染 15 词 + 4 篇 + 26 题）
- `selectRefineDate(d)` / `selectRefineLevel(l)` 切换；`_refineAutoLoad()` hook 包裹 renderMain
- `loadRefineData` 用 `__REFINE_CACHE` + `__REFINE_INFLIGHT` 缓存，动态 `<script>` 加载 `articles/data/<date>.js`
- **内置页来源名/链接取自 `refine_data.js` 的 `sources[]`，正文取自 `articles/data/<date>.js`**；独立页来源硬编码在 `.source-cta`
- TTS：`_bindRefineWordSpeak/_bindRefineParaSpeak/_bindRefinePlayAll/_bindRefineScore/_bindRefineRate`；`window.__refineSpeakRate/__refineSpeakQueue`
- 难词高亮：优先 `paragraphs[].vocab`，回退 `a.hardWords`；`\b` 词边界 + tooltip

---

## 十一、验收清单（推送前逐项勾选）

- [ ] 15 词卡完整（lemma/IPA/释义/双语例句/记忆提示）
- [ ] 4 篇 10/10/≥18/≥20 段；26 题（5/5/8/8）
- [ ] B1/B2 每段西语 35–50 词（勿为凑数扩写，也勿拆段）
- [ ] 题干 q / 选项 opts 纯西语；解析标段落号并引用原句
- [ ] B2 难题 ≥4、B1 难题 ≥2（zh 带「此题考查…」标签）
- [ ] B1/B2 难词各 8–10 个，含 ejemplo+analisis，且正文自然出现
- [ ] 4 个原文链接可打开（curl/WebFetch 200）；B1/B2 无 RTVE、无非西语媒体；无则留空不编造
- [ ] 期号在线读 max+1；REFINE_PACKS 严格递减连续；只插最前不覆盖
- [ ] HTML 数据 JSON.stringify 内联；Playwright 渲染 0 JS 错误
- [ ] refine_data.js 与独立页四等级 sourceUrl 逐字一致，且已实际推送线上
- [ ] DOCX 含 4 个真实超链接（zipfile 校验）
- [ ] 认证用 hosts.yml oauth_token；无明文 token；Contents API 推送 4 文件
- [ ] 等 Pages built 后 curl 线上 200 + 正确 title/期号/主题；回读 refine_data.js 无旧来源残留

---

## 十二、本 SKILL 与「自动化指令」的关系

- **自动化任务 `siele-v3` 的 prompt**（WorkBuddy 侧）：每 4 天自动触发时直接读取，是常规推送的执行入口
- **`.codebuddy/automation.md`**：完整权威规范（含历史版本记录），任务 prompt 引用它为权威源
- **本 SKILL**：手动触发场景（用户直接说「生成外刊精炼」）时的执行指南，内容与 automation.md v4.5 一致
- 三处规则必须保持同步；更新任一版本规范后，其余两处需一并更新（本仓库 `skills/` 与本地 `~/.codebuddy/skills/` 也需同步，本地不会自动同步仓库更新，需手动复制或运行同步脚本）
