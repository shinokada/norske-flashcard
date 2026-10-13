---
title: Vocab vs Uttrykk v2
date: 2026-10-13
completed: null
---

# Vocab vs Uttrykk (v2)

> **Status: DRAFT, not yet in force.** `vocab-and-uttrykk.md` (v1) stays the rule until this doc is adopted. Adoption (renaming, repointing references, script review, data moves) is the checklist at the end: "Adoption checklist". Decisions still open are listed in "Open decisions".

v2 is a **full replacement** of v1: the field rules are carried over unchanged, and the classification rules (vocab vs uttrykk) are revised.

## What changed from v1

| Topic                                                                                     | v1                                                                                              | v2                                                                                                                           |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| What uttrykk means                                                                        | "fixed expressions"; idioms and proverbs mentioned                                              | Explicit umbrella with three kinds: **idiom**, **ordtak** (proverb), **formula** (communicative). SNL definition referenced. |
| Time expressions (`i går`, `i morgen`)                                                    | uttrykk (`i dag` is a vocab adverb: contradiction)                                              | **vocab**, `part: adverb`                                                                                                    |
| Multi-word prepositions / conjunctions (`i lys av`, `forutsatt at`, `med utgangspunkt i`) | listed as uttrykk examples, while vocab says multi-word prepositions stay vocab (contradiction) | **vocab**                                                                                                                    |
| Fixed prepositional/adverbial chunks                                                      | uttrykk "if they read as a formula"                                                             | **vocab** (adverb/preposition), consistent with the collocation `part` table (`på gløtt`, `til sjøs`)                        |
| "Head-less formulas" bucket                                                               | any chunk with no single head                                                                   | narrowed to chunks with a **communicative job**: greetings, politeness, conversational fragments, discourse markers          |
| `ta vare på`, `ha lyst til`                                                               | in the uttrykk examples, despite the 2026-09-19 amendment                                       | removed from the examples; treated as vocab verb collocations                                                                |
| Decision rule                                                                             | idiom? → lexical item? → chunk?                                                                 | idiom/ordtak? → **dictionary-headword test** → communicative formula?                                                        |

Also changed in v2 (fields):

- **`definition` scope.** The field now exists on every vocab level (A1–C), on `uttrykk-c`, and on part of `uttrykk-a1` to `-b2`. A source uttrykk entry that has none needs a definition written when it moves to vocab (see the `definition` field section).
- **`phrase` examples.** The `phrase` rows in the `norsk` and `lemma` tables no longer use `biologisk mangfold`, which is a `noun` (v1 contradicted itself here).
- **Verb-initial uttrykk examples.** `bli oppfordret til` (a literal passive frame, not an idiom) is replaced by the idiom `holde hodet over vann`.

## vocab-xx.json entry rules

### `norsk` field

The display form shown to learners.

| `part`                   | Format                                                                      | Example                         |
| ------------------------ | --------------------------------------------------------------------------- | ------------------------------- |
| `noun`                   | dictionary form + gender in parentheses                                     | `hus (et)`                      |
| `noun` (variable gender) | dictionary form + `(en/ei)` (both accepted, e.g. `m/f` source dictionaries) | `elv (en/ei)`                   |
| `noun` (plural card)     | plural form + `(pl.)` or `(b.pl.)` in parentheses                           | `bøker (pl.)`, `bøkene (b.pl.)` |
| `noun` (indeclinable)    | dictionary form + `(ubøy.)` in parentheses                                  | `fjor (ubøy.)`                  |
| `verb`                   | infinitive with `å`                                                         | `å få`                          |
| `adjective`              | base (masculine singular) form                                              | `glad`                          |
| `adverb`                 | uninflected form                                                            | `i dag`, `i går`                |
| `conjunction`            | uninflected form                                                            | `fordi`, `forutsatt at`         |
| `preposition`            | uninflected form                                                            | `ved siden av`, `i lys av`      |
| `pronoun`                | base form                                                                   | `jeg`                           |
| `numeral`                | base form                                                                   | `én`                            |
| `interjection`           | base form                                                                   | `hei`                           |
| `phrase`                 | the fixed multi-word form (headless frame only, see `part` values)          | `det er om å gjøre`             |

### `lemma` field

