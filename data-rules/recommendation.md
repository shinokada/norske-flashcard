The followings are recommendations or changes that can be applied to vocab-and-uttrykk-v2.md.

## Recommendation 1

I actually think **`i går` and `i morgen` are quite different from `skade seg`**.

I'd classify them like this:

| Type                                             | Examples                                                | Store as |
| ------------------------------------------------ | ------------------------------------------------------- | -------- |
| Single lexical word                              | hus, stor, være                                         | `v-`     |
| Multi-word lexical unit (dictionary lemma)       | kle på seg, slå av, føle seg, spesialisere seg          | `v-`     |
| Fixed adverbial/prepositional/conjunction phrase | i går, i morgen, ved siden av, etter hvert, med en gang | `u-`     |
| Idioms/collocations                              | ta vare på, ha lyst til, slå seg til ro                 | `u-`     |

The key question isn't **"How many words?"** but rather:

> **Would a Norwegian dictionary list this as a lexical headword?**

### `i går`

This isn't really a verb, noun, adjective, or adverb in the normal sense.

It's a **fixed time expression**.

```
i går
i dag
i morgen
i overmorgen
i fjor
```

These are best learned as chunks, so I'd put them under **uttrykk**.

### `ved siden av`

This is interesting.

It functions as a **compound preposition**.

```
ved siden av huset
```

Norwegian grammars usually analyze it as a prepositional expression rather than a single lexical word.

So I would also classify it as **uttrykk**.

In fact, I noticed from your duplicate report that you currently have:

```
v-a2-directions-004
lemma: ved siden av
part: preposition

u-a2-268
lemma: ved siden av
part: phrase
```

I'd keep **only the expression entry**.

### Reflexive verbs

On the other hand,

```
skade seg
føle seg
legge seg
kle på seg
slappe av
slå av
snakke med
spesialisere seg
```

are all verbs.

Learners conjugate them:

```
jeg skader meg
jeg skadet meg
jeg har skadet meg
```

These behave like ordinary verbs, so I'd keep them as vocabulary entries.

### What I'd recommend for Norskeord

I think a nice rule would be:

#### Vocabulary (`v-`)

- nouns
- verbs (including reflexive verbs and particle verbs)
- adjectives
- adverbs
- pronouns
- determiners
- conjunctions
- interjections

Basically, anything that functions as a **dictionary lemma**, even if it has multiple words.

#### Expressions (`u-`)

- time expressions (`i går`, `i morgen`, `for en stund siden`)
- prepositional expressions (`ved siden av`, `i stedet for`, `på grunn av`)
- discourse expressions (`forresten`, `med andre ord`, `i tillegg`)
- idioms (`ta vare på`, `ha lyst til`, `slå seg til ro`)
- common fixed chunks (`vær så snill`, `takk skal du ha`, `god bedring`)

---

Looking at the duplicate list in your file , my recommendations would be:

- **Remove the `u-` entries** for `skade seg`, `føle seg`, `kle på seg`, `legge seg`, `slappe av`, `slå av`, `snakke med`, and `spesialisere seg`.
- **Keep the `u-` entry** for `ved siden av` and remove the `v-` version.
- **Move expressions like `i går`, `i morgen`, `i fjor`, `i dag`, `etter hvert`, `med en gang`, `på grunn av`** into `u-` only.

I think this gives you a much cleaner separation: **`v-` is for lexical items (even multi-word verbs), while `u-` is for fixed expressions and chunks.** This also aligns well with how Norwegian dictionaries and teaching materials generally organize vocabulary.

## Recommendation 2

The main thing I would change is the definition of **vocab vs uttrykk** so that it is based on **lexical units** rather than **semantic compositionality**. That will eliminate nearly all of the edge cases like `skade seg`, `kle på seg`, and `slå av`.

Here are the changes I'd recommend.

---

# 1. Replace "Type A / Type B"

I would replace the entire section

> **Type A — Fixed expressions...**
>
> **Type B — Compound concepts...**

with something like this:

---

## Vocab vs Uttrykk

### Vocab (`vocab-xx.json`)

