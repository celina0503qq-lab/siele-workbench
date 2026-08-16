/* ============================================================
 * refine_data.js — 外刊精炼模块数据索引
 *
 * 每个外刊精炼包对应一天的推送：
 *   - 15 个生活/职场高频西语单词
 *   - 4 篇分级外刊（A1/A2/B1/B2）
 *   - 每篇 10 段（A1/A2）或 15 段（B1/B2）中西双语精读
 *   - 每篇阅读题（A1/A2: 5题，B1/B2: 8题）中西双语解析
 *   - 每篇附带 DELE Ahora / RTVE / BBC Mundo 原文链接
 *
 * 添加新日期步骤：
 *   1. 把当天推送的 HTML 复制到 articles/<date>.html
 *   2. 把当天推送的 docx 复制到 articles/<date>.docx
 *   3. 把当天推送的 WORDS + ARTICLES 数据导出到 articles/data/<date>.js
 *   4. 在下方 REFINE_PACKS 增加 <date> 键，并填入 source / sourceUrl
 * ============================================================ */

// 1) 2026-08-16 第 13 期 — 主题：公园野餐 · 图书馆文化复兴 · 西班牙旅游业转型 · 欧洲干旱危机
window.REFINE_PACKS = {
  "2026-08-16": {
    date: "2026-08-16",
    weekday: "日",
    issue: 13,
    theme: "公园野餐 · 图书馆文化复兴 · 西班牙旅游业转型 · 欧洲干旱危机",
    sources: [
      { level: "A1", source: "DELE Ahora", sourceUrl: "https://deleahora.com/actividades/comprension-de-lectura", topic: "Un domingo en el parque" },
      { level: "A2", source: "RTVE", sourceUrl: "https://www.rtve.es/noticias/cultura/", topic: "Las bibliotecas: un nuevo espacio de encuentro" },
      { level: "B1", source: "RTVE", sourceUrl: "https://www.rtve.es/noticias/economia/", topic: "El turismo en España: entre el récord y la sostenibilidad" },
      { level: "B2", source: "BBC Mundo", sourceUrl: "", topic: "La sequía que asola Europa: crisis climática y gestión del agua" }
    ]
  },
  "2026-08-13": {
    date: "2026-08-13",
    weekday: "四",
    issue: 12,
    theme: "咖啡馆早餐 · 西班牙传统市集 · 高铁网络扩张 · AI与就业市场",
    sources: [
      { level: "A1", source: "DELE Ahora", sourceUrl: "https://deleahora.com/actividades/comprension-de-lectura", topic: "El desayuno en la cafetería" },
      { level: "A2", source: "RTVE", sourceUrl: "https://www.rtve.es/noticias/cultura/", topic: "El mercado municipal: tradición e innovación" },
      { level: "B1", source: "RTVE", sourceUrl: "https://www.rtve.es/temas/renfe/6350/1833", topic: "La alta velocidad española: expansión y liberalización" },
      { level: "B2", source: "BBC Mundo", sourceUrl: "https://www.bbc.com/mundo", topic: "La IA y el futuro del empleo" }
    ]
  },
  "2026-08-12": {
    date: "2026-08-12",
    weekday: "三",
    issue: 11,
    theme: "超市购物 · 社区生活 · 西班牙可再生能源 · 拉丁美洲移民危机",
    sources: [
      { level: "A1", source: "DELE Ahora", sourceUrl: "https://deleahora.com/actividades/comprension-de-lectura", topic: "De compras en el supermercado" },
      { level: "A2", source: "RTVE", sourceUrl: "https://www.rtve.es/noticias/sociedad/", topic: "El alma del barrio: comunidad y convivencia" },
      { level: "B1", source: "RTVE", sourceUrl: "https://www.rtve.es/noticias/economia/", topic: "La revolución verde de España" },
      { level: "B2", source: "BBC Mundo", sourceUrl: "https://www.bbc.com/mundo/articles/c5yv2rlzd40o", topic: "La crisis migratoria en América Latina" }
    ]
  },
  "2026-08-11": {
    date: "2026-08-11",
    weekday: "二",
    issue: 10,
    theme: "早上日常 · 西班牙音乐节 · 远程办公与城市 · 地震与城市韧性",
    sources: [
      { level: "A1", source: "DELE Ahora", sourceUrl: "https://deleahora.com/actividades/comprension-de-lectura", topic: "La rutina de la mañana: un día normal en España" },
      { level: "A2", source: "RTVE", sourceUrl: "https://www.rtve.es/noticias/cultura/", topic: "Festivales de verano en España: música, cultura y turismo" },
      { level: "B1", source: "RTVE", sourceUrl: "https://www.rtve.es/noticias/economia/", topic: "Teletrabajo y transformación urbana en España" },
      { level: "B2", source: "BBC Mundo", sourceUrl: "https://www.bbc.com/mundo/articles/cly5720pnz4o", topic: "Resiliencia urbana: lecciones del terremoto en Colombia" }
    ]
  },
  "2026-08-10": {
    date: "2026-08-10",
    weekday: "日",
    issue: 9,
    theme: "卡洛斯的早晨 · 西班牙传统节日 · 西班牙数字化转型 · 欧洲移民辩论",
    sources: [
      { level: "A1", source: "DELE Ahora", sourceUrl: "https://deleahora.com/actividades/comprension-de-lectura", topic: "La rutina matutina de Carlos" },
      { level: "A2", source: "RTVE", sourceUrl: "https://www.rtve.es/noticias/cultura/", topic: "Las fiestas populares en España" },
      { level: "B1", source: "RTVE", sourceUrl: "https://www.rtve.es/noticias/20260612/claves-pacto-europeo-sobre-migracion-asilo/17110937.shtml", topic: "La transformación digital en España" },
      { level: "B2", source: "BBC Mundo", sourceUrl: "", topic: "El debate migratorio en Europa" }
    ]
  },
  "2026-08-09": {
    date: "2026-08-09",
    weekday: "日",
    issue: 8,
    theme: "周日家庭聚餐 · 橄榄油文化 · 意大利儿童肥胖 · AI设计病毒",
    sources: [
      { level: "A1", source: "DELE Ahora", sourceUrl: "https://deleahora.com/actividades/comprension-de-lectura/la-importancia", topic: "Los domingos en familia: comida y tradición" },
      { level: "A2", source: "RTVE", sourceUrl: "https://www.rtve.es/noticias/cultura/", topic: "El olivo y la dieta mediterránea: un patrimonio en peligro" },
      { level: "B1", source: "BBC Mundo", sourceUrl: "https://www.bbc.com/mundo/articles/cx2mrppm26do", topic: "Italia y la obesidad infantil: el fin de la dieta mediterránea" },
      { level: "B2", source: "BBC Mundo", sourceUrl: "https://www.bbc.com/mundo/articles/cgk4ek6xke3o", topic: "La IA diseña virus completamente nuevos por primera vez en la historia" }
    ]
  },
  "2026-08-08": {
    date: "2026-08-08",
    weekday: "六",
    issue: 7,
    theme: "夏季集中工时 · 开学季 · 西班牙八月热浪 · 极端高温与城市韧性",
    sources: [
      { level: "A1", source: "RTVE", sourceUrl: "https://www.rtve.es/grafo/video/dia-mundial-del-cafe-los-espaoles-consumimos/cb38b8d1-2b31-4a40-b342-2d4a7679c378", topic: "Día mundial del café: los españoles consumimos" },
      { level: "A2", source: "RTVE", sourceUrl: "https://www.rtve.es/grafo/en/video/como-ha-cambiado-la-vuelta-al-cole/f43014f2-3dc6-4443-86ad-eaa47517d713", topic: "¿Cómo ha cambiado la vuelta al cole?" },
      { level: "B1", source: "RTVE", sourceUrl: "https://www.rtve.es/grafo/en/video/la-ola-de-calor-mantiene-en-aviso-a-gran-parte-de/a3b0b5d8-1dba-48b4-963f-5ee3ddc6cae0", topic: "La ola de calor mantiene en aviso a gran parte de España" },
      { level: "B2", source: "BBC Mundo", sourceUrl: "https://www.bbc.com/mundo/articles/crrvepyp5g2o", topic: "Ciudades frente al calor extremo: el modelo de Phoenix" }
    ]
  },
  "2026-08-07": {
    date: "2026-08-07",
    weekday: "五",
    issue: 6,
    theme: "夏季出行 · 酷暑天气 · 行政手续 · 农村空心化",
    sources: [
      { level: "A1", source: "DELE Ahora", sourceUrl: "https://deleahora.com/actividades/a1-a2", topic: "Viajar en España en agosto: mucho más que playa" },
      { level: "A2", source: "RTVE", sourceUrl: "https://www.rtve.es/noticias/tiempo/", topic: "El calor extremo del verano español: temperaturas récord" },
      { level: "B1", source: "RTVE", sourceUrl: "https://www.rtve.es/noticias/sociedad/", topic: "Trámites en España: la odisea burocrática de los extranjeros" },
      { level: "B2", source: "El País", sourceUrl: "https://elpais.com/sociedad/2019/03/31/actualidad/1554022545_649884.html", topic: "La España vaciada: despoblación rural y repoblación" }
    ]
  },
  "2026-08-06": {
    date: "2026-08-06",
    weekday: "四",
    issue: 5,
    theme: "办公室日常 · 求职面试 · 自由职业 · 远程办公",
    sources: [
      { level: "A1", source: "RTVE", sourceUrl: "https://www.rtve.es/noticias/", topic: "Un día en la oficina en España" },
      { level: "A2", source: "DELE Ahora", sourceUrl: "https://deleahora.com/actividades/comprension-de-lectura", topic: "Cómo buscar trabajo en España: currículum y entrevista" },
      { level: "B1", source: "RTVE", sourceUrl: "https://www.rtve.es/noticias/economia/", topic: "Ser autónomo en España: ventajas, desafíos y cuotas" },
      { level: "B2", source: "RTVE", sourceUrl: "https://www.bbc.com/mundo/articles/c5y6g9dxww4o", topic: "El teletrabajo y el futuro del empleo en España" }
    ]
  },
  "2026-08-05": {
    date: "2026-08-05",
    weekday: "三",
    issue: 4,
    theme: "超市购物 · 西班牙美食文化 · 数字游民潮 · 欧洲干旱危机",
    sources: [
      { level: "A1", source: "DELE Ahora", sourceUrl: "https://deleahora.com/actividades/comprension-de-lectura/el-fin-de-semana-texto-para-completar", topic: "De compras en el supermercado" },
      { level: "A2", source: "RTVE", sourceUrl: "https://www.rtve.es/noticias/gastronomia/", topic: "La gastronomía española: un viaje por sus regiones" },
      { level: "B1", source: "BBC Mundo", sourceUrl: "https://www.bbc.com/mundo/articles/c5yw679ggjvo", topic: "Nómadas digitales en España: ¿oportunidad o amenaza?" },
      { level: "B2", source: "BBC Mundo", sourceUrl: "https://www.bbc.com/mundo/articles/c5yv2rlzd40o", topic: "La gran sequía europea: crisis hídrica y cambio climático" }
    ]
  },
  "2026-08-04": {
    date: "2026-08-04",
    weekday: "二",
    issue: 3,
    theme: "医院看病 · 租房找房 · 西班牙医疗体系 · 欧洲住房危机",
    sources: [
      { level: "A1", source: "DELE Ahora", sourceUrl: "https://deleahora.com/actividades/comprension-de-lectura", topic: "En el médico: una consulta rutinaria" },
      { level: "A2", source: "RTVE", sourceUrl: "https://www.rtve.es/noticias/sociedad/", topic: "Buscar piso en España: anuncios, precios y contratos" },
      { level: "B1", source: "BBC Mundo", sourceUrl: "https://www.bbc.com/mundo/articles/cx2mrppm26do", topic: "El sistema sanitario español: ¿modelo a seguir o en crisis?" },
      { level: "B2", source: "BBC Mundo", sourceUrl: "https://www.bbc.com/mundo/articles/czxq1ppnw18o", topic: "La crisis de vivienda en Europa: precios récord y desahucios" }
    ]
  },
  "2026-08-03": {
    date: "2026-08-03",
    weekday: "一",
    issue: 2,
    theme: "问路指路 · 餐厅点餐 · 西班牙旅游热潮 · 过度旅游争议",
    sources: [
      { level: "A1", source: "DELE Ahora", sourceUrl: "https://deleahora.com/actividades/comprension-de-lectura", topic: "Perdido en la ciudad: cómo pedir direcciones" },
      { level: "A2", source: "DELE Ahora", sourceUrl: "https://deleahora.com/actividades/a1-a2", topic: "En el restaurante: del menú a la cuenta" },
      { level: "B1", source: "RTVE", sourceUrl: "https://www.rtve.es/noticias/economia/", topic: "El turismo en España: el motor que mueve el país" },
      { level: "B2", source: "BBC Mundo", sourceUrl: "https://www.bbc.com/mundo/articles/ckgdmv8gz1jo", topic: "Turismofobia: el lado oscuro del paraíso turístico" }
    ]
  },
  "2026-08-02": {
    date: "2026-08-02",
    weekday: "日",
    issue: 1,
    theme: "家庭日常 · 天气描述 · 西班牙午睡文化 · 四天工作制实验",
    sources: [
      { level: "A1", source: "DELE Ahora", sourceUrl: "https://deleahora.com/actividades/comprension-de-lectura/la-familia-garcia-un-dia-normal", topic: "Un domingo en familia: rutinas y actividades" },
      { level: "A2", source: "RTVE", sourceUrl: "https://www.rtve.es/noticias/tiempo/", topic: "El tiempo en España: cuatro estaciones, mil climas" },
      { level: "B1", source: "BBC Mundo", sourceUrl: "https://www.bbc.com/mundo/articles/cgr7xknqgrjo", topic: "La siesta española: entre el mito y la productividad" },
      { level: "B2", source: "BBC Mundo", sourceUrl: "https://www.bbc.com/mundo/articles/crrvepyp5g2o", topic: "La semana laboral de cuatro días: el experimento europeo" }
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
      delete window.__REFINE_INFLIGHT[dateKey];  // Allow future reloads to re-execute script
      resolve(payload);
    };
    s.onerror = () => {
      delete window.__REFINE_INFLIGHT[dateKey];
      reject(new Error('Failed to load ' + s.src));
    };
    document.head.appendChild(s);
  });
  return window.__REFINE_INFLIGHT[dateKey];
};
