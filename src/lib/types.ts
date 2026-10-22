import type { SVGAttributes } from 'svelte/elements';
import type { Card } from 'ts-fsrs';
import { CATEGORIES_BY_LEVEL, LANGUAGES } from '$lib/config';

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C';

export type PartOfSpeech =
  | 'noun'
  | 'verb'
  | 'adjective'
  | 'adverb'
  | 'pronoun'
  | 'numeral'
  | 'preposition'
  | 'conjunction'
  | 'interjection'
  | 'phrase';

/** The three kinds of uttrykk entry (data-rules/vocab-and-uttrykk-v2.md, `kind` field). */
export type UttrykkKind = 'idiom' | 'ordtak' | 'formula';

export type Category = (typeof CATEGORIES_BY_LEVEL)[CEFRLevel][number];

export type FSRSRating = 'again' | 'hard' | 'good' | 'easy';

export interface CardProgress {
  fsrs: Card;
  seenCount: number;
  lastSeen: string; // ISO date string
  lastRating?: FSRSRating; // most recent rating
  level: CEFRLevel;
  category: Category;
}

export type Language = keyof typeof LANGUAGES;
export type FlashcardLanguage = Exclude<Language, 'norwegian'>;

export interface VocabEntry {
  id: string;
  lemma?: string;
  norsk: string;
  /** Short Norwegian gloss that disambiguates entries with an identical `norsk`,
   *  e.g. "til strikking" vs "til fiske". Required on every entry in such a group.
   *  Trimmed, lowercase, no parentheses, 1-3 words (~25 chars max). Shown on flashcard
   *  fronts, the quiz reveal card and the summary (not in quiz prompts, where it
   *  could give the answer away). See data-rules/vocab-and-uttrykk-v2.md (sense field). */
  sense?: string;
  english: string;
  spanish?: string;
  ukrainian?: string;
  german?: string;
  example: string;
  example_english: string;
  example_spanish?: string;
  example_ukrainian?: string;
  example_german?: string;
  definition?: string; //monolingual Norwegian definition of the word
  level: CEFRLevel;
  category: Category;
  part: PartOfSpeech;
  // theme removed — A1–B2 uttrykk now uses `category` directly, matching
  // vocab and C-level uttrykk (ai-docs/implementation/uttrykk-theme-category-unification.md)
  note?: string; // free-text usage note (distinct from `definition` — see data-rules/vocab-and-uttrykk-v2.md)
  verb_type?: string; // conjugation class for verbs: 'v1' | 'v2' | 'v3' | 'ureg' or a comma-separated combination, e.g. 'v1, v2'
  /** Uttrykk entries only: idiom, ordtak (proverb) or formula (communicative chunk).
   *  Required on every uttrykk entry (check-uttrykk.ts errors on a missing kind since 2026-10-17);
   *  optional in this shared type because vocab entries use it too. Never set on vocab entries.
   *  See data-rules/vocab-and-uttrykk-v2.md. */
  kind?: UttrykkKind;
}

type TitleType = {
  id?: string;
  title?: string;
};

type DescType = {
  id?: string;
  desc?: string;
};

export interface BaseProps extends SVGAttributes<SVGElement> {
  size?: string;
  role?: string;
  color?: string;
  variation?: 'solid' | 'outline' | 'mini' | 'micro';
  strokeWidth?: string;
}

export interface Props extends BaseProps {
  title?: TitleType;
  desc?: DescType;
  ariaLabel?: string;
}

// ── Norskprøven Practice ─────────────────────────────────────────────────────

/** Level for Norskprøven practice: A2 or B1 */
export type NorskprovenLevel = 'A2' | 'B1';

/** Test type */
export type NorskprovenTestType = 'reading' | 'writing' | 'oral';

// ── Reading ──────────────────────────────────────────────────────────────────

export interface ReadingOption {
  id: string; // 'a' | 'b' | 'c' | 'd'
  text: string;
}

export interface ReadingQuestion {
  id: string; // e.g. 'rq-001'
  prompt: string; // question text
  options: ReadingOption[];
  correctId: string; // matches one option.id
}

export interface ReadingPassage {
  id: string; // e.g. 'rp-a2-001'
  level: NorskprovenLevel;
  title: string; // passage title shown above the text
  text: string; // the Norwegian passage (1–5 short paragraphs)
  imageUrl?: string; // optional path to static/ asset
  questions: ReadingQuestion[];
}

