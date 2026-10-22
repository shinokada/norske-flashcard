# norske-flashcard

## 2.113.0

### Minor Changes

- - **New Features**
    - Multiple-choice grammar questions now support three or four answers, with choices labeled A–D. Questions with a sentence display it alongside the prompt.
    - Updated blog links redirect readers to the current article addresses.

  - **Documentation**
    - Refreshed Norwegian grammar and vocabulary guides with revised explanations, examples, comparisons, and practice questions across topics including word order, prepositions, and commonly confused expressions.
    - Updated listening recommendations for learners at different levels.

## 2.112.0

### Minor Changes

- - **New Features**
    - feat: add 202 uttrykk and 105 vocab
    - Expanded Norwegian learning content with 202 expressions and 105 vocabulary items.
    - This minor update adds new material for learners to explore and practice, alongside the existing content. The additions cover both complete expressions and individual vocabulary items, providing more learning material across these two content types.

## 2.111.1

### Patch Changes

- chore: bump data submodule

## 2.111.0

### Minor Changes

- feat: add 83 uttrykk

## 2.110.0

### Minor Changes

- - **New Features**
    - Grammar questions can be answered with keyboard shortcuts, with hints showing available keys.
  - **Bug Fixes**
    - Prevented repeat submissions while a grammar answer is being processed.
  - **Content Updates**
    - Reclassified some vocabulary and expressions.
  - **Removed**
    - Removed FAQ information about Norwegian lesson emails, including how to enable them.

## 2.109.0

### Minor Changes

- - **New Features**
    - Flashcards now show a "Click to flip" label on desktop and "Tap to flip · Swipe to navigate" on touch devices, in all five languages. The label softens once you have flipped a card, and the first card wiggles once for new users.
    - On touch devices, faint edge chevrons show that swiping moves to the previous or next card.
    - On desktop, the card gets a light ring and shadow on hover.
  - **Improvements**
    - Long definitions and phrases now use a smaller font, so they stay inside the card and clear of the label.

## 2.108.0

### Minor Changes

- - **Content Updates**
    - Updated selected vocabulary entries with revised forms, parts of speech, definitions, and metadata.
    - Removed duplicate entries and entries that do not represent lexicalized material.
    - Linked earlier decisions to the later decisions that supersede them.
  - **Validation**
    - Missing `kind` values on expressions are now reported as errors; allowed values are `idiom`, `ordtak`, and `formula`.

## 2.107.0

### Minor Changes

- - **Documentation**
    - Clarified how to record idioms with interchangeable words, including how to choose the main form, where to list alternatives, and when a variant warrants a separate entry.
  - **Content Updates**
    - Reclassified collocations and fixed expressions as vocabulary, with updated forms, definitions, translations, examples, and other details.
    - Revised several phrase classifications and removed duplicate entries across B1 and B2 content, making the vocabulary lists more consistent.

## 2.106.0

### Minor Changes

- - **Content Updates**
    - Revised Norwegian vocabulary classifications, moving selected time, manner, place, reasoning, and collocational expressions into vocabulary while retaining selected phrases and formulas in the expressions section.
    - Removed duplicate entries across proficiency levels and selected non-lexical entries. Updated some headwords, grammatical details, categories, and definitions.

## 2.105.0

### Minor Changes

- - **New Features**
    - Added a multilingual FAQ explaining _uttrykk_ (expressions), including idioms, proverbs, and everyday formulas, and how they differ from vocabulary.
  - **Content Updates**
    - Updated the vocabulary and expression guidelines with clearer classification rules and definition expectations.
    - Reclassified selected time expressions, adverbials, and multi-word entries as vocabulary; other entries remain in their existing category where appropriate.
    - Clarified expression types and their labels, and added labels to selected expressions.
  - **Validation**
    - Added checks for valid expression labels and to prevent labels on vocabulary entries.

## 2.104.0

### Minor Changes

- - **New Features**
    - Flashcards display a localized flip hint in English, German, Spanish, Norwegian, and Ukrainian, with guidance tailored to touch or non-touch devices.
    - The first card wiggles once for devices that have not flipped a card before; the animation respects reduced-motion settings.
    - Touch layouts show swipe-direction chevrons, with the left chevron hidden on the first card.

## 2.103.0

### Minor Changes

- - **New Features**
    - Added previous- and next-level navigation on learning pages, with links displayed beside the page introduction and below the content.
    - Navigation labels and accessible link text are available in English, German, Spanish, Norwegian, and Ukrainian.
    - Level names are displayed consistently in navigation and page introductions.

## 2.102.0

### Minor Changes

- - **New Features**
    - For signed-in users, the app now records a two-letter country code derived from their connection when available. The first recorded value is retained and is not changed later.
  - **Documentation**
    - The privacy policy now explains how country information is derived and stored, and notes that understanding users’ countries is a legitimate-interest purpose.

## 2.101.0

### Minor Changes

- v2.101.0

  - Count Plus content requests per account in log-only mode (migration 030)
  - Cover quiz-entries, review-entries, review-grammar-entries,
    grammar-questions and /c/uttrykk
  - Privacy policy: mention per-account request counters

## 2.100.1

### Patch Changes

- - **Bug Fixes**
    - Approved lessons are available only to Plus subscribers with an active subscription or a subscription that has not yet expired.
    - Daily pages are no longer served from the public edge cache.
    - When search data cannot be loaded, the search service reports that it is temporarily unavailable, and later requests can retry.

## 2.100.0

### Minor Changes

- - **New Features**
    - Norskprøven practice pages now load securely, with Tests 2 and 3 restricted to Plus subscribers. Test 1 remains available to guests.
    - Added consistent access checks across reading, writing, and oral practice for A2 and B1 levels.
  - **Bug Fixes**
    - Restricted practice content is no longer included in guest-facing page responses, and practice pages are not stored in shared caches.

## 2.99.2

### Patch Changes

- - **Chores**
    - Added a development-time check to flag certain direct content imports from client-accessible code. This helps keep vocabulary and phrase content access consistent with the approved access paths. Server-side code and tests are not affected. No end-user functionality or interface changes are included in this update.

## 2.99.1

### Patch Changes

- - **Improvements**
    - Vocabulary and expression category totals are based on a consolidated content index, keeping displayed counts aligned with available content.
    - The content index refreshes when starting the development server or creating a production build.

## 2.99.0

### Minor Changes

- - **New Features**
    - Added a quiz picker that shows available categories and question counts, with access based on your plan.
    - Quiz questions now load when you start a quiz, and loading errors are shown in your language.
  - **Bug Fixes**
    - Pressing Enter to submit an answer no longer advances the question twice.

## 2.98.0

### Minor Changes

- - **New Features**
    - Grammar topics and chapter practice show questions according to access level: free and guest visitors can play free questions, while Plus visitors can access all questions.
    - Topic overviews display question counts and locked-question breakdowns for the selected level.
    - Chapter practice offers a retry option when questions can’t be loaded.

  - **Accessibility & Usability**
    - Improved screen-reader labels and announcements across grammar questions and session summaries.
    - Keyboard focus moves to relevant questions, answers, or summaries as sessions progress, with clearer focus indicators and improved text contrast.

## 2.97.1

### Patch Changes

- - **Subscription Updates**
    - Subscription plans now reflect the monthly or annual plan associated with the selected variant.
    - When an end date is unavailable, subscription access dates use the renewal date when provided.
    - Cancelled and expired subscriptions now show their corresponding statuses. Unpaid and expired subscriptions are assigned the free plan.
    - Subscriptions without a recognized plan variant or available end and renewal dates are handled without assuming a value.

## 2.97.0

### Minor Changes

- - **New Features**
    - Free visitors can preview locked learning categories, including the first Norwegian word and card count, before choosing whether to sign in or upgrade.
    - Locked category links open the relevant learning page instead of sending visitors directly to the Plus page.
    - “My Progress” offers a way to study all due cards when they span multiple levels.
    - Login, checkout, and post-payment flows preserve a safe return destination. The success page shows activation status while Plus access is confirmed.
    - Added localized preview and activation messages.

  - **Bug Fixes**
    - Study links now include the selected level.
    - Login and payment completion use a consistent fallback destination when no valid return path is provided.

## 2.96.0

### Minor Changes

- - **New Features**
    - Added Google sign-in alongside the existing email login option.
    - Added Privacy Policy and Terms of Service pages, covering data practices, accounts, billing, and service terms.
  - **Bug Fixes**
    - Improved handling of sign-in sessions and return destinations, including when authentication uses multiple cookies.
    - Limited public edge caching to eligible pages and preserved existing cache settings.

## 2.95.0

### Minor Changes

- - **New Features**
    - Plus users can search with localized results and source and level filters.
    - Search begins after at least two characters are entered.
    - Search requests are limited to 20 per minute, with a notice when the limit is reached.
  - **Bug Fixes**
    - Search status and error messages now describe search availability rather than index loading.
  - **Documentation**
    - Updated setup and deployment guidance to reflect server-side search.

## 2.94.0

### Minor Changes

- - **Features**
    - `/price` and `/pricing` now permanently redirect to `/plus`, preserving query parameters.
    - Navigation labels in several languages now clearly identify Plus pricing. Free and guest offers use consistent copy about Plus access and syncing progress across devices, with a call to action to view Plus pricing.
    - Guest progress text no longer mentions signing in to sync.
  - **Bug Fixes**
    - Sitemap listings now include `/plus` and paths such as `/plusfoo`.

