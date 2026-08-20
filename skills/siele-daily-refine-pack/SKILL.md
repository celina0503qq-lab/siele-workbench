---
name: siele-daily-refine-pack
description: SIELE 工作台外刊精炼推送流程 v4.5 — 每 4 天一期 · 15 词 + 4 篇分级精读 (A1:10段5题/A2:10段5题/B1:≥18段8题/B2:≥20段8题，共26题) + Word 下载 + 在线阅读 + 原文链接, 落到 GitHub Pages celina0503qq-lab.github.io/siele-workbench/articles/<date>/。含 B1/B2 每段 35-50 词、题干/选项纯西语、B1/B2 难词 8-10 个含 ejemplo+analisis、B2 难题 ≥4/8 + B1 ≥2/8（带标签校验）、B1/B2 禁取材 RTVE、期号连续性防护、HTML 内联 JSON.stringify 引号安全、模板复用、Contents API 推送（hosts.yml oauth_token）
read_when:
  - 用户要求生成西语外刊精炼推送
  - 自动化 (每 4 天 00:00) 推送触发
  - 需要把外刊内容接入 📚外刊精炼 菜单
  - 排查外刊期号错乱 / 引号语法错误 / 推送 404 / 链接失效 / 来源错误 / 段落过短
---

# SIELE 外刊精炼推送 (Daily Refine Pack) v4.5

> 权威源：`.codebuddy/automation.md`（**v4.5, 2026-08-20**）。本 skill 是其执行版，冲突时以 automation.md 为准。

## 调度安排

- **频率**：每 4 天一期（自 2026-08-13 起）
- **时间**：每 4 天 **00:00**（Asia/Shanghai，v4.5 与自动化任务实际配置核对修正），cron `0 0 0 */4 * *`
- **自动化任务**：WorkBuddy `siele-v3`（id=5100839）
- **期号**：严格"在线读 refine_data.js 最大 issue + 1"，按实际推送次数递增，不按自然周
- **手动触发**：临时 once 任务或手动执行生成流程（仍须遵守全部安全规则）

## 模块概述（每期产出）

| 部分 | 数量 | 说明 |
|---|---|---|
| 高频词 | 15 个 | 生活/职场/时事，含 IPA/释义/双语例句/记忆提示 |
| A1 精读 | 10 段 / 5 题 | 入门，陈述式现在时为主 |
| A2 精读 | 10 段 / 5 题 | 基础，现在完成时/简单过去时 |
| B1 精读 | **≥18 段** / **8 题** | 进阶，虚拟式+条件式+复合句 |
| B2 精读 | **≥20 段** / **8 题** | 高级，议论文体+学术词汇 |

合计 **26 题**（5+5+8+8）。每篇含原文链接、DELE 考点、难词清单、**做题持久化 + 笔记**。

## v4.4/v4.5 硬性规范（务必遵守）

- **题干 q 与选项 opts 必须纯西语**（A1–B2 全部等级），禁止中文题干/选项；解析 es/zh 中西混合，且必须标注段落号（`párrafo N` / `原文第 N 段`）并引用原句（引号包裹）
- **B1/B2 每段西语 35–50 词**（用户明确指示）：**不要为了扩写而扩写**，35 词左右是正常水平；也不得为凑段数把长段拆成单句短段（第 14 期拆段教训）。校验：`es.trim().split(/\s+/).length` 断言每段在 35–50 之间；A1/A2 无此硬要求
- **B1/B2 难词各 8–10 个**，每项含 `w/m/ejemplo`（西语例句）`/analisis`（详细分析 ≥2-3 句，涵盖词源/搭配/语法/语境义/DELE 考点/易混淆词中 ≥2 项）；A1/A2 保持 `{w,m}` 结构 5 个
- **B2 难题 ≥4/8（50%）、B1 难题 ≥2/8（25%）**；难题的 `zh` 解析末尾必须带固定标签：`此题考查推理判断` / `此题考查观点辨析` / `此题考查长句理解` / `此题考查跨段落综合` / `此题考查词汇深度`（供机器统计，标签只能出现在 zh 解析里，禁止写进题干）
- **B1/B2 禁取材 RTVE**（RTVE 链接长期只有频道页/列表页、溯源链接没有明确指向）。B1/B2 来源优先级：**El País 原文 > BBC Mundo 原文 > 官方机构/计划专页（如 IDAE）> 其他西语新闻媒体**；**严禁他语种媒体**（如 Japan Times，第 14 期曾误用被纠正）
- **内置页 + 独立页来源一致性**：`refine_data.js` 的 `sources[].sourceUrl` 与独立页 `.source-cta` href 必须逐字一致（A1/A2/B1/B2 四级），且 **refine_data.js 必须实际推送到线上**（不能只改本地，第 14 期曾因此内置页仍跳旧来源）

