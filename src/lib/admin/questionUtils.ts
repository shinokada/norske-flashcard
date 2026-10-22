import type { GrammarQuestion } from '$lib/types';

/** Auto-generate the next id for a topic, e.g. gq-ikke-013 */
export function generateId(topic: string, existing: GrammarQuestion[]): string {
  const prefix = topicPrefix(topic);
  const nums = existing
    .filter((q) => q.id.startsWith(`gq-${prefix}-`))
    .map((q) => parseInt(q.id.split('-').pop() ?? '0', 10))
    .filter((n) => !isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `gq-${prefix}-${String(next).padStart(3, '0')}`;
}

const TOPIC_PREFIXES: Record<string, string> = {
  'ikke-placement': 'ikke',
  'det-sentence': 'det',
  'det-er-ikke': 'dei',
  'v2-word-order': 'v2',
  'modal-verb-order': 'mod',
  'subordinate-order': 'sub',
  'relative-som': 'rel',
  'svar-ja-jo-nei': 'svar',
  setningsadverbial: 'setadv',
  'adverbial-fronting': 'advfr',
  'noun-articles': 'noun-art',
  'noun-plurals': 'noun-pl',
  'noun-possessives': 'noun-pos',
  'adj-agreement': 'adj',
  'adj-definite': 'adj',
  'adj-comparison': 'adj',
  'sterke-verb': 'sterke',
  helsetninger: 'hels',
  'preposisjoner-tid': 'prep-tid',
  'preposisjoner-sted': 'prep-sted',
  kommaregler: 'komma'
};

function topicPrefix(topic: string): string {
  return TOPIC_PREFIXES[topic] ?? topic.slice(0, 6);
}

/** Return a list of validation error messages. Empty = valid. */
export function validateQuestion(q: Partial<GrammarQuestion>): string[] {
  const errors: string[] = [];
  if (!q.id) errors.push('id is required');
  if (!q.topic) errors.push('topic is required');
  if (!q.cefr) errors.push('cefr is required');
  if (!q.type) errors.push('type is required');
  if (!q.answer) errors.push('answer is required');
  if (q.type === 'fill' && !q.sentence) errors.push('sentence is required for fill');
  if (q.type === 'order' && !q.tokens?.length) errors.push('tokens are required for order');
  if (q.type === 'transform' && !q.source) errors.push('source is required for transform');
  if (q.type === 'minimal-pair' && (!q.optionA || !q.optionB)) {
    errors.push('optionA and optionB are required for minimal-pair');
  }
  if (q.type === 'multiple-choice') {
    if (!q.options || (q.options.length !== 3 && q.options.length !== 4)) {
      errors.push('options must have 3 or 4 entries for multiple-choice');
    } else if (!q.options.includes(q.answer ?? '')) {
      errors.push('answer must exactly match one of the options for multiple-choice');
    }
  }
  if (q.type === 'punctuation') {
    if (!q.options || q.options.length !== 3) {
      errors.push('options must have exactly 3 entries for punctuation');
    } else if (!q.options.includes(q.answer ?? '')) {
      errors.push('answer must exactly match one of the options for punctuation');
    }
  }
  return errors;
}

/** Return a blank question skeleton for the add form. */
export function blankQuestion(
  type: GrammarQuestion['type'] = 'transform'
): Partial<GrammarQuestion> {
  return {
    type,
    cefr: 'A2',
    topic: 'ikke-placement',
    answer: '',
    alternates: [],
    plusOnly: false
  };
}