// ── Writing ──────────────────────────────────────────────────────────────────

export interface WritingPrompt {
  id: string; // e.g. 'wp-a2-001'
  level: NorskprovenLevel;
  situation: string; // context sentence
  task: string; // the instruction
  wordCountMin: number;
  wordCountMax: number;
  modelAnswer: string; // full example answer
  modelNotes?: string; // optional explanation of what makes this answer good
}

// ── Oral ─────────────────────────────────────────────────────────────────────

export interface OralPrompt {
  id: string; // e.g. 'op-a2-001'
  level: NorskprovenLevel;
  scenario: string; // brief role-play setup or discussion topic
  questions: string[]; // 2–4 discussion questions the examiner may ask
  tips?: string; // preparation tip for the candidate
  modelAnswer?: string; // example of a good response, revealed after practice
  modelNotes?: string; // optional explanation of what makes this answer good
}

// ── Aggregated ───────────────────────────────────────────────────────────────

export interface NorskprovenData {
  reading: ReadingPassage[];
  writing: WritingPrompt[];
  oral: OralPrompt[];
}

// ── Grammar ──────────────────────────────────────────────────────────────────

export type GrammarTopic =
  | 'ikke-placement' // ikke in main vs subordinate clauses
  | 'v2-word-order' // inversion after fronted adverbials
  | 'det-sentence' // At X er Y → Det er Y at X
  | 'det-er-ikke' // ordering det / er / ikke
  | 'modal-verb-order' // modal + infinitive position
  | 'subordinate-order' // general subordinate clause word order
  | 'relative-som' // relative clauses with «som» (A2 intro; harder omission/fronting forms B2–C1)
  | 'setningsadverbial' // sentence adverbial placement
  | 'adverbial-fronting' // fronting adverbials with V2 inversion
  | 'svar-ja-jo-nei' // short answers: ja / jo / nei (B2–C1)
  // Phase 2 — morphology topics (Plus only)
  | 'noun-articles' // en / et / ei · null article (professions, generics)
  | 'noun-plurals' // irregular and rule-based plural forms
  | 'noun-possessives' // Eriks / Annes — no apostrophe in Norwegian
  | 'adj-agreement' // adjective agreement: ubestemt sg → pl, bestemt form
  | 'adj-definite' // den/det/de + weak adjective form
  | 'enkel-dobbel-bestemmelse' // double determination (den gode maten) as the norm; exceptions: fixed names (Det hvite hus, De forente nasjoner) and formal written language (Det norske folk)
  | 'adj-comparison' // comparative and superlative forms
  | 'sterke-verb' // strong verb preteritum and past participle forms
  | 'fortellende-setninger' // statements: V2 word order, fronted adverbials
  | 'sporresetninger' // questions: yes/no inversion, question words
  | 'preposisjoner-tid' // time prepositions: i, om, for–siden, på, til
  | 'preposisjoner-sted' // place & relation prepositions: i/på, geography, hos/ved/til/fra, av/fra, compounds
  // Nivå A2 topics — see ai-docs/implementation/a2-quiz-and-grammar.md
  | 'presens-perfektum' // formation (har + perfektum partisipp), contrast with preteritum, duration questions
  | 'derfor-fordi' // derfor (result, main-clause V2) vs. fordi (cause, subordinate clause)
  | 'kvantorer' // mye/mange, mer/flere — countable vs. uncountable
  | 'modalverb-preteritum' // modal preteritum forms: kan→kunne, vil→ville, skal→skulle, må→måtte, bør→burde
  | 'plassering-verb' // sette/legge (movement, takes object) vs. stå/ligge (state, no object)
  | 'refleksive-verb' // reflexive pronoun agreement: glede seg, grue seg, føle seg
  | 'ha-vs-vaere' // «ha» for symptoms/possession-shaped states vs. «være» for adjective-shaped states
  // Nivå A1 topics (free) — see ai-docs/implementation/a1-quiz-and-grammar.md
  | 'personlige-pronomen' // subject pronouns jeg/du/han/hun/vi/dere/de
  | 'presens-verb' // regular presens (-er) conjugation
  | 'pronomen-objektsform' // object pronouns meg/deg/ham/henne/oss/dere/dem
  | 'og-men' // og (addition) vs men (contrast)
  | 'adverb-sted-hjem' // inne/ute, inn/ut, hjem/hjemme
  | 'refleksive-uttrykk' // reflexive verb+pronoun pattern: legge seg, like seg
  | 'infinitiv-a1' // bare infinitive after modals vs. «å» after like/pleie/prøve
  | 'substantiv-bestemt-form' // definite singular noun endings: -en/-a/-et
  | 'pronomen-den-det-de' // den/det/de referring back to a noun
  | 'denne-dette-disse' // demonstratives denne/dette/disse
  | 'imperativ' // imperative = verb stem, no subject, no -r ending
  | 'possessiver-min-din' // min/din/hans/hennes/vår/deres, post-nominal in spoken Norwegian
  | 'refleksivt-possessiv-sin' // sin/sitt/sine vs. hans/hennes
  | 'ja-jo' // jo — contradicting a negative question/statement, vs. plain ja
  | 'preteritum-a1' // regular preteritum + common irregular verbs (var, hadde, gikk)
  | 'for-a-fordi' // «for å» + infinitive (purpose) vs. «fordi» + clause (cause)
  | 'vaer-det-subjekt' // impersonal/weather «det»: Det regner, Det blåser
  | 'indirekte-tale-at-om' // reported statement with «at» vs. reported yes/no question with «om»
  | 'synes-tror' // synes (opinion) vs. tror (belief/uncertainty)
  // Nivå A1 topics (free), pt. 2 — see ai-docs/implementation/a1-update.md
  | 'klokka-tid' // telling time: hel/halv + kvart på/over + N over/på halv
  | 'ordenstall-dato' // ordinal formation + date phrasing (den 3. juni / tredje i sjette)
  | 'for-siden' // «for + duration + siden» = time elapsed since an event
  // Nivå B1 topics (Plus only) — see ai-docs/implementation/b1-grammar.md
  | 'framtid-uttrykk' // future expressions: skal/vil/kommer til å + har tenkt å/har lyst til å/håper (at)
  | 'for-sa-arsak-folge' // «for» (cause, coordinating) vs. «så» (result, coordinating)
  | 'da-naar' // «da» (single past event) vs. «når» (repeated/habitual, or present/future)
  | 'hvis-om-betingelse' // «hvis» (condition) vs. «om» (embedded yes/no question)
  | 'passiv-bli-s' // introductory passive voice: bli-passiv and s-passiv formation
  | 'bade-og-verken-eller' // «både X og Y» / «verken X eller Y» correlative conjunctions
  | 'adjektiv-eller-adverb' // adjective (agrees with noun) vs. neuter/adverb -t form (modifies verb)
  | 'motsetning-selv-om-likevel' // «men» (coordinating) vs. «selv om» (subordinating) vs. «likevel» (adverb, V2)
  | 'tidssekvens-etter-at-etterpaa' // «etter at» (subjunction) vs. «etterpå» (adverb, V2) vs. «så» (conjunction)
  | 'transitiv-intransitiv-verb' // transitive/intransitive verb pairs: sette/sitte, legge/ligge, henge, brenne, senke/synke
  | 's-verb' // reciprocal/deponent -s verbs: møtes, sees, synes, trives — no non-s counterpart, or a different meaning
  | 'verbprefiks-be-an-mis' // verb-forming prefixes be-/an-/mis- changing a base verb's meaning/valency
  | 'adverb-setningsbinding' // connective adverbs linking two sentences: så (time), derfor (årsak), likevel (motsetning), dessuten (tillegg)
  // Nivå C topics (Plus only) — see ai-docs/implementation/c-grammar.md
  | 'ubestemt-artikkel-c' // indefinite article — professions+adjective, uncountables, transport, uttrykk, optional article
  | 'substantiv-uttrykk-c' // noun forms inside fixed idioms (ta hånd om, stå til liv, gå som fot i hose)
  | 'sammensatte-substantiv' // building compound nouns from a descriptive phrase
  | 'adj-mer-mest' // adjective classes that never take -ere/-est
  | 'adj-farger-uboyelige' // invariable color adjectives: oransje, lilla, rosa, beige
  | 'adj-partisipp-som-adjektiv' // irregular predikativ forms of participle-adjectives
  | 'predikativ-agreement' // predikativ non-agreement (intetkjønn with ubestemt subject) + exceptions
  | 'verbform-i-kontekst' // infinitiv/presens choice across multi-verb sentences
  | 'sterke-verb-c' // rare strong verbs beyond the common A2/B1 list
  | 'perfektum-pluskvamperfektum' // tense choice + word order with sentence adverbials
  | 'futurum-referert' // 2. futurum — evidential/reported «skal ha X»
  | 'kondisjonalis-counterfactual' // 1./2. kondisjonalis + om-setninger
  | 'verbet-a-fa' // meanings of «å få» + hjelpeverb uses
  | 'leddsetning-som-fundament' // subordinate clause filling the front field
  | 'ordet-sa' // så as konjunksjon / tidsadverb / subjunksjon
  | 'koordinerende-konjunksjoner' // og/eller/men/for/så choice + comma rule
  | 'ordfamilie-avledning' // deriving noun/verb/adjective/adverb within a word family
  | 'omskriving-passiv' // active↔passive, casual→formal nominalized paraphrase
  | 'jo-desto-komparativ' // jo + comparative … desto/jo + comparative correlative
  | 'preposisjoner-kroppsdel-uttrykk' // body-part idiom prepositions (hår, nakke, hals, øre)
  | 'preposisjoner-generelt-c' // general idiomatic preposition collocations
  | 'uttrykk' // idiom recognition, practised in sets of ~25 (merged from uttrykk-gjenkjenning-*)
  | 'adj-boying-c' // adjective comparison (incl. irregular -en stems) + weak/definite agreement, C level
  // Nivå B2 topics (Plus only) — see ai-docs/implementation/b2-grammar.md
  | 'substantivert-adjektiv' // adjective standing alone as a noun: de unge, de fattige, den ansatte
  | 'motsetning-prefiks' // forming an antonym with a negative prefix: u-, mis-, van-
  | 'subjunksjon-oversikt' // choosing among many subjunctions by meaning (da, fordi, hvis, selv om, …)
  | 'partisipp-former' // presens partisipp (manner adverbial) + perfektum partisipp used adjectivally
  | 'substantivert-partisipp' // participles used as nouns: de streikende, de reisende, de overlevende (presens, never inflects), de ansatte, den savnede (perfektum, inflects like an adjective), mange ansatte without article
  | 'sammensatte-partisipper' // compound participles: hjemmelaget, utsolgt, aleneboende (perfektum, usually uninflected after the verb), febernedsettende, enestående (presens, never inflects), building new compounds
  | 'partikkelverb-los-fast' // particle verbs: loose vs. fixed compound, synonym swaps, fixed participles
  | 'modalverb-betydning' // choosing kan/skal/vil/må by meaning (ability, plan, desire, necessity)
  | 'sannsynlighet-uttrykk' // paraphrasing expressions of probability/likelihood
  | 'bli-presens-partisipp' // «bli» + presens partisipp — durative/ongoing aspect
  | 'fa-perfektum-partisipp' // «få» + perfektum partisipp — resultative aspect
  | 'mene-synes-tro-tenke' // near-synonym opinion verbs: mene/synes/tro/tenke
  // Nivå B2 topics, round 2 (Plus only) — see ai-docs/implementation/b2-grammar-2.md
  | 'modale-adverb' // certainty/discourse-particle adverbs: nok, vel, jo, faktisk, egentlig, kanskje, sikkert, visst, neppe
  | 'sammensatte-substantiv-b2' // compound noun linking forms (-s-/-e-/none) + adjective+noun vs. fixed compound
  | 'preteritum-perfektum-og-futurum' // narrating before/after a past reference point: hadde + partisipp, skulle/ville + infinitiv
  | 'det-formelt-subjekt' // «det» as formal/dummy subject (incl. passive) and «det er/var … som» cleft sentences
  | 'det-referanse' // anaphoric «det» referring back to a clause, adjective, or predicate
  | 'spesial-kvantorer' // ingen/ingenting, all/alt/alle, hel/helt/hele, hver/hvert, begge (to)/begge deler
  | 'arsak-og-folge-uttrykk' // broader cause/effect/purpose toolkit: siden, ettersom, dermed, nemlig, føre til, for at
  | 'kontrast-uttrykk' // broader contrast/concession toolkit: enda, til tross for at, imidlertid, derimot, tvert imot
  | 'hoflig-preteritum' // preteritum used for politeness/hedging: kunne du, det hadde vært fint om
  | 'hypotetiske-betingelsessetninger' // graded hypothetical/counterfactual conditionals + skulle ønske/tenk om
  | 'stedsadverb-statisk-dynamisk' // location adverb pairs: hjemme/hjem, inne/inn, ute/ut, der/dit, her/hit
  | 'man-en-upersonlig-pronomen' // impersonal pronouns «man» (subject only) vs. «en» (subject or object)
  // Nivå B2/C topic — punctuation (see ai-docs/implementation/punctuation.md)
  | 'kommaregler' // comma rules: subordinate-clause comma, list comma, and related conventions
  // Nivå B2/C topics — Det går bra! (see ai-docs/implementation/b2-c-grammar.md)
  | 'nyanser-uttrykk' // near-synonym/nuance discrimination across word classes (seriøs/alvorlig, tid/time/gang, ryke, såpass)
  | 'preposisjoner-uttrykk-b2' // idiomatic/collocational B2 preposition choices (ta ansvar for, ha inntrykk av, forberedt på)
  // Nivå B2 topic — "På Nivå" arbeidsbok (see ai-docs/implementation/b2-grammar-pa-niva-arbeidsbok.md)
  | 'determinativ-forsterkere' // emphasizer determinatives: egen/eget/egne, selv/selve, eneste
  | 'adverb-gradboying' // adverb comparison: regular -ere/-est (sakte/fort/ofte) + irregular gjerne→heller→helst
  // Tier 1 content — see ai-docs/implementation/grammar-content-tier1.md
  | 'subjekt-og-verbal' // subject and verbal: hvem/hva + verb test, verbal (one or more verbs), S-V order, inversion in questions/after a front element, subjekt vs. objekt
  | 'objekt' // direct object: hva/hvem test, place after the verb, objekt vs. adverbial/predikativ, objekt in the front field
  | 'predikativ' // predicative: describes the subject after være/bli/hete/virke/se ut, noun or adjective, position, predikativ vs. objekt/adverbial
  | 'setningsfragment-uttrykk' // fixed expressions without a verb: wishes (god tur, god helg, lykke til, smaklig maltid) and replies (i like mate, ingen arsak, selv takk)
  | 'folelsesuttrykk' // expressing feelings: reaction words by situation (sa bra, sa synd, hurra, au, oi), sa + adjektiv (neuter for a situation, agreement with a noun), det var leit a hore
  | 'hilseord' // greetings and polite expressions: hei/god morgen/god kveld/god natt by time of day, god dag is formal, ha det/vi ses, takk/vaer sa god/unnskyld, hyggelig a mote deg
  | 'tidsadverb' // time adverbs: when (nå, i dag, i går, i morgen), how often (alltid, ofte, aldri), placement, allerede/ennå/fortsatt, i morgen vs. i morges
  | 'egennavn' // proper names: capital letter for names and places, small letter for weekdays/months/languages/nationality words, no article before names, titles before a name (kong Harald), seas/lakes/mountains
  | 'resiprokt-pronomen' // reciprocal pronoun hverandre: each other, hverandre vs. seg vs. dem, position after verb/preposition, also for later actions (vi ser hverandre i morgen)
  | 'preposisjoner-tilhorighet' // prepositions for people: til (bilen til Anna), med (gift med, venn med, sammen med), hos (bor/jobber hos), fra (origin)
  | 'preposisjoner-annen-bruk' // prepositions for means, topic and purpose: med (reiser med tog), uten (kaffe uten sukker), om (snakke om), for (bra for deg, takk for), til (gave til mamma, kake til kaffen)
  | 'sammensatte-preposisjoner' // compound prepositions as fixed units: i nærheten av, i stedet for, på grunn av, ved hjelp av, i forhold til, til tross for
  | 'preposisjoner-av-for-med' // more uses of av (material, cause, source, passive agent), for (who it concerns), med (manner)
  | 'adverbial' // adverbial: hvor/når/hvordan, position (last or first), adverbial vs. objekt/predikativ
  | 'indirekte-objekt' // indirect object: the recipient (Lars ga Eva en blomst), position before the direct object, hvem/hva questions, til-phrase alternative, object pronoun form
  | 'sammensatt-verbtid' // naming verb1 (finite auxiliary) / verb2 (non-finite main verb) / tempus in compound verb forms
  | 'setningsledd-identifikasjon' // naming/labeling sentence elements (subjekt/verbal/objekt/predikativ/adverbial), NP-building, and clause-function analysis (leddsetning as subjekt/objekt/adverbial)
  | 'leddsetning-grunnleggende' // what a leddsetning is: starts with at/fordi/når/hvis, can't stand alone, can come first (then the main clause starts with the verb)
  | 'tillegg-setninger' // adding information between sentences: og, dessuten (verb right after it when first), «også» after the verb or last, heller ikke / heller last
  | 'betingelse-hvis-dersom' // conditions: hvis and dersom (same meaning, dersom more formal), condition clause after or before the main clause (verb first in the main clause), ikke between subject and verb
  | 'svarord-nyanser' // answer word nuances: tja/nja, ja da/jo da/nei da (reassuring), ja vel/nei vel (understood), a ja/a nei, nei to agree and jo to contradict a negative statement
  | 'tid-samtidighet-plutselig' // time relations: før/innen as subjunctions, simultaneity adverbials (imens, i mellomtida, på den tida, samtidig (som)), da, sudden events (plutselig, i det samme, i samme øyeblikk)
  | 'folge-uttrykk' // result: derfor in the middle field (formal), av den grunn / som en følge av det, så … at (adjective agrees with the subject), slik at / sånn at (more spoken)
  | 'i-tillegg-uttrykk' // addition: i tillegg (verb second when first, can also stand last), og så (spoken), i tillegg til + noun
  | 'tror-ikke-og-innskutt' // word order with tror/synes/sier: ikke right after the verb (tror ikke (at) ...), trailing expressions with the verb before the subject (..., tror jeg / sier han)
  | 'det-er-som-sporsmal' // questions with det er/var ... som: quantity word as subject (som), as object (no som), stress on one element, with question words (Hvor er det dere bor?)
  | 'pronomen-mer'; // more on pronouns: den/det/de for place names (by gender of the noun), logical pronoun for groups (familien/politiet → de) and persons (vitnet → hun/han), hun eller han (hen in the rule only)

