You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

## Blog post tags — canonical taxonomy

All posts in `src/lib/posts/` must use **only** the following 9 tags in their frontmatter.
Do not invent new tags. Pick the 1–2 that best fit.

| Tag             | Use for                                                         |
| --------------- | --------------------------------------------------------------- |
| `adjectives`    | posts about adjective meaning, choice, or nuance                |
| `adverbs`       | posts about adverb meaning, choice, or nuance                   |
| `verbs`         | verb meaning, modal verbs, verb conjugation                     |
| `nouns`         | nouns, professions, compound words, gender                      |
| `grammar`       | word order, sentence structure, negation, prepositions, clauses |
| `vocabulary`    | word choice, near-synonyms, nuance between words                |
| `expressions`   | phrases, idioms, fixed expressions, colloquialisms              |
| `pronunciation` | spoken vs written register, sounds, rhythm                      |
| `study-tips`    | learning strategy, app usage guides                             |

**Notes:**

- `comparison` is NOT a tag — almost every post is a comparison, so it adds no value
- `professions`, `word-order`, `sentence-structure` are NOT tags — use `nouns` and `grammar` instead
- Guide posts (`type: guide`) typically use `study-tips`
- Most word-pair posts need just 2 tags: the part-of-speech tag + `vocabulary`

---

## Available Svelte MCP Tools:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.

### 5. Use ASD-STE100 English to explain

## Other notes

You can find db schema in supabase/current-schema.sql, current-functions.sql and current-cron-push-notification.sql. You can find all the db migration files in supabase/migrations directory.
