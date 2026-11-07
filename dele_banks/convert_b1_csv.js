/* 转换 espanol_b1_1500.csv -> quiz_b1_new.js (QDATA格式)
 * 字段映射: section=grammar->type=grammar, section=vocab->type=word
 * answer: A->0, B->1, C->2, D->3
 */
const fs = require('fs');

const csvPath = 'C:/Users/33835/Downloads/espanol_b1_1500.csv';
const outPath = 'C:/Users/33835/Desktop/西班牙语SIELE/siele-workbench-deploy/dele_banks/quiz_b1_new.js';

const raw = fs.readFileSync(csvPath, 'utf8');
// 去掉 BOM
const text = raw.replace(/^\uFEFF/, '');

// 简易 CSV 解析（处理引号内逗号）
function parseCSV(text) {
  const lines = [];
  let cur = '';
  let row = [];
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuote) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = false;
      } else cur += c;
    } else {
      if (c === '"') inQuote = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n') { row.push(cur); lines.push(row); row = []; cur = ''; }
      else if (c === '\r') { /* skip */ }
      else cur += c;
    }
  }
  if (cur !== '' || row.length) { row.push(cur); lines.push(row); }
  return lines;
}

const rows = parseCSV(text);
const header = rows[0];
// id,section,number,stem,option_a,option_b,option_c,option_d,answer,answer_text
const data = rows.slice(1).filter(r => r.length >= 10 && r[0]);

const ansMap = { A: 0, B: 1, C: 2, D: 3 };
const items = [];
let grammarCount = 0, vocabCount = 0;

for (const r of data) {
  const section = r[1].trim();
  const stem = r[3];
  const oa = r[4], ob = r[5], oc = r[6], od = r[7];
  const answer = r[8].trim().toUpperCase();
  const answerText = r[9];
  const ansIdx = ansMap[answer];
  if (ansIdx === undefined) {
    console.error('Bad answer for id', r[0], '->', answer);
    continue;
  }
  const type = section === 'grammar' ? 'grammar' : 'word';
  if (type === 'grammar') grammarCount++; else vocabCount++;
  items.push({
    ex: 'dele',
    lvl: 'B1',
    type: type,
    q: stem,
    opts: [oa, ob, oc, od],
    ans: ansIdx,
    fb: '正确答案：' + answer + '. ' + answerText
  });
}

console.log('Total items:', items.length, '| grammar:', grammarCount, '| vocab(word):', vocabCount);

// 生成 JS 文件
const header2 = `/* Auto-generated from espanol_b1_1500.csv on 2026-09-22
 * B1 题库整体替换数据: 1500题 (语法750 + 词汇750)
 * 格式: QDATA 兼容 {ex, lvl, type, q, opts[], ans, fb}
 * 注入方式: window.QDATA_B1_REPLACE, 由 index.html 运行时替换所有 lvl=B1 题
 */
window.QDATA_B1_REPLACE = `;

// 用 JSON.stringify 保证转义正确
const body = JSON.stringify(items, null, 0);
const out = header2 + body + ';\n';
fs.writeFileSync(outPath, out, 'utf8');
console.log('Written to:', outPath, '| size:', (out.length / 1024).toFixed(1), 'KB');

// 验证: 重新加载并检查
const verify = eval(out.replace('window.QDATA_B1_REPLACE = ', '').replace(/;\s*$/, ''));
console.log('Verify count:', verify.length);
const vg = verify.filter(q => q.type === 'grammar').length;
const vw = verify.filter(q => q.type === 'word').length;
console.log('Verify grammar:', vg, '| vocab(word):', vw);
// 抽样
console.log('Sample grammar:', JSON.stringify(verify[0]));
console.log('Sample vocab:', JSON.stringify(verify[750]));