Use **vocab** for lexical items (lemmas).

A lexical item may consist of one or more words if it functions as a single dictionary unit.

This includes:

- nouns
- verbs (including reflexive verbs)
- particle verbs
- adjectives
- adverbs
- prepositions
- conjunctions
- pronouns
- numerals
- interjections
- lexical noun phrases that name a concept

Examples:

```
hus
være
kle på seg
føle seg
slå av
snakke med
ved siden av
kunstig intelligens
biologisk mangfold
```

---

### Uttrykk (`uttrykk-xx.json`)

Use **uttrykk** for fixed expressions that learners memorize as complete chunks rather than ordinary lexical items.

These include:

- greetings
- conversational formulas
- idioms
- proverbs
- discourse markers
- sentence fragments
- fixed time expressions
- fixed prepositional expressions

Examples:

```
ha det bra
god morgen
vær så snill
i går
i morgen
for en stund siden
på den andre siden
etter min mening
ta vare på
ha lyst til
slå seg til ro
```

---

That single change immediately explains almost every edge case.

---

# 2. Don't use "meaning isn't compositional"

I would remove this sentence:

> meaning isn't fully compositional

because it breaks on examples like

```
i går
```

The meaning is completely compositional ("in yesterday"), but it's still best learned as a chunk.

Likewise

```
ha lyst til
```

is mostly compositional but still an expression.

Instead I'd write:

> learners memorize them as complete chunks.

---

# 3. Update the `part` section

Currently you say

> Use `phrase` for multi-word entries...

I'd rewrite that to distinguish between **grammatical category** and **database type**.

For example:

> Use `phrase` only when the entry has no single grammatical head (for example greetings, idioms, discourse markers, and fixed expressions).
>
> Multi-word verbs remain `verb`.
>
> Multi-word prepositions remain `preposition`.
>
> Multi-word noun phrases that name concepts remain `noun`.

Examples:

| lemma              | part        |
| ------------------ | ----------- |
| kle på seg         | verb        |
| slå av             | verb        |
| ved siden av       | preposition |
| biologisk mangfold | noun        |
| i går              | phrase      |
| ha det bra         | phrase      |

I think this is much more linguistically consistent.

---

# 4. Update the examples in `norsk`

Currently you have

```
preposition
ved siden av
```

If you move `ved siden av` to vocab (which I would), that's perfectly fine.

But if you decide `ved siden av` belongs in uttrykk, then remove it from this table.

Either choice is defensible.

---

# 5. Clarify lemma

I would slightly change

> Always the plain dictionary form

to

> Always the canonical form (lemma) of the lexical item.

Examples:

```
å kle på seg
lemma: kle på seg

å slå av
lemma: slå av

ved siden av
lemma: ved siden av

kunstig intelligens
lemma: kunstig intelligens
```

This avoids implying that only single-word dictionary entries have lemmas.

---

# 6. Add a decision rule

I'd add a short checklist because this is the question you'll repeatedly face while expanding the database.

> When deciding between **vocab** and **uttrykk**, ask:
>
> 1. Does this function as a lexical item (a noun, verb, adjective, preposition, etc.)?
>    → Put it in **vocab**.
> 2. Or is it primarily a fixed chunk used in communication?
>    → Put it in **uttrykk**.

This is easier to apply than asking whether the meaning is compositional.

---

## One recommendation I'd reconsider

The only point where I differ from the current document is **`ved siden av`**.

Earlier I suggested moving it to `uttrykk`, but after thinking more about your schema, I now think it fits better in **vocab** because:

- it has a clear grammatical category (`preposition`),
- it behaves like other multi-word prepositions (`i stedet for`, `på grunn av`, `fram til`),
- learners use it as part of normal grammar rather than as an idiomatic saying.

That leads to a simpler principle:

- **Multi-word verbs** → `vocab`
- **Multi-word prepositions** → `vocab`
- **Multi-word noun concepts** → `vocab`
- **Greetings, idioms, discourse markers, conversational formulas, and sentence chunks** → `uttrykk`

I think that rule is both linguistically sound and much easier to apply consistently across the thousands of entries in Norskeord.