Always the canonical form (lemma) of the lexical item — no gender markers, no `å` prefix, no inflection. This applies whether the lexical item is one word or several (e.g. a multi-word verb or preposition still has a lemma). Used for FSRS lookup and deduplication.

| `part`                                                                            | Format                      | Example              |
| --------------------------------------------------------------------------------- | --------------------------- | -------------------- |
| `noun`                                                                            | bare noun, no gender        | `hus`                |
| `verb`                                                                            | infinitive without `å`      | `få`                 |
| `adjective`                                                                       | base form (same as `norsk`) | `glad`               |
| `adverb` / `conjunction` / `preposition` / `pronoun` / `numeral` / `interjection` | same as `norsk`             | `fordi`              |
| `phrase`                                                                          | same as `norsk`             | `det er om å gjøre`  |

### Plural-form noun cards

Irregular or otherwise learning-worthy plurals (`bok` → `bøker`, `barn` → `barn`, `mann` → `menn`) can get their own `noun` vocab card in addition to the singular dictionary-form card. This is optional — only add a plural card when the plural is irregular enough to be worth drilling separately.

- `norsk` — the plural form + a plural marker in parentheses, in place of the gender marker:
  - `(pl.)` — ubestemt flertall, e.g. `bøker (pl.)`
  - `(b.pl.)` — bestemt flertall, e.g. `bøkene (b.pl.)`
- `lemma` — always the bare **singular** dictionary form, same as the base noun's lemma (e.g. `bok`, not `bøker`). This keeps FSRS lookup/dedup anchored to the base word even though the card teaches the plural.
- `id` / `category` / `level` — assigned normally like any other noun entry.

Why not `(u.pl.)`: ubestemt flertall is the unmarked/default plural, so bare `(pl.)` matches standard Norwegian dictionary shorthand (Bokmålsordboka etc. use `pl.` and `best. pl.`). Only bestemt flertall needs an explicit flag.

### Indeclinable noun cards

A small number of Norwegian nouns are genuinely `ubøyelig` (indeclinable) — no gender article, no plural, no bestemt form. `fjor` is the classic example (only ever appears as `i fjor`, `i forfjor`); dictionaries like NAOB and Bokmålsordboka label these explicitly rather than assigning them a gender.

For these, use `(ubøy.)` in place of the gender marker:

```
"norsk": "fjor (ubøy.)",
"lemma": "fjor",
"part": "noun"
```

Don't reach for this marker just because a noun happens to only show up in one fixed phrase in your example sentence — check a dictionary (NAOB/Bokmålsordboka) first and only use `(ubøy.)` when it's actually listed as `ubøyelig`. If the word is more of a fixed multi-word chunk than a single indeclinable noun, it may belong in `uttrykk` instead (see below).

### `part` values

`noun` · `verb` · `adjective` · `adverb` · `conjunction` · `preposition` · `pronoun` · `numeral` · `interjection` · `phrase`

Most multi-word entries keep the `part` of their grammatical head, not `phrase`:

- Multi-word verbs (reflexive, particle) remain `verb` — e.g. `kle på seg`, `slå av`.
- Multi-word prepositions remain `preposition` — e.g. `ved siden av`, `i stedet for`, `i lys av`.
- Multi-word conjunctions remain `conjunction` — e.g. `forutsatt at`.
- Multi-word time and manner expressions that work as adverbials remain `adverb` — e.g. `i går`, `i morgen`, `på gløtt`.
- Multi-word noun phrases that name a concept remain `noun` — e.g. `kunstig intelligens`, `biologisk mangfold`.

Use `phrase` only when the entry has **no single grammatical head** — idioms, ordtak, greetings, discourse markers, and other fixed expressions. These belong in `uttrykk-xx.json` rather than `vocab-xx.json`; see the decision rule below. Exception: a **collocation** (see below) with a genuinely headless, impersonal frame — e.g. `det er om å gjøre` — may be `phrase` in vocab.

| lemma              | part                 |
| ------------------ | -------------------- |
| kle på seg         | verb                 |
| slå av             | verb                 |
| ved siden av       | preposition          |
| i lys av           | preposition          |
| forutsatt at       | conjunction          |
| i går              | adverb               |
| biologisk mangfold | noun                 |
| ha det bra         | phrase _(→ uttrykk)_ |