## 2.93.0

### Minor Changes

- - **Bug Fixes**
    - Profile card-limit preferences now take precedence over the device’s saved setting. “All cards” is respected, while profiles without a saved limit continue to use the device setting.
  - **Updates**
    - New profiles default to a 20-card session limit. Existing profiles without a limit are set to 20; “All cards” remains available. Session limits also cap new cards added to due-card sessions.
    - Free access includes all A1 content and three vocabulary and quiz categories per level from A2 through C. Grammar is free at A1; higher-level grammar and expressions require Plus.
    - Free progress views show available progress and locked-content teasers, and due counts reflect each plan’s access.
    - Non-Plus visitors can see which exam categories require Plus and access unlock prompts.
  - **New Features**
    - Signed-out visitors can access “My Progress” from the navigation.

## 2.92.1

### Patch Changes

- - **Scheduling**
    - Plus users’ retention settings now affect review intervals. Guests and free users receive the default review schedule, including when saving progress.
    - Default new-card intervals are 3 days for Hard, 5 days for Good, and 8 days for Easy.
  - **Changes**
    - Personalized review-weight optimization is no longer available; review scheduling uses shared default weights instead.

## 2.92.0

### Minor Changes

- - **New Features**
    - Vocabulary entries with the same Norwegian spelling can show sense labels on flashcards and quiz answers.
    - Search results open the exact matching entry, including when several entries share a spelling.
  - **Improvements**
    - Progress is tracked separately for distinct entries, and related cards are spaced apart in decks and quizzes.
    - Quiz sessions can include cards that are not yet due to fill a short session.
    - Answer choices avoid entries with the same Norwegian form or lemma; fallback fill-in-the-blank questions use clearer prompts.
  - **Bug Fixes**
    - Retrying a quiz with no available questions no longer replaces the current quiz state.

## 2.91.0

### Minor Changes

- - **New Features**
    - Grammar statistics now appear in book order and include links to relevant chapters when available.
    - Fill-in questions with a blank now display a label that reflects the task.
    - Grammar topic navigation displays section IDs when available.
    - Answer reveals now highlight selected and correct options, show typed answers when incorrect, and present question-specific content.
  - **Bug Fixes**
    - Reveal and restart shortcuts no longer trigger while typing in text fields or when a key event has already been handled or is repeating.
    - Level statistics reserve space for section links consistently when section information is available.

## 2.90.0

### Minor Changes

- - **New Features**
    - The progress page organizes Vocabulary, Uttrykk, and Grammar into selectable tabs. Your selection is reflected in the URL and saved for your next visit.
    - Due counts and review links match the selected content type. The Grammar panel links to all grammar topics, with labels available in English, German, Spanish, Norwegian, and Ukrainian.
    - CEFR estimates and activity charts appear below the selected content panel.
  - **Improvements**
    - Vocabulary and Uttrykk details remain available to Plus members, while Grammar details are available to all users.

## 2.89.0

### Minor Changes

- - **New Features**
    - Definition-based flashcards are available for any category containing definitions, regardless of level. If a category has none, flashcards automatically switch to Norwegian-to-English mode.
    - You can choose definition-based cards for word entries at any level. If you switch to phrase cards, the card direction returns to the standard language-to-language mode.
    - Added tools to prepare vocabulary definition batches, validate entries, and merge reviewed definitions. You can preview planned changes, review validation issues, and back up vocabulary data before updates.
  - **Documentation**
    - Added instructions for preparing, validating, and merging vocabulary definition batches.

## 2.88.0

### Minor Changes

- - **New Features**
    - Added a grammar map organized by book parts and chapters, with topic search, CEFR-level filtering, chapter practice, and links between related topics.
    - Added an A1 “Start here” learning path with practice progress.
    - Added grammar progress pages with level estimates, chapter progress, weak-topic insights, and chapter-specific review links.
    - Added grammar explanations, topic previews, Plus access indicators, and expanded free A1 practice content.
    - Added grammar navigation and progress text in English, German, Spanish, Norwegian, and Ukrainian.
    - Added separate “Study due now” links and progress summaries for Vocabulary, Uttrykk, and Grammar.
    - Added keyboard-accessible topic tabs and search, plus server-rendered grammar topic pages with SEO metadata.

  - **Bug Fixes**
    - Grammar progress and due reviews now reflect questions’ current topics and levels after content changes.
    - Legacy grammar topic links now redirect to replacement pages.

## 2.87.0

### Minor Changes

- - **New Features**
    - Progress tabs show due-count badges for levels with vocabulary or expression reviews due. Counts above 99 display as “99+,” and accessible labels include the localized count.
    - Vocabulary and expression sections show due counts; Plus-user and grammar sections reflect the active level’s due cards.
    - Due-review actions and labels are localized in English, German, Spanish, Norwegian, and Ukrainian.
  - **Updates**
    - Removed the separate “Study due at this level” link beneath the progress tabs.

## 2.86.1

### Patch Changes

- fix: data update

## 2.86.0

### Minor Changes

- - **New Features**
    - Added four B2 expression categories and four C-level categories, covering cultural heritage, interpersonal conflict, and abstract expressions.
    - Added category labels in German, English, Spanish, Norwegian, and Ukrainian.
    - Updated level-page article links to show the matching article count and level.
  - **Updates**
    - Level pages now show all matching non-guide articles, with links to the full article list for that level.

## 2.85.0

### Minor Changes

- - **New Features**
    - Category lists now show Plus-only topics as dimmed, locked pills that link to Plus.
    - Vocabulary categories have been divided into more specific topics across B1, B2, and C, with a new A2 Home category.
  - **Changes**
    - Removed the aggregate Plus-only count pill and the fixed-expression count link from the level C page.

## 2.84.0

### Minor Changes

- - **Updates**
    - The progress page is now available at **My Progress** (`/my-progress`) throughout navigation, footer links, review pages, and practice summaries. Visits to `/stats` now redirect to the new address while preserving query parameters.
  - **Localization**
    - Added translated grammar practice level labels and session-summary text in English, German, Spanish, Norwegian, and Ukrainian.

## 2.83.1

### Patch Changes

- - **Improvements**
    - Review sessions and statistics now reflect each card’s current level and category, including after content is reorganized.
    - Expression categories are grouped consistently across learning pages, category pages, and statistics.
    - Due-today totals now include vocabulary and expressions only; grammar is excluded.
  - **Bug Fixes**
    - Cards that no longer match available content are omitted from resolved review and statistics results.

## 2.83.0

### Minor Changes

- - **New Content**
    - Added Norwegian vocabulary entries for collocations, particle verbs, fixed adverbials, and grammatical constructions.
    - Added dictionary-style Norwegian definitions for applicable vocabulary and expressions.
  - **Improvements**
    - Corrected inaccurate translations and example sentences, and refined grammatical classifications and entry wording.
    - Removed duplicate or superseded vocabulary and expression entries.
  - **Documentation**
    - Expanded guidance on writing definitions and classifying multi-word expressions, including grammatical head selection and formatting conventions.

## 2.82.0

### Minor Changes

- - **Data Quality**
    - Corrected Norwegian idiom lemmas by removing unnecessary infinitive markers while preserving displayed expressions.
    - Improved classification of literal verb constructions, figurative idioms, and proverbs.
    - Updated affected entries with corrections to text, examples, translations, themes, and definitions.
    - Removed duplicate and near-duplicate entries and restored entries whose classification was revised.

  - **Validation**
    - Improved duplicate detection across vocabulary and idiom entries, including equivalent forms with or without “å”.
    - Added clearer validation for missing or incorrectly formatted lemmas.
    - Improved verification of applied data corrections across all updated fields.

## 2.81.0

### Minor Changes

- **New Content**
- Added a Norwegian-language lesson explaining the differences between _by_ and _tettsted_, including examples, vocabulary, and Norskprøven practice.
- Added a Norwegian-language lesson covering the uses of _selv_ and _selve_, common expressions, distinctions from _enda_, examples, and practice exercises.

- **Documentation**
- Expanded the grammar lesson on sentence adverbs with guidance on multi-verb phrases and subordinate-clause word order.
- Updated the lesson’s publication date.
- Clarified how fixed verb-and-infinitive constructions and productive adjective combinations should be classified in vocabulary materials.

## 2.80.0

### Minor Changes

- - **New Features**
    - Added extensive Norwegian-learning lessons covering vocabulary, grammar, prepositions, verb distinctions, word formation, noun gender, expressions, and Norskprøven practice.
    - Added lessons on _feil/galt_, _gå/forlate_, _hvor/hvordan_, _for/til_, _vil/ønsker_, _seg/sin_, _ta/få_, _som helst_, _sørge for_, _-vern_, _-vis_, _-legge_, and more.

  - **Bug Fixes**
    - Improved subscription validity, billing details, and Plus access handling.
    - Prevented outdated subscription events from overwriting newer account information.

  - **Documentation**
    - Updated related links, examples, explanations, metadata, formatting, and accepted alternative answers.

## 2.79.0

### Minor Changes

