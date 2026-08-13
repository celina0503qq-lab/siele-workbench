---
name: siele-daily-refine-pack
description: SIELE 工作台每日外刊精炼推送流程 — 15 词 + 4 篇分级精读 (A1/A2/B1/B2) + 20 道题 + Word 下载 + 在线阅读 + 原文链接, 落到 GitHub Pages siele-workbench-deploy/articles/<date>/
read_when:
  - 用户要求生成每日西语外刊精炼推送
  - 自动化 (10:30) 每日推送触发
  - 需要把外刊内容接入 📚外刊精炼 菜单
---

# SIELE 每日外刊精炼推送 (Daily Refine Pack)

## 触发条件
- 自动化每日 10:30 cron
- 用户明确要求 "今日外刊" / "每日推送" / "外刊精炼 <日期>"

## 目标产出 (3 份文件)

所有文件落 `siele-workbench-deploy/articles/`:

1. **`<date>.html`** (在线阅读版) — 单文件 HTML, 顶部 15 词卡 → 4 篇文章 (10/10/15/15 段) → 20 道阅读题
2. **`<date>.docx`** (Word 下载) — python-docx 生成, 难词橙色加粗
3. **`data/<date>.js`** (题库数据) — 暴露 `window.WORDS` (15 词) + `window.ARTICLES` (A1/A2/B1/B2)

外加: `siele-workbench-deploy/refine_data.js` 内 `REFINE_PACKS` 加新 date key。

## 数据 Schema (data/<date>.js)

```js
window.WORDS = [
  {
    lema: "jornada intensiva",       // 词条
    ipa: "[xoɾˈnaða intenˈsiβa]",   // IPA
    pos: "f.",                       // 词性
    significado: "集中工时 (夏季 7-8 月常见)",  // 中文释义
    ejemplo_es: "En agosto trabajo en jornada intensiva.",  // 西语例句
    ejemplo_zh: "八月我上集中工时。",
    tip: "对比 jornada partida (分时段工时)"   // 记忆提示
  }
  // 15 个
];

window.ARTICLES = {
  a1: { level: "A1", title: "El café de la mañana", source: "BBC Mundo", sourceUrl: "https://...", topic: "...",
    paragraphs: [{es: "...", zh: "..."}, ...10],
    hardWords: [{w: "café", m: "咖啡"}, ...],
    dele: "A1 考点: <b>陈述式现在时</b> · <b>不规则动词</b>",  // 兼容 string 或 array
    quiz: [{q: "...", opts: ["A","B","C","D"], ans: 0, es: "...", zh: "..."}, ...5]
  },
  a2: { ... },
  b1: { ... },  // 15 段
  b2: { ... }   // 15 段
};
```

## refine_data.js 索引模板

```js
window.REFINE_PACKS = {
  "2026-08-08": {
    date: "2026-08-08",
    weekday: "六",     // 中文数字
    issue: 7,           // 第几期
    theme: "夏季集中工时 · 开学季 · 西班牙八月热浪 · 人口空心化",
    sources: [
      { level: "A1", source: "BBC Mundo", sourceUrl: "https://www.bbc.com/mundo/...", topic: "..." },
      // 4 个, 一篇一链接
    ]
  },
  "<new date>": { ... }  // 追加, 不覆盖
};
```

## 颜色编码 (CSS)

```
A1 入门  = #2E7D32 (绿)
A2 基础  = #1565C0 (蓝)
B1 中级  = #C12A2A (红)
B2 中高  = #6A1B9A (紫)
```

## 原文链接规则 (3 个地方都要有, 用户会问)

