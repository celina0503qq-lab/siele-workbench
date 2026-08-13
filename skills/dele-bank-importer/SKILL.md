---
name: dele-bank-importer
description: Complete workflow for importing Nuevo DELE exam question banks
  (Modelo 1-4, levels A1-B2) from Ramón Díez Galán PDF textbooks into the SIELE
  workbench. Covers PDF extraction with pymupdf, answer verification against
  SOLUCIONES, JS data file generation with json.dumps, index.html integration,
  and common pitfalls. This skill should be used when the user asks to import
  DELE questions, add new Modelo banks, or fix incomplete DELE bank content.
agent_created: true
disable: true
---

# DELE Question Bank Importer — Complete Workflow

## Purpose

Import complete DELE exam question banks from Ramón Díez Galán PDF textbooks into the
SIELE workbench single-file HTML application. Covers all 4 pruebas (Reading/Listening/
Writing/Speaking) across all Modelos, with exact PDF content alignment, answer verification
against SOLUCIONES, and proper formatting.

## When to Use

Trigger on any request involving:
- "导入 DELE 题库" / "导入 Modelo" / "补全题库"
- "DELE B1/B2/A1/A2 题目不全/缺题目/选项空"
- "从 PDF 提取题目" / "Nuevo DELE" + any level
- Any mention of `dele_bank_*.js` creation or modification

## Project Context

### File Locations
```
C:\Users\33835\Desktop\西班牙语SIELE\siele-workbench-deploy\
├── index.html                    # Main app (~14000 lines)
├── dele_banks/                   # ALL bank files live here
│   ├── dele_bank_{a1,a2,b1,b2}.js              # Original generic banks
│   ├── dele_bank_{a1,a2,b1,b2}_nuevo_m1.js     # Nuevo DELE Modelo 01
│   ├── dele_bank_b1_nuevo_m{2,3,4}.js          # B1 Modelo 02/03/04
│   └── dele_bank_a1_v5.js                       # Legacy v5 variants
├── refine_data.js                # External article index
├── vdata_dele.js                 # Vocabulary database (2635 words)
└── admin.html                    # Admin panel
```

### PDF Source Files
```
C:\Users\33835\Desktop\Dele\1. Dele资料（六册备考A1-C2）\Nuevo DELE\
├── NUEVO DELE B1. Curso de preparación para el examen DELE B1 (Ramón Díez Galán).pdf
├── NUEVO DELE B2 Preparación para el examen. Modelos completos del examen DELE B2...
├── Nuevo DELE A1 Versión 2020...
├── Nuevo DELE A2 (Ramon Diez Galan).pdf
```

### Stack & Conventions
- Single-file HTML app: index.html (~1.9MB, ~14700 lines)
- Data files: `window.DELE_BANK_{LEVEL}_NUEVO_M{num} = { ... };`
- Deployment: `git push origin main` → GitHub Pages (`celina0503qq-lab/siele-workbench`)
- Login: CloudBase | Sync: GitHub Gist LWW merge
- STORE_KEY: `dele_siele_wb_v3`
- Memory: `.workbuddy/memory/YYYY-MM-DD.md` + `MEMORY.md`

## CRITICAL RULES (Read First — Most Mistakes Come From Ignoring These)

### Rule 1: NEVER Fabricate Content
Every word of the exam content (reading passages, questions, options, transcripts) MUST
come from the PDF. Fabricated questions/options WILL be wrong and WILL need to be fixed
later. If a section can't be extracted from PDF, mark it clearly as placeholder and tell the user.

### Rule 2: ALWAYS Verify Answers Against SOLUCIONES
Every answer letter (a/b/c/d/e/f/g/h/i) must be verified against the PDF's SOLUCIONES
section (last ~20 pages of each book). Never trust generated or assumed answers.

### Rule 3: ALWAYS Use json.dumps() for JS Generation
NEVER hand-write JS string concatenation for Spanish content. Unicode characters (ñ, áéíóú,
¿¡, «») will break JS syntax. Python's `json.dumps(data, indent=2, ensure_ascii=False)` handles
all escaping correctly.