- - **New Features**
    - Added new Norwegian-language lessons comparing **begynne** and **starte**, and **ta med seg** and **bringe**.
    - Added Norskprøven-style multiple-choice practice questions with answer explanations across numerous grammar and vocabulary lessons.
    - Added related-article links to help learners explore connected topics.

  - **Documentation**
    - Updated lesson metadata and publication information across the Norwegian learning content.
    - Clarified usage distinctions, corrected examples, and improved guidance throughout several lessons.
    - Improved navigation between related lessons.

## 2.78.1

### Patch Changes

- - **Bug Fixes**
    - Grammar answers now require exact matching for spelling, accents, punctuation, and word count. Minor typos and extra words are no longer accepted.

  - **Statistics**
    - Progress summaries now more accurately distinguish learning, relearning, and review cards.
    - “Others” expression categories now include stale categories and link correctly to due review items.

  - **Review**
    - C-level “Others” expression sessions are now supported on the review page.

## 2.78.0

### Minor Changes

- - **New Features**
    - Vocabulary and expression entries now use a shared, sequential ID format across all levels and categories.
    - Existing local progress is automatically remapped from older ID formats.

  - **Bug Fixes**
    - Guest and free-user progress loading now completes reliably before quiz, review, flashcard, and statistics views display progress.
    - Progress remains available after the ID format migration, including older saved entries.

  - **Documentation**
    - Updated guidance and migration documentation for the new shared ID format.

## 2.77.0

### Minor Changes

- - **New Features**
    - Added animal vocabulary categories for A2 and B1 learning levels.
    - Added localized category labels in English, German, Spanish, Norwegian, and Ukrainian.
    - The B1 animal category is available as a Plus feature.

## 2.76.0

### Minor Changes

- - **New Content**
    - Added Norwegian vocabulary for farm and animal topics across A1, A2, and B1 levels.
    - Expanded vocabulary statistics to reflect the new entries.

  - **Documentation**
    - Added release notes for version 2.75.0, summarizing the new vocabulary content and updated statistics.

## 2.75.0

### Minor Changes

- **New Content**
  - Added new Norwegian vocabulary for farm/animals theme across A1, A2, and B1 levels.
  - Expanded vocabulary statistics to reflect the new entries.

## 2.74.0

### Minor Changes

- - **New Content**
    - Added new Norwegian vocabulary for transportation, travel, aviation, vehicles, and water sports across A1, A2, and B1 levels.
    - Expanded vocabulary statistics to reflect the new entries.

  - **Documentation**
    - Updated implementation and question documentation, including data protection planning and grammar-answer clarifications.

  - **Maintenance**
    - Improved internal tracking for vocabulary review sessions while preserving existing review behavior.

## 2.73.0

### Minor Changes

- - **New Features**
    - Added due-only grammar reviews with CEFR-level and topic filtering, grading, progress saving, keyboard navigation, and restart support.
    - Added grammar review links from statistics.
    - Search now matches and displays translations and examples in the selected language, with English fallback.
    - Added improved vocabulary review sessions with fixed due-card pools and practice repeats.
    - Added more accurate filtering for themed expression reviews.

  - **Bug Fixes**
    - Improved handling of empty, future, overdue, and exhausted review pools.
    - Corrected scoped review links for vocabulary, expressions, and grammar.

## 2.72.0

### Minor Changes

- - **New Features**
    - Added due-card review sessions with global, level, category, and Vocabulary/Uttrykk filters.
    - Added “Study due” links and counts throughout progress statistics.
    - Added clearer end-of-session guidance when more cards remain.
    - Added new Norwegian vocabulary across A1–C levels.
    - Added Norwegian learning articles covering grammar, vocabulary, and common language distinctions.
    - Updated mobile navigation to include Progress.

  - **Bug Fixes**
    - Improved due-review links and empty-state handling for scoped sessions.

  - **Tests**
    - Expanded end-to-end coverage for review and statistics workflows.

## 2.71.0

### Minor Changes

- - **New Features**
    - Added hundreds of Norwegian vocabulary entries across A1–C levels, with multilingual translations, examples, and metadata.
    - Added new expressions across A2–C levels.
    - Added the “home” category to A2 learning content.
    - Quiz answers now accept common dictionary forms without infinitive markers or noun gender articles.
  - **Documentation**
    - Added guides for CEFR vocabulary classification, vocabulary processing, and Norwegian grammar distinctions.
  - **Improvements**
    - Updated learning-content statistics to reflect the expanded collection.

## 2.70.0

### Minor Changes

- **New Features**
  - Added comprehensive Norwegian grammar practice for levels A1 through C, including exercises, explanations, hints, and answer alternatives.
  - Added a complete B2 “På Nivå” workbook and answer key.
  - Added new B2 vocabulary, expressions, and grammar topics.
  - Added Norwegian learning articles covering common vocabulary and grammar distinctions.
- **Improvements**
  - Grammar content now loads by level and topic, improving page efficiency.
  - Expanded grammar statistics and topic coverage.
- **Bug Fixes**
  - Corrected Norwegian vocabulary definitions, spelling, examples, and duplicate entries.

## 2.69.0

### Minor Changes

- - **New Features**
    - Added Norwegian learning articles covering common grammar, vocabulary, and word distinctions.
    - Added cooking and kitchen vocabulary and expressions from A1 through B2.
    - Added guidance on review intensity and how it affects flashcard scheduling in multiple languages.
  - **Improvements**
    - Improved flashcard pronunciation by prioritizing vocabulary lemmas.
    - Improved blog filter navigation and added a review-intensity FAQ entry.
  - **Bug Fixes**
    - Corrected numerous Norwegian spelling, accent, spacing, and example-text errors.

## 2.68.0

### Minor Changes

- - **New Features**
    - Blog filters for level, tag, and search now persist in the URL, making filtered views easier to share and revisit.
    - Search updates are reflected automatically while typing, with a short delay to keep the experience responsive.

  - **Improvements**
    - Updated search result styling makes active selections clearer in light and dark modes.
    - Refined blog navigation behavior when applying or clearing filters.

  - **Documentation**
    - Added instructions for listing blog posts, including all available posts.

## 2.67.0

### Minor Changes

- **New Features**
  - Added Relaxed, Standard, and Intensive review-intensity preferences across supported languages.
  - Review scheduling now adapts to the selected intensity and provides day-scale intervals.
  - Search results can open a targeted flashcard deck with the selected word first.
  - Added new B1 vocabulary, expressions, and grammar content, plus expanded C-level exercises.
  - Added four grammar topics and improved grammar explanations.

- **Improvements**
  - Grammar topic cards now show counts for the selected proficiency level.
  - Added Norwegian grammar guidance and learning articles.

- fix: pnpm optional-dependency resolution issue

## 2.66.0

### Minor Changes

- **New Features**
  - Added 73 advanced Norwegian grammar exercises for B1–C levels, including adjective agreement, verb forms, passives, punctuation, possessives, and compound words.
  - Expanded grammar coverage across multiple textbook-based topics and added advanced adjective comparison guidance.
  - Added nine vocabulary items and the expression “somle bort noe.”
  - Added Norwegian learning articles explaining _feil/galt_, _planlegge_, and _-vern_.
- **Bug Fixes**
  - Corrected a Norwegian example from “det filmen” to “den filmen.”
- **Updates**
  - Refreshed grammar statistics and expanded C-level validation coverage.

## 2.65.0

### Minor Changes

- **New Features**
  - Added extensive Norwegian C-level vocabulary, idioms, expressions, translations, examples, and definitions.
  - Added more than 1,000 C-level preposition and fixed-expression exercises in varied formats.
  - Added complete Norwegian workbooks, answer keys, grammar guides, and vocabulary learning materials.
  - Added an article explaining distinctions between _oppføre seg_, _opptre_, and _arte seg_.
- **Improvements**
  - Refined A1–B2 vocabulary and expression content, translations, definitions, categorization, and identifiers.
  - Added support for vocabulary notes and verb-type information.
- **Bug Fixes**
  - Improved search test reliability and duplicate-content cleanup.

## 2.64.0

### Minor Changes

- **New Features**
  - Plus users can independently collapse or expand Vocabulary, Uttrykk, and Grammar sections on the statistics page.
  - Section states are remembered between visits.
  - Grammar statistics now include a persistent summary while details are collapsed.
  - Added accessible toggles with visual expand/collapse indicators.

- **Bug Fixes**
  - Updated the displayed statistics data timestamp.

## 2.63.0

### Minor Changes

- **New Features**
  - Grammar explanations now support clearer paragraphs, bullet lists, bold emphasis, and expandable content.
  - Added new vocabulary entries for “monument,” “billedhugger,” “å debutere,” “utover,” and “lovende.”

- **Improvements**
  - Grammar exercises now provide clearer instructions to write complete sentences and use the requested word forms.
  - Updated explanations across the grammar rules with improved structure and readability.

- **Documentation**
  - Added implementation notes and updated related documentation references.

## 2.62.0

### Minor Changes