- A1/A2 → BBC Mundo (https://www.bbc.com/mundo/...)
- B1/B2 → El País (https://elpais.com/...)
- 真实可点击 URL, 不能 placeholder

### 必现位置
1. **工作台 refine 卡片标题旁** — `.refine-source-cta` 等级色填充按钮 (CSS `background:${color}`)
2. **articles/<date>.html** 文章 header — `.source-cta.A1/A2/B1/B2` 等级色按钮
3. **`<date>.docx`** — **真实 `<w:hyperlink>` XML 元素**, Word 里点击跳转, 不能纯文本 URL

### docx 真实超链接 (python-docx)
```python
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

def add_hyperlink(paragraph, text, url, font_size=10, color="0066CC", bold=True, underline=True):
    """在段落末尾添加一个真实可点击的超链接"""
    part = paragraph.part
    r_id = part.relate_to(
        url,
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink",
        is_external=True,
    )
    hyperlink = OxmlElement('w:hyperlink')
    hyperlink.set(qn('r:id'), r_id)
    new_run = OxmlElement('w:r')
    rPr = OxmlElement('w:rPr')
    # rFonts / sz / szCs / color / b / bCs / u 全套样式
    new_run.append(rPr)
    t = OxmlElement('w:t')
    t.text = text
    t.set(qn('xml:space'), 'preserve')
    new_run.append(t)
    hyperlink.append(new_run)
    paragraph._p.append(hyperlink)
    return hyperlink
```
调用:
```python
p2 = doc.add_paragraph()
add_hyperlink(p2, f"🔗 {art['src']} 原文链接(点击打开)", art["url"], font_size=10, color="0066CC")
```

### docx 验证 (Playwright JS 不可靠 → Python zipfile)
- **坑**: `fetch().arrayBuffer()` → `TextDecoder.decode()` → 正则搜不到, docx 是二进制 ZIP
- **正解**:
  ```python
  import zipfile, re
  with zipfile.ZipFile('2026-08-08.docx') as z:
      rels = z.read('word/_rels/document.xml.rels').decode('utf-8')
      targets = re.findall(r'Target="(https?://[^"]+)"', rels)
      doc_xml = z.read('word/document.xml').decode('utf-8')
      hyperlink_count = doc_xml.count('<w:hyperlink ')
      # target 数 == hyperlink 数 == 4 (预期)
  ```

## 部署步骤

1. **生成 3 份文件** (用工作台对应生成脚本或手工)
2. **更新 `refine_data.js`** REFINE_PACKS 加新 date key
3. **检查未追踪文件**: `cd siele-workbench-deploy && git status --short`, 看到 `??` 立刻 add
4. **提交 + 推送**:
   ```bash
   git add articles/ refine_data.js
   git -c user.email='celina@local' -c user.name='celina' commit -m "feat(refine): <date> 外刊精炼内容"
   GIT_TERMINAL_PROMPT=0 git -c credential.helper= push origin main
   ```
5. **等 60s** 让 GitHub Pages CDN 刷缓存
6. **E2E 验证**:
   - `node siele-test/test_refine_live_final.js` (15词/4文章/4链接/1docx/1html/0 4xx)
   - `node siele-test/menu_regression.js` (19/19 菜单 PASS, 0 pageerror)
7. **curl 关键资源**:
   ```bash
   curl -sI https://celina0503qq-lab.github.io/siele-workbench/articles/<date>.html
   curl -sI https://celina0503qq-lab.github.io/siele-workbench/articles/<date>.docx
   curl -sI https://celina0503qq-lab.github.io/siele-workbench/articles/data/<date>.js
   ```

## 关键调试技巧

- **nav 文本含 emoji**: Playwright 调试优先用 `window.go('refine')` 走 SPA 路由, 而不是 `el.textContent === '外刊精炼'`
- **GitHub Pages 404 排查**: `node siele-test/probe_live_404.js` 列出所有 4xx 响应
- **未追踪文件导致 404**: `git status --short` 看 `??` 前缀, 立刻 `git add`

## renderRefine 模块 (在 index.html 内)

- `renderRefine()` 静态壳: 日期 chip + 主题 + Word/在线按钮 + 等级过滤 + body 占位
- `renderRefineBody()` 异步: 调 `window.loadRefineData(date)` → 渲染 15 词卡 + 4 篇文章 + 20 题
- `selectRefineDate(d)` 切日期时: `currentRefineDate = d; renderMain(); setTimeout(renderRefineBody, 30)`
- `selectRefineLevel(l)` 切等级: 隐藏非该级文章卡片
- **关键 hook**: 包裹原 `renderMain` 注入 `_refineAutoLoad()`, 避免手动二次调用

## loadRefineData 缓存模式 (refine_data.js 内)

```js
window.loadRefineData = function(dateKey) {
  if (!window.__REFINE_CACHE) window.__REFINE_CACHE = {};
  if (!window.__REFINE_INFLIGHT) window.__REFINE_INFLIGHT = {};
  if (window.__REFINE_CACHE[dateKey]) return Promise.resolve(window.__REFINE_CACHE[dateKey]);
  if (window.__REFINE_INFLIGHT[dateKey]) return window.__REFINE_INFLIGHT[dateKey];
  window.__REFINE_INFLIGHT[dateKey] = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = './articles/data/' + dateKey + '.js';
    s.onload = () => {
      const payload = { WORDS: window.WORDS || [], ARTICLES: window.ARTICLES || {} };
      window.__REFINE_CACHE[dateKey] = payload;
      resolve(payload);
    };
    s.onerror = () => reject(new Error('Failed to load ' + s.src));
    document.head.appendChild(s);
  });
  return window.__REFINE_INFLIGHT[dateKey];
};
```

## dele 字段类型兼容

`a.dele` 字段可能是 string (HTML) 或 array (chips), 渲染时:
```js
if (a.dele) {
  if (Array.isArray(a.dele)) deleHtml = a.dele.map(d => `<span>${esc(d)}</span>`).join('');
  else if (typeof a.dele === 'string') deleHtml = a.dele;  // 已是 HTML
}
```

## 难词高亮 (mark)

优先用 `paragraphs[].vocab`, 缺失时回退 `a.hardWords`:
```js
if (p.vocab) { html = highlightByVocab(p.es, p.vocab); }
else { html = highlightByHardWords(p.es, a.hardWords); }
```

## 验收标准 (commit 前必查)

- [ ] 15 词卡有完整 lemma/IPA/释义/例句/记忆提示
- [ ] 4 篇文章 10/10/15/15 段
- [ ] 4 个真实原文链接 (BBC Mundo / El País)
- [ ] 1 个 docx 下载链接 + 1 个 html 在线阅读链接
- [ ] 20 道阅读题 (5×4) 完整答案
- [ ] `refine_data.js` 索引更新
- [ ] `git status --short` 无 untracked
- [ ] E2E test 0 4xx + 19/19 菜单 PASS
- [ ] commit message 含日期