### Rule 4: Separate instrucciones from cuerpo
Task instructions ("INSTRUCCIONES: Usted va a leer...") must be stored in the `instrucciones`
field, NOT mixed into `cuerpo`. The rendering code shows them in separate boxes:
📋 题目说明 → 📄 阅读原文 → Questions.

### Rule 5: Verify Page-by-Page Alignment
Every tarea's questions must correspond to the correct tarea's text. Common mistake:
mixing up which questions belong to which tarea number.

## Workflow

### Phase 1: PDF Content Extraction

1. Open PDF with pymupdf (NOT IMA — IMA extraction adds image markers):
   ```python
   import fitz
   doc = fitz.open(pdf_path)
   ```

2. Map page structure for the target Modelo:
   - Answer sheet pages (HOJA DE RESPUESTAS)
   - Reading content pages (PRUEBA 1 / COMPRENSIÓN DE LECTURA)
   - Listening content pages (PRUEBA 2 / COMPRENSIÓN AUDITIVA)
   - Writing pages (PRUEBA 3)
   - Speaking pages (PRUEBA 4)
   - SOLUCIONES pages (last ~20 pages)

3. Extract text page-by-page with `doc[page_idx].get_text()`

4. Clean extracted text:
   ```python
   text = re.sub(r'公众号\[?西语SuperO\]?', '', text)
   text = re.sub(r'MODELO\s*\d', '', text)
   text = re.sub(r'\b\d{2,3}\s*$', '', text, flags=re.MULTILINE)
   ```

### Phase 2: Answer Extraction from SOLUCIONES

Extract from SOLUCIONES pages at end of PDF. Format varies by book:
- B1: "Tarea X  Soluciones: 1a,2c,3b..."
- B2: "Solución: a, c, b..."
- Separate reading (PRUEBA 1) and listening (PRUEBA 2) answers

Store as structured dict:
```python
ANSWERS = {
    '2': {  # Modelo number
        'R': {1: {1:'d',2:'b',...}, 2: {7:'c',8:'a',...}, ...},  # Reading
        'L': {1: {1:'b',2:'c',...}, 2: {7:'c',8:'b',...}, ...},  # Listening
    }
}
```

### Phase 3: Data File Generation

#### Item Schema (CRITICAL — every field matters)
```python
{
    'modelo': 'nuevo_m{num}',          # e.g. 'nuevo_m2'
    'modelo_name': 'Nuevo DELE B1 Modelo 02',  # Display name
    'prueba': 1,                        # 1=Reading, 2=Listening, 3=Writing, 4=Speaking
    'tarea': 1,                         # Task number within prueba
    'q': 1,                             # Question number
    'q_range': [1, 6],                  # Question range for this tarea
    'answer': 'D',                      # UPPERCASE letter
    'prompt': 'Question text here',     # The actual question
    'options': [{'key':'A','text':'A) Option text'}, ...],  # Answer choices
    'type': 'choice3',                  # choice3/choice4/choice8/choice9/writing/speaking
    '_v5': True,                        # Always True for nuevo banks
    'cuerpo': 'Reading passage text',   # Reading: the passage
    'transcript': 'Listening transcript',  # Listening: the audio text
    'instrucciones': 'Task instructions',  # Separated from cuerpo!
    'explanation': 'Answer explanation',
    'rango_palabras': '100-120 palabras',  # Writing tasks only
}
```

#### Type Mapping
| prueba | tarea | type | Description |
|--------|-------|------|-------------|
| 1 | 1 | choice9 | 9-option matching (6 people × 9 texts) |
| 1 | 2 | choice3 | 3-option reading comprehension |
| 1 | 3 | choice3 | 3-text matching (A/B/C) |
| 1 | 4 | choice8 | 8-fragment gap fill (choose 6) |
| 1 | 5 | choice3 | 3-option cloze/grammar |
| 2 | 1 | choice3 | 6 short listening messages |
| 2 | 2 | choice3 | Conversation comprehension |
| 2 | 3 | choice3 | News items comprehension |
| 2 | 4 | choice9 | 6 people + 9 statements matching |
| 2 | 5 | choice3 | Conversation with A/B/C (person1/person2/neither) |
| 3 | 1-2 | writing | Writing tasks (no options needed) |
| 4 | 1-3 | speaking | Speaking tasks (no options needed) |