- - **New Features**
    - Added 48 advanced Norwegian grammar questions covering comma usage, idioms, nuance, and prepositional expressions.
    - Added punctuation exercises with multiple-choice answers and skip support.
    - Added new B2 and C-level idioms, phrases, vocabulary, and learning topics.
  - **Documentation**
    - Added comprehensive _Det går bra!_ workbooks for chapters 1–16.
    - Added a Norwegian grammar reference and introductory guide.
  - **Improvements**
    - Updated course statistics and expanded grammar validation.

## 2.61.0

### Minor Changes

- - **New Features**
    - Added extensive Norwegian B2 grammar practice covering advanced topics such as modal adverbs, conditionals, contrast, quantifiers, formal “det”, and location expressions.
    - Added expanded Norwegian vocabulary, phrases, idioms, grammar references, workbook exercises, and debate materials.
    - Added clearer section labels distinguishing vocabulary from expressions.
    - Expanded grammar statistics to show topic counts.

  - **Documentation**
    - Added implementation guidance for upcoming B2 grammar and punctuation-sensitive exercises.

  - **Style**
    - Standardized exercise answer blanks and simplified expression headings across translations.

## 2.60.2

### Patch Changes

- - **Updates**
    - Removed the “How smart review works” section from the Plus page, so pricing/support CTAs appear sooner.
    - Grammar now respects the selected level scope consistently, including on topic pages (with a “showing this level only” indicator and an option to view all levels).
  - **Localization**
    - Updated Plus translations to remove the streamlined “how it works” content.
    - Added a Ukrainian Plus priority support comparison row.
  - **Maintenance**
    - Refreshed displayed stats.
    - Improved reliability of automated UI tests and data validation checks.

## 2.60.1

### Patch Changes

- - **Updates**
    - Revised Plus plan messaging across supported languages, including vocabulary ranges, category totals, phrase previews, and free grammar availability.
    - Updated displayed Plus feature wording to reflect access through level C.

  - **Bug Fixes**
    - Improved blog filter and pagination test reliability by waiting for visible UI updates.

  - **Tests**
    - Updated Plus feature coverage to match the revised “Full B1 to C access” wording.

## 2.60.0

### Minor Changes

- - **New Features**
    - A1 learners can now access all expression themes, including “Others” and study-all content, without restrictions.
  - **Bug Fixes**
    - Updated expression access handling so the “Others” option correctly reflects availability for each level.
    - Improved blog filter test reliability under slower preview-server conditions.
  - **Documentation**
    - Clarified internationalization maintenance scripts, cleanup safeguards, and usage guidance.
  - **Chores**
    - Removed outdated generated reports and ignored generated output directories.
    - Refreshed statistics metadata.

## 2.59.0

### Minor Changes

- - **New Features**
    - Added seven A2 grammar topics and expanded exercises, vocabulary, and expressions.
    - Quiz prompts, answers, and distractors now respect the selected translation language.
    - Improved Norwegian-only quiz behavior for eligible content.
    - Added consistent translated category labels across search, learning, statistics, and progress views.
    - Updated flashcard breadcrumbs and mode labels for clearer navigation.
  - **Bug Fixes**
    - Corrected category translations, A2 vocabulary matching, and Norwegian-only hint content.
  - **Documentation**
    - Consolidated internationalization maintenance guidance and completion records.

## 2.58.0

### Minor Changes

- - **New Features**
    - Expanded Norwegian grammar practice and vocabulary content across beginner to advanced levels.
    - Added more hints, explanations, answer keys, and exercises.
    - Grammar practice screens now consistently use Norwegian interface text and feedback.

  - **Bug Fixes**
    - Corrected remaining English text appearing in Norwegian grammar exercises and prompts.

  - **Documentation**
    - Updated guidance for creating, reviewing, and validating Norwegian-only learning content.
    - Released version 2.57.0.

## 2.57.0

### Minor Changes

- - **New Features**
    - Added A1 practice for telling time, dates, spatial prepositions, and time-ago expressions.
    - Expanded A1 vocabulary with prepositions, ordinal numbers, transportation, and housing terms.
    - Added new A1 vocabulary categories for prepositions and housing.
    - Added extensive Norwegian grammar exercises and answer keys covering levels A1–C.
  - **Documentation**
    - Expanded grammar implementation plans, reclassification guidance, and Norwegian-only content planning.
    - Added reference material for abbreviations, grammar rules, and advanced exercises.
  - **Style**
    - Refined visual styling across navigation, onboarding, search, flashcards, and account screens.

## 2.56.0

### Minor Changes

- - **New Features**
    - Added extensive A1 grammar lessons and exercises covering chapters 1–9.
    - Added A2 grammar and quiz content for chapters 10–16.
    - Added new grammar topics, examples, explanations, and practice questions.
    - Expanded free grammar access with additional A1 topics.
    - Added Norwegian vocabulary coverage checks for A1 grammar content.
  - **Documentation**
    - Added chapter overviews and detailed grammar and quiz workbooks for A1 and A2 learners.
  - **Tests**
    - Updated grammar statistics checks to include newly available A1 content.

## 2.55.0

### Minor Changes

- - **New Features**
    - Redesigned the Stats page with CEFR level tabs, summary metrics, and streamlined progress lists for vocabulary, fixed expressions, and grammar.
    - Added a Plus-only C-level fixed expressions deck covering all entries.
    - Added navigation between the C learning hub, fixed expressions, and category pages.
  - **Bug Fixes**
    - Improved C-level fixed-expression navigation and breadcrumb context.
    - Corrected grammar topic assignment to use each question’s CEFR level consistently.
  - **Tests**
    - Expanded coverage for the new Stats layout and C-level fixed expressions route.

## 2.54.0

### Minor Changes

- - **New Features**
    - Added theme-based access controls for Uttrykk study content, with selected themes available for free and others requiring Plus.
    - Updated learning hubs to show free and locked themes with clear Plus upgrade links.
    - Added persistent “Show more/less” states across learning hub navigation.
  - **Improvements**
    - Retired the separate Uttrykk preview experience and redirected existing links to the main Uttrykk area.
    - Improved theme-specific navigation, including C-level expressions.
    - Simplified Uttrykk administration to use a single deck per level.
  - **Bug Fixes**
    - Corrected category navigation and quiz category handling after preview retirement.

## 2.53.0

### Minor Changes

- - **New Features**
    - Added advanced Nivå C grammar content covering 24 topics and 425 questions.
    - Added multiple-choice grammar exercises with three answer options.
    - Expanded Nivå C vocabulary and expressions with translations and examples.
    - Added theme-based browsing for expressions and separate Vocabulary and Uttrykk progress sections.
    - Added detailed expression statistics and expandable category views.
  - **Bug Fixes**
    - Improved B2 and C quizzes to use Norwegian definitions and avoid unsuitable entries.
  - **Localization**
    - Improved Norwegian quiz instructions, grammar explanations, and exercise prompts across supported languages.

## 2.52.0

### Minor Changes

- - **New Features**
    - Added advanced Nivå C grammar content covering 24 topics and 425 questions.
    - Added multiple-choice grammar exercises with three answer options.
    - Expanded Nivå C vocabulary and expressions with multilingual translations, definitions, and examples.
  - **Improvements**
    - Nivå C grammar titles, explanations, and instructional text now always appear in Norwegian.
    - Added localized prompts for multiple-choice exercises in supported languages.
  - **Validation**
    - Added checks to help verify Norwegian grammar content and vocabulary coverage.

## 2.51.0

### Minor Changes

- - **New Features**
    - Added extensive Level C vocabulary, expressions, translations, and example sentences.
    - Added Norwegian grammar guides, exercises, and answer keys covering articles, nouns, adjectives, verbs, word order, and more.
    - Added new C-level categories, including gastronomy and cultural heritage.
  - **Content Improvements**
    - Expanded and refined vocabulary and expression entries across proficiency levels.
    - Improved grammatical labels, lemmas, translations, and example handling.
  - **Documentation**
    - Updated guidance for vocabulary classification, image extraction, duplicate checking, and content workflows.

## 2.50.0

### Minor Changes

- - **New Features**
    - Added support for clearer handling of glossary and phrase content, including broader language coverage and improved formatting rules.
    - Added automatic redirect support so Norwegian-language paths now route to the main site version.
  - **Bug Fixes**
    - Improved validation and correction of accented characters and punctuation in generated content.
    - Reduced duplicate entries and tightened ID handling for draft data.
  - **Chores**
    - Updated build and maintenance workflows, plus refreshed several internal guidance and report files.

## 2.49.0

### Minor Changes

- - **New Features**
    - Added support for the new “C” mastery level across the learning experience.
    - Introduced a consolidated C-level vocabulary view and updated page styling for the new level.
  - **Bug Fixes**
    - Improved how C-level content is grouped and displayed, including locked/free content behavior.
    - Updated page descriptions and keywords so C-level pages present more relevant search and sharing metadata.
  - **Chores**
    - Updated site indexing so the new C-level routes are included in the sitemap.

## 2.48.0

### Minor Changes

- - **New Features**
    - Added a new vocabulary review workflow for converting image-based content into draft JSON, enriching it, assigning IDs, and merging it into production.
    - Added an adjective audit report and filtering tools to help review flagged entries more easily.
  - **Bug Fixes**
    - Corrected several vocabulary entries and lemmas for more accurate forms.
    - Removed incorrect indefinite articles from some entries.
  - **Documentation**
    - Added guidance for the new workflow and updated conversion instructions.