**`part` for collocations** (a fixed multi-word vocab entry kept whole per "Collocation entries coexist with their head word" below): take the `part` of the collocation's own grammatical head, the same rule as any other multi-word entry — not `phrase` by default.

| Collocation type                                      | `part`      | Example                   |
| ----------------------------------------------------- | ----------- | ------------------------- |
| verb + object or complement                           | `verb`      | `å gjøre en dårlig figur` |
| fixed prepositional phrase used adverbially           | `adverb`    | `på gløtt`, `til sjøs`    |
| noun + adjective / adjective + noun                   | `noun`      | `trange kår`              |
| copula/light verb + adjective with no adjective entry | `adjective` | `prisgitt`, `skikket til` |
| impersonal or sentence frame with no head             | `phrase`    | `det er om å gjøre`       |

### ID format

`w-{NNNNNN}` where NNNNNN is a zero-padded 6-digit number, **one shared sequence global across both vocab and uttrykk, and across all levels of each.** Neither `category`, `level`, nor type (vocab vs. uttrykk) is part of the id — all three live only in their own fields (`category`/`part` distinguish vocab from uttrykk), so recategorizing, reclassifying (CEFR level), or moving an entry between vocab and uttrykk is a pure data edit with no id implication.

Example: `w-000001`

Vocab and uttrykk ids are drawn from the same counter and are otherwise indistinguishable by shape — which file an entry lives in, and its `category`/`part` fields, are the only source of truth for its type.

**Never key progress, maps or lookups by `norsk`.** Use `vocabKey(entry)` (`entry.id`, from `src/lib/progress.ts`). Entries with an identical `norsk` are different senses with independent progress (see the `sense` field), so a `norsk`-keyed lookup such as `progressMap[e.norsk]` silently matches nothing (or the wrong card). `norsk` is a display form, not an identifier.

**Checks:** `pnpm check:ids` verifies that every production vocab and uttrykk entry has a well-formed `w-NNNNNN` id and that no id is used twice, including between vocab and uttrykk (`check-vocab.ts` and `check-uttrykk.ts` each only see their own files). `pnpm check:data` runs all three checkers with `--strict`.

### `definition` field (every vocab level; uttrykk-c; some uttrykk A1–B2)

A monolingual Norwegian, dictionary-style definition of the sense shown in `english`.

- One sentence or short clause, capitalised, ending with a period; vocabulary at or below the entry's own CEFR level (A1 and A2 definitions use simple words: `Faren til moren eller faren din.`).
- It explains the meaning; it does not illustrate it. Never an example sentence, quote, question or exclamation, and never first-person or dialogue ("Skal vi begynne?", "Jeg tillater det.").
- Must match the sense in `english` and `example`.
- Avoid the headword and its word family where possible.
- Verbs start with `Å` + infinitive (`Å etterligne noens oppførsel.`); nouns with an article (`En ...`, `Et ...`); adverbs and adjectives with a paraphrase (`Ikke i det hele tatt.`, `Dagen før i dag.`); prepositions and conjunctions with when or why they are used (`Brukes for å vise ...`); expressions with when they are used (`Brukes når ...`).
- **Collocation entries** (a fixed multi-word vocab entry, see below) are defined as a whole, not via their head word alone — e.g. `å gjøre en dårlig figur` gets "Å gjøre et dårlig inntrykk på andre," not a definition of `figur`. Verb collocations still use `Å` + infinitive.
- Must not share more than half its words with `example`.
- **Moving an entry between files means checking its definition.** Vocab entries carry a definition at every level, but uttrykk entries at A1–B1 mostly have none (and `uttrykk-b2` only some). So an entry moving **uttrykk → vocab** usually needs a definition written; an entry moving **vocab → uttrykk** keeps the one it has. A source `definition` field is also often not a real definition: an example sentence pasted in by mistake, a bare synonym, or text that starts with the quoted headword (`'Vi ses' er en ...`). Rewrite it to this format rather than carrying it over.
- Supplementary usage information goes in `note`, not here.

### `note` field (optional)

Free-text usage note — supplementary context that doesn't belong in `definition`. `definition` is a monolingual Norwegian dictionary-style definition (B1+); `note` is looser: register/slang flags, related word-family members, a usage caveat, or a secondary sense. Written in whichever language is clearest (usually Norwegian, since it's typically sourced from Norwegian teaching material).

Example:

```
"note": "Børst er et slangord som brukes av dem som drikker (for) mye selv."
```

### `verb_type` field (optional, `verb` entries only)

Conjugation class, sourced from dictionary/textbook annotations like `(v1)`, `(v2)`, `(v3)`, `(ureg.)`. Value is one of `v1` | `v2` | `v3` | `ureg`, or a comma-separated combination when a source lists more than one accepted class, e.g. `"v1, v2"`.

Example:

```
"norsk": "å subbe",
"part": "verb",
"verb_type": "v1"
```

### `sense` field (optional, vocab only)

A short Norwegian gloss that tells apart **separate entries for different senses of the same word** (e.g. `bank (en)` "penger" vs `bank (en)` "sitte på"). Each sense is its own `VocabEntry`, so FSRS schedules it independently: a learner may know `å legge` "to lay" but not "to go to bed".

**Rule:** entries with an identical `norsk` (case-insensitive) must each have a distinct, non-empty `sense`. Entries that share only a `lemma` (different `norsk`, e.g. `å legge` vs `å legge seg`, or `bok` vs `bøker (pl.)`) don't need one: their card fronts already differ.

**Format:** trimmed, lowercase, no parentheses, 1-3 words, ~25 characters at most. **Norwegian only**: it is language-neutral, so learners of every flashcard language see the same pill and no per-language field is needed. Use vocabulary at or below the entry's own level, and prefer a context or topic hint (`til strikking`, `om mat`) or a simple synonym over a translation of the word.

```
"norsk": "garn (et)",
"lemma": "garn",
"sense": "til strikking"
```

Why a separate field: a noun's `norsk` must end in a gender / `(pl.)` / `(ubøy.)` marker, so a gloss like `bank (finansinstitusjon)` is not allowed there. `definition` exists only at B1+ and is Norwegian; `note` is free text that isn't shown on every card.

**When to split:** when knowing one meaning does not imply the other (homonyms, clearly different senses, a different part of speech or conjugation class, a different CEFR level). Don't split minor nuances. Each sense may live in a different level file and category.

**ID policy:**

- The most common sense keeps the **original `id`**, so existing `card_progress` rows stay valid.
- Every additional sense gets a plain next-free `w-NNNNNN` from `scripts/assign-ids.mjs`. Never hand-assign, renumber, insert, or use suffixed ids like `w-000123-2`.
- Progress is always keyed by `id` (`vocabKey(entry)`), never by `norsk`: siblings share `norsk` but have independent progress.

Split through the draft pipeline (the admin section is dormant): edit the original in place (keep `id`, add `sense`, narrow `english` / translations / `definition` / `example`), add each other sense as a draft entry with `id: ""`, the same `lemma`, and its own `sense`, then run `find_dupes.py`, `check-vocab.ts --draft`, `assign-ids.mjs`, `merge-to-production.mjs`. See `ai-docs/implementation/vocab-multiple-senses.md`.

## Vocab vs Uttrykk

### Terminology

SNL defines _uttrykk_ as a word or group of words with a collective meaning (a very broad definition: `hus` would qualify). Other Norwegian sources use it for _faste vendinger_ (fixed expressions), some of which are idioms. This app uses the narrower, learner-facing sense:

> `uttrykk-xx.json` is the umbrella for **fixed expressions learned as whole chunks**, not built word by word. It holds three kinds of entry:
>
> 1. **Idiom** — a figurative expression whose meaning cannot be derived from its words (`ha is i magen`).
> 2. **Ordtak** (proverb) — a fixed saying, usually a full sentence, stating a general truth or piece of advice (`Morgenstund har gull i munn`).
> 3. **Formula** — a fixed chunk with a **communicative job**: greeting, politeness, conversational fragment, or discourse marker. Not figurative, but it has no word class and is not recombined (`god morgen`, `vær så snill`, `det vil si`).

Idioms, ordtak and formulas all live in the same file family. They are not split into separate files (see "Open decisions" for an optional `kind` label).

### The boundary: lexical unit-hood

The vocab/uttrykk split is based on **lexical unit-hood**, not on whether the meaning is compositional. Compositionality is a bad test — `i går` ("in yesterday") is fully compositional, and `kle på seg` is arguably just as compositional. Both are lexical items with a word class (`i går` is an adverb, `kle på seg` a verb), so both are vocab. So instead of asking "is the meaning compositional?", ask whether the entry **functions as a dictionary headword with a word class**.