#### Tarea 1 Options (9-option matching)
For Reading Tarea 1, follow this EXACT format for each option label:
```python
'A) [Sender/Context]: [First 50 chars of message content]'
# Example:
'A) Despido: no estamos contentos, estamos buscando a alguien para sustituirte'
'B) Quemadura: jugó con fuego, está ingresado en urgencias'
# ...
'I) Tu aspecto: ha cambiado, ¿estilo de vida saludable o problemas?'
```
Each label MUST include the letter, a short topic keyword, and the beginning of the message text.
This renders as a fill-in-the-blank with a reference list below (≥6 options triggers `isManyOptionChoice`).

#### Tarea 3 Options (3-text matching A/B/C)
```python
[{'key':'A','text':'A) NAME — [Key characteristic 1], [key characteristic 2]'},
 {'key':'B','text':'B) NAME — [Key characteristic 1], [key characteristic 2]'},
 {'key':'C','text':'C) NAME — [Key characteristic 1], [key characteristic 2]'}]
```

#### Writing Items
Writing tasks have no answer options. Use:
```python
item(m, 3, tarea, q, q_range, '', prompt, [], 'writing',
     instrucciones=full_instructions, rango='100-120 palabras')
```

#### Speaking Items
```python
item(m, 4, tarea, q, q_range, '', prompt, [], 'speaking',
     instrucciones=full_instructions)
```

### Phase 4: JS File Generation

ALWAYS use json.dumps:
```python
data = {'version':'1.0','level':'B1','source':'...','language':'es-ES',
        'syllabus':{...},'items':items}
js = f'window.DELE_BANK_{LEVEL}_NUEVO_M{m} = ' + \
     json.dumps(data, indent=2, ensure_ascii=False) + ';\n'
with open(f'{DEPLOY}/dele_bank_b1_nuevo_m{m}.js', 'w', encoding='utf-8') as f:
    f.write(js)
```

After writing, verify:
```bash
node -c path/to/dele_bank_*.js
```

### Phase 5: index.html Integration

Three changes needed in index.html:

1. **Script tags** (add after existing bank script tags, line ~13495):
```html
<script src="./dele_banks/dele_bank_b1_nuevo_m2.js" defer></script>
<script src="./dele_banks/dele_bank_b1_nuevo_m3.js" defer></script>
<script src="./dele_banks/dele_bank_b1_nuevo_m4.js" defer></script>
```

2. **Injection functions** (add after `_injectDeleBankNuevoLevel` function, line ~12068):
```javascript
function _injectDeleBankNuevoB1M2(){ return _injectDeleBankNuevoLevel('B1','DELE_BANK_B1_NUEVO_M2'); }
function _injectDeleBankNuevoB1M3(){ return _injectDeleBankNuevoLevel('B1','DELE_BANK_B1_NUEVO_M3'); }
function _injectDeleBankNuevoB1M4(){ return _injectDeleBankNuevoLevel('B1','DELE_BANK_B1_NUEVO_M4'); }
```

3. **Initialize calls** (add after existing tryInject calls, line ~13481):
```javascript
tryInjectNuevoB1M2(35);
tryInjectNuevoB1M3(35);
tryInjectNuevoB1M4(35);
```

Where `tryInjectNuevo*` uses the standard retry pattern:
```javascript
function tryInjectNuevoB1M2(retries){
  if (_injectDeleBankNuevoB1M2()) return;
  if (retries > 0) setTimeout(function(){ tryInjectNuevoB1M2(retries-1); }, 80);
}
```

### Phase 6: Verification Checklist

Before declaring "done", verify ALL of these:

```
☐ All JS files pass `node -c`
☐ Answer count matches expected: A1=25R+25L, A2=25R+25L, B1=30R+30L, B2=30R+30L
☐ All answers verified against PDF SOLUCIONES (0 mismatches)
☐ Tarea 1 TEXTOS have correct A-I labels (not all the same letter)
☐ Tarea 3 has correct person names from PDF (not fabricated)
☐ instrucciones is in its own field, not mixed into cuerpo
☐ Writing tasks have rango_palabras
☐ index.html: script tags, injection functions, tryInject calls all present
☐ Git commit pushed to origin/main
☐ No placeholder text like 'Pregunta X' in prompt field
☐ No placeholder text like '(ver PDF)' in options
☐ Options have complete text, not just 'A)' or 'A) Opcion A'
```

## Common Pitfalls & Solutions

### Pitfall 1: Spanish Characters Breaking JS
**Symptom**: `SyntaxError: Unexpected token` when running `node -c`
**Cause**: Manual string concatenation with unescaped Spanish characters
**Fix**: ALWAYS use `json.dumps(data, ensure_ascii=False)` — never hand-build JS strings

### Pitfall 2: TEXTOS Labels All Same Letter
**Symptom**: All 9 messages labeled "B. Mensaje:" instead of A through I
**Cause**: PDF text extraction reads visual labels incorrectly
**Fix**: Rewrite labels manually using the correct A-I sequence from the PDF visual layout

### Pitfall 3: Question-Text Mismatch
**Symptom**: Questions don't make sense with the reading passage
**Cause**: Questions from one tarea mixed with text from another
**Fix**: Extract page-by-page, verify each tarea's questions match its text

### Pitfall 4: Wrong Person Names in Tarea 3
**Symptom**: Names don't match PDF (e.g., EMI/ANDREA/NADIA instead of EMI/MAX/LUZ)
**Cause**: Fabricating names instead of reading from PDF
**Fix**: Always extract names directly from PDF page text

### Pitfall 5: Forgetting Writing/Speaking Items
**Symptom**: Total item count is 60 instead of 65
**Cause**: Only generating 30R + 30L, forgetting 2W + 3S
**Fix**: Always generate all 4 pruebas: 30R + 30L + 2W + 3S = 65 (B1) or 25R + 25L + 2W + 3S = 55 (A1/A2)

### Pitfall 6: Empty Options
**Symptom**: Options show as `A)` `B)` `C)` with no text
**Cause**: For Tarea 2-5 listening/reading, options were placeholder `choice{3,8,9}` with no actual text
**Fix**: Extract exact option text from PDF question pages

### Pitfall 7: Forgetting to Update index.html
**Symptom**: Bank file exists but doesn't appear in the app
**Cause**: Missing script tag, injection function, or tryInject call
**Fix**: All 3 components required — script tag + function + init call

### Pitfall 8: Git Rebase on Windows
**Symptom**: `error: could not mark as interactive`
**Fix**: Always use merge strategy, never rebase:
```bash
GIT_TERMINAL_PROMPT=0 git -c credential.helper= push origin main
```

## Answer Keys (for quick reference)

These were extracted from PDF SOLUCIONES. Use for verification, not as source of truth
for generating unverified content.

### B1 Modelo 2
```
R-T1: 1d,2b,3i,4g,5e,6f
R-T2: 7c,8a,9c,10a,11b,12b
R-T3: 13a,14a,15c,16c,17a,18b
R-T4: 19e,20b,21d,22h,23a,24f
R-T5: 25b,26a,27c,28a,29c,30a
L-T1: 1b,2c,3a,4a,5b,6b
L-T2: 7c,8b,9a,10c,11a,12b
L-T3: 13c,14a,15b,16a,17b,18c
L-T4: 19d,20a,21f,22b,23c,24e
L-T5: 25a,26c,27b,28b,29c,30b
```

### B1 Modelo 3
```
R-T1: 1a,2d,3f,4b,5i,6g
R-T2: 7b,8a,9c,10a,11b,12c
R-T3: 13a,14c,15c,16a,17b,18b
R-T4: 19d,20b,21f,22h,23a,24g
R-T5: 25a,26c,27b,28b,29a,30b
L-T1: 1a,2b,3b,4c,5a,6c
L-T2: 7b,8c,9b,10c,11b,12a
L-T3: 13b,14c,15a,16c,17b,18b
L-T4: 19d,20a,21f,22b,23c,24e
L-T5: 25b,26c,27a,28b,29a,30a
```