## 2.47.0

### Minor Changes

- - **New Features**
    - Added a new **Learn** navigation menu with related learning resources.
    - Moved the **Blog** link into the new Learn menu for a cleaner top-level navigation.
    - Added the new **Learn** label in English, German, Spanish, Norwegian, and Ukrainian.

## 2.46.0

### Minor Changes

- - **New Features**
    - FAQ page now uses an accordion layout with clear expand/collapse indicators.
  - **UI Improvements**
    - Plus page “How smart review works” is now step-based, and Plus feature highlights were updated.
    - Blog browsing now blends Guides into the main results where applicable.
    - Grammar and learning surfaces now show consistent, color-coded CEFR badges/chips and refined progress header typography.
  - **Localization / Content**
    - Updated Plus marketing text structure across supported languages.
  - **Tests**
    - Updated e2e coverage for the revised Plus, Blog, and Grammar UIs.
  - **Documentation**
    - Clarified the i18n maintenance command flow as numbered steps.
  - **Chores**
    - Removed outdated prior-session notes content from internal AI docs.

## 2.45.0

### Minor Changes

- - **New Features**
    - Expanded i18n-driven UI copy across the app (login, profile, resources/FAQ, contact, stats, grammar/quiz, Plus, and Norskprøven).
    - Improved navigation for locked Plus content, including localized “next” prompts in vocab/quiz flows.
  - **Bug Fixes**
    - Error page and empty states now use localized fallback text.
    - Resources/footer flow now uses a consistent contact link; updated translated badges and labels.
  - **Tests / Chores**
    - Added i18n key validation tooling and reports; updated end-to-end coverage for footer note links.
  - **Documentation**
    - Updated i18n maintenance guidance and related setup notes.

## 2.44.0

### Minor Changes

- - **New Features**
    - Added a clearer login recovery flow with a “back to login” action on the verification screen.
    - Improved login handling so pending sign-in state can survive reloads and backgrounding.
    - Added local development guidance for testing login flows through ngrok.
  - **Bug Fixes**
    - Fixed OTP verification issues after reloads and Android/PWA backgrounding.
    - Improved resend and verification behavior, including better handling of anti-bot checks and cleaner state resets.
    - Updated translations to support the new login navigation text.

## 2.43.1

### Patch Changes

- - **Style & UI Polish**
    - Updated typography across major pages (headings in flashcards, learn, resources, quiz, plus, stats), plus navigation/footer, for a cleaner, more consistent look. Adjusted spacing on category pills and badges.
  - **Content & Localization**
    - Removed Norskprøven “study tips” section text across supported languages, so the flow goes directly to the main exam preparation call-to-action.
    - Shortened the Resources subtitle to “Free tools, courses, and communities.”
  - **Data / Stats**
    - Refreshed displayed statistics to include additional Level C items.
  - **Progress**
    - Improved consistency of saved/synced vocabulary progress.

## 2.43.0

### Minor Changes

- - **New Features**
    - Synced flashcard language from saved profile.
    - Added global toast plus reusable Toggle and Segmented Control.
    - Modernized profile/preferences with auto-save, debounced updates, and collapsible Danger Zone.
    - Added a tool to count vocab/uttrykk entries by category.
  - **Bug Fixes**
    - Limited definition mode to supported levels and improved search index loading to avoid duplicate fetches.
  - **Localization / UI**
    - Streamlined home/Plus/resources/learn copy, updated footer text, refreshed translations, and refreshed button/flashcard styling.
  - **Docs & Tests**
    - Added entry-count documentation; updated Playwright setup and search e2e tests.

## 2.42.0

### Minor Changes

- - **New Features**
    - Added German language support across the app.
    - Updated flashcards with clearer Show/Hide controls and improved pronunciation button layouts.
    - Refreshed several help and learning pages with better organization and updated guidance.
  - **Bug Fixes**
    - Improved mobile flashcard spacing, navigation, and overflow behavior.
    - Cleaned up duplicate and inconsistent content in vocabulary data for a more reliable learning experience.
  - **Documentation**
    - Updated setup and reference notes for vocabulary, expressions, and language rules.

## 2.41.1

### Patch Changes

- fix: remove UpdateBanner

## 2.41.0

### Minor Changes

- - **New Features**
    - Added an update banner that appears when a new app version is available, letting you refresh with one tap.
  - **Bug Fixes**
    - Improved flashcard navigation hints across multiple languages to better match touch-based use.
    - Updated mobile wording to say “swipe to navigate” instead of arrow-key navigation.
  - **Documentation**
    - Removed an outdated note from the AI questions list.

## 2.40.0

### Minor Changes

- - **New Features**
    - Added broader Norwegian-language guidance across the learning content, including clearer explanations, examples, tables, and wording.
    - Expanded blog-post handling so content and metadata can be updated consistently in Norwegian.
  - **Bug Fixes**
    - Fixed several vocabulary entries and normalized word forms, including gender markers and missing lemma values.
    - Improved site build behavior so broken or unpublished blog links no longer fail prerendering in some cases.
  - **Documentation**
    - Added and refined rules for blog posts and vocabulary formatting to keep content more consistent.

## 2.39.0

### Minor Changes

- - **New Features**
    - Added a dedicated FAQ page with localized content, navigation links, and improved page metadata.
    - Added new navigation/footer links for resources, account, and FAQ.
    - Expanded guide content with clearer flashcard, quiz, and scheduling explanations.
  - **Bug Fixes**
    - Improved flashcard text wrapping and layout so long content displays more cleanly.
    - Updated flashcard page spacing, sizing, and button readability for a more consistent mobile/desktop experience.
  - **Documentation**
    - Added new Norwegian learning materials, including grammar, vocabulary, and debate practice content.

## 2.38.0

### Minor Changes

- - **New Features**
    - Enhanced mobile language switcher to display the current locale's flag icon when available, with fallback to globe icon for improved visual recognition.
  - **Documentation**
    - Added quiz open decisions document outlining key behavioral choices for quiz functionality.
    - Reorganized questions documentation structure.

## 2.37.0

### Minor Changes

- - **New Features**
    - Added a dedicated public Contact page accessible from the Help menu and footer (no login required).
    - Moved the support contact form from the Profile page to the new Contact page.
    - Logged-in users see their email pre-filled/read-only; guests can enter their email.
    - Plus members receive priority support wording; submissions include bot protection (Turnstile + honeypot) and show success/error states.
  - **Documentation**
    - Updated the FAQ to direct users to the Contact page.
  - **Internationalization**
    - Added/updated Contact-related translations for English, Spanish, Norwegian, and Ukrainian.
  - **Tests**
    - Added unit coverage for contact message sending and adjusted test scripts.

## 2.36.1

### Patch Changes

- - **Documentation**
    - Added a grammar example to the AI docs to illustrate a corrected usage scenario.
    - Updated AI docs with new proposals for making a “Contact” feature more discoverable (menu links and updated flow guidance).
  - **Chores**
    - Refreshed the grammar exercise dataset for adjective comparisons, expanding comparative and superlative practice with additional patterns, sentence-writing tasks, and updated prompts/hints.

## 2.36.0

### Minor Changes

- ## New Features
  - **Norwegian Language Learning Content** — Added 40+ new structured lesson posts covering grammar, vocabulary, and phrasal verbs (e.g., adjective vs. adverb usage, “det er lov,” verb particles like “få …,” and “finne fram”), with explanations, examples, comparisons, and practice.
  - **Learning Resources** — Published a level-based listening improvement guide, including practical study tips and subtitle guidance.

  ## Content Updates
  - **Lesson Refreshes** — Updated the “sakte vs langsomt” lesson with clearer structure, expanded examples, and improved learning sections.

## 2.35.0

### Minor Changes

- - **New Features**
    - Added "Where to start" section on the guide page with learning path recommendations based on goals.
    - Structured guide page into anchored subsections (flashcards, quiz, grammar, Norskprøven, FAQ) for improved navigation.
  - **Documentation**
    - Significantly expanded README with tech stack, routes, deployment, and development setup details.
    - Enhanced guide content across all supported languages with detailed mode explanations and updated FAQ.
  - **Bug Fixes**
    - Updated onboarding step 5 messaging to focus on maintaining study consistency with optional daily reminders.

## 2.34.0

### Minor Changes

- - **New Features**
    - Added a daily email reminder option as a new step in the onboarding workflow.
  - **Localization**
    - Added translations for footer sections and navigation items across English, Spanish, Norwegian, and Ukrainian.
    - Expanded onboarding messaging in all supported languages.
    - Footer and navigation UI now display fully localized text throughout the app.

## 2.33.1

### Patch Changes

- fix: change circular icons to square icons

## 2.33.0

### Minor Changes

- - **New Features**
    - Email-based login now uses 6-digit one-time passwords (OTP) sent to your email address
    - Login interface available in Spanish and Ukrainian in addition to English and Norwegian

## 2.32.1

### Patch Changes

- - **Bug Fixes & Improvements**
    - Corrected Spanish and Ukrainian translations for multiple vocabulary entries including greetings, colors, classroom items, and clothing terms.
    - Enhanced translation examples for better accuracy and idiomatic expression.
  - **Documentation**
    - Updated vocabulary review documentation with expanded action items and summary of applied corrections.