## 一键生成流程（8 步）

### 第 1 步：确认日期 / 星期 / 期号 / 主题
- 日期 `YYYY-MM-DD`；星期中文（一~日）
- **期号必须在线读 `refine_data.js` 最大 issue + 1**（禁止凭记忆）
- 4 主题方向：A1 生活场景 → A2 文化/社会 → B1 经济/科技 → B2 深度分析/争议

### 第 2 步：生成数据 JS（`articles/data/<date>.js`）
数据格式见下方「数据 Schema」。**关键约束**：
- B1/B2 每段西语 35–50 词
- quiz 的 q/opts 纯西语；es/zh 解析标注段落号并引用原句；难题 zh 末尾带「此题考查…」标签
- B1/B2 hardWords 各 8–10 个，含 w/m/ejemplo/analisis
- `zh` 值含中文引号 `""` 必须 `\u201C`/`\u201D` 转义
- 用 `node -e "new Function(fs.readFileSync(...))"` 验证语法
- 用 `vm.runInNewContext` 验证：15 WORDS + A1(10p/5q) + A2(10p/5q) + B1(≥18p/8q) + B2(≥20p/8q) + 每段 35-50 词 + 纯西语 + 难题标签数（B2≥4/B1≥2）+ 难词数 8-10

### 第 3 步：生成独立 HTML（`articles/<date>.html`）
**用最近一期已验证的 v3 模板为基准**（如 `2026-08-20.html`），复制后仅替换 title/topbar/4 篇 h2/来源链接/footer 日期/数据块。**禁止手工从零写 HTML，禁止沿用 v1/v2 模板。**

**HTML 数据内联引号安全（最高优先级）**：
- 唯一可靠方案：先独立 `data/<date>.js` 生成验证数据 → `node` + `vm.runInContext` 提取 JSON → **`JSON.stringify`** 序列化插入 `<script>`。JSON.stringify 自动转义 `"` 为 `\"`，无需手工处理引号
- 禁止 rfind / 正则 `([^"]*)` / 逐行扫描（都会误改 es 字符串边界）
- 完成后用 Playwright 无头渲染，断言 JS 运行时错误=0、词汇卡=15、各级段/题数正确、难词展开数=难词总数

### 第 4 步：生成 DOCX（`articles/<date>.docx`）
python-docx 生成：标题/15 词/4 篇中西对照/DELE 考点/难词（B1/B2 含例句+分析）/阅读题。原文链接用**真实 `<w:hyperlink>` XML**（见下）。

### 第 5 步：更新索引 `refine_data.js`（期号连续性防护）
- 新日期条目**只插入 `REFINE_PACKS` 最前面**，绝不删除/覆盖任何已有条目
- `sources` 四个等级的 source/sourceUrl/topic 与独立页 `.source-cta` 逐字一致
- 推送前 `vm.runInContext` 断言期号从新到旧**严格递减且连续**（如 14,13,...,1），断裂/跳号不得推送
- 推送 `refine_data.js` 前先 GET 拿线上 sha，再 PUT 带 sha，避免并发覆盖

### 第 6 步：四重验证（推送前必做）
1. **JS 语法**：对 HTML 每个 `<script>` 块 `new Function()` 校验通过
2. **数据完整性**：`vm.runInContext` 验证 15 词 + A1(10p/5q) + A2(10p/5q) + B1(≥18p/8q) + B2(≥20p/8q) + B1/B2 每段 35-50 词 + 难词 8-10 含 ejemplo/analisis + 题干/选项纯西语（正则 `[\u4e00-\u9fff]`）+ 难题标签数达标（B2≥4/B1≥2）
3. **期号连续性**：读 REFINE_PACKS，断言期号严格递减连续
4. **浏览器实际渲染**：用 playwright/chromium 无头打开页面，断言 JS 运行时错误数 = 0、词汇卡 = 15、各级段落/题目数正确

