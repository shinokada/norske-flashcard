#!/usr/bin/env node
/**
 * fix-diacritics-c-phase4-es2.mjs
 *
 * Phase 4 of ai-docs/implementation/uttrykk-kind-follow-up.md, Spanish pass 2.
 * Second round, after fix-diacritics-c-phase4-es.mjs: words that are valid without
 * the accent in some reading, or that no dictionary knew. Every hit below was read
 * in its sentence.
 *
 *  - MAP: whole-word replacements that are safe everywhere in the C files
 *    (mas -> más, tenia -> tenía, forms that are not Spanish words without the accent).
 *  - OVERRIDES: [id, field, from, to, snippet]. Replace ONE word: the whole-word
 *    occurrence of `from` that lies inside `snippet` in that entry's field. The snippet
 *    must occur exactly once and contain exactly one such word, else the run aborts
 *    before anything is written.
 *
 * Touches ONLY `spanish` and `example_spanish`.
 *
 * Usage (from the repo root):
 *   node scripts/fix-diacritics-c-phase4-es2.mjs            # dry run, prints counts
 *   node scripts/fix-diacritics-c-phase4-es2.mjs --write    # writes the files
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILES = ['src/lib/data/vocab-c.json', 'src/lib/data/uttrykk-c.json'];
const FIELDS = ['spanish', 'example_spanish'];
const WRITE = process.argv.includes('--write');

const MAP = {"mas":"más","tenia":"tenía","Tenia":"Tenía","salio":"salió","sucedio":"sucedió","engullio":"engulló","pondia":"ponía","enfria":"enfría","guias":"guías","mecia":"mecía","hibernacion":"hibernación","empatico":"empático","informatico":"informático","autoproteccion":"autoprotección","discurria":"discurría","oscurecia":"oscurecía","sorbia":"sorbía","solian":"solían","reprendio":"reprendió","vendio":"vendió","rechazaria":"rechazaría","cumplia":"cumplía","envejecia":"envejecía","escribia":"escribía","respondia":"respondía"};

const OVERRIDES = [
  // sería (conditional), está (verb), té (tea), sí, qué, cómo, él
  ['w-007733','example_spanish','seria','sería','que seria un'],
  ['w-006156','example_spanish','esta','está','guardería esta sujeta'],
  ['w-009279','example_spanish','esta','está','verano esta a'],
  ['w-009340','example_spanish','esta','está','cabaña esta en'],
  ['w-006688','example_spanish','te','té','con te,'],
  ['w-006038','example_spanish','si','sí','a si misma'],
  ['w-006205','spanish','si','sí','en si'],
  ['w-006205','example_spanish','si','sí','en si.'],
  ['w-006087','example_spanish','que','qué','saber que hacer'],
  ['w-006191','example_spanish','que','qué','saber que hacer'],
  ['w-010522','spanish','que','qué','saber que hacer'],
  ['w-010062','spanish','como','cómo','¿como ocurrió'],
  ['w-010062','spanish','como','cómo','¿como sucedio'],
  ['w-006214','example_spanish','el','él','para el y'],
  ['w-006614','example_spanish','el','él','pero el no'],
  ['w-007250','example_spanish','el','él','a el.'],
  ['w-009377','example_spanish','el','él','respuesta de ella, el se'],
  ['w-006020','example_spanish','El','Él','El se sentó'],
  ['w-006152','example_spanish','El','Él','El siempre llevaba'],
  // third-person preterite written like the first-person present
  ['w-006511','example_spanish','abandono','abandonó','Cuando abandono'],
  ['w-006794','example_spanish','abandono','abandonó','adversario abandono'],
  ['w-006212','example_spanish','logro','logró','suerte logro'],
  ['w-007730','example_spanish','logro','logró','policía logro'],
  ['w-009362','example_spanish','logro','logró','finalmente logro'],
  ['w-009464','example_spanish','logro','logró','finalmente logro'],
  ['w-009466','example_spanish','logro','logró','empresa logro'],
  ['w-005934','example_spanish','escucho','escuchó','cuando escucho'],
  ['w-005970','example_spanish','escucho','escuchó','cuando escucho'],
  ['w-005991','example_spanish','escucho','escuchó','cuando escucho'],
  ['w-006127','example_spanish','escucho','escuchó','que escucho'],
  ['w-006155','example_spanish','escucho','escuchó','cuando escucho'],
  ['w-009366','example_spanish','escucho','escuchó','no escucho'],
  ['w-006102','example_spanish','dejo','dejó','lo dejo secar'],
  ['w-006149','example_spanish','dejo','dejó','lo dejo.'],
  ['w-006214','example_spanish','dejo','dejó','y dejo a'],
  ['w-006790','example_spanish','dejo','dejó','y dejo tras'],
  ['w-007702','example_spanish','dejo','dejó','se dejo caer'],
  ['w-005995','example_spanish','tomo','tomó','y tomo los'],
  ['w-006030','example_spanish','tomo','tomó','viaje tomo'],
  ['w-006168','example_spanish','tomo','tomó','cuando tomo'],
  ['w-009331','example_spanish','tomo','tomó','Le tomo'],
  ['w-009415','example_spanish','tomo','tomó','Se tomo'],
  ['w-009415','example_spanish','trabajo','trabajó','y trabajo duro'],
  ['w-006789','example_spanish','Trabajo','Trabajó','Trabajo en dos'],
  ['w-006054','example_spanish','tiro','tiró','Ella tiro'],
  ['w-006033','example_spanish','quedo','quedó','paisaje quedo'],
  ['w-006087','example_spanish','quedo','quedó','Se quedo'],
  ['w-006122','example_spanish','quedo','quedó','familia quedo'],
  ['w-009313','example_spanish','quedo','quedó','se quedo jadeando'],
  ['w-009377','example_spanish','quedo','quedó','se quedo sin'],
  ['w-006023','example_spanish','Quedo','Quedó','Quedo completamente'],
  ['w-006147','example_spanish','documento','documentó','informe documento'],
  ['w-006023','example_spanish','anuncio','anunció','jefe anuncio'],
  ['w-009395','example_spanish','anuncio','anunció','profesor anuncio'],
  ['w-006122','example_spanish','entero','enteró','se entero'],
  ['w-009390','example_spanish','entero','enteró','se entero'],
  ['w-006189','example_spanish','marco','marcó','copas marco'],
  ['w-009336','example_spanish','Uso','Usó','Uso el destornillador'],
  ['w-009297','example_spanish','acabo','acabó','cuadro acabo'],
  ['w-009324','example_spanish','Acepto','Aceptó','Acepto la oferta'],
  ['w-009375','example_spanish','arrojo','arrojó','rabia, arrojo'],
  ['w-006197','example_spanish','Derribo','Derribó','Derribo todos'],
  ['w-006046','example_spanish','desplomo','desplomó','se desplomo'],
  ['w-006154','example_spanish','entrego','entregó','alcalde entrego'],
  ['w-006202','example_spanish','entro','entró','oso entro'],
  ['w-009402','example_spanish','entro','entró','cuando entro'],
  ['w-009322','example_spanish','Entro','Entró','Entro con'],
  ['w-009364','example_spanish','estallo','estalló','público estallo'],
  ['w-006036','example_spanish','golpeo','golpeó','se golpeo'],
  ['w-006614','example_spanish','mostro','mostró','no mostro'],
  ['w-005950','example_spanish','retiro','retiró','se retiro'],
  ['w-009361','example_spanish','cayo','cayó','cuando cayo'],
  ['w-006095','example_spanish','molesto','molestó','se molesto'],
  ['w-007626','example_spanish','Pedaleo','Pedaleó','Pedaleo furiosamente'],
  ['w-006107','example_spanish','agarro','agarró','cuando agarro'],
  ['w-006214','example_spanish','Agarro','Agarró','Agarro codiciosamente'],
  ['w-006807','example_spanish','califico','calificó','oposición califico'],
  ['w-007733','example_spanish','planifico','planificó','grupo planifico'],
];

const WORD = /[A-Za-zÁÉÍÓÚáéíóúñÑü]+/g;
const used = new Map();
const ovDone = new Set();
const problems = [];
let total = 0;

function applyOverride(entry, field, ov, n) {
  const [, , from, to, snippet] = ov;
  const s = entry[field];
  const at = s.indexOf(snippet);
  if (at < 0 || s.indexOf(snippet, at + 1) >= 0) {
    problems.push(`#${n} ${ov[0]} ${field}: snippet "${snippet}" found ${at < 0 ? 0 : 'more than 1'} time(s)`);
    return s;
  }
  const hits = [];
  for (const m of s.matchAll(WORD)) {
    if (m[0] === from && m.index >= at && m.index + from.length <= at + snippet.length) hits.push(m.index);
  }
  if (hits.length !== 1) {
    problems.push(`#${n} ${ov[0]} ${field}: "${from}" matched ${hits.length} time(s) in snippet "${snippet}"`);
    return s;
  }
  ovDone.add(n);
  return s.slice(0, hits[0]) + to + s.slice(hits[0] + from.length);
}

const loaded = [];
for (const rel of FILES) {
  const path = join(ROOT, rel);
  const raw = readFileSync(path, 'utf8');
  const data = JSON.parse(raw);
  const list = Array.isArray(data) ? data : Object.values(data).find(Array.isArray);
  const indent = raw.match(/^[\[{]\n( +)/)?.[1].length ?? 2;
  const tail = raw.endsWith('\n') ? '\n' : '';
  if (JSON.stringify(data, null, indent) + tail !== raw) {
    console.error(`❌ ${rel}: round-trip changes the file formatting, aborting (nothing written).`);
    process.exit(1);
  }
  let fileChanges = 0;
  for (const entry of list) {
    for (const f of FIELDS) {
      if (typeof entry[f] !== 'string') continue;
      let out = entry[f];
      OVERRIDES.forEach((ov, n) => {
        if (ov[0] === entry.id && ov[1] === f) out = applyOverride({ [f]: out }, f, ov, n);
      });
      out = out.replace(WORD, (w) => {
        const fix = Object.prototype.hasOwnProperty.call(MAP, w) ? MAP[w] : null;
        if (!fix) return w;
        used.set(w, (used.get(w) ?? 0) + 1);
        return fix;
      });
      if (out !== entry[f]) {
        entry[f] = out;
        fileChanges++;
      }
    }
  }
  total += fileChanges;
  console.log(`${rel}: ${fileChanges} field(s) changed`);
  loaded.push({ path, data, indent, tail });
}
OVERRIDES.forEach((ov, n) => {
  if (!ovDone.has(n) && !problems.some((p) => p.startsWith(`#${n} `))) problems.push(`#${n} ${ov[0]} ${ov[1]}: entry or field not found`);
});
const unused = Object.keys(MAP).filter((k) => !used.has(k));
console.log(`total: ${total} field(s), ${[...used.values()].reduce((a, b) => a + b, 0)} MAP token(s) + ${ovDone.size}/${OVERRIDES.length} override(s)`);
if (unused.length) console.log(`MAP keys never matched (${unused.length}): ${unused.join(', ')}`);
if (problems.length) {
  console.error(`❌ ${problems.length} override problem(s), nothing written:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
if (WRITE) {
  for (const { path, data, indent, tail } of loaded) writeFileSync(path, JSON.stringify(data, null, indent) + tail);
  console.log('✅ written');
} else {
  console.log('dry run only, nothing written (add --write)');
}