### Vocab (`vocab-xx.json`)

Use **vocab** for lexical items (lemmas). A lexical item may consist of one or more words if it functions as a single dictionary unit — learners inflect/conjugate it and use it productively in sentences like any other word.

**Dictionary-headword test:** would a Norwegian dictionary (Bokmålsordboka, NAOB) list it as a headword or sub-headword with a word class — noun, verb, adjective, adverb, preposition, conjunction, pronoun, numeral, interjection? If yes → vocab, however many words it has.

This includes:

- nouns (including lexical noun phrases that name a concept)
- verbs, including reflexive verbs and particle verbs
- adjectives
- adverbs, **including time and manner expressions** (`i dag`, `i går`, `i morgen`, `på gløtt`)
- prepositions (including multi-word prepositions: `ved siden av`, `i lys av`, `med utgangspunkt i`)
- conjunctions (including multi-word conjunctions: `forutsatt at`)
- pronouns
- numerals
- interjections

Examples:

```
hus
være
kle på seg
føle seg
slå av
snakke med
ved siden av
i lys av
med utgangspunkt i
forutsatt at
i går
kunstig intelligens
biologisk mangfold
```

This also covers ordinary verb + preposition collocations where the object slot is freely swappable — the preposition is fixed but the verb is the productive head, so the whole thing inflects/conjugates like any other verb. The test is the same as above: can a learner freely substitute the object and conjugate the verb across tenses?

```
sørge for
ta hensyn til
ta vare på
minne om
ha godt av
ta tak i
```

A fixed complement does not disqualify a verb phrase. Literal, non-figurative verb frames — a copula or light verb (`være`, `bli`, `stå`, `få`, `ta`) plus a fixed adjective or prepositional complement — are vocab verbs when the meaning follows from the words (or is a conventionalized, non-figurative frame) and the verb conjugates normally:

```
være i stand til
være i ferd med
stå i fare for
bli kvitt
bli klar over
```

What keeps a verb-initial entry out of vocab is not the shape of its complement but that the phrase is a **figurative idiom** — see "Idioms and ordtak" under Uttrykk below.

> Amended 2026-09-19 (carried over from v1): an earlier version sent verb + fixed complement that isn't an "ordinary grammatical object" (e.g. `være skyld i`) to uttrykk. That test could not separate `ta hensyn til` (vocab) from `ta vare på` (uttrykk), so it was dropped in favour of the idiom test. Entries already classified under the old test (e.g. `ta vare på`, `ha lyst til`) are not bulk-reclassified; the amended rule applies to new decisions and to entries reviewed from now on.

The same test applies when the swappable slot is an infinitive rather than a noun phrase: a finite verb + fixed complementizer + infinitive construction is vocab, not uttrykk, as long as the finite verb conjugates normally and the infinitive slot is freely swappable.

```
komme til å
ha lyst til å
ha tid til å
få lov til å
```

This only applies when the complementizer is more than the bare infinitive marker `å` — i.e. a fixed element like `til å` that carries real idiomatic/grammaticalized weight (future sense, desire, permission, etc.), not ordinary infinitive-complement syntax. Plain verb + `å` + infinitive (`begynne å`, `prøve å`, `ønske å`, `håpe å`) is fully productive grammar — almost any verb can take a bare infinitival complement this way — so it doesn't qualify as a vocab lemma on its own; require evidence the _whole sequence_ is lexicalized (a fixed dictionary-citable unit), not just that the pattern is swappable.

`ha lyst til` (with or without `å` + infinitive) is a vocab verb collocation: the meaning follows from the words and the verb conjugates. v1 treated the bare `ha lyst til` as an uttrykk fragment; v2 drops that distinction. Existing uttrykk entries are not bulk-moved (see the amendment above and the adoption checklist).

### Uttrykk (`uttrykk-xx.json`)

Use **uttrykk** for fixed expressions that learners memorize as complete chunks rather than building them word by word. An entry belongs here if it is one of the three kinds in the terminology above: an **idiom** or **ordtak** (even when it starts with a conjugating verb, as `ha is i magen` does), or a **communicative formula** that has no word class of its own. Everything with a word class of its own is vocab (see the dictionary-headword test above).

This includes:

- idioms (figurative)
- ordtak / proverbs
- greetings and politeness formulas
- conversational formulas and sentence fragments
- discourse markers

Examples:

```
ha is i magen
slå seg til ro
som fisken i vannet
Morgenstund har gull i munn
ha det bra
god morgen
vær så snill
det vil si
alt i alt
på den andre siden
etter min mening
```

**Not uttrykk (moved to vocab by v2):** time expressions (`i går`, `i morgen`), multi-word prepositions and conjunctions (`i lys av`, `med utgangspunkt i`, `forutsatt at`), and fixed prepositional/adverbial chunks that work as an adverbial (`på gløtt`, `til sjøs`). They have a word class, so they are lexical items. Longer time phrases such as `for en stund siden` are borderline: apply the working test below.

**Working test for communicative formulas vs adverbials.** Ask what the chunk does:

- It works **inside the clause** as a time, place, manner or relation word, or links clauses → it has a word class → **vocab**.
- It works **across the conversation or argument** — greets, softens, asks politely, signals stance or how one sentence relates to the next (`det vil si`, `alt i alt`, `etter min mening`) → **uttrykk**.

The edge is fuzzy by nature (some discourse markers could also be called adverbials). When in doubt, ask whether a dictionary lists it with a word class; if it does, it is vocab.

### Idioms and ordtak (the core of uttrykk)

The clearest uttrykk are **figurative idioms and ordtak**: the meaning cannot be derived from the words even if the learner knows every word, and the expression is used to characterize a particular situation, person or state.

Idioms:

```
som fisken i vannet
ha is i magen
ha et hjerte av gull
ligge i luften
sveve i skyene
ha lopper i blodet
vise en kald skulder
holde hodet over vann
```

Ordtak:

```
Morgenstund har gull i munn
Det er ikke gull alt som glimrer
Når katten er borte, danser musene på bordet
```

Test: does the expression have a figurative meaning tied to a situation, one that a literal paraphrase would not convey (`ha is i magen` = stay calm under pressure)? If yes → uttrykk, even when it starts with a conjugating verb. `være i stand til` or `bli kvitt` fail this test — their meaning is literal or conventional, so they are vocab verbs (see above).

Ordtak are written as the whole saying in citation form. They are sentences, so there is no `å` question and `lemma` equals `norsk`. Use `part: phrase`. The `definition` says when the saying is used (`Brukes når ...`).

Uttrykk therefore holds three kinds of entry: **idioms**, **ordtak** and **communicative formulas** (greetings, politeness, conversational fragments, discourse markers).

### `norsk` / `lemma` fields

Same as vocab: `norsk` is the display form, `lemma` is the canonical/dictionary form used for dedup. For uttrykk, both fields are normally identical — the whole fixed chunk, in its citation form — except for the optional `å` described below.

**Verb-initial uttrykk: `å` in `norsk` is optional; `lemma` is always bare.** Either display form is accepted:

| `norsk` (either form is fine)                 | `lemma` (always bare, no `å`) |
| --------------------------------------------- | ----------------------------- |
| `ha is i magen` / `å ha is i magen`           | `ha is i magen`               |
| `slå seg til ro` / `å slå seg til ro`         | `slå seg til ro`              |
| `holde hodet over vann` / `å holde hodet over vann` | `holde hodet over vann`          |

Prefer the bare form for idioms cited the way a dictionary would (`ha is i magen`); the `å` form is fine for entries that read naturally as an infinitive phrase (`å ta buss`). Don't normalise existing entries in either direction just for consistency. But never leave `å` in `lemma`: it is used for dedup and FSRS lookup and must match how vocab lemmas are written. When comparing an uttrykk entry against vocab (duplicate checks), ignore a leading `å` on both sides.

> Amended 2026-09-20 (carried over from v1): an earlier version required the bare form (no `å`) in uttrykk `norsk`. A scan showed `å` in 749 of 1,780 uttrykk entries (`uttrykk-c` 585/916, `-b2` 73/418, `-b1` 63/183, `-a2` 23/156, `-a1` 5/107), so the requirement was dropped in favour of accepting both. `lemma` stays strict. Existing uttrykk entries whose `lemma` still carries `å` (e.g. `w-007966`) are a known cleanup item, see `ai-docs/implementation/reclassification-follow-up.md` §7.

