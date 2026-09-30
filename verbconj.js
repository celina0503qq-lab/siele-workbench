// ============================================================
// 动词变位引擎 v1.6 — 规则模板 + 高频不规则内置表（v1.6 2026-09-30: 批6 reír 类精校+irregularType 三态；v1.5: 批5 强变化过去式；v1.4: 批4 yo 增音族）
// 时态 14 项: presente/indefinido/imperfecto/perfecto/pluscuamperfecto
//   futuro/condicional/subjPresente/subjImperfecto(-ra/-se)/
//   subjPluscuamperfecto/imperativoAf/imperativoNeg/gerundio/participio
// 数据形态: 规则动词引擎生成; 不规则动词逐格精校内置表;
//   管理员覆盖走 content_edits(verbConj)
// ============================================================
(function () {
  'use strict';

  // ---------- 时态定义 ----------
  var TENSES = [
    { k: 'presente', zh: '陈述式现在时', n: 6 },
    { k: 'indefinido', zh: '简单过去式', n: 6 },
    { k: 'imperfecto', zh: '过去未完成时', n: 6 },
    { k: 'perfecto', zh: '现在完成时', n: 6 },
    { k: 'pluscuamperfecto', zh: '过去完成时', n: 6 },
    { k: 'futuro', zh: '简单将来时', n: 6 },
    { k: 'condicional', zh: '简单条件时', n: 6 },
    { k: 'subjPresente', zh: '虚拟式现在时', n: 6 },
    { k: 'subjImperfecto', zh: '虚拟式过去未完成时', n: 6, dual: true },
    { k: 'subjPluscuamperfecto', zh: '虚拟式过去完成时', n: 6, dual: true },
    { k: 'imperativoAf', zh: '命令式（肯定）', n: 4 },
    { k: 'imperativoNeg', zh: '命令式（否定）', n: 4 },
    { k: 'gerundio', zh: '副动词', n: 1 },
    { k: 'participio', zh: '过去分词', n: 1 }
  ];

  var PERSONS = ['yo', 'tú', 'él/ella/usted', 'nosotros/as', 'vosotros/as', 'ellos/ellas/ustedes'];
  var PERSONS_IMP = ['tú', 'vosotros/as', 'usted', 'ustedes'];

  // ---------- haber 变位(拼复合时态用) ----------
  var HABER = {
    presente: ['he', 'has', 'ha', 'hemos', 'habéis', 'han'],
    imperfecto: ['había', 'habías', 'había', 'habíamos', 'habíais', 'habían'],
    subjPresente: ['haya', 'hayas', 'haya', 'hayamos', 'hayáis', 'hayan'],
    subjImperfectoRa: ['hubiera', 'hubieras', 'hubiera', 'hubiéramos', 'hubierais', 'hubieran'],
    subjImperfectoSe: ['hubiese', 'hubieses', 'hubiese', 'hubiésemos', 'hubieseis', 'hubiesen']
  };

  // ---------- 10 个高频不规则动词逐格精校表 ----------
  // 规则: 6人称=presente/indefinido/imperfecto/futuro/condicional/subjPresente
  //       6人称×{ra,se}=subjImperfecto
  //       4人称=tú/vosotros/usted/ustedes 命令式
  //       1格=gerundio/participio
  //       复合时态(perfecto/pluscuamperfecto/subjPluscuamperfecto)由 participio 自动拼
  var IRREGULAR = {
    'ser': {
      presente: ['soy', 'eres', 'es', 'somos', 'sois', 'son'],
      indefinido: ['fui', 'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron'],
      imperfecto: ['era', 'eras', 'era', 'éramos', 'erais', 'eran'],
      futuro: ['seré', 'serás', 'será', 'seremos', 'seréis', 'serán'],
      condicional: ['sería', 'serías', 'sería', 'seríamos', 'seríais', 'serían'],
      subjPresente: ['sea', 'seas', 'sea', 'seamos', 'seáis', 'sean'],
      subjImperfecto: { ra: ['fuera', 'fueras', 'fuera', 'fuéramos', 'fuerais', 'fueran'], se: ['fuese', 'fueses', 'fuese', 'fuésemos', 'fueseis', 'fuesen'] },
      imperativoAf: ['sé', 'sed', 'sea', 'sean'],
      imperativoNeg: ['no seas', 'no seáis', 'no sea', 'no sean'],
      gerundio: 'siendo',
      participio: 'sido',
      tips: ["⚠️ RAE 辨析：ser 表本质/身份/属性，estar 表状态/位置（Ella es guapa 天生漂亮 vs está guapa 今天打扮漂亮）。","⚠️ 命令式 tú 是 sé（带重音符号），不是 se！sé = 命令式\"你是\"，se = 自复代词。","⚠️ 简单过去式 fui/fuiste/fue... 与 ir 完全相同，靠上下文判断。","⚠️ 虚拟式过去未完成时 fuera/fuese 两形都正确，考试可任选。"]
    },
    'estar': {
      presente: ['estoy', 'estás', 'está', 'estamos', 'estáis', 'están'],
      indefinido: ['estuve', 'estuviste', 'estuvo', 'estuvimos', 'estuvisteis', 'estuvieron'],
      imperfecto: ['estaba', 'estabas', 'estaba', 'estábamos', 'estabais', 'estaban'],
      futuro: ['estaré', 'estarás', 'estará', 'estaremos', 'estaréis', 'estarán'],
      condicional: ['estaría', 'estarías', 'estaría', 'estaríamos', 'estaríais', 'estarían'],
      subjPresente: ['esté', 'estés', 'esté', 'estemos', 'estéis', 'estén'],
      subjImperfecto: { ra: ['estuviera', 'estuvieras', 'estuviera', 'estuviéramos', 'estuvierais', 'estuvieran'], se: ['estuviese', 'estuvieses', 'estuviese', 'estuviésemos', 'estuvieseis', 'estuviesen'] },
      imperativoAf: ['está', 'estad', 'esté', 'estén'],
      imperativoNeg: ['no estés', 'no estéis', 'no esté', 'no estén'],
      gerundio: 'estando',
      participio: 'estado',
      tips: ["⚠️ 现在时重音：estoy/estás/está 三处带重音，estamos/estáis 也有。","⚠️ 简单过去式词干是 estuv-（estuve/estuviste/estuvo），不是 est-。","⚠️ 副动词是 estando，过去分词是 estado（estar + 分词表状态）。","⚠️ 命令式 tú 是 está（重音），与陈述式 él 相同。"]
    },
    'haber': {
      presente: ['he', 'has', 'ha', 'hemos', 'habéis', 'han'],
      indefinido: ['hube', 'hubiste', 'hubo', 'hubimos', 'hubisteis', 'hubieron'],
      imperfecto: ['había', 'habías', 'había', 'habíamos', 'habíais', 'habían'],
      futuro: ['habré', 'habrás', 'habrá', 'habremos', 'habréis', 'habrán'],
      condicional: ['habría', 'habrías', 'habría', 'habríamos', 'habríais', 'habrían'],
      subjPresente: ['haya', 'hayas', 'haya', 'hayamos', 'hayáis', 'hayan'],
      subjImperfecto: { ra: ['hubiera', 'hubieras', 'hubiera', 'hubiéramos', 'hubierais', 'hubieran'], se: ['hubiese', 'hubieses', 'hubiese', 'hubiésemos', 'hubieseis', 'hubiesen'] },
      imperativoAf: ['he', 'habed', 'haya', 'hayan'],
      imperativoNeg: ['no hayas', 'no hayáis', 'no haya', 'no hayan'],
      gerundio: 'habiendo',
      participio: 'habido',
      tips: ["⚠️ hay 是无人称\"有\"，haber 作为助动词时变位：he/has/ha/hemos/habéis/han。","⚠️ 简单过去式 hube/hubiste/hubo（词干 hub-），非常用但 DELE 会考。","⚠️ 虚拟式现在时 haya/hayas/haya（不要写成 haiga ❌，这是不规范口语）。","⚠️ 命令式极少用；hube 表示\"刚做完\"的完成用法更书面。"]
    },
    'ir': {
      presente: ['voy', 'vas', 'va', 'vamos', 'vais', 'van'],
      indefinido: ['fui', 'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron'],
      imperfecto: ['iba', 'ibas', 'iba', 'íbamos', 'ibais', 'iban'],
      futuro: ['iré', 'irás', 'irá', 'iremos', 'iréis', 'irán'],
      condicional: ['iría', 'irías', 'iría', 'iríamos', 'iríais', 'irían'],
      subjPresente: ['vaya', 'vayas', 'vaya', 'vayamos', 'vayáis', 'vayan'],
      subjImperfecto: { ra: ['fuera', 'fueras', 'fuera', 'fuéramos', 'fuerais', 'fueran'], se: ['fuese', 'fueses', 'fuese', 'fuésemos', 'fueseis', 'fuesen'] },
      imperativoAf: ['ve', 'id', 'vaya', 'vayan'],
      imperativoNeg: ['no vayas', 'no vayáis', 'no vaya', 'no vayan'],
      gerundio: 'yendo',
      participio: 'ido',
      tips: ["⚠️ 现在时完全不规则：voy/vas/va/vamos/vais/van（无 -ir 规律）。","⚠️ 简单过去式 fui/fuiste/fue 与 ser 完全相同！","⚠️ 副动词是 yendo（不是 iendo ❌），过去分词 ido。","⚠️ 命令式 tú 是 ve（不是 va ❌），vosotros 是 id。","⚠️ ir a + 不定式 = 将来意图（Voy a estudiar）。"]
    },
    'tener': {
      presente: ['tengo', 'tienes', 'tiene', 'tenemos', 'tenéis', 'tienen'],
      indefinido: ['tuve', 'tuviste', 'tuvo', 'tuvimos', 'tuvisteis', 'tuvieron'],
      imperfecto: ['tenía', 'tenías', 'tenía', 'teníamos', 'teníais', 'tenían'],
      futuro: ['tendré', 'tendrás', 'tendrá', 'tendremos', 'tendréis', 'tendrán'],
      condicional: ['tendría', 'tendrías', 'tendría', 'tendríamos', 'tendríais', 'tendrían'],
      subjPresente: ['tenga', 'tengas', 'tenga', 'tengamos', 'tengáis', 'tengan'],
      subjImperfecto: { ra: ['tuviera', 'tuvieras', 'tuviera', 'tuviéramos', 'tuvierais', 'tuvieran'], se: ['tuviese', 'tuvieses', 'tuviese', 'tuviésemos', 'tuvieseis', 'tuviesen'] },
      imperativoAf: ['ten', 'tened', 'tenga', 'tengan'],
      imperativoNeg: ['no tengas', 'no tengáis', 'no tenga', 'no tengan'],
      gerundio: 'teniendo',
      participio: 'tenido',
      tips: ["⚠️ 现在时第一人称 tengo 加 g；tú tienes/él tiene 变 e→ie。","⚠️ 简单过去式词干 tuv-（tuve/tuviste/tuvo），不是 ten-。","⚠️ 将来时 tendré/tendrás（去 e 加 dr-），条件式 tendría。","⚠️ 命令式 tú 是 ten，vosotros 是 tened。","⚠️ 固定搭配：tener hambre/sueño/prisa/razón（不用 ser/estar）。"]
    },
    'hacer': {
      presente: ['hago', 'haces', 'hace', 'hacemos', 'hacéis', 'hacen'],
      indefinido: ['hice', 'hiciste', 'hizo', 'hicimos', 'hicisteis', 'hicieron'],
      imperfecto: ['hacía', 'hacías', 'hacía', 'hacíamos', 'hacíais', 'hacían'],
      futuro: ['haré', 'harás', 'hará', 'haremos', 'haréis', 'harán'],
      condicional: ['haría', 'harías', 'haría', 'haríamos', 'haríais', 'harían'],
      subjPresente: ['haga', 'hagas', 'haga', 'hagamos', 'hagáis', 'hagan'],
      subjImperfecto: { ra: ['hiciera', 'hicieras', 'hiciera', 'hiciéramos', 'hicierais', 'hicieran'], se: ['hiciese', 'hicieses', 'hiciese', 'hiciésemos', 'hicieseis', 'hiciesen'] },
      imperativoAf: ['haz', 'haced', 'haga', 'hagan'],
      imperativoNeg: ['no hagas', 'no hagáis', 'no haga', 'no hagan'],
      gerundio: 'haciendo',
      participio: 'hecho',
      tips: ["⚠️ 现在时第一人称 hago（加 g）。","⚠️ 简单过去式：hice/hiciste/hizo（z 代替 c 保持 /θ/ 音！hizo 不是 hico ❌）。","⚠️ 将来时 haré/harás（去 ce 加 r-），条件式 haría。","⚠️ 命令式 tú 是 haz（不是 hace ❌）。","⚠️ 过去分词 hecho（不是 hacho/hacido ❌），用于 he hecho。"]
    },
    'venir': {
      presente: ['vengo', 'vienes', 'viene', 'venimos', 'venís', 'vienen'],
      indefinido: ['vine', 'viniste', 'vino', 'vinimos', 'vinisteis', 'vinieron'],
      imperfecto: ['venía', 'venías', 'venía', 'veníamos', 'veníais', 'venían'],
      futuro: ['vendré', 'vendrás', 'vendrá', 'vendremos', 'vendréis', 'vendrán'],
      condicional: ['vendría', 'vendrías', 'vendría', 'vendríamos', 'vendríais', 'vendrían'],
      subjPresente: ['venga', 'vengas', 'venga', 'vengamos', 'vengáis', 'vengan'],
      subjImperfecto: { ra: ['viniera', 'vinieras', 'viniera', 'viniéramos', 'vinierais', 'vinieran'], se: ['viniese', 'vinieses', 'viniese', 'viniésemos', 'vinieseis', 'viniesen'] },
      imperativoAf: ['ven', 'venid', 'venga', 'vengan'],
      imperativoNeg: ['no vengas', 'no vengáis', 'no venga', 'no vengan'],
      gerundio: 'viniendo',
      participio: 'venido',
      tips: ["⚠️ 现在时第一人称 vengo（加 g）；tú vienes/él viene 变 e→ie。","⚠️ 简单过去式词干 vin-（vine/viniste/vino）。","⚠️ 将来时 vendré/vendrás（去 e 加 dr-），条件式 vendría。","⚠️ 副动词 viniendo（注意双 n：ven- → vin-）。","⚠️ 命令式 tú 是 ven（与陈述式 él viene 不同）。"]
    },
    'poder': {
      presente: ['puedo', 'puedes', 'puede', 'podemos', 'podéis', 'pueden'],
      indefinido: ['pude', 'pudiste', 'pudo', 'pudimos', 'pudisteis', 'pudieron'],
      imperfecto: ['podía', 'podías', 'podía', 'podíamos', 'podíais', 'podían'],
      futuro: ['podré', 'podrás', 'podrá', 'podremos', 'podréis', 'podrán'],
      condicional: ['podría', 'podrías', 'podría', 'podríamos', 'podríais', 'podrían'],
      subjPresente: ['pueda', 'puedas', 'pueda', 'podamos', 'podáis', 'puedan'],
      subjImperfecto: { ra: ['pudiera', 'pudieras', 'pudiera', 'pudiéramos', 'pudierais', 'pudieran'], se: ['pudiese', 'pudieses', 'pudiese', 'pudiésemos', 'pudieseis', 'pudiesen'] },
      imperativoAf: ['puede', 'podéis', 'pueda', 'puedan'],
      imperativoNeg: ['no puedas', 'no podáis', 'no pueda', 'no puedan'],
      gerundio: 'pudiendo',
      participio: 'podido',
      tips: ["⚠️ 现在时 o→ue：puedo/puedes/puede，nosotros/vosotros 保留 o（podemos/podéis）。","⚠️ 简单过去式词干 pud-（pude/pudiste/pudo）。","⚠️ 将来时 podré/podrás（去 er 加 dr-）。","⚠️ 虚拟式现在时 pueda/puedas...podamos/podáis/puedan。","⚠️ 命令式实际很少用（poder 表能力，命令语气弱）。"]
    },
    'decir': {
      presente: ['digo', 'dices', 'dice', 'decimos', 'decís', 'dicen'],
      indefinido: ['dije', 'dijiste', 'dijo', 'dijimos', 'dijisteis', 'dijeron'],
      imperfecto: ['decía', 'decías', 'decía', 'decíamos', 'decíais', 'decían'],
      futuro: ['diré', 'dirás', 'dirá', 'diremos', 'diréis', 'dirán'],
      condicional: ['diría', 'dirías', 'diría', 'diríamos', 'diríais', 'dirían'],
      subjPresente: ['diga', 'digas', 'diga', 'digamos', 'digáis', 'digan'],
      subjImperfecto: { ra: ['dijera', 'dijeras', 'dijera', 'dijéramos', 'dijerais', 'dijeran'], se: ['dijese', 'dijeses', 'dijese', 'dijésemos', 'dijeseis', 'dijesen'] },
      imperativoAf: ['di', 'decid', 'diga', 'digan'],
      imperativoNeg: ['no digas', 'no digáis', 'no diga', 'no digan'],
      gerundio: 'diciendo',
      participio: 'dicho',
      tips: ["⚠️ 现在时第一人称 digo（g）；tú dices/él dice 变 e→i。","⚠️ 简单过去式词干 dij-（dije/dijiste/dijo），第三人称复数 dijeron（不是 dijieron ❌）。","⚠️ 将来时 diré/dirás（去 ec 加 r-），条件式 diría。","⚠️ 命令式 tú 是 di（与陈述式 él dice 不同）。","⚠️ 过去分词 dicho：he dicho（不是 decido ❌）。"]
    },
    'salir': {
      presente: ['salgo', 'sales', 'sale', 'salimos', 'salís', 'salen'],
      indefinido: ['salí', 'saliste', 'salió', 'salimos', 'salisteis', 'salieron'],
      imperfecto: ['salía', 'salías', 'salía', 'salíamos', 'salíais', 'salían'],
      futuro: ['saldré', 'saldrás', 'saldrá', 'saldremos', 'saldréis', 'saldrán'],
      condicional: ['saldría', 'saldrías', 'saldría', 'saldríamos', 'saldríais', 'saldrían'],
      subjPresente: ['salga', 'salgas', 'salga', 'salgamos', 'salgáis', 'salgan'],
      subjImperfecto: { ra: ['saliera', 'salieras', 'saliera', 'saliéramos', 'salierais', 'salieran'], se: ['saliese', 'salieses', 'saliese', 'saliésemos', 'salieseis', 'saliesen'] },
      imperativoAf: ['sal', 'salid', 'salga', 'salgan'],
      imperativoNeg: ['no salgas', 'no salgáis', 'no salga', 'no salgan'],
      gerundio: 'saliendo',
      participio: 'salido',
      tips: ["⚠️ 现在时第一人称 salgo（加 g）。","⚠️ 将来时 saldré/saldrás（加 dr-），条件式 saldría。","⚠️ 命令式 tú 是 sal（与 salir 原形同形）。","⚠️ 虚拟式现在时 salga/salgas/salga...salgan。","⚠️ 简单过去式是规则的：salí/saliste/salió。"]
    },
    'dar': {
      presente: ['doy', 'das', 'da', 'damos', 'dais', 'dan'],
      indefinido: ['di', 'diste', 'dio', 'dimos', 'disteis', 'dieron'],
      imperfecto: ['daba', 'dabas', 'daba', 'd\u00e1bamos', 'dabais', 'daban'],
      futuro: ['dar\u00e9', 'dar\u00e1s', 'dar\u00e1', 'daremos', 'dar\u00e9is', 'dar\u00e1n'],
      condicional: ['dar\u00eda', 'dar\u00edas', 'dar\u00eda', 'dar\u00edamos', 'dar\u00edais', 'dar\u00edan'],
      subjPresente: ['d\u00e9', 'des', 'd\u00e9', 'demos', 'deis', 'den'],
      subjImperfecto: { ra: ['diera', 'dieras', 'diera', 'di\u00e9ramos', 'dierais', 'dieran'], se: ['diese', 'dieses', 'diese', 'di\u00e9semos', 'dieseis', 'diesen'] },
      imperativoAf: ['da', 'dad', 'd\u00e9', 'den'],
      imperativoNeg: ['no des', 'no deis', 'no d\u00e9', 'no den'],
      gerundio: 'dando',
      participio: 'dado',
      tips: ["⚠️ 现在时 yo 是 doy（-oy）；tú das/él da 完全规则。","⚠️ 虚拟式现在时 dé/des/dé/demos/deis/den——单音节 dé 带重音！","⚠️ 简单过去式 di/diste/dio/dimos（dio 不写 dió ❌）。","⚠️ 命令式 tú 是 da，usted 是 dé（带重音）。"]
    },
    'ver': {
      presente: ['veo', 'ves', 've', 'vemos', 'veis', 'ven'],
      indefinido: ['vi', 'viste', 'vio', 'vimos', 'visteis', 'vieron'],
      imperfecto: ['ve\u00eda', 've\u00edas', 've\u00eda', 've\u00edamos', 've\u00edais', 've\u00edan'],
      futuro: ['ver\u00e9', 'ver\u00e1s', 'ver\u00e1', 'veremos', 'ver\u00e9is', 'ver\u00e1n'],
      condicional: ['ver\u00eda', 'ver\u00edas', 'ver\u00eda', 'ver\u00edamos', 'ver\u00edais', 'ver\u00edan'],
      subjPresente: ['vea', 'veas', 'vea', 'veamos', 've\u00e1is', 'vean'],
      subjImperfecto: { ra: ['viera', 'vieras', 'viera', 'vi\u00e9ramos', 'vierais', 'vieran'], se: ['viese', 'vieses', 'viese', 'vi\u00e9semos', 'vieseis', 'viesen'] },
      imperativoAf: ['ve', 'ved', 'vea', 'vean'],
      imperativoNeg: ['no veas', 'no ve\u00e1is', 'no vea', 'no vean'],
      gerundio: 'viendo',
      participio: 'visto',
      tips: ["⚠️ 过去分词是 visto（he visto），不是 vido ❌。","⚠️ 简单过去式 vi/viste/vio/vimos（vi/vio 单音节不加重音）。","⚠️ 虚拟式过去未完成 viera/viese（不是 veiera ❌）。","⚠️ 副动词 viendo。"]    },
    're\u00edr': {
      presente: ['r\u00edo', 'r\u00edes', 'r\u00ede', 're\u00edmos', 're\u00eds', 'r\u00eden'],
      indefinido: ['re\u00ed', 're\u00edste', 'ri\u00f3', 're\u00edmos', 're\u00edsteis', 'rieron'],
      imperfecto: ['re\u00eda', 're\u00edas', 're\u00eda', 're\u00edamos', 're\u00edais', 're\u00edan'],
      futuro: ['reir\u00e9', 'reir\u00e1s', 'reir\u00e1', 'reiremos', 'reir\u00e9is', 'reir\u00e1n'],
      condicional: ['reir\u00eda', 'reir\u00edas', 'reir\u00eda', 'reir\u00edamos', 'reir\u00edais', 'reir\u00edan'],
      subjPresente: ['r\u00eda', 'r\u00edas', 'r\u00eda', 'riamos', 'ri\u00e1is', 'r\u00edan'],
      subjImperfecto: { ra: ['riera', 'rieras', 'riera', 'ri\u00e9ramos', 'rierais', 'rieran'], se: ['riese', 'rieses', 'riese', 'ri\u00e9semos', 'rieseis', 'riesen'] },
      imperativoAf: ['r\u00ede', 're\u00edd', 'r\u00eda', 'r\u00edan'],
      imperativoNeg: ['no r\u00edas', 'no ri\u00e1is', 'no r\u00eda', 'no r\u00edan'],
      gerundio: 'riendo',
      participio: 're\u00eddo',
      tips: ["⚠️ 现在时重读 í 带重音：río/ríes/ríe/ríen，nosotros/vosotros 无重音（reímos/reís）。","⚠️ 简单过去式 reí/reíste/rió…第三人称 rió 与复数 rieron 变 y！","⚠️ 虚拟式现在时 ría/rías/ría/riamos/riáis/rían。","⚠️ 副动词 riendo（不是 reiendo ❌）。","⚠️ 命令式 tú 是 ríe（带重音），usted 是 ría。"]
    },
    'sonre\u00edr': {
      presente: ['sonr\u00edo', 'sonr\u00edes', 'sonr\u00ede', 'sonre\u00edmos', 'sonre\u00eds', 'sonr\u00eden'],
      indefinido: ['sonre\u00ed', 'sonre\u00edste', 'sonri\u00f3', 'sonre\u00edmos', 'sonre\u00edsteis', 'sonrieron'],
      imperfecto: ['sonre\u00eda', 'sonre\u00edas', 'sonre\u00eda', 'sonre\u00edamos', 'sonre\u00edais', 'sonre\u00edan'],
      futuro: ['sonreir\u00e9', 'sonreir\u00e1s', 'sonreir\u00e1', 'sonreiremos', 'sonreir\u00e9is', 'sonreir\u00e1n'],
      condicional: ['sonreir\u00eda', 'sonreir\u00edas', 'sonreir\u00eda', 'sonreir\u00edamos', 'sonreir\u00edais', 'sonreir\u00edan'],
      subjPresente: ['sonr\u00eda', 'sonr\u00edas', 'sonr\u00eda', 'sonriamos', 'sonri\u00e1is', 'sonr\u00edan'],
      subjImperfecto: { ra: ['sonriera', 'sonrieras', 'sonriera', 'sonri\u00e9ramos', 'sonrierais', 'sonrieran'], se: ['sonriese', 'sonrieses', 'sonriese', 'sonri\u00e9semos', 'sonrieseis', 'sonriesen'] },
      imperativoAf: ['sonr\u00ede', 'sonre\u00edd', 'sonr\u00eda', 'sonr\u00edan'],
      imperativoNeg: ['no sonr\u00edas', 'no sonri\u00e1is', 'no sonr\u00eda', 'no sonr\u00edan'],
      gerundio: 'sonriendo',
      participio: 'sonre\u00eddo',
      tips: ["⚠️ 变位与 reír 完全同构（词干 son- + río 系）。","⚠️ 现在时 sonrío/sonríes/sonríe/sonríen 重读 í 带重音。","⚠️ 简单过去式 sonreí/sonreíste/sonrió…第三人称与复数变 y。","⚠️ 副动词 sonriendo。","⚠️ 命令式 tú 是 sonríe，usted 是 sonría。"]
    },
    'fre\u00edr': {
      presente: ['fr\u00edo', 'fr\u00edes', 'fr\u00ede', 'fre\u00edmos', 'fre\u00eds', 'fr\u00eden'],
      indefinido: ['fre\u00ed', 'fre\u00edste', 'fri\u00f3', 'fre\u00edmos', 'fre\u00edsteis', 'frieron'],
      imperfecto: ['fre\u00eda', 'fre\u00edas', 'fre\u00eda', 'fre\u00edamos', 'fre\u00edais', 'fre\u00edan'],
      futuro: ['freir\u00e9', 'freir\u00e1s', 'freir\u00e1', 'freiremos', 'freir\u00e9is', 'freir\u00e1n'],
      condicional: ['freir\u00eda', 'freir\u00edas', 'freir\u00eda', 'freir\u00edamos', 'freir\u00edais', 'freir\u00edan'],
      subjPresente: ['fr\u00eda', 'fr\u00edas', 'fr\u00eda', 'friamos', 'fri\u00e1is', 'fr\u00edan'],
      subjImperfecto: { ra: ['friera', 'frieras', 'friera', 'fri\u00e9ramos', 'frierais', 'frieran'], se: ['friese', 'frieses', 'friese', 'fri\u00e9semos', 'frieseis', 'friesen'] },
      imperativoAf: ['fr\u00ede', 'fre\u00edd', 'fr\u00eda', 'fr\u00edan'],
      imperativoNeg: ['no fr\u00edas', 'no fri\u00e1is', 'no fr\u00eda', 'no fr\u00edan'],
      gerundio: 'friendo',
      participio: 'frito',
      tips: ["⚠️ 变位与 reír 同构（frío/fríes/fríe/freímos/freís/fríen）。","⚠️ 简单过去式 freí/freíste/frió…第三人称与复数变 y（frió/frieron）。","⚠️ 过去分词第一不规则形 frito（he frito），freído 也正确。","⚠️ 副动词 friendo（不是 friiendo ❌）。","⚠️ 虚拟式 fría/frías/fría/friamos/friáis/frían。"]
    }
  };

  // ---------- 规则动词模板(-ar/-er/-ir) ----------
  var RULE_TEMPLATES = {
    'ar': {
      presente: ['-o', '-as', '-a', '-amos', '-áis', '-an'],
      indefinido: ['-é', '-aste', '-ó', '-amos', '-asteis', '-aron'],
      imperfecto: ['-aba', '-abas', '-aba', '-ábamos', '-abais', '-aban'],
      futuro: ['-é', '-ás', '-á', '-emos', '-éis', '-án'],
      condicional: ['-ía', '-ías', '-ía', '-íamos', '-íais', '-ían'],
      subjPresente: ['-e', '-es', '-e', '-emos', '-éis', '-en'],
      subjImperfecto: { ra: ['-ara', '-aras', '-ara', '-áramos', '-arais', '-aran'], se: ['-ase', '-ases', '-ase', '-ásemos', '-aseis', '-asen'] },
      imperativoAf: ['-a', '-ad', '-e', '-en'],
      imperativoNeg: ['-es', '-éis', '-e', '-en'],
      gerundio: '-ando',
      participio: '-ado'
    },
    'er': {
      presente: ['-o', '-es', '-e', '-emos', '-éis', '-en'],
      indefinido: ['-í', '-iste', '-ió', '-imos', '-isteis', '-ieron'],
      imperfecto: ['-ía', '-ías', '-ía', '-íamos', '-íais', '-ían'],
      futuro: ['-é', '-ás', '-á', '-emos', '-éis', '-án'],
      condicional: ['-ía', '-ías', '-ía', '-íamos', '-íais', '-ían'],
      subjPresente: ['-a', '-as', '-a', '-amos', '-áis', '-an'],
      subjImperfecto: { ra: ['-iera', '-ieras', '-iera', '-iéramos', '-ierais', '-ieran'], se: ['-iese', '-ieses', '-iese', '-iésemos', '-ieseis', '-iesen'] },
      imperativoAf: ['-e', '-ed', '-a', '-an'],
      imperativoNeg: ['-as', '-áis', '-a', '-an'],
      gerundio: '-iendo',
      participio: '-ido'
    },
    'ir': {
      presente: ['-o', '-es', '-e', '-imos', '-ís', '-en'],
      indefinido: ['-í', '-iste', '-ió', '-imos', '-isteis', '-ieron'],
      imperfecto: ['-ía', '-ías', '-ía', '-íamos', '-íais', '-ían'],
      futuro: ['-é', '-ás', '-á', '-emos', '-éis', '-án'],
      condicional: ['-ía', '-ías', '-ía', '-íamos', '-íais', '-ían'],
      subjPresente: ['-a', '-as', '-a', '-amos', '-áis', '-an'],
      subjImperfecto: { ra: ['-iera', '-ieras', '-iera', '-iéramos', '-ierais', '-ieran'], se: ['-iese', '-ieses', '-iese', '-iésemos', '-ieseis', '-iesen'] },
      imperativoAf: ['-e', '-id', '-a', '-an'],
      imperativoNeg: ['-as', '-áis', '-a', '-an'],
      gerundio: '-iendo',
      participio: '-ido'
    }
  };

  // ---------- A2 修复 (v1.1 2026-09-28): 将来时/条件式不规则词干 ----------
  // 西语 futuro/condicional = 「原形+后缀」(hablar→hablaré / hablaría)，
  // 不是「词干+后缀」。12 个高频不规则词干（RAE 对照）+ 常用派生族后缀匹配。
  var FUT_STEM = {
    tener: 'tendr', poner: 'pondr', salir: 'saldr', venir: 'vendr',
    poder: 'podr', hacer: 'har', decir: 'dir', haber: 'habr',
    querer: 'querr', saber: 'sabr', caber: 'cabr', valer: 'valdr'
  };
  // 常用派生族: mantener→mantendré / componer→compondré / intervenir→intervendré /
  // sobresalir→sobresaldré / oponer→opondré / rehacer→reharé（前缀≥1字母生效）
  // ⚠️ decir 族不在派生表：RAE 现行 bendeciré/maldeciré/desdeciré/predeciré 均以规则形
  // 为第一形（仅 desdecir/predecir 认可 -diré 第二形），decir 本体走内置精校表 diré。
  var FUT_STEM_DER = [
    [/tener$/, 'tendr'], [/poner$/, 'pondr'], [/salir$/, 'saldr'],
    [/venir$/, 'vendr'], [/poder$/, 'podr'], [/hacer$/, 'har'],
    [/haber$/, 'habr'], [/querer$/, 'querr'],
    [/saber$/, 'sabr'], [/caber$/, 'cabr'], [/valer$/, 'valdr']
  ];
  // 例外: 未来时保持规则原形（防御性保留；/decir$/ 已从派生表移除）
  var FUT_REGULAR_EXCEPT = { bendecir: 1 };
  function futStemOf(verb) {
    if (FUT_REGULAR_EXCEPT[verb]) return verb;
    if (Object.prototype.hasOwnProperty.call(FUT_STEM, verb)) return FUT_STEM[verb];
    for (var i = 0; i < FUT_STEM_DER.length; i++) {
      var re = FUT_STEM_DER[i][0];
      if (re.test(verb) && verb.replace(re, '').length >= 1) {
        return verb.replace(re, FUT_STEM_DER[i][1]);
      }
    }
    return verb;
  }

  // ---------- 批3 (v1.2 2026-09-28): 词干变化 + 拼写适配 ----------
  // 词干变化表: 原形(无代词) -> 变化后词干(presente 1/2/3/6 与虚拟式重读形式)
  // 家族自动推导: 词干含 ie=e族 / 含 ue=o族 / 否则=i族
  var STEM_CH = {
    // e→ie (-ar)
    pensar:'piens', acertar:'aciert', acrecentar:'acrecient', alentar:'alient', apretar:'apriet', arrendar:'arriend', asentar:'asient', atravesar:'atravies', calentar:'calient', comenzar:'comienz', confesar:'confies', denegar:'denieg', desenterrar:'desentierr', despertar:'despiert', empezar:'empiez', fregar:'frieg', helar:'hiel', merendar:'meriend', negar:'nieg', nevar:'niev', quebrar:'quiebr', recomendar:'recomiend', sembrar:'siembr', sentar:'sient', sosegar:'sosieg', temblar:'tiembl', tropezar:'tropiez',
    // e→ie (-er)
    atender:'atiend', ascender:'asciend', defender:'defiend', descender:'desciend', entender:'entiend', perder:'pierd', querer:'quier', verter:'viert', mantener:'mantien', obtener:'obtien', contener:'contien', retener:'retien', detener:'detien', sostener:'sostien', abstener:'abstien',
    // e→ie (-ir)
    adherir:'adhier', advertir:'adviert', adquirir:'adquier', convertir:'conviert', controvertir:'controviert', diferir:'difier', discernir:'disciern', hervir:'hierv', ingerir:'ingier', mentir:'mient', preferir:'prefier', referir:'refier', sentir:'sient', sugerir:'sugier',
    // o→ue (-ar)
    acordar:'acuerd', acostar:'acuest', almorzar:'almuerz', apostar:'apuest', avergonzar:'averg\u00fcenz', colgar:'cuelg', comprobar:'comprueb', contar:'cuent', costar:'cuest', demostrar:'demuestr', descontar:'descuent', encontrar:'encuentr', esforzar:'fuerz', mostrar:'muestr', probar:'prueb', recostar:'recuest', recordar:'recuerd', reforzar:'refuerz', renovar:'renuev', rogar:'rueg', soltar:'suelt', sonar:'suen', volar:'vuel', volcar:'vuelc',
    // o→ue (-er/-ir)
    cocer:'cuez', devolver:'devuelv', desenvolver:'desenvuelv', doler:'duel', morder:'muerd', oler:'huel', promover:'promuev', solar:'suel', soler:'suel', torcer:'tuerz', volver:'vuelv', dormir:'duerm', morir:'muerm',
    // e→i (-ir)
    'ce\u00f1ir':'ci\u00f1', competir:'compit', concebir:'concib', conseguir:'consig', corregir:'corrij', derretir:'derrit', elegir:'elij', expedir:'expid', impedir:'impid', medir:'mid', pedir:'pid', despedir:'despid', rendir:'rind', repetir:'repit', seguir:'sig', servir:'sirv', 'te\u00f1ir':'ti\u00f1', vestir:'vist',
    // u→ue 特例
    jugar:'jueg', erguir:'yerg',
    // B4: -ger/-gir/-guir yo g→j 组 (subj nosotros 全 j; -guir 裸 g)
    acoger:'acoj', coger:'coj', escoger:'escoj', proteger:'protej', recoger:'recoj', exigir:'exij', infligir:'inflij', restringir:'restrinj', surgir:'surj', resurgir:'resurj', distinguir:'disting', extinguir:'exting'
  };
  // 虚拟式全 6 人称变化组: 所有 -ir 词干变化动词 + 下表例外(jugar)
  var STEM_CH_FULL = { jugar: 1 };
  // presente tú/él/ellos 词干覆盖: yo 与重读形式词干分离的词
  // (-guir: g 裸/gu; -gir 软音: yo 用 j 其余 g; -cer 音位: z→c 于 e 系后缀)
  var STEM_CH_ALT = { seguir:'sigu', conseguir:'consigu', elegir:'elig', corregir:'corrig', cocer:'cuec', torcer:'tuerc', acoger:'acog', coger:'cog', escoger:'escog', proteger:'proteg', recoger:'recog', exigir:'exig', infligir:'inflig', restringir:'restring', surgir:'surg', resurgir:'resurg', distinguir:'distingu', extinguir:'extingu' };
  // 全变化组虚拟式 nosotros/vosotros 词干覆盖(跟随过去式 3 人称词干; 家族推导不适用的词全显式)
  var STEM_CH_NOS = {
    jugar:'juegu',
    sentir:'sint', preferir:'prefir', referir:'refir', diferir:'difir', sugerir:'sugir', ingerir:'ingir', adherir:'adhir', advertir:'advirt', convertir:'convirt', controvertir:'controvirt', mentir:'mint', hervir:'hirv', adquirir:'adquir', discernir:'discern',
    dormir:'durm', morir:'mur', cocer:'coz', torcer:'torz', erguir:'irg',
    // B4: -ger 组 subj nosotros j (RAE: cojamos/recojamos/protejamos/acojamos/escojamos)
    acoger:'acoj', coger:'coj', escoger:'escoj', proteger:'protej', recoger:'recoj'
  };
  // -iar/-uar 重音断裂: 显式重读词干(presente 1/2/3/6 + subj 1/2/3/6; nosotros/vosotros 恒用原词干)
  var ACC_CH = { aliar:'al\u00ed', actuar:'act\u00fa', continuar:'contin\u00fa', desafiar:'desaf\u00ed', confiar:'conf\u00ed', criar:'cr\u00ed', evaluar:'eval\u00fa', reevaluar:'reeval\u00fa', fiar:'f\u00ed', graduar:'grad\u00fa', liar:'l\u00ed', perpetuar:'perpet\u00fa', reenviar:'reenv\u00ed', enviar:'env\u00ed', reunir:'re\u00fan', 'desconfiar':'desconf\u00ed', 'expiar':'exp\u00ed', 'mecanografiar':'mecanograf\u00ed', 'fluctuar':'fluct\u00fa', tatuar:'tat\u00fa', vaciar:'vac\u00ed', variar:'var\u00ed' };
  // -uir 类 y 插入: presente 1/2/3/6 + subj 全 6 人称 (construyo/construya)
  var UIR_CH = { construir:1, contribuir:1, destruir:1, incluir:1, constituir:1, influir:1, intuir:1, obstruir:1, reconstruir:1, fluir:1, sustituir:1 };
  // -guar 类 ü: presente 全规则(apaciguo); 虚拟式全 6 人称 + 命令式 usted 系用 ü 词干 (apacigüe/averigüe)
  // B4: 名词误入动词表的跳过 (cáncer 走 zc 规则会产出 cánczco 垃圾形)
  var ZC_SKIP = { cancer: 1 };
  var GU_CH = { 'apaciguar':'apacig\u00fc', 'averiguar':'averig\u00fc' };
  // B4 (v1.4 2026-09-29): yo 增音族显式覆盖 (RAE 逐词核查)
  // yo=presente[0] 全形; t2/t3/t6=presente tú/él/ellos 覆盖; subj=subjPresente 全 6 人称词干;
  // imp0=imperativoAf tú 覆盖; ger=gerundio 覆盖; siY=gerundio+indefinido[3,6]+subjImperfecto y 音位(ai→ay); gerY=仅 gerundio ai→ay
  var GO_CH = {
    // tener 族 (ie 词干已在 STEM_CH; subj 全 -eng; imp tú -tén)
    abstener:{yo:'abstengo',subj:'absteng',imp0:'abst\u00e9n'}, contener:{yo:'contengo',subj:'conteng',imp0:'cont\u00e9n'}, detener:{yo:'detengo',subj:'deteng',imp0:'det\u00e9n'}, mantener:{yo:'mantengo',subj:'manteng',imp0:'mant\u00e9n'}, obtener:{yo:'obtengo',subj:'obteng',imp0:'obt\u00e9n'}, retener:{yo:'retengo',subj:'reteng',imp0:'ret\u00e9n'}, sostener:{yo:'sostengo',subj:'sosteng',imp0:'sost\u00e9n'},
    // poner 族 (无词干变化; imp tú 短形 -pon; disponer/imponer/proponer/suponer 带 ó)
    poner:{yo:'pongo',subj:'pong',imp0:'pon'}, componer:{yo:'compongo',subj:'compong',imp0:'compon'}, descomponer:{yo:'descompongo',subj:'descompong',imp0:'descompon'}, disponer:{yo:'dispongo',subj:'dispong',imp0:'disp\u00f3n'}, imponer:{yo:'impongo',subj:'impong',imp0:'imp\u00f3n'}, proponer:{yo:'propongo',subj:'propong',imp0:'prop\u00f3n'}, suponer:{yo:'supongo',subj:'supong',imp0:'sup\u00f3n'},
    // salir 族 / venir 族 (ie 词干 + imp tú 重音短形)
    sobresalir:{yo:'sobresalgo',subj:'sobresalg',imp0:'sobresal'},
    convenir:{yo:'convengo',t2:'convienes',t3:'conviene',t6:'convienen',subj:'conveng',imp0:'conv\u00e9n'},
    intervenir:{yo:'intervengo',t2:'intervienes',t3:'interviene',t6:'intervienen',subj:'interveng',imp0:'interv\u00e9n'},
    prevenir:{yo:'prevengo',t2:'previenes',t3:'previene',t6:'previenen',subj:'preveng',imp0:'prev\u00e9n'},
    // decir 族 (ellos i 词干; ger i 音位 bendiciendo/prediciendo)
    bendecir:{yo:'bendigo',t2:'bendices',t3:'bendice',t6:'bendicen',subj:'bendig',ger:'bendiciendo'},
    predecir:{yo:'predigo',t2:'predices',t3:'predice',t6:'predicen',subj:'predig',ger:'prediciendo'},
    // valer / caber (subj 全 6 用增音词干)
    valer:{yo:'valgo',subj:'valg'}, caber:{yo:'quepo',subj:'quep'},
    // caer 族 (y 音位: cayendo/cayó/cayeron/cayera)
    caer:{yo:'caigo',subj:'caig',siY:1}, decaer:{yo:'decaigo',subj:'decaig',siY:1}, recaer:{yo:'recaigo',subj:'recaig',siY:1},
    // traer 族 (indef/subjImp 是 j 强变化→批5; 本批仅 ger y: trayendo/atrayendo)
    traer:{yo:'traigo',subj:'traig',gerY:1}, atraer:{yo:'atraigo',subj:'atraig',gerY:1}, distraer:{yo:'distraigo',subj:'distraig',gerY:1}, extraer:{yo:'extraigo',subj:'extraig',gerY:1},
    // -cer/-cir 例外组 (c→z 不插 c)
    vencer:{yo:'venzo',subj:'venz'}, convencer:{yo:'convenzo',subj:'convenz'}, ejercer:{yo:'ejerzo',subj:'ejerz'}, esparcir:{yo:'esparzo',subj:'esparz'}, fruncir:{yo:'frunzo',subj:'frunz'}, resarcir:{yo:'resarzo',subj:'resarz'},
    // -eer 组 (RAE: creí/creyó/creyendo/creyera; c. leer)
    creer:{siE:1}, poseer:{siE:1}
  };
  // -ar 虚拟式/命令式 usted 系拼写适配: -car→qu / -gar→gu / -zar→c (busque/llegue/empiece)
  // 注意后缀首字符含重音 é 也触发 (busquéis)
  var orthAr = function (st, suf) {
    var c0 = suf.charAt(0);
    if (c0 === 'e' || c0 === '\u00e9') {
      if (/c$/.test(st)) return st.slice(0, -1) + 'qu' + suf;
      if (/g$/.test(st)) return st.slice(0, -1) + 'gu' + suf;
      if (/z$/.test(st)) return st.slice(0, -1) + 'c' + suf;
    }
    return st + suf;
  };
  // B5 (v1.5 2026-09-29): 强变化过去式词干 (indefinido 全 6 + subjImperfecto ra/se 同词干; RAE 核查)
  // 后缀: e/iste/o/imos/isteis/ieron (单音节无重音) + iera 系 / -iese 系
  var STRONG_PRET = {
    abstener:'abstuv', contener:'contuv', detener:'detuv', mantener:'mantuv', obtener:'obtuv', retener:'retuv', sostener:'sostuv',
    poner:'pus', componer:'compus', descomponer:'descompus', disponer:'dispus', imponer:'impus', proponer:'propus', suponer:'supus',
    convenir:'convin', intervenir:'intervin', prevenir:'previn', bendecir:'bendij', predecir:'predij',
    traer:'traj', atraer:'atraj', distraer:'distraj', extraer:'extraj', caber:'cup', querer:'quis', andar:'anduv',
    conducir:'conduj', deducir:'deduj', inducir:'induj', introducir:'introduj', reducir:'reduj', seducir:'seduj', traducir:'traduj'
  };
  // B5: 不规则过去分词 (RAE 第一形; 复合时态由 buildCompound 自动拼)
  var PART_IRREG = {
    poner:'puesto', componer:'compuesto', descomponer:'descompuesto', disponer:'dispuesto', imponer:'impuesto', proponer:'propuesto', suponer:'supuesto',
    volver:'vuelto', devolver:'devuelto', desenvolver:'desenvuelto', morir:'muerto', cubrir:'cubierto', descubrir:'descubierto', describir:'descrito', suscribir:'suscrito',
    // B5b: 元音词干分词重音 í (RAE: creído/caído/traído 系)
    creer:'cre\u00eddo', poseer:'pose\u00eddo', caer:'ca\u00eddo', decaer:'deca\u00eddo', recaer:'reca\u00eddo', traer:'tra\u00eddo', atraer:'atra\u00eddo', distraer:'distra\u00eddo', extraer:'extra\u00eddo'
  };
  // ---------- 工具 ----------
  function stemOf(verb) { return verb.slice(0, -2); }
  function endingOf(verb) { return verb.slice(-2); }

  function isIrregular(verb) {
    var v = stripPronoun(verb);
    return Object.prototype.hasOwnProperty.call(IRREGULAR, v);
  }
  // B6 (v1.6): 不规则类型标记 full=完全精校 / partial=局部不规则(词干变化/yo增音/强变化/分词/拼写适配) / null=纯规则
  function irregularTypeOf(verb) {
    var v = stripPronoun(verb);
    if (Object.prototype.hasOwnProperty.call(IRREGULAR, v)) return 'full';
    if (STEM_CH[v] || GO_CH[v] || STRONG_PRET[v] || PART_IRREG[v] || ACC_CH[v] || UIR_CH[v] || GU_CH[v]) return 'partial';
    var end = endingOf(v);
    if ((end === 'er' && /cer$/.test(v) && !ZC_SKIP[v]) || (end === 'ir' && /cir$/.test(v))) return 'partial';
    return null;
  }
  // 提取代词式动词原形: dormirse -> dormir, se 前缀保留在返回的 meta
  function stripPronoun(verb) {
    var prons = ['me', 'te', 'se', 'nos', 'os'];
    for (var i = 0; i < prons.length; i++) {
      var suf = prons[i];
      if (verb.length > suf.length + 2 && verb.slice(-suf.length) === suf) {
        var core = verb.slice(0, -suf.length);
        // 只认以 ar/er/ir 结尾的原形(如 dormirse -> dormir)
        if (/[aeiou]n?[aeiou]$/.test(core) || /(ar|er|ir|\u00edr)$/.test(core)) {
          return core;
        }
      }
    }
    return verb;
  }

  // 规则生成: 模板后缀替换
  function conjRegular(verb) {
    var stem = stemOf(verb);
    var end = endingOf(verb);
    var tpl = RULE_TEMPLATES[end];
    if (!tpl) return null;
    // 模板后缀用连字符作占位标记（如 '-o'），拼接时去掉，产出真实变位（vivo 而非 viv-o）
    var glue = function (suf) { return stem + suf.replace(/^-/, ''); };
    // B3 (v1.2): -ar 虚拟式/命令式(usted 系)拼写适配 (busque/llegue/empiece/no busques/busquéis)
    var glueE = function (suf) {
      suf = suf.replace(/^-/, '');
      if (end === 'ar') return orthAr(stem, suf);
      return stem + suf;
    };
    // A2 修复 (v1.1 2026-09-28): futuro/condicional 用「原形/不规则词干」而非「词干」。
    // indefinido 的 -é 仍是词干+后缀（hablé 正确），勿混淆。
    var futStem = futStemOf(verb);
    var glueFut = function (suf) { return futStem + suf.replace(/^-/, ''); };
    var glueFor = function (tk) { return (tk === 'futuro' || tk === 'condicional') ? glueFut : glue; };
    var out = {};
    Object.keys(tpl).forEach(function (tk) {
      var val = tpl[tk];
      var g = (tk === 'subjPresente' || tk === 'imperativoAf' || tk === 'imperativoNeg') ? glueE : glueFor(tk);
      if (Array.isArray(val)) out[tk] = val.map(g);
      else if (val && typeof val === 'object') {
        out[tk] = { ra: val.ra.map(g), se: val.se.map(g) };
      } else out[tk] = g(val);
    });
    // B3 (v1.2): 词干变化/重音断裂/y插入 动词覆盖 presente/subjPresente/imperativo
    var sc = STEM_CH[verb];
    var ac = ACC_CH[verb];
    var ui = UIR_CH[verb];
    var gu = GU_CH[verb];
    if (sc) {
      var fam = sc.indexOf('ie') >= 0 ? 'e' : (sc.indexOf('ue') >= 0 ? 'o' : 'i');
      var fullSubj = (end === 'ir') || STEM_CH_FULL[verb] === 1;
      var nosStem = (STEM_CH_NOS[verb] || (fullSubj ? (fam === 'e' ? sc.replace('ie', 'i') : fam === 'o' ? sc.replace('ue', 'u') : sc) : stem));
      var pS = [tpl.presente[0], tpl.presente[1], tpl.presente[2], tpl.presente[5]].map(function (s) { return s.replace(/^-/, ''); });
      var sS = tpl.subjPresente.map(function (s) { return s.replace(/^-/, ''); });
      var chE = STEM_CH_ALT[verb] || sc;
      out.presente = [sc + pS[0], chE + pS[1], chE + pS[2], stem + tpl.presente[3].replace(/^-/, ''), stem + tpl.presente[4].replace(/^-/, ''), chE + pS[3]];
      out.subjPresente = [orthAr(sc, sS[0]), orthAr(sc, sS[1]), orthAr(sc, sS[2]), orthAr(nosStem, sS[3]), orthAr(nosStem, sS[4]), orthAr(sc, sS[5])];
      out.imperativoAf = [out.presente[1].slice(0, -1), stem + (end === 'ar' ? 'ad' : (end === 'er' ? 'ed' : 'id')), out.subjPresente[2], out.subjPresente[5]];
      out.imperativoNeg = ['no ' + out.subjPresente[1], 'no ' + out.subjPresente[4], 'no ' + out.subjPresente[2], 'no ' + out.subjPresente[5]];
    } else if (ac) {
      var pS2 = [tpl.presente[0], tpl.presente[1], tpl.presente[2], tpl.presente[5]].map(function (s) { return s.replace(/^-/, ''); });
      var sS2 = tpl.subjPresente.map(function (s) { return s.replace(/^-/, ''); });
      out.presente = [ac + pS2[0], ac + pS2[1], ac + pS2[2], stem + tpl.presente[3].replace(/^-/, ''), stem + tpl.presente[4].replace(/^-/, ''), ac + pS2[3]];
      out.subjPresente = [ac + sS2[0], ac + sS2[1], ac + sS2[2], stem + sS2[3], stem + sS2[4], ac + sS2[5]];
      out.imperativoAf = [out.presente[1].slice(0, -1), stem + (end === 'ar' ? 'ad' : (end === 'er' ? 'ed' : 'id')), out.subjPresente[2], out.subjPresente[5]];
      out.imperativoNeg = ['no ' + out.subjPresente[1], 'no ' + out.subjPresente[4], 'no ' + out.subjPresente[2], 'no ' + out.subjPresente[5]];
    } else if (ui) {
      var ys = stem + 'y', us2 = stem;
      out.presente = [ys + 'o', ys + 'es', ys + 'e', us2 + 'imos', us2 + '\u00eds', ys + 'en'];
      out.subjPresente = [ys + 'a', ys + 'as', ys + 'a', ys + 'amos', ys + '\u00e1is', ys + 'an'];
      out.imperativoAf = [out.presente[1].slice(0, -1), us2 + 'id', out.subjPresente[2], out.subjPresente[5]];
      out.imperativoNeg = ['no ' + out.subjPresente[1], 'no ' + out.subjPresente[4], 'no ' + out.subjPresente[2], 'no ' + out.subjPresente[5]];
    } else if (gu) {
      var sS3 = tpl.subjPresente.map(function (s) { return s.replace(/^-/, ''); });
      out.subjPresente = [gu + sS3[0], gu + sS3[1], gu + sS3[2], gu + sS3[3], gu + sS3[4], gu + sS3[5]];
      out.imperativoAf = [out.presente[1].slice(0, -1), stem + (end === 'ar' ? 'ad' : (end === 'er' ? 'ed' : 'id')), out.subjPresente[2], out.subjPresente[5]];
      out.imperativoNeg = ['no ' + out.subjPresente[1], 'no ' + out.subjPresente[4], 'no ' + out.subjPresente[2], 'no ' + out.subjPresente[5]];
    }
    // B4 (v1.4): -cer/-cir yo zc 自动规则 (词干末 c→zc; 例外 c→z 组在 GO_CH)
    var isCeCi = (end === 'er' && /cer$/.test(verb)) || (end === 'ir' && /cir$/.test(verb));
    if (isCeCi && !STEM_CH[verb] && !IRREGULAR[verb] && !GO_CH[verb] && !ZC_SKIP[verb]) {
      var zst = stem.slice(0, -1) + 'zc';
      var sS4 = tpl.subjPresente.map(function (s) { return s.replace(/^-/, ''); });
      out.presente[0] = zst + 'o';
      out.subjPresente = sS4.map(function (s) { return zst + s; });
      out.imperativoAf[2] = out.subjPresente[2];
      out.imperativoAf[3] = out.subjPresente[5];
      out.imperativoNeg = ['no ' + out.subjPresente[1], 'no ' + out.subjPresente[4], 'no ' + out.subjPresente[2], 'no ' + out.subjPresente[5]];
    }
    // B4 (v1.4): GO_CH yo 增音族覆盖
    var gch = GO_CH[verb];
    if (gch) {
      if (gch.yo) out.presente[0] = gch.yo;
      if (gch.t2) out.presente[1] = gch.t2;
      if (gch.t3) out.presente[2] = gch.t3;
      if (gch.t6) out.presente[5] = gch.t6;
      if (gch.subj) {
        var sS5 = tpl.subjPresente.map(function (s) { return s.replace(/^-/, ''); });
        out.subjPresente = sS5.map(function (s) { return gch.subj + s; });
        out.imperativoAf[2] = out.subjPresente[2];
        out.imperativoAf[3] = out.subjPresente[5];
        out.imperativoNeg = ['no ' + out.subjPresente[1], 'no ' + out.subjPresente[4], 'no ' + out.subjPresente[2], 'no ' + out.subjPresente[5]];
      }
      if (gch.imp0) out.imperativoAf[0] = gch.imp0;
      else if (gch.t2) out.imperativoAf[0] = out.presente[1].slice(0, -1);
      var ayFix = function (x) { return String(x).replace(/ai(?=[o\u00f3e\u00e9])/g, 'ay'); };
      if (gch.ger) out.gerundio = gch.ger;
      if (gch.siY) {
        out.gerundio = ayFix(out.gerundio);
        out.indefinido = [stem + '\u00ed', stem + '\u00edste', ayFix(stem + 'i\u00f3'), stem + '\u00edmos', stem + '\u00edsteis', ayFix(stem + 'ieron')];
        out.subjImperfecto = { ra: out.subjImperfecto.ra.map(ayFix), se: out.subjImperfecto.se.map(ayFix) };
      }
      if (gch.gerY) out.gerundio = ayFix(out.gerundio);
    }
    // B5 (v1.5): 强变化过去式 + 不规则分词 + -eer 组
    var sp = STRONG_PRET[verb];
    if (sp) {
      // B5b: -j 词干 RAE 为 trajera/trajeron (无 i); 其余词干 mantuviera/mantuvieron
      var jEnd = sp.charAt(sp.length - 1) === 'j';
      out.indefinido = [sp + 'e', sp + 'iste', sp + 'o', sp + 'imos', sp + 'isteis', jEnd ? sp + 'eron' : sp + 'ieron'];
      var srA = (jEnd ? ['era', 'eras', 'era', '\u00e9ramos', 'erais', 'eran'] : ['iera', 'ieras', 'iera', 'i\u00e9ramos', 'ierais', 'ieran']).map(function (s) { return sp + s; });
      var srS = (jEnd ? ['ese', 'eses', 'ese', '\u00e9semos', 'eseis', 'esen'] : ['iese', 'ieses', 'iese', 'i\u00e9semos', 'ieseis', 'iesen']).map(function (s) { return sp + s; });
      out.subjImperfecto = { ra: srA, se: srS };
    }
    var pir = PART_IRREG[verb];
    if (pir) out.participio = pir;
    if (gch && gch.siE) {
      out.gerundio = stem + 'yendo';
      out.indefinido = [stem + '\u00ed', stem + '\u00edste', stem + 'y\u00f3', stem + '\u00edmos', stem + '\u00edsteis', stem + 'yeron'];
      out.subjImperfecto = { ra: [stem + 'yera', stem + 'yeras', stem + 'yera', stem + 'y\u00e9ramos', stem + 'yerais', stem + 'yeran'], se: [stem + 'yese', stem + 'yeses', stem + 'yese', stem + 'y\u00e9semos', stem + 'yeseis', stem + 'yesen'] };
    }
    // B4 (v1.4): -ar indefinido 1sg 拼写适配 (busqué/llegué/empecé/apacigüé)
    if (end === 'ar') {
      if (/c$/.test(stem)) out.indefinido[0] = stem.slice(0, -1) + 'qu\u00e9';
      else if (/g$/.test(stem)) out.indefinido[0] = stem.slice(0, -1) + 'gu\u00e9';
      else if (/z$/.test(stem)) out.indefinido[0] = stem.slice(0, -1) + 'c\u00e9';
      else if (/gu$/.test(stem)) out.indefinido[0] = stem.slice(0, -2) + 'g\u00fc\u00e9';
    }
    // P7: 规则动词否定命令式补 no 前缀 (覆盖块路径已自带 no; IRREGULAR 内置表不受此路径影响)
    if (out.imperativoNeg && String(out.imperativoNeg[0]).indexOf('no ') !== 0) {
      out.imperativoNeg = out.imperativoNeg.map(function (x) { return 'no ' + x; });
    }
    return out;
  }

  // 复合时态拼接: perfecto/pluscuamperfecto/subjPluscuamperfecto
  function buildCompound(forms) {
    var part = forms.participio;
    forms.perfecto = HABER.presente.map(function (h) { return h + ' ' + part; });
    forms.pluscuamperfecto = HABER.imperfecto.map(function (h) { return h + ' ' + part; });
    forms.subjPluscuamperfecto = {
      ra: HABER.subjImperfectoRa.map(function (h) { return h + ' ' + part; }),
      se: HABER.subjImperfectoSe.map(function (h) { return h + ' ' + part; })
    };
    return forms;
  }

  // ---------- 对外主接口 ----------
  // 返回 { verb, original, pronominal, forms, irregular, source }
  // forms: { presente:[6], ..., gerundio:'', participio:'' }
  function conj(verb) {
    var original = verb;
    var pronominal = false;
    // 代词式检测: dormirse/vestirse/levantarse
    var core = stripPronoun(verb);
    if (core !== verb) pronominal = true;
    var forms;
    var tipsArr = null;
    if (isIrregular(core)) {
      forms = JSON.parse(JSON.stringify(IRREGULAR[core]));
      tipsArr = forms.tips || null;
      delete forms.tips; // tips 单独返回，不进 forms
      forms = buildCompound(forms);
    } else {
      forms = conjRegular(core);
      if (!forms) return null;
      forms = buildCompound(forms);
    }
    return { verb: original, core: core, pronominal: pronominal, forms: forms, irregular: isIrregular(core), irregularType: irregularTypeOf(core), source: isIrregular(core) ? 'irregular-builtin' : 'engine-regular', tips: tipsArr };
  }

  // 组装完整展示结构: [{t:{k,zh,n,dual}, cells:[...]}]
  function tableOf(result) {
    var rows = [];
    TENSES.forEach(function (t) {
      var cells;
      if (t.k === 'gerundio') cells = [result.forms.gerundio];
      else if (t.k === 'participio') cells = [result.forms.participio];
      else if (t.dual) {
        cells = result.forms[t.k].ra; // 默认显示 -ra 行, 渲染层可切 -se
        rows.push({ t: t, ra: result.forms[t.k].ra, se: result.forms[t.k].se });
        return;
      } else cells = result.forms[t.k];
      rows.push({ t: t, cells: cells });
    });
    return rows;
  }

  window.verbConj = {
    TENSES: TENSES,
    PERSONS: PERSONS,
    PERSONS_IMP: PERSONS_IMP,
    conj: conj,
    tableOf: tableOf,
    isIrregular: isIrregular,
    irregularList: Object.keys(IRREGULAR)
  };
})();
