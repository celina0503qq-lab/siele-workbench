// ============================================================
// 动词变位引擎 v1 (MVP) — 规则模板 + 高频不规则内置表
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

  // ---------- 工具 ----------
  function stemOf(verb) { return verb.slice(0, -2); }
  function endingOf(verb) { return verb.slice(-2); }

  function isIrregular(verb) {
    var v = stripPronoun(verb);
    return Object.prototype.hasOwnProperty.call(IRREGULAR, v);
  }
  // 提取代词式动词原形: dormirse -> dormir, se 前缀保留在返回的 meta
  function stripPronoun(verb) {
    var prons = ['me', 'te', 'se', 'nos', 'os'];
    for (var i = 0; i < prons.length; i++) {
      var suf = prons[i];
      if (verb.length > suf.length + 2 && verb.slice(-suf.length) === suf) {
        var core = verb.slice(0, -suf.length);
        // 只认以 ar/er/ir 结尾的原形(如 dormirse -> dormir)
        if (/[aeiou]n?[aeiou]$/.test(core) || /(ar|er|ir)$/.test(core)) {
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
    var out = {};
    Object.keys(tpl).forEach(function (tk) {
      var val = tpl[tk];
      if (Array.isArray(val)) out[tk] = val.map(function (suf) { return stem + suf; });
      else if (val && typeof val === 'object') {
        out[tk] = { ra: val.ra.map(function (s) { return stem + s; }), se: val.se.map(function (s) { return stem + s; }) };
      } else out[tk] = stem + val;
    });
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
    return { verb: original, core: core, pronominal: pronominal, forms: forms, irregular: isIrregular(core), source: isIrregular(core) ? 'irregular-builtin' : 'engine-regular', tips: tipsArr };
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