## 2.32.0

### Minor Changes

- - **New Features**
    - Updated homepage hero badge branding and localization (including a standalone product name label).
    - Refreshed the footer to be fully localized and data-driven, with updated “Learn” and “Resources” link structure.
  - **Bug Fixes**
    - Improved readability and light/dark contrast across many screens (charts, empty states, cards, search, grammar/quiz, and various page headings), plus small spacing tweaks for better legibility.
    - Updated the language switcher dropdown behavior for more consistent opening.
  - **Chores**
    - Updated the project’s package manager version.

## 2.31.0

### Minor Changes

- - **New Features**
    - Language switcher now shows abbreviated language codes instead of full names.
  - **Style**
    - Improved typography across the home page, login page, Plus billing interval toggle, learn pages, and feature cards.
    - Updated footer layout to a clearer grid structure with better text sizing.
    - Refined sidebar icon/hover colors and added consistent horizontal padding to page content.
  - **Documentation**
    - Added a “Mobile check” item to the Questions checklist.

## 2.30.0

### Minor Changes

- - **New Features**
    - Enhanced onboarding experience with new steps for user profile configuration and language preferences
    - Improved step progression and completion flow
  - **Improvements**
    - Simplified onboarding field requirements
    - Expanded multilingual support with localization updates across English, Spanish, Norwegian, and Ukrainian
  - **Documentation**
    - Updated onboarding testing guidance

## 2.29.0

### Minor Changes

- - **New Features**
    - Added Spanish and Ukrainian as supported languages
    - Introduced independent flashcard language preference setting
  - **Improvements**
    - Streamlined onboarding experience with reduced steps
    - Changed UI language selector from toggle to dropdown menu
    - Enhanced preferences page with new language configuration options
  - **Tests**
    - Updated e2e tests to reflect new UI language labels and behavior
  * Widens ui_language CHECK to accept es and uk
  * Adds flashcard_language column (NOT NULL DEFAULT 'english')
  * Renames card_direction values from no_en/en_no/def_no → l1_l2/l2_l1/def_l1
  * Drops native_language, other_languages, and country

## 2.28.0

### Minor Changes

- - **New Features**
    - Added Spanish and Ukrainian language support for both UI and flashcard translations
    - Improved language selector with dropdown interface for better language switching
  - **Bug Fixes**
    - Fixed flashcard language selection to properly display translations in chosen language
    - Corrected English language flag representation
  - **Documentation**
    - Added SEO optimization guidance and checklist
    - Documented multi-language implementation patterns and domain strategy
  - **Chores**
    - Updated homepage copy and marketing messaging
    - Added translation automation scripts
    - Refactored code structure for maintainability
    - Enhanced test coverage for language features

## 2.27.0

### Minor Changes

- - **New Features**
    - Added onboarding flow to collect account information including display name, native language, and study goals with progress tracking.
    - Added profile completion nudges throughout the app to guide users through initial setup.
  - **Refactor**
    - Changed "Target Level" terminology to "Current Level" for improved accuracy across the application.

## 2.26.2

### Patch Changes

- - fix: The initialized flag inside authStore prevents double-fetching — calling init() on a page where user already came from the server doesn't trigger an extra Supabase request. The store just populates itself once and stays valid for all subsequent client-side navigations.
  * **Bug Fixes**
    - Fixed an issue where user avatars would only display on certain routes after login. Avatars now appear correctly across all pages immediately after authentication.
  * **Documentation**
    - Added troubleshooting guide for authentication state handling on client-side navigation.

## 2.26.1

### Patch Changes

- - **Style**
    - Updated mobile navigation sidebar styling with improved visual distinction between active and inactive menu items.

## 2.26.0

### Minor Changes

- fix: plus button in Nav

  - **New Features**
    - Improved Plus plan detection for consistent visibility of Plus-exclusive features across page types, ensuring subscribers always see search functionality.
  - **Tests**
    - Strengthened end-to-end test coverage with explicit waits for improved reliability when testing Plus user scenarios.

## 2.25.8

### Patch Changes

- - fix: the root cause was always that Nav.svelte relied solely on page.data.user which is null on prerendered pages. Now that it falls back to clientUser from the Supabase browser session, all prerendered pages will correctly show the avatar after onMount fires.
  * **Bug Fixes**
    - Improved client-side authentication synchronization for prerendered pages, ensuring the correct logged-in/logged-out UI across the navigation, account menu, visible email, Plus access indicators, and authenticated mobile/desktop sections.
    - Updated logout behavior and locale persistence so they rely on the effective current user state.
  * **Tests**
    - Refreshed the navigation authentication Playwright test for the authenticated blog route (whitespace-only adjustment).

## 2.25.7

### Patch Changes

- fix: src/routes/auth/sync/+page.svelte use window.location.href for full page reload

  - **Tests**
    - Refined authentication and navigation test suite to better validate user authentication workflows and navigation patterns across all routes.
  - **Chores**
    - Enhanced post-login synchronization and redirect handling for improved reliability.

## 2.25.6

### Patch Changes

- - **Bug Fixes**
    - Improved authentication synchronization to properly invalidate cached data before redirecting users to their destination, ensuring they receive the latest information immediately after login.
  - **Tests**
    - Added comprehensive end-to-end tests for navigation across multiple pages in authenticated sessions, verifying avatar visibility and proper UI behavior.

## 2.25.5

### Patch Changes

- - **Bug Fixes**
    - Improved error handling and logging for progress save/upsert and undo/delete operations.
  - **Improvements**
    - Updated login sync to use server-provided post-login destination logic.
    - Enhanced mobile navigation placement for login/logout.
    - Changed link preload behavior from hover to tap.
    - Removed legacy Norwegian hreflang/locale alternates; added redirects for `/nb/*` and adjusted sitemap alternates.
  - **Documentation**
    - Added a full migration guide for converting card progress lookup keys from `norsk` to `vocab_id`, including smoke-test and troubleshooting steps.

## 2.25.4

### Patch Changes

- - **Bug Fixes**
    - Improved card progress tracking consistency by ensuring the vocab ID is always required and properly enforced in the database.
  - **Documentation**
    - Extended migration guidance with additional post-testing steps and troubleshooting for the card progress update.

## 2.25.3

### Patch Changes

- - **Chores**
    - Migrated flashcard progress tracking system to use stable vocabulary identifiers, improving data integrity and consistency for long-term progress persistence.

## 2.25.2

### Patch Changes

- - **Bug Fixes**
    - Resolved login and avatar display inconsistencies across platform pages.
    - Fixed caching issues preventing proper authentication state reflection.
    - Corrected login requirement checks on learning level pages.
  - **Performance**
    - Optimized edge cache configuration for improved performance on both authenticated and anonymous user requests.

## 2.25.1

### Patch Changes

- - **Bug Fixes**
    - Fixed authentication state caching issue where newly logged-in users might see cached anonymous data on learning pages
    - Improved edge cache handling to ensure auth-dependent content displays correctly after login

## 2.25.0

### Minor Changes

- - **New Features**
    - Added admin pages for managing vocabulary and expressions with review tracking workflows.
    - Extended review system to track all content types across the platform.
    - Added Admin link to user navigation menu.
  - **Performance**
    - Optimized caching for category pages and personalized content delivery.
  - **User Interface**
    - Updated navigation level labels to use "Nivå A1," "Nivå A2," etc.
    - Enhanced admin panel with new vocabulary and expression management sections.

## 2.24.0

### Minor Changes

- - **New Features**
    - Added admin panel for managing blog posts with editing, publishing, and deletion capabilities
    - Added admin interface for managing grammar questions with full CRUD operations
    - Added review tracking system for blog posts and grammar questions
    - Added avatar dropdown menu with profile and progress links
  - **Bug Fixes**
    - Updated badge display on resources page
  - **Style**
    - Increased font sizes for main page headings
    - Adjusted layout spacing and styling

## 2.23.0

### Minor Changes

- - **New Features**
    - Added dark mode toggle in the navigation bar
    - Introduced mobile sidebar for improved navigation on smaller screens
  - **Bug Fixes & Improvements**
    - Updated navigation menu structure with separate "Help" and "Free resources" options
    - Improved responsive navigation behavior across device sizes

## 2.22.4

### Patch Changes

- - **Refactor**
    - Improved the verification widget on the login page for more reliable loading and token capture during authentication.
  - **Tests**
    - Strengthened end-to-end login tests by stubbing the verification widget and adding explicit timeouts for server checks.
    - Made quiz e2e test more deterministic by bounding quiz length and reset behavior.
    <!-- end of auto-generated comment: release notes by coderabbit.ai -->

## 2.22.3

### Patch Changes

- ## Bug Fixes
  - Enhanced CAPTCHA token handling during login to ensure proper verification collection
  - Improved error recovery with ability to retry CAPTCHA verification after failed attempts

## 2.22.2

### Patch Changes

- - **Bug Fixes**
    - Fixed Cloudflare Turnstile verification request handling to ensure consistent and reliable bot protection validation.

## 2.22.1

### Patch Changes

- - **Documentation**
    - New guide for verifying Supabase authentication through multiple methods
    - Updated login monitoring guide with clearer Turnstile behavior and verification steps
  - **Improvements**
    - Enhanced login flow with improved Turnstile token management and timeout handling
    - Navigation dropdowns automatically close when navigating or logging out