### Decision rule

When deciding between vocab and uttrykk, ask, in order:

1. **Is this a figurative idiom or an ordtak** — non-literal meaning tied to a situation, or a proverb? → **uttrykk**, even if it starts with a conjugating verb.
2. **Dictionary-headword test: does it have a word class of its own?** (noun, verb, adjective, adverb — including time and manner expressions — preposition, conjunction, pronoun, numeral, interjection; including literal verb + fixed complement frames) → **vocab**.
3. **Is it primarily a communicative formula** — a greeting, politeness formula, conversational fragment or discourse marker that works across the conversation rather than inside the clause? → **uttrykk**.
4. **None of the above** — e.g. a productive copula + adjective, or plain grammar → no standalone card (see below).

This is easier to apply consistently than asking whether the meaning is compositional. It resolves the recurring edge cases (reflexive/particle verbs, multi-word prepositions and conjunctions, time expressions) in favor of `vocab`, while keeping genuine idioms, ordtak and communicative formulas in `uttrykk`.

### Neither vocab nor uttrykk: productive copula + adjective

`bli`/`være` + a predicative adjective (`bli forelsket`, `bli sulten`, `være glad`) is fully productive Norwegian grammar, not a fixed lexical unit — any adjective can fill the slot. Don't create a standalone card for the combination; make sure the adjective itself has a vocab entry and let `bli`/`være` stand as their own verb entries.

Exception: if the combination has drifted to a non-compositional idiomatic meaning beyond "become/be + adjective," it may warrant its own `uttrykk` entry.

### Collocation entries coexist with their head word (not duplicates)

This app is not a dictionary — the goal is to show learners as many useful
collocation examples as possible, not to minimize the entry count per
lexical item. A verb (or noun/adjective) having its own bare vocab entry
does **not** make a separate collocation entry built on that same head word
a duplicate.

Example: `tåle` (a standalone verb entry, "to tolerate") and `tåle kulde`
("to handle cold weather well") are both legitimate, separate vocab
entries. So are `avlegge en visitt` and `avlegge et besøk` — two different
collocations that happen to mean the same thing ("to pay a visit") — kept
as synonym variants so learners see the range of phrasing, not merged into
one.

