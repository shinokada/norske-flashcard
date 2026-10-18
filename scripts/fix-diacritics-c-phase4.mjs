#!/usr/bin/env node
/**
 * fix-diacritics-c-phase4.mjs
 *
 * Phase 4 of ai-docs/implementation/uttrykk-kind-follow-up.md.
 * Applies an approved token map (degraded -> correct) to the C files.
 * Touches ONLY the fields listed in FIELDS, whole-word matches only.
 * The map was built by checking every word of those fields against a German
 * dictionary and keeping the restorations a person approved; "Ase" and "Halse"
 * are deliberately NOT in it (both are already correct).
 *
 * Usage (from the repo root):
 *   node scripts/fix-diacritics-c-phase4.mjs            # dry run, prints counts
 *   node scripts/fix-diacritics-c-phase4.mjs --write    # writes the files
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILES = ['src/lib/data/vocab-c.json', 'src/lib/data/uttrykk-c.json'];
const FIELDS = ['german', 'example_german'];
const WRITE = process.argv.includes('--write');

const MAP = {"Anfanger":"Anfänger","Bedurfnisse":"Bedürfnisse","Befoerderung":"Beförderung","Beforderung":"Beförderung","Behorden":"Behörden","Bevolkerung":"Bevölkerung","Bevollmachtigung":"Bevollmächtigung","Blatter":"Blätter","Buhne":"Bühne","Burgermeister":"Bürgermeister","Burgersteig":"Bürgersteig","Dacher":"Dächer","Dickhautern":"Dickhäutern","Einode":"Einöde","Einwande":"Einwände","Entzundung":"Entzündung","Eroffnung":"Eröffnung","Fahigkeit":"Fähigkeit","Fahrgaste":"Fahrgäste","Fruhling":"Frühling","Fusse":"Füße","Gebaudes":"Gebäudes","Gefangnis":"Gefängnis","Gelachter":"Gelächter","Gelander":"Geländer","Gemalde":"Gemälde","Gerausch":"Geräusch","Geschaftigkeit":"Geschäftigkeit","Gesprachen":"Gesprächen","Getraenk":"Getränk","Gewuerzen":"Gewürzen","Grosses":"Großes","Gultigkeit":"Gültigkeit","Hande":"Hände","Handen":"Händen","Hohepunkt":"Höhepunkt","Hutte":"Hütte","Kerngehaeuse":"Kerngehäuse","Klager":"Kläger","Knochel":"Knöchel","Konigreiche":"Königreiche","Konigshaus":"Königshaus","Korper":"Körper","Kraftausdrucke":"Kraftausdrücke","Kunstler":"Künstler","Kunstlers":"Künstlers","Kuste":"Küste","Lacheln":"Lächeln","Laecheln":"Lächeln","Larm":"Lärm","Madchen":"Mädchen","Massnahme":"Maßnahme","Missverstandnis":"Missverständnis","Mitschuler":"Mitschüler","Mogliche":"Mögliche","Monch":"Mönch","Muhe":"Mühe","Mutze":"Mütze","Nachte":"Nächte","Nervositaet":"Nervosität","Neuankommling":"Neuankömmling","Oberflache":"Oberfläche","Pfuetze":"Pfütze","Prazision":"Präzision","Prufstand":"Prüfstand","Prugel":"Prügel","Qualitat":"Qualität","Rucksicht":"Rücksicht","Ruge":"Rüge","Schimpfworter":"Schimpfwörter","Schimpfwortern":"Schimpfwörtern","Schliessung":"Schließung","Schlussel":"Schlüssel","Schnursenkel":"Schnürsenkel","Stucke":"Stücke","Sunden":"Sünden","Tur":"Tür","Turrahmen":"Türrahmen","Uberlegung":"Überlegung","Uberraschung":"Überraschung","Unterstutzung":"Unterstützung","Veranderung":"Veränderung","Verhangnis":"Verhängnis","Vorstellungsgesprachen":"Vorstellungsgesprächen","Vorwurfe":"Vorwürfe","Wasseroberflache":"Wasseroberfläche","Zusammenstoss":"Zusammenstoß","abschutteln":"abschütteln","allmahlich":"allmählich","alteren":"älteren","anfangst":"anfängst","angstlich":"ängstlich","ankundigte":"ankündigte","aufgebruht":"aufgebrüht","aufgebruhten":"aufgebrühten","aufgewuhlt":"aufgewühlt","auflosen":"auflösen","aufreissen":"aufreißen","aufzuhoren":"aufzuhören","ausser":"außer","aussergewohnlich":"außergewöhnlich","ausserhalb":"außerhalb","ausserordentlich":"außerordentlich","befordert":"befördert","begrunden":"begründen","begrundet":"begründet","besass":"besaß","beschamt":"beschämt","bestandig":"beständig","bestatigen":"bestätigen","betaubt":"betäubt","bruchig":"brüchig","daruber":"darüber","drauben":"draußen","dunn":"dünn","durfen":"dürfen","eingefugt":"eingefügt","entzuckend":"entzückend","erbarmlich":"erbärmlich","erklarte":"erklärte","ermachtigen":"ermächtigen","ermoglicht":"ermöglicht","erschopft":"erschöpft","erwahnen":"erwähnen","erzahlte":"erzählte","feinfuhlig":"feinfühlig","fruhe":"frühe","fuhlend":"fühlend","fuhlte":"fühlte","funf":"fünf","fursorglich":"fürsorglich","geargert":"geärgert","gefugig":"gefügig","gefuhllos":"gefühllos","gefuttert":"gefüttert","gegenuber":"gegenüber","gehanselt":"gehänselt","gehore":"gehöre","geniessen":"genießen","geruhrt":"gerührt","giessen":"gießen","gleichmassigen":"gleichmäßigen","griesgramig":"griesgrämig","gross":"groß","grossartig":"großartig","grossen":"großen","grosses":"großes","grosszugig":"großzügig","gruendlich":"gründlich","gruene":"grüne","grundlich":"gründlich","hinuber":"hinüber","horen":"hören","hubsch":"hübsch","irrefuhren":"irreführen","irrezufuhren":"irrezuführen","kammen":"kämmen","kampft":"kämpft","klaglich":"kläglich","koniglicher":"königlicher","kummern":"kümmern","kummerte":"kümmerte","kundigte":"kündigte","lachelte":"lächelte","laerm":"Lärm","laermend":"lärmend","laermende":"lärmende","langere":"längere","liess":"ließ","merkwurdiger":"merkwürdiger","mitfuhlend":"mitfühlend","mitfuhlende":"mitfühlende","muhelos":"mühelos","muhsam":"mühsam","nahere":"nähere","naherte":"näherte","naherten":"näherten","naturliches":"natürliches","nervose":"nervöse","offnen":"öffnen","raumen":"räumen","reissen":"reißen","reissend":"reißend","reissendes":"reißendes","rucksichtsloser":"rücksichtsloser","ruegen":"rügen","ruegte":"rügte","sass":"saß","sassen":"saßen","schiessen":"schießen","schlangeln":"schlängeln","schlangelte":"schlängelte","schliesslich":"schließlich","schmachtig":"schmächtig","schmachtige":"schmächtige","schmuckt":"schmückt","schuchtern":"schüchtern","schutzen":"schützen","schwachlich":"schwächlich","sorgfaltig":"sorgfältig","stiess":"stieß","storen":"stören","stossen":"stoßen","suß":"süß","truegt":"trügt","ubereinstimmend":"übereinstimmend","uberging":"überging","uberquellend":"überquellend","uberreichen":"überreichen","uberreichte":"überreichte","uberrumpelt":"überrumpelt","uberschwanglich":"überschwänglich","uberschwanglichem":"überschwänglichem","ubersehen":"übersehen","ubersät":"übersät","ubervoll":"übervoll","ubervollen":"übervollen","unersaettlich":"unersättlich","unertraglich":"unerträglich","unfahig":"unfähig","unmoglich":"unmöglich","unschatzbar":"unschätzbar","unterstutzt":"unterstützt","unubertroffen":"unübertroffen","unverhullt":"unverhüllt","uppig":"üppig","verblufft":"verblüfft","verbusste":"verbüßte","vergonnt":"vergönnt","verliess":"verließ","versaumen":"versäumen","vertaut":"vertäut","vollig":"völlig","vollstandig":"vollständig","weisse":"weiße","wortlich":"wörtlich","wuerde":"würde","wurdevollen":"würdevollen","wurdig":"würdig","wutend":"wütend","zermurbte":"zermürbte","zogerte":"zögerte","zuhoren":"zuhören","zuverlassig":"zuverlässig","zuverlassiger":"zuverlässiger","zuzuhoren":"zuzuhören","äusseres":"äußeres"};

const used = new Map();
let total = 0;
for (const rel of FILES) {
  const path = join(ROOT, rel);
  const raw = readFileSync(path, 'utf8');
  const data = JSON.parse(raw);
  const list = Array.isArray(data) ? data : Object.values(data).find(Array.isArray);
  // Round-trip guard: refuse to write if re-serialising would change anything else.
  const indent = raw.match(/^[\[{]\n( +)/)?.[1].length ?? 2;
  const again = JSON.stringify(data, null, indent) + (raw.endsWith('\n') ? '\n' : '');
  if (WRITE && again !== raw) {
    console.error(`❌ ${rel}: round-trip changes the file formatting, aborting (nothing written).`);
    process.exit(1);
  }
  let fileChanges = 0;
  for (const entry of list) {
    for (const f of FIELDS) {
      if (typeof entry[f] !== 'string') continue;
      const out = entry[f].replace(/[A-Za-zÄÖÜäöüß]+/g, (w) => {
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
  if (WRITE) writeFileSync(path, JSON.stringify(data, null, indent) + (raw.endsWith('\n') ? '\n' : ''));
}
const unused = Object.keys(MAP).filter((k) => !used.has(k));
console.log(`total: ${total} field(s), ${[...used.values()].reduce((a, b) => a + b, 0)} token(s) replaced`);
if (unused.length) console.log(`map keys never matched (${unused.length}): ${unused.join(', ')}`);
console.log(WRITE ? '✅ written' : 'dry run only, nothing written (add --write)');