### 第 7 步：推送到 GitHub（Contents API）

**认证（v4.4 修正，重要）**：
- **不要用 fine-grained PAT，也不要依赖 gh CLI**（曾出现只读 403「Resource not accessible」）
- **从 `~/.config/gh/hosts.yml` 的 `github.com.oauth_token` 字段读取 token**（有 contents:write 权限，已验证可推送）；回退环境变量 GH_TOKEN
- **禁止把 token 明文写进命令、脚本、git URL 或 commit message**

```python
# /tmp/push.py —— hosts.yml oauth_token + Contents API PUT
import subprocess, json, base64, yaml
TOKEN = yaml.safe_load(open("/root/.config/gh/hosts.yml"))["github.com"]["oauth_token"]
RESOLVE = ["--resolve", "api.github.com:443:140.82.121.5"]
def get_sha(path):
    r = subprocess.run(["curl","-s","-H",f"Authorization: token {TOKEN}",
        "-H","Accept: application/vnd.github+json",*RESOLVE,
        f"https://api.github.com/repos/celina0503qq-lab/siele-workbench/contents/{path}"], capture_output=True, text=True)
    return json.loads(r.stdout).get("sha")
def put(path, msg):
    b64 = base64.b64encode(open(f"/workspace/siele-workbench/{path}","rb").read()).decode()
    payload = {"message": msg, "content": b64, "branch": "main"}
    sha = get_sha(path)
    if sha: payload["sha"] = sha
    r = subprocess.run(["curl","-s","-X","PUT","-H",f"Authorization: token {TOKEN}",
        "-H","Accept: application/vnd.github+json","-H","Content-Type: application/json",
        *RESOLVE,"-d",json.dumps(payload),
        f"https://api.github.com/repos/celina0503qq-lab/siele-workbench/contents/{path}"], capture_output=True, text=True)
    d = json.loads(r.stdout)
    assert "content" in d, f"推送 {path} 失败: {d.get('message')}"
    print(f"✅ {path}")
for p in ["articles/data/<date>.js", "articles/<date>.html", "articles/<date>.docx", "refine_data.js"]:
    put(p, f"refine: <date> 第N期")
```

**4 个文件缺一不可**：`articles/data/<date>.js`、`articles/<date>.html`、`articles/<date>.docx`、`refine_data.js`（漏推 refine_data.js 会导致内置页来源错误）。推送后回读校验线上内容（尤其 refine_data.js 的 sourceUrl、无旧来源残留）。

### 第 8 步：验证线上部署
- 推送后 GitHub Pages 自动构建，**约 1-2 分钟延迟**，期间新页面返回 404 是正常的
- 查构建状态：`GET /repos/celina0503qq-lab/siele-workbench/pages/builds/latest`，等 status 变为 built/deployed
- Pages 访问用 `--resolve <host>:443:185.199.108.153`
- 最终 curl 线上页面应返回 200，且 grep 到正确 title / 期号 / 主题；DOCX、data JS 同样 200；回读 refine_data.js 确认四等级来源正确

## B1/B2 阅读题难度要求

- **B2 难题 ≥4/8（50%）**：B2 的 8 题中至少 4 道难题
- **B1 难题 ≥2/8（25%）**：B1 的 8 题中至少 2 道难题
- 难题标准（至少一种，不能只考字面定位）：
  1. 推理判断（作者态度/隐含结论/未来趋势）
  2. 观点辨析（区分不同人物/机构观点，识别反方论点）
  3. 长句/复合句理解（虚拟式/条件式/关系从句/倒装）
  4. 跨段落综合（整合两段以上信息）
  5. 词汇深度（一词多义/学术词汇/语境义辨析）
- **机器校验**：难题的 `zh` 解析末尾带 `此题考查(推理判断|观点辨析|长句理解|跨段落综合|词汇深度)` 标签，正则统计断言 B2≥4、B1≥2
- A1/A2 保持基础（段落直接定位 + 简单同义替换），不盲目加难
- B1/B2 的 hardWords 应包含难题答案依赖的高阶词汇，形成词汇→阅读闭环

## 原文链接准确性（用户会问，硬性）