### B1 Modelo 4
```
R-T1: 1e,2b,3g,4i,5a,6h
R-T2: 7a,8c,9c,10a,11c,12b
R-T3: 13b,14a,15c,16b,17c,18a
R-T4: 19b,20e,21h,22c,23a,24g
R-T5: 25b,26a,27c,28a,29a,30c
L-T1: 1a,2c,3b,4a,5b,6c
L-T2: 7c,8a,9b,10a,11b,12c
L-T3: 13b,14c,15c,16a,17a,18c
L-T4: 19d,20a,21f,22b,23c,24e
L-T5: 25c,26a,27b,28a,29c,30b
```

### B1 Modelo 1
```
R-T1: 1d,2c,3a,4b,5f,6h
R-T2: 7b,8a,9b,10c,11a,12c
R-T3: 13c,14b,15a,16a,17b,18c
R-T4: 19c,20f,21a,22h,23d,24b
R-T5: 25b,26b,27a,28c,29a,30c
L-T2: 7c,8b,9c,10b,11c,12b
L-T3: 13c,14b,15b,16c,17c,18b
L-T5: 25b,26a,27a,28c,29b,30c
```

### B2 Modelo 1
```
R-T1: 1a,2c,3b,4a,5c,6b
R-T2: 7c,8a,9b,10d,11d,12a,13b,14d,15a,16c
R-T3: 17c,18e,19g,20a,21h,22b
R-T4: 23b,24a,25b,26b,27a,28c,29a,30c,31b,32a,33c,34b,35a,36a
L-T1: 1a,2b,3a,4c,5a,6b
L-T2: 7b,8b,9c,10a,11a,12c
L-T3: 13b,14c,15c,16b,17a,18a
L-T4: 19e,20a,21c,22h,23f,24i
L-T5: 25b,26b,27c,28a,29b,30a
```

## Quick Reference: B1 PDF Page Mapping

| Section | Modelo 2 | Modelo 3 | Modelo 4 |
|---------|----------|----------|----------|
| Answer Sheet | pg44 | pg77 | pg110 |
| Reading R-T1 | pg46-47 | pg79-80 | pg112-113 |
| Reading R-T2 | pg48-50 | pg81-83 | pg114-116 |
| Reading R-T3 | pg51-52 | pg84-85 | pg117-118 |
| Reading R-T4 | pg53-54 | pg86-87 | pg119-120 |
| Reading R-T5 | pg55 | pg88 | pg121 |
| Listening L-T1 | pg57 | pg89-90 | pg122-123 |
| Listening L-T2 | pg58 | pg91 | pg124 |
| Listening L-T3 | pg59 | pg92 | pg125 |
| Listening L-T4 | pg60 | pg93 | pg126 |
| Listening L-T5 | pg61 | pg94 | pg127 |
| Writing | pg62-65 | pg95-98 | pg128-131 |
| Speaking | pg66-69 | pg99-104 | pg132-137 |
| SOLUCIONES | pg144-148 | pg149-153 | pg154-160 |

Note: Page numbers are 1-indexed from the PDF. pymupdf uses 0-indexed (subtract 1).

## Reading Tarea 1 Content Structure

Every Modelo's Tarea 1 follows this exact pattern:
```
Page N: 6 person descriptions (1. Name: situation, 2. Name: situation, ...)
Page N+1: 9 TEXTOS (A. Mensaje: ...text..., B. Mensaje: ...text..., ...)
```
The model name (B1 NUEVO_M2) can be confirmed to exist in the PDF content by checking for all required pages for that model.

## Tarea 5 Content Structure
```
Reading: cloze text with 6 gaps (25-30), each with 3 labelled choices (25a,25b,25c...)
Listening: conversation between two people, 6 statements marked as A/B/C (person1/person2/neither)
```