export interface GrammarRule {
  id: GrammarTopic;
  titleEn: string;
  titleNb: string;
  explanationEn: string; // short rule shown on wrong answer
  explanationNb: string;
  blogSlug?: string; // link to related blog post
}

export interface GrammarQuestion {
  id: string; // stable key for FSRS, e.g. 'gq-ikke-001'
  topic: GrammarTopic;
  cefr: CEFRLevel; // level — drives the free-tier budget + FSRS progress bucket + /stats grouping
  type: 'fill' | 'order' | 'transform' | 'minimal-pair' | 'multiple-choice' | 'punctuation';
  // Per-question instruction shown above the stimulus, e.g.
  // "Embed in: «Jeg tror at …»" or "Translate into Norwegian:".
  // Lets transform/production items state the task that the generic type
  // label can't. Written in the learner's L1 (English) with NB fragments quoted.
  prompt?: string;
  // --- fill type ---
  sentence?: string; // e.g. "Jeg vet at han _____ frisk."  (___ = the blank)
  words?: string[]; // word bank to arrange in the blank, e.g. ["ikke", "er"]
  // --- order type ---
  tokens?: string[]; // word list shown as chips (reshuffled for display)
  // --- transform type ---
  source?: string; // sentence to rewrite, or an L1 sentence to translate
  // --- minimal-pair type ---
  optionA?: string; // first candidate sentence
  optionB?: string; // second candidate sentence
  explanation?: string; // shown on reveal: why the correct option is right
  // --- multiple-choice type ---
  // multiple-choice: 3 or 4 options (the UI labels them A–D); punctuation: exactly 3
  // (per ai-docs/implementation/c-grammar.md Phase 1.5). `answer`
  // must equal one of these strings verbatim (grading matches on normalized text,
  // same as every other type) — there is no separate letter/index field.
  options?: string[];
  // --- shared ---
  answer: string; // primary correct answer (the blank span for fill; full sentence otherwise)
  alternates?: string[]; // other accepted forms
  hint?: string; // optional nudge shown after a wrong attempt
  plusOnly?: boolean; // gate advanced questions behind Plus
  set?: string; // optional practice-set label (e.g. 'uttrykk-3'); used by topics offered in sets
}