**`lemma` exception for these entries:** normally `lemma` is the canonical
dictionary form, shared for dedup/FSRS lookup (see above). A collocation
entry is the exception — its `lemma` stays the full phrase (same as
`norsk`, minus the verb's `å` prefix where applicable), **not** reduced to
the bare head word's canonical form. This keeps the collocation card
distinct from the head word's own card in FSRS/dedup rather than colliding
with it. Only single-word lexical items (verb, noun, adjective, etc.) use
the reduced canonical `lemma`; anything multi-word keeps `lemma` = `norsk`
(minus `å`), whether or not a bare version of its head word also exists
elsewhere.

**What's still a real duplicate, worth deleting:** two entries with the
_identical_ `norsk`/`lemma` text (a copy-paste accident), not two different
phrasings or a phrase vs. its head word. `find_dupes.py`'s cross-file/
within-file duplicate sections catch exact-text repeats; its "normalized
duplicates" section will keep surfacing head-word/collocation pairs like
`tåle` vs `tåle kulde` — that's expected noise under this policy, not
something to action.

Identical `norsk` text is **not** a duplicate when every entry in the group has a distinct, non-empty `sense` (see the `sense` field section): those are deliberately split senses. `find_dupes.py` skips such groups, `merge-to-production.mjs` doesn't warn about a lemma collision between entries with different senses, and `check-vocab.ts` enforces the `sense` rule instead.

## Open decisions

Resolve these before adoption; they change what v2 says.

1. **Optional `kind` field on uttrykk entries** (`idiom` | `ordtak` | `formula`)? It would need no id changes and would allow filtering later, but it is a schema change (`src/lib/types.ts`, checkers, data). Default if not decided: no field; the three kinds are documentation only.
2. **Legacy entries:** `ta vare på`, `ha lyst til` and the time/preposition/conjunction entries currently in uttrykk. Move them in one reviewed batch, or leave them until touched (the v1 amendment's "no bulk reclassification" stance)?
3. **Borderline time phrases** such as `for en stund siden`: decide per entry using the working test, or list the approved ones here.

## Adoption checklist

Do these in order when v2 is approved. Renaming is a single step in the middle, not the first thing done: until step 1, everything still points at v1, which stays valid.

### A. Rename and repoint

1. **Rename v1:** `git mv data-rules/vocab-and-uttrykk.md data-rules/vocab-and-uttrykk-v1.md`. Add a first line to it: `> Superseded by vocab-and-uttrykk-v2.md (adopted YYYY-MM-DD). Kept for history.`
2. **Update v2's header:** remove the DRAFT status line and add the adoption date.
3. **Repoint live references to `vocab-and-uttrykk-v2.md`** (found by `grep -rn "vocab-and-uttrykk" --exclude-dir=node_modules --exclude-dir=.git .`, output saved in `scripts/outputs/vocab-and-uttrykk.txt`):
   - Source: `src/lib/types.ts` (2 places), `src/routes/[level]/[category]/+page.server.ts`, `eslint.config.js`.
   - Script comments: `check-uttrykk.ts`, `normalise-norsk-field.mjs`, `find_dupes.py`, `merge-to-production.mjs`, `migrate-to-vocab.mjs`, `apply-uttrykk-c-triage.mjs`, `clean-i-samme-baat-vocab.mjs`, `migrate-general-uttrykk-to-vocab.mjs`.
   - Instructions: `ai-docs/instructions/work-flow.md`, `ai-docs/instructions/image-converter-b1.md`, `ai-docs/instructions/image-converter-c.md`.
   - Related doc: `data-rules/recommendation.md` (first line says its changes apply to `vocab-and-uttrykk.md`).
   - Active projects (optional): `draft/b2/pa-niva/implementation/b2-vocab-uttrykk-pa-niva-arbeidsbok.md` and the `draft/c/**/implementation/` docs that name the rules file.
4. **Leave historical references alone.** `scripts/reclass/decisions/*.jsonl`, the dated logs and workflow docs in `ai-docs/implementation/` (`id-new-format.md`, `vocab-multiple-senses.md`, `vocab-uttrykk-reclassification-workflow-*.md`, `determiner-reclassification.md`, `fix-vocab-uttrykk.md` and similar), `draft/**` validation reports and source lists. They describe what was true under v1. `.svelte-kit/**` is generated; do not edit it.

### B. Rule logic that is not just a path

Renaming does not change the rules embedded in code and prompts. Review and update these for the v2 decisions (time expressions, multi-word prepositions and conjunctions, narrower formula bucket, `ha lyst til`):

5. LLM prompts that carry the vocab/uttrykk rule: `scripts/classify-uttrykk-verbs.mjs` (prompt near line 305), `scripts/classify-vocab-phrases.mjs` (prompt near line 91), `scripts/find-cross-type-duplicates.mjs` (prompt near line 187). Check whether each reads the rules file or only names the path in its text.
6. `scripts/normalise-norsk-field.mjs` (its header says it mirrors the doc's rules) and `scripts/check-uttrykk.ts` / `scripts/check-vocab.ts` (confirm they do not enforce a classification that v2 changes).

### C. Data

7. **Find existing entries that v2 reclassifies:** in `uttrykk-*.json`, entries such as `i går`, `i morgen`, `i lys av`, `med utgangspunkt i`, `forutsatt at`, other time expressions and fixed prepositional/adverbial chunks (and `ta vare på` / `ha lyst til`, depending on open decision 2). Write a read-only script that lists candidates; do not edit data by hand.
8. **Move reviewed entries from uttrykk to vocab.** The `id` stays the same (ids are independent of type), so progress rows stay valid. Per the moving rules: set `part` to the right word class, reformat `norsk`/`lemma` for that `part`, and re-check `definition` (write a real one if the source field is an example sentence).
9. **Check for twins:** run `scripts/find-cross-type-duplicates.mjs` after the moves, and `find_dupes.py` for vocab-side collisions.
10. **Run the checks:** `pnpm check:ids` and `pnpm check:data`.
11. **Log the work** as a new follow-up item in `ai-docs/implementation/reclassification-follow-up.md`, with the decisions in `scripts/reclass/decisions/`.

### D. Verify

12. Re-run the grep from step 3. Expected result: the remaining hits are only the historical references from step 4 and `vocab-and-uttrykk-v1.md` itself.
13. Add a changeset if the data changes ship (`pnpm ch`).