- `sourceUrl` 指向**内容与正文直接对应、可打开的页面**，**禁填首页/频道页/列表页**（RTVE 的 `rtve.es/noticias/economia/` 即反例）
- **官方公告/计划专页可作为合法来源**（v4.5）：如 IDAE 的 `idae.es/ayudas-y-financiacion/programa-energias-renovables-innovadoras`（内容多、西语、正文事实与之对应）
- 生成时必须 `curl -s -o /dev/null -w "%{http_code}" <url>` 验证 **200**；沙箱 curl 连不通时改用 `WebFetch` 验证
- 付费墙（El País 等）可填但标"可能需要订阅"
- 同一篇原文不得跨等级复用；临时无可用链接则 `sourceUrl=""` 留空（前端降级显示来源名），**不可编造**
- **B1/B2 禁取材 RTVE**；来源优先级：El País > BBC Mundo > 官方机构/计划专页 > 其他西语媒体；严禁非西语媒体
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
        hardWords:[{w:"难词",m:"释义"},...5], quiz:[{q:"¿Pregunta en español?",opts:["Opción A","Opción B","Opción C","Opción D"],ans:0,es:"解析(西语,含párrafo N)",zh:"解析(中文,含原文第N段)"},...5] },
  a2: { /* 同上，10段/5题 */ },
  b1: { paragraphs:[...≥18 段，每段 35-50 词], dele:"...",
        hardWords:[{w:"难词",m:"释义",ejemplo:"西语例句",analisis:"详细分析"},...8-10], quiz:[...8 题（≥2 难题带标签）] },
  b2: { /* ≥20段/8题（≥4难题带标签）；hardWords 8-10 含详细分析字段 */ }
};
```
- **题干 q / 选项 opts 纯西语**；解析 es/zh 标段落号并引用原句；难题 zh 带「此题考查…」标签
- **B1/B2 每段西语 35–50 词**（勿为扩写而扩写）
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
- GitHub Pages 404 → 等构建 built 再验证；未追踪文件 → `git status --short` 看 `??`
- 引号语法错误 → 用 JSON.stringify 方案，勿手工转义
- 段数/难词数调整后 → 验证脚本期望值必须从数据动态读取，勿硬编码（第 14 期曾因此误报）

## 工作台内置模块（index.html 内）

- `renderRefine()` 静态壳 + `renderRefineBody()` 异步（`loadRefineData(date)` → 渲染 15 词 + 4 篇 + 26 题）
- `selectRefineDate(d)` / `selectRefineLevel(l)` 切换；`_refineAutoLoad()` hook 包裹 renderMain
- `loadRefineData` 用 `__REFINE_CACHE` + `__REFINE_INFLIGHT` 缓存，动态 `<script>` 加载 `articles/data/<date>.js`
- 内置页来源名/链接取自 `refine_data.js` 的 `sources[]`（正文取自 data JS），独立页来源硬编码在 `.source-cta`
- TTS：`_bindRefineWordSpeak/_bindRefineParaSpeak/_bindRefinePlayAll/_bindRefineScore/_bindRefineRate`；`window.__refineSpeakRate/__refineSpeakQueue`
- 难词高亮：优先 `paragraphs[].vocab`，回退 `a.hardWords`；`\b` 词边界 + tooltip

## 验收标准（推送前必查）

- [ ] 15 词卡完整 lemma/IPA/释义/例句/记忆提示
- [ ] 4 篇 10/10/≥18/≥20 段，26 题（5/5/8/8），B2 难题 ≥4、B1 难题 ≥2（带「此题考查…」标签）
- [ ] B1/B2 每段西语 35–50 词（勿为凑数扩写，也勿拆段）
- [ ] 题干 q / 选项 opts 纯西语；解析标段落号并引用原句
- [ ] B1/B2 难词各 8–10 个，含 ejemplo + analisis
- [ ] 4 个真实原文链接可打开（curl/WebFetch 200，无则留空不编造）；B1/B2 无 RTVE、无非西语媒体
- [ ] 期号在线读 max+1，REFINE_PACKS 严格递减连续，只插最前不覆盖
- [ ] HTML 数据 JSON.stringify 内联，Playwright 渲染 0 JS 错误
- [ ] refine_data.js 与独立页四等级 sourceUrl 逐字一致，且已实际推送线上
- [ ] 1 docx 下载 + 1 html 在线阅读链接
- [ ] 认证用 hosts.yml oauth_token，无明文 token；Contents API 推送 4 个文件
- [ ] 等 Pages built 后 curl 线上 200 + 正确 title/期号/主题
