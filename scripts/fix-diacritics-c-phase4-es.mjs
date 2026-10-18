#!/usr/bin/env node
/**
 * fix-diacritics-c-phase4-es.mjs
 *
 * Phase 4 of ai-docs/implementation/uttrykk-kind-follow-up.md, Spanish pass 1.
 * Applies an approved token map (accent missing -> correct) to the C files.
 * Touches ONLY the fields in FIELDS, whole-word matches only.
 *
 * Built by checking every word of the Spanish fields against a Spanish dictionary
 * plus the accented forms already present in the data, then reading each hit in its
 * sentence. Words that are valid without the accent in some reading are NOT in MAP
 * (creo, tenido, unas, anima, indica, libera, lastimero, montes, opera, solicita,
 * suena, aves, continuas, pasara, funcionara, universalismo, periodo, bebe as a verb).
 * Cases that depend on the sentence (llego / llegó, rio / rió, regano, bebe) are in
 * OVERRIDES, which run first, entry by entry.
 *
 * Usage (from the repo root):
 *   node scripts/fix-diacritics-c-phase4-es.mjs            # dry run, prints counts
 *   node scripts/fix-diacritics-c-phase4-es.mjs --write    # writes the files
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILES = ['src/lib/data/vocab-c.json', 'src/lib/data/uttrykk-c.json'];
const FIELDS = ['spanish', 'example_spanish'];
const WRITE = process.argv.includes('--write');

const MAP = {"Actuo":"Actuó","Admitio":"Admitió","Coloco":"Colocó","Conto":"Contó","Deslizo":"Deslizó","Empezo":"Empezó","Hundio":"Hundió","Lanzo":"Lanzó","Llego":"Llegó","Parecia":"Parecía","Sintio":"Sintió","Solto":"Soltó","abrio":"abrió","actuacion":"actuación","admitio":"admitió","admonicion":"admonición","aferro":"aferró","afonica":"afónica","agradecio":"agradeció","ahi":"ahí","albondigas":"albóndigas","alfeizar":"alféizar","alicaido":"alicaído","alla":"allá","alquitran":"alquitrán","amortiguacion":"amortiguación","analisis":"análisis","animacion":"animación","animo":"ánimo","anticipacion":"anticipación","aparecio":"apareció","aplico":"aplicó","aprendio":"aprendió","arbitro":"árbitro","arbol":"árbol","arboles":"árboles","area":"área","armonia":"armonía","arrastro":"arrastró","atencion":"atención","ato":"ató","atras":"atrás","atrevio":"atrevió","autentica":"auténtica","baston":"bastón","boveda":"bóveda","caido":"caído","calida":"cálida","calido":"cálido","caligrafia":"caligrafía","canalon":"canalón","caracter":"carácter","carbon":"carbón","carinoso":"cariñoso","cascara":"cáscara","causo":"causó","centimetro":"centímetro","cesped":"césped","climatica":"climática","coccion":"cocción","colchon":"colchón","colision":"colisión","coloco":"colocó","comia":"comía","comico":"cómico","comodamente":"cómodamente","companero":"compañero","compania":"compañía","compas":"compás","comprendio":"comprendió","comprension":"comprensión","confusion":"confusión","construyo":"construyó","conversacion":"conversación","convirtio":"convirtió","corazon":"corazón","cordon":"cordón","corrio":"corrió","crecian":"crecían","creia":"creía","critica":"crítica","criticas":"críticas","critico":"crítico","cuestion":"cuestión","cumplio":"cumplió","deberia":"debería","deberias":"deberías","debil":"débil","decadas":"décadas","decidio":"decidió","decision":"decisión","declaracion":"declaración","dejaria":"dejaría","demas":"demás","demostracion":"demostración","depresion":"depresión","desaparecio":"desapareció","descubrio":"descubrió","desgarron":"desgarrón","desperto":"despertó","destruccion":"destrucción","desvio":"desvío","determinacion":"determinación","detras":"detrás","diagnostico":"diagnóstico","discusion":"discusión","distraidamente":"distraídamente","dormia":"dormía","dueno":"dueño","educacion":"educación","eligio":"eligió","emitia":"emitía","empezo":"empezó","enganar":"engañar","entendio":"entendió","epoca":"época","escabullo":"escabulló","escalon":"escalón","escandalo":"escándalo","escuadron":"escuadrón","estan":"están","estomago":"estómago","estupido":"estúpido","excepcion":"excepción","excitacion":"excitación","exigio":"exigió","exito":"éxito","exposicion":"exposición","expresion":"expresión","extrano":"extraño","fantastica":"fantástica","floracion":"floración","formacion":"formación","formo":"formó","fotografia":"fotografía","fragil":"frágil","frio":"frío","futbol":"fútbol","gentio":"gentío","guarderia":"guardería","habian":"habían","habitacion":"habitación","hablo":"habló","heroe":"héroe","hipnotica":"hipnótica","humeda":"húmeda","implicito":"implícito","incomoda":"incómoda","increiblemente":"increíblemente","inflamacion":"inflamación","inmovil":"inmóvil","inspeccion":"inspección","inutil":"inútil","jamas":"jamás","jardin":"jardín","jarron":"jarrón","jubilacion":"jubilación","jubilo":"júbilo","kilometro":"kilómetro","kilometros":"kilómetros","ladron":"ladrón","lagrimas":"lágrimas","lamina":"lámina","lanzo":"lanzó","leia":"leía","leyo":"leyó","limite":"límite","linea":"línea","liquido":"líquido","llamo":"llamó","llevo":"llevó","magnifico":"magnífico","maldicion":"maldición","matematica":"matemática","matematicas":"matemáticas","mecian":"mecían","medicos":"médicos","melodia":"melodía","merito":"mérito","metalica":"metálica","minimo":"mínimo","miro":"miró","montanas":"montañas","movia":"movía","musculos":"músculos","nego":"negó","negociacion":"negociación","ningun":"ningún","ocurrio":"ocurrió","oidos":"oídos","oir":"oír","opinion":"opinión","oposicion":"oposición","opto":"optó","oyo":"oyó","pajaro":"pájaro","parecia":"parecía","partio":"partió","pequenas":"pequeñas","perdio":"perdió","perfeccion":"perfección","pidio":"pidió","poblacion":"población","podian":"podían","podria":"podría","podrian":"podrían","policia":"policía","politico":"político","politicos":"políticos","ponia":"ponía","posesion":"posesión","precision":"precisión","preferia":"prefería","prometio":"prometió","promocion":"promoción","proposito":"propósito","publicamente":"públicamente","pure":"puré","queria":"quería","rafaga":"ráfaga","rapidamente":"rápidamente","razon":"razón","recibio":"recibió","recien":"recién","recomendo":"recomendó","reflexion":"reflexión","refunfunar":"refunfuñar","reganar":"regañar","regimen":"régimen","rehen":"rehén","reian":"reían","reirse":"reírse","reprension":"reprensión","resena":"reseña","respiracion":"respiración","respondio":"respondió","resulto":"resultó","reunian":"reunían","reunio":"reunió","reunion":"reunión","revelo":"reveló","rigido":"rígido","rincon":"rincón","rio":"río","ritmicamente":"rítmicamente","ritmico":"rítmico","salon":"salón","satisfaccion":"satisfacción","seguia":"seguía","senales":"señales","sensacion":"sensación","sentia":"sentía","sento":"sentó","sintio":"sintió","sirvio":"sirvió","situacion":"situación","sobresalia":"sobresalía","sofa":"sofá","solida":"sólida","solido":"sólido","solidos":"sólidos","solto":"soltó","sono":"sonó","sonrio":"sonrió","supervision":"supervisión","surgio":"surgió","tacito":"tácito","tension":"tensión","termino":"término","timido":"tímido","tipico":"típico","trajin":"trajín","transicion":"transición","traves":"través","vacio":"vacío","vegetacion":"vegetación","verguenza":"vergüenza","vision":"visión","vivian":"vivían","vivio":"vivió","volveria":"volvería","volvian":"volvían","volvio":"volvió"};

// [id, field, from, to]: sentence-dependent cases, applied before MAP.
const OVERRIDES = [["w-006042","example_spanish","llego","llegó"],["w-006045","example_spanish","llego","llegó"],["w-006067","example_spanish","llego","llegó"],["w-006513","example_spanish","llego","llegó"],["w-009330","example_spanish","llego","llegó"],["w-006169","example_spanish","regano","regañó"],["w-007594","example_spanish","indico","indicó"],["w-006502","example_spanish","rio","rió"],["w-006764","example_spanish","rio","rió"],["w-006878","example_spanish","rio","rió"],["w-007102","example_spanish","rio","rió"],["w-007910","example_spanish","rio","rió"],["w-009374","example_spanish","rio","rió"],["w-006044","spanish","regano","regaño"],["w-006044","example_spanish","regano","regaño"],["w-005961","example_spanish","bebe","bebé"],["w-005989","example_spanish","bebe","bebé"],["w-005961","spanish","bebes","bebés"]];

const WORD = /[A-Za-zÁÉÍÓÚáéíóúñÑü]+/g;
const used = new Map();
const ovUsed = new Set();
let total = 0;
for (const rel of FILES) {
  const path = join(ROOT, rel);
  const raw = readFileSync(path, 'utf8');
  const data = JSON.parse(raw);
  const list = Array.isArray(data) ? data : Object.values(data).find(Array.isArray);
  // Round-trip guard: refuse to write if re-serialising would change anything else.
  const indent = raw.match(/^[\[{]\n( +)/)?.[1].length ?? 2;
  const tail = raw.endsWith('\n') ? '\n' : '';
  if (WRITE && JSON.stringify(data, null, indent) + tail !== raw) {
    console.error(`❌ ${rel}: round-trip changes the file formatting, aborting (nothing written).`);
    process.exit(1);
  }
  let fileChanges = 0;
  for (const entry of list) {
    for (const f of FIELDS) {
      if (typeof entry[f] !== 'string') continue;
      let out = entry[f];
      OVERRIDES.forEach(([id, field, from, to], n) => {
        if (id !== entry.id || field !== f) return;
        out = out.replace(WORD, (w) => {
          if (w !== from) return w;
          ovUsed.add(n);
          return to;
        });
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
  if (WRITE) writeFileSync(path, JSON.stringify(data, null, indent) + tail);
}
const unused = Object.keys(MAP).filter((k) => !used.has(k));
const ovMissing = OVERRIDES.filter((_, n) => !ovUsed.has(n)).map((o) => o.join(':'));
console.log(`total: ${total} field(s), ${[...used.values()].reduce((a, b) => a + b, 0)} MAP token(s) + ${ovUsed.size} override(s)`);
if (unused.length) console.log(`MAP keys never matched (${unused.length}): ${unused.join(', ')}`);
if (ovMissing.length) console.log(`OVERRIDES never matched: ${ovMissing.join(' | ')}`);
console.log(WRITE ? '✅ written' : 'dry run only, nothing written (add --write)');