## 2.22.0

### Minor Changes

- - **New Features**
    - In-app browser detection banner prompting to open in Chrome.
    - Welcome-sequence email flow added with scheduled delivery and unsubscribe handling.
    - Cloudflare Turnstile invisible mode integrated on login.
    - Redirect logic refined to better respect auth state and valid saved paths.
  - **Documentation**
    - Added detailed login flow manual test guide.
    - Expanded questions doc and clarified admin branch recommendation.
  - **Tests**
    - New homepage redirect tests; improved blog filter DOM reactivity test.

## 2.21.0

### Minor Changes

- - **New Features**
    - Grammar stats now display all available grammar topics, including those not yet started, with enhanced visual distinction and "Not started" status labels for improved clarity.
  - **Documentation**
    - Updated domain configuration and improved formatting in Norwegian idiom article introductions.
  - **Chores**
    - Updated English and Norwegian translations with new "Not started" status message for grammar topics.

## 2.20.0

### Minor Changes

- - **New Features**
    - Added minimal-pair grammar exercises for more interactive question types
    - Expanded grammar curriculum with strong verbs, sentence structures, and preposition lessons
  - **Documentation**
    - Comprehensive admin panel implementation guide added
    - Updated grammar instruction materials and lesson structure
    - Blog post metadata and scheduling updates

## 2.19.0

### Minor Changes

- - **New Features**
    - Grammar topics can be filtered by search query and CEFR level with an active-filter summary and clear button
    - Grammar topics and level breakdowns are now clickable for direct navigation
  - **UI Improvements**
    - Enhanced back-navigation/layout on grammar topic pages
    - Added empty-state messaging when filters yield no results
    - Plus upsell banner only shows when no filters are active; filtered locked topics still display
    - Language toggle styling/placement updated for logged-in vs. guest and small vs. large screens

## 2.18.0

### Minor Changes

- - **New Features**
    - Grammar back-navigation that preserves level context
    - New question type: minimal-pair
    - Redesigned Plus billing interval selector with clearer visuals
    - Expanded Norwegian A2–B1 grammar content and new morphology topics (noun/adjective areas)
  - **Bug Fixes**
    - Improved answer normalization for apostrophes/quotes
    - More randomized mixed-level grammar session selection
  - **Changes**
    - Consolidated C1/C2 into a single C (Mastery) level across the app
    - UI state persistence for learning page sections
  - **Tests**
    - Added end-to-end grammar test coverage
  - **Chores**
    - Updated package manager pin to pnpm@11.5.2

## 2.17.0

### Minor Changes

- - **New Features**
    - Per-level learning hubs A1–C (C now single “Mastery”) with vocab, grammar, quiz entry and blog previews
    - Homepage feature showcase and refreshed hero copy
  - **Changes**
    - Nav simplified to direct CEFR links; “Prepare” removed and “More” trimmed
    - Deck picker replaced by level summary cards
    - Norskprøven practice moved inline to /norskproven (legacy /practice consolidated)
    - Search UI gated to Plus users
    - C1/C2 consolidated into C sitewide (ordering, stats, sitemap, i18n updated)

## 2.16.1

### Patch Changes

- fix: vocab-a2 and uttrykk-a2

## 2.16.0

### Minor Changes

- - **New Features**
    - Added annual Plus subscription option with monthly/annual toggle on Plus page
    - Profile page now displays whether your subscription is billed monthly or annually
    - Annual Plus pricing updated to NOK 490/year
  - **Documentation**
    - Added billing management implementation documentation

## 2.15.0

### Minor Changes

- - **New Features**
    - Full-text search modal for Plus members with Ctrl/Cmd+K, keyboard navigation, highlighting, source/level filters, lazy loading, and a free-user upgrade prompt; search index prebuilt and served as a cached static asset.
  - **Brand Updates**
    - App and marketing text updated from “Norske Flashcard” to “Norskeord”.
  - **Content**
    - Added new vocabulary entries and refreshed one recording.
  - **Tests**
    - New end-to-end search tests and refinements to existing e2e flows.
  - **Docs / Chores**
    - Added implementation/service docs, build script, cache header, and updated ignore patterns.

## 2.14.1

### Patch Changes

- docs: plus page update

## 2.14.0

### Minor Changes

- - **New Features**
    - Added a new Grammar section under Prepare with interactive exercises (fill-in-the-blank, word ordering, sentence transformation).
    - Grammar progress now tracked separately in stats with practiced/due/mastered counts.
    - Plus-tier gating applied to select grammar topics.
  - **Documentation**
    - Added educational guides on Norwegian subordinate clauses, sentence adverbials, and related grammar topics.
    - Enhanced learning guides emphasizing active engagement with handwritten practice and auditory reinforcement.

## 2.13.0

### Minor Changes

- - **New Features**
    - Blog posts now display "Practice this vocabulary" section with links to related flashcard decks.
    - Added structured data markup (Schema.org) to flashcard decks and resource pages for improved search visibility.
  - **Improvements**
    - Switched to static Open Graph images for blog posts and decks for better performance and consistency.
    - Enhanced sitemap with multi-locale support (English, Norwegian Bokmål, and default).
  - **Documentation**
    - Updated SEO checklist to mark completed items including structured data implementation and keyword optimization.

## 2.12.0

### Minor Changes

- - **New Features**
    - Added site vocabulary statistics (per-level counts) and UI labels.
    - Bulk tools to generate, enrich and merge vocabulary/phrase datasets, including image-to-list extraction and AI-assisted field enrichment.
    - New scripts to add/remove and count entries programmatically.
  - **Bug Fixes**
    - Resolved many cross-level duplicate entries.
    - Normalized category formatting across datasets.
  - **Documentation**
    - Added workflow guide for managing and processing vocabulary data.
  - **Chores**
    - Added a stats generator and various maintenance utilities.

## 2.11.2

### Patch Changes

- fix: vocab-a2.json

## 2.11.1

### Patch Changes

- - **Bug Fixes**
    - Removed an incorrect entry from the phrase vocabulary database.
  - **Chores**
    - Updated publication schedules for multiple language learning posts.
    - Cleaned up draft content and development artifacts.
    - Enhanced script documentation and file path handling.

## 2.11.0

### Minor Changes

- - **New Features**
    - Added a Guide page with comprehensive help: smart scheduling, study button guidance, card state descriptions, flow tips, and a full FAQ.
  - **Localization / Documentation**
    - Guide content localized in English and Norwegian.
  - **Style**
    - Improved text alignment across practice (oral, reading, writing) and quiz pages; added dynamic quiz headings.
  - **Tests**
    - End-to-end login tests made more reliable by awaiting the authentication request; test results now show passing.

## 2.10.0

### Minor Changes

- - **New Features**
    - Login rebuilt as a form-driven flow with Cloudflare Turnstile and success UX (“Free · No credit card required”)
  - **Updates**
    - Vocabulary B1 categories reorganized for clearer taxonomy
    - Norskprøven: revised A2/B1 category sets and conditional Plus upsell for B1
    - Resources page redesigned with improved layout and external-link cards
    - Contact form now includes invisible honeypot for improved spam protection
  - **Documentation**
    - Added security and monitoring guidance (login, Turnstile, rate-limiting)

## 2.9.1

### Patch Changes

- fix: update c2 vocab

## 2.9.0

### Minor Changes

- - **New Features**
    - Profile preference: show example translations by default (syncs across devices)
    - Free-tier expansion: first 3 quiz categories per level and Practice Test 1 unlocked; locked items show a lock and upgrade flow
  - **UI Improvements**
    - Flashcard layout, labels, keyboard sizing, aria labels, and quiz/category selection refined; nav links reflect partial access
    - Plus comparison table updated
  - **Accessibility**
    - prefers-reduced-motion for flip animations
  - **Localization**
    - New i18n strings for profile prefs; updated Plus copy
  - **Tests**
    - Updated end-to-end coverage for quizzes, practice tests, and flashcard counter
  - **Data / Database**
    - B1 vocabulary category keys renamed; DB migration adds show-example profile column
  - **Documentation**
    - Updated docs and implementation plan for quiz/practice changes
  - **Chores**
    - Bumped package manager version

## 2.8.1

### Patch Changes

- style: Flashcard page update

## 2.8.0

### Minor Changes

- - **New Features**
    - Plus users now store and restore study progress in cloud (with migration from device storage) and can reset cloud progress across devices.
    - Audio planning docs added for a future AI-powered TTS option.
  - **Bug Fixes**
    - Reset flow UX improved: separate guest vs signed-in messages, disabling while resetting, and clearer in-progress labels.
    - Various quiz/flashcard flows made more robust with async persistence to avoid races.
  - **Documentation**
    - Multiple AI and implementation docs added/expanded; minor formatting and content updates to guides and examples.

## 2.7.2

### Patch Changes

- **New Features**
  - Added Previous/Next category navigation links and level badge display in vocab flashcards
- **Vocabulary Updates**
  - Reorganized A1/A2 category slugs and labels; broad renaming (removed many "basic"/"simple" prefixes)
  - Large content updates across A1, A2, B2, C1, C2 datasets; many entries removed, rewritten, or normalized
  - Added new draft flashcard/vocab entries
