// ===== 词汇导入 第3批 先行验证版(10词) =====
// 来源: 西语专四高频词表 → 清洗(类别2分词删除/类别3 RAE修复/类别4方言标注) → 例句+CEFR分级
// 说明: 先行 10 词验证 UI 效果, 完整 803 词将由后台任务生成覆盖
const VDATA_BATCH3 = [
{"t": "b3", "es": "abogado", "pos": "m.", "zh": "律师", "ex": "El abogado defendió al cliente en el juicio.", "lvl": "B1", "tag": "专四", "dialect": 0},
{"t": "b3", "es": "albañil", "pos": "m.", "zh": "泥瓦工", "ex": "El albañil construyó la pared de ladrillos.", "lvl": "B1", "tag": "专四", "dialect": 0},
{"t": "b3", "es": "cocodrilo", "pos": "m.", "zh": "鳄鱼", "ex": "El cocodrilo vive en el río.", "lvl": "A2", "tag": "专四", "dialect": 0},
{"t": "b3", "es": "delfín", "pos": "m.", "zh": "海豚；海豚式（游泳）", "ex": "Los delfines son animales muy inteligentes.", "lvl": "A2", "tag": "专四", "dialect": 0},
{"t": "b3", "es": "foca", "pos": "f.", "zh": "【动】海豹", "ex": "La foca descansaba sobre el hielo.", "lvl": "B1", "tag": "专四", "dialect": 0},
{"t": "b3", "es": "queque", "pos": "m.", "zh": "蛋糕", "ex": "Mi abuela hizo un queque para la fiesta.", "lvl": "B1", "tag": "专四", "dialect": 1},
{"t": "b3", "es": "maní", "pos": "m.", "zh": "花生", "ex": "Compré maní tostado en el mercado.", "lvl": "B1", "tag": "专四", "dialect": 1},
{"t": "b3", "es": "yuyo", "pos": "m.", "zh": "杂草", "ex": "Hay muchos yuyos en el jardín.", "lvl": "B2", "tag": "专四", "dialect": 1},
{"t": "b3", "es": "polera", "pos": "f.", "zh": "T恤", "ex": "Compré una polera nueva para el verano.", "lvl": "A2", "tag": "专四", "dialect": 1},
{"t": "b3", "es": "zapato", "pos": "m.", "zh": "鞋", "ex": "Necesito zapatos cómodos para caminar.", "lvl": "A1", "tag": "专四", "dialect": 0}
];
(function(){
  if(typeof VDATA==='undefined'||typeof VDATA_BATCH3==='undefined') return;
  var _existingB3=new Set(VDATA.map(function(v){return v.es;}));
  VDATA_BATCH3.forEach(function(v){ if(!_existingB3.has(v.es)){VDATA.push(v);} });
  // 重建 VDATA_BY_LVL 静态索引: 纳入全部批次词 + 专四桶
  if(typeof VDATA_BY_LVL!=='undefined'){
    VDATA_BY_LVL.A1.length=VDATA_BY_LVL.A2.length=VDATA_BY_LVL.B1.length=VDATA_BY_LVL.B2.length=0;
    if(!VDATA_BY_LVL['专四']) VDATA_BY_LVL['专四']=[]; else VDATA_BY_LVL['专四'].length=0;
    VDATA.forEach(function(v){
      if(VDATA_BY_LVL[v.lvl]) VDATA_BY_LVL[v.lvl].push(v);
      if(v.tag==='专四') VDATA_BY_LVL['专四'].push(v);
    });
  }
})();
