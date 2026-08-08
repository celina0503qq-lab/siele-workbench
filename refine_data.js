/* ============================================================
 * refine_data.js — 外刊精炼模块数据索引
 *
 * 每个外刊精炼包对应一天的推送：
 *   - 5 个生活/职场高频西语单词
 *   - 4 篇分级外刊（A1/A2/B1/B2）
 *   - 每篇 10 段（A1/A2）或 15 段（B1/B2）中西双语精读
 *   - 每篇 5 道阅读题（中西双语解析）
 *   - 每篇附带 BBC Mundo / El País 原文链接
 *
 * 添加新日期步骤：
 *   1. 把当天推送的 HTML 复制到 articles/<date>.html
 *   2. 把当天推送的 docx 复制到 articles/<date>.docx
 *   3. 把当天推送的 WORDS + ARTICLES 数据导出到 articles/data/<date>.js
 *   4. 在下方 REFINE_PACKS 增加 <date> 键，并填入 source / sourceUrl
 * ============================================================ */

// 1) 2026-08-08 第 7 期 — 主题：夏季集中工时 / 开学季 / 八月热浪 / 人口空心化
window.REFINE_PACKS = {
  "2026-08-08": {
    date: "2026-08-08",
    weekday: "六",
    issue: 7,
    theme: "夏季集中工时 · 开学季 · 西班牙八月热浪 · 人口空心化",
    sources: [
      { level: "A1", source: "BBC Mundo", sourceUrl: "https://www.bbc.com/mundo/articles/cx2ld7g4e0wo", topic: "El café de la mañana" },
      { level: "A2", source: "El País", sourceUrl: "https://elpais.com/sociedad/2026-08-08/vuelta-al-cole-septiembre-2026.html", topic: "Vuelta al cole en septiembre" },
      { level: "B1", source: "BBC Mundo", sourceUrl: "https://www.bbc.com/mundo/noticias/espana-ola-calor-agosto-2026", topic: "La ola de calor de agosto en España" },
      { level: "B2", source: "El País", sourceUrl: "https://elpais.com/espana/2026-08-08/espana-vaciada-reto-demografico.html", topic: "La España vaciada" }
    ]
  }
};

// 2) 渲染时根据日期拉取对应的 data js，动态注入
window.REFINE_DATA_BASE = "articles/data/";
window.REFINE_ARTICLES_BASE = "articles/";

window.loadRefineData = function(dateKey) {
  if (!window.__REFINE_CACHE) window.__REFINE_CACHE = {};
  if (!window.__REFINE_INFLIGHT) window.__REFINE_INFLIGHT = {};
  // Cache hit (same date, same data)
  if (window.__REFINE_CACHE[dateKey] && window.__REFINE_DATE__ === dateKey) {
    return Promise.resolve(window.__REFINE_CACHE[dateKey]);
  }
  // Inflight dedup
  if (window.__REFINE_INFLIGHT[dateKey]) {
    return window.__REFINE_INFLIGHT[dateKey];
  }
  window.__REFINE_INFLIGHT[dateKey] = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = window.REFINE_DATA_BASE + dateKey + '.js';
    s.dataset.refineDate = dateKey;
    s.onload = () => {
      // The data file (articles/data/<date>.js) sets window.WORDS, window.ARTICLES, window.__REFINE_DATE__
      const payload = { WORDS: window.WORDS || [], ARTICLES: window.ARTICLES || {} };
      window.__REFINE_CACHE[dateKey] = payload;
      resolve(payload);
    };
    s.onerror = () => reject(new Error('Failed to load ' + s.src));
    document.head.appendChild(s);
  });
  return window.__REFINE_INFLIGHT[dateKey];
};