- **Translations**
  - Updated English and Norwegian message catalogs for category labels
- **Documentation**
  - Expanded implementation notes, prompts, and notification-email formatting
- **Other**
  - Simplified push reminder message; test fixtures adjusted

## 2.7.1

### Patch Changes

- fix: vocab-a1.json
  fix: notification-time helper comment

## 2.7.0

### Minor Changes

- - **New Features**
    - Added daily email reminders for Plus users sent at 19:00 UTC when study hasn't occurred that day.
    - Added email reminder toggle in profile settings with Plus-only access.
    - Extended unsubscribe functionality to support both lesson and reminder emails.
  - **Documentation**
    - Added comprehensive email reminder implementation guide.
    - Updated push notification documentation.
  - **Localization**
    - Added English and Norwegian translations for email reminder preferences.

## 2.6.0

### Minor Changes

- - **New Features**
    - Definition → Norwegian flashcard mode for vocabulary learners at B1+ levels
    - Norwegian learning blog posts on improving listening skills, speaking techniques, and study strategies
    - Oral practice content with 20 guided prompts and model answers (4-part series)
    - Monolingual Norwegian definitions for vocabulary entries
    - Study day streak tracking and push notification reminders for Plus members
  - **Localization**
    - Added translation keys for definition flashcard UI and profile preferences
  - **Updates**
    - Extended flashcard direction preferences to support definition mode

## 2.5.0

### Minor Changes

- - **New Features**
    - Added scheduled blog post publishing automation
    - Introduced 30+ new Norwegian language learning blog posts covering grammar rules, vocabulary distinctions, phrases, and practical usage examples
  - **Documentation**
    - Updated blog planning guidelines with improved structure and author guidance
    - Enhanced blog post planning with topic grouping and publication strategies

## 2.4.0

### Minor Changes

- **New Features**
  - Dedicated blog with articles/guides grouped by CEFR level, badges, dates, back navigation; “Blog” added to nav and “Learn” nav label.
  - Support contact form available to all logged-in users (updated UI text and abuse-prevention notice).
- **Documentation**
  - Many new and draft articles, blog planning/implementation notes, Open Graph guidance, and a publishing checklist.
- **UI**
  - Category bar chart includes uttrykk totals correctly; flashcard action label added (“View my progress →”).
- **Tests**
  - New unit and end-to-end tests for blog parsing, index, and post pages.

## 2.3.5

### Patch Changes

- fix: bugs

## 2.3.4

### Patch Changes

- fix: add level to og image

## 2.3.3

### Patch Changes

- fix: meta image links

## 2.3.2

### Patch Changes

- 265f2e2: fix: Remove the prompt entirely (silent auto-update)
- vite.config.ts — registerType changed from 'prompt' to 'autoUpdate'
- +layout.svelte — removed the PwaUpdatePrompt import
- +layout.svelte — removed the <PwaUpdatePrompt /> component tag

## 2.3.1

### Patch Changes

- **Bug Fixes**
  - Fixed PWA update behavior to reliably reload the application after service worker updates, preventing the update prompt from reappearing unexpectedly.

## 2.3.0

### Minor Changes

- **New Features**
  - Added hreflang alternate links with x-default for improved multi-language SEO.
- **Improvements**
  - Moved vocabulary/category loading to server-side for better SSR and performance.
  - Enforced redirects and tighter access control for Plus-only and preview content.
- **Chores**
  - Updated package manager settings (pnpm specified) and Node engine requirement (Node 20+).
  - Added workspace/build configuration and Vercel deployment configuration.
  - Relaxed npm engine-strict enforcement.
- **Documentation**
  - Reorganized SEO notes into resolved items.

## 2.2.1

### Patch Changes

- **New Features**
  - Flashcard backs show a “Last” rating badge with labeled, styled ratings.
  - App version shown in footer and included with support reports.
  - “What’s unlocked at each level” section added to Plus page with level teasers.
- **Changes**
  - Progress is now scoped per-user, merged on login; anonymous progress cleared after sync and user-scoped progress cleared on logout.
  - In-session new-card cap increased from 15 to 20.
  - Removed email-lesson toggle and its row from the Free vs Plus comparison.
  - Home/hero text localized; locked categories collapse into a “+N with Plus” badge.
- **Security**
  - Migration tightens study-day upsert execution and removes an exposed view.

## 2.2.0

### Minor Changes

- feat: Session limit management now respects Plus membership and device syncing preferences.
- **New Features**
  - Session limit management now respects Plus membership and device syncing preferences.
  - Activity tracking enhanced for Plus subscribers with Supabase integration.
  - UI now clearly differentiates Plus-exclusive features (daily reminders, cross-device sync).
- **Bug Fixes**
  - Fixed PWA update refresh behavior to properly reload after service worker updates.
- **Documentation**
  - Added "Rating Flow" guide explaining card state transitions and rating mechanics.
  - Expanded vocabulary documentation.

## 2.1.0

### Minor Changes

- feat: email service and quiz features

## 2.0.0

### Major Changes

- feat:
- Added a Word/Phrase toggle to customize flashcard display; flashcards now show front/back content appropriate to the selected type and remember your preference.
  UI Changes:
- Offline-ready and update-available notifications replaced with dismissable toasts featuring clearer titles, icons, and simplified actions.
  Tests:
- End-to-end tests updated to validate card-type labels and persistence behavior.
  Breaking Change:
- Vocab entry data now requires example translations to be present (update imports/data accordingly).

## 1.6.9

### Patch Changes

- fix: Voice picker only shows language-appropriate voices (Norwegian), or is hidden entirely if none are installed
- fix: Pronounce button still fires on A04 via voices[0] fallback in doSpeak, using utterance.lang as a hint to the TTS engine — it may not sound great, but it won't silently fail

## 1.6.8

### Patch Changes

- fix: mobile right side cut

## 1.6.7

### Patch Changes

- fix: mobile sway, add w-full overflow-hidden

## 1.6.6

### Patch Changes

- fix: add lang ts to +layout

## 1.6.5

### Patch Changes

- fix: PWA sway right and left

## 1.6.4

### Patch Changes

- fix: app.html and app.css

## 1.6.3

### Patch Changes

- fix: overflow-x

## 1.6.2

### Patch Changes

- fix: horizontal move

## 1.6.1

### Patch Changes

- Style:
- Standardized indentation and whitespace across the project for consistent formatting.

Improvements:

- Flashcard pages now choose and display language-specific example phrases and their translations more reliably.

Bug Fixes:

- Improved robustness of random selection and link-opening behavior to prevent edge-case failures.

Accessibility:

- Minor icon/label adjustments to improve clarity and assistive technology accuracy.

## 1.6.0

### Minor Changes

- New Features:
- Expanded vocabulary for A1–B2 with ~4,900 new entries across many topics (cooking, adjectives, nature, chores, finance, medicine, business, religion, etc.).
- Added a Resources page with curated external learning links.
- Navigation updated to include a "More" dropdown containing About and Resources.

Documentation:

- Added a CEFR-aligned category expansion plan and adjective-priority guidance.
- Minor wording correction in multi-language docs.

Style:

- Adjusted heading capitalization and category badge spacing.

## 1.5.1

### Patch Changes

- fix: Redirects now only run on fresh page loads to prevent unexpected in-app navigation.
  fix: Invalid or malformed saved flashcard links are cleared to avoid failed redirects.
  fix: Auto-redirect behavior tightened so users aren’t sent to incorrect pages and stored bad paths are removed.

## 1.5.0

### Minor Changes

- feat: persistent button and page choices

## 1.4.0

### Minor Changes

- feat: new vocab, structure, etc

## 1.2.0

### Minor Changes

- feat: apply consistent UX improvements across all flashcard components
- Add card counter display (e.g., "3/7") to all flashcard variants
- Implement unified keyboard navigation: ←↑ previous, →↓ next, N for new card
- Fix history management to preserve forward navigation without truncation
- Add touch gesture support with swipe detection for mobile users
- Update button layouts with proper disabled states and visual feedback
- Separate navigation from card generation for clearer user experience
- Add context-aware help text (different for touch vs keyboard users)
- Maintain component-specific features (verb modes, explanation modes)

Components updated:

- FlashcardPage.svelte (Japanese with verb support)
- FlashcardPage.svelte (Norske basic version)
- FlashcardPageExtended.svelte (Norske with explanation mode)

Breaking: Arrow keys no longer flip cards (use space/enter instead)

## 1.1.1

### Patch Changes

- feat(FlashcardPage/FlashcardPageExtended): improve UX by making flashcard clickable to flip
- Removed "flip" button (←) for flipping card
- Made the flashcard clickable to flip using mouse or keyboard (Enter/Space)
- Added keyboard accessibility with role="button" and tabindex="0"
- Updated instructions to reflect new interaction pattern
- Preserved support for arrow key shortcuts: ← (flip), → (next), ↑ (previous), ↓ (forward)

## 1.0.1

### Patch Changes

- docs: update about page ([`b513f25939b26c5d0b9df730d831e307b40b1e4d`](https://github.com/shinokada/norskeord/commit/b513f25939b26c5d0b9df730d831e307b40b1e4d))
  chore: update dependencies
