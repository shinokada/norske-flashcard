#!/usr/bin/env python3
"""
find_dupes.py
Scans all vocab-XX.json files in the norskeord project and reports
duplicate 'norsk' entries — both within a single file and across files.

Also runs a second, normalized pass: strips the gender marker
((en)/(et)/(ei)/(en/ei)/etc.), plural marker ((pl.)/(b.pl.)), (ubøy.)
marker, and verb 'å ' prefix before comparing, so e.g. 'elv (en)' and
'elv (en/ei)' are caught as the same underlying word even though the
exact-'norsk' pass above treats them as distinct strings. Only reports
normalized groups that the exact-match pass didn't already catch.

Usage:
    python scripts/find_dupes.py
    python scripts/find_dupes.py --details   # also write full side-by-side entry pairs
    python scripts/find_dupes.py --data-dir DIR --out FILE   # read another tree / write the
                                             # report elsewhere (used by the fixture test)
"""
import argparse
import json
import os
import re
from collections import defaultdict

# Mirrors the marker patterns in scripts/check-vocab.mjs
GENDER_PATTERN = re.compile(r'\s*\((en|et|ei|en/ei|en/et|en/men)\)$', re.IGNORECASE)
PLURAL_PATTERN = re.compile(r'\s*\((b\.)?pl\.\)$', re.IGNORECASE)
UBOYELIG_PATTERN = re.compile(r'\s*\(ubøy\.\)$', re.IGNORECASE)
VERB_PREFIX = re.compile(r'^å\s+')


def normalize_norsk(s):
    """Lowercase + strip gender/plural/ubøy. marker and verb 'å ' prefix."""
    s = (s or '').strip().lower()
    s = GENDER_PATTERN.sub('', s)
    s = PLURAL_PATTERN.sub('', s)
    s = UBOYELIG_PATTERN.sub('', s)
    s = VERB_PREFIX.sub('', s)
    return s.strip()


def has_distinct_senses(level_entry_pairs):
    """True when every entry in the group has a non-empty `sense` and no two
    senses are equal (case-insensitive). Such a group is a set of deliberately
    split senses (see data-rules/vocab-and-uttrykk-v2.md), not a duplicate."""
    senses = [((entry.get('sense') or '').strip().lower()) for _, entry in level_entry_pairs]
    return all(senses) and len(set(senses)) == len(senses)

parser = argparse.ArgumentParser()
parser.add_argument(
    '--details',
    action='store_true',
    help="Also write scripts/outputs/find-dupes-details.txt with full "
         "side-by-side entry pairs for every duplicate group, for quick review."
)
parser.add_argument(
    '--data-dir',
    default=None,
    help="Directory holding the vocab-*.json / uttrykk-*.json files "
         "(default: src/lib/data)."
)
parser.add_argument(
    '--out',
    default=None,
    help="Where to write the report (default: scripts/vocab_duplicate_report.txt)."
)
args = parser.parse_args()

# Works whether run from project root or scripts/
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
base = os.path.abspath(args.data_dir) if args.data_dir else os.path.join(project_root, "src", "lib", "data")

files = {
    'A1': os.path.join(base, 'vocab-a1.json'),
    'A1-uttrykk': os.path.join(base, 'uttrykk-a1.json'),
    'A2': os.path.join(base, 'vocab-a2.json'),
    'A2-uttrykk': os.path.join(base, 'uttrykk-a2.json'),
    'B1': os.path.join(base, 'vocab-b1.json'),
    'B1-uttrykk': os.path.join(base, 'uttrykk-b1.json'),
    'B2': os.path.join(base, 'vocab-b2.json'),
    'B2-uttrykk': os.path.join(base, 'uttrykk-b2.json'),
    'C': os.path.join(base, 'vocab-c.json'),
    'C-uttrykk': os.path.join(base, 'uttrykk-c.json'),
    # 'A1-draft': os.path.join(project_root, 'draft', 'a1', 'vocab-a1-new.json'),
    # 'A1-uttrykk-draft': os.path.join(project_root, 'draft', 'a1', 'uttrykk-a1-new.json'),
    # 'A2-draft': os.path.join(project_root, 'draft', 'a2', 'vocab-a2-new.json'),
    # 'A2-uttrykk-draft': os.path.join(project_root, 'draft', 'a2', 'uttrykk-a2-new.json'),
    # 'B1-draft': os.path.join(project_root, 'draft', 'b1', 'vocab-b1-new.json'),
    # 'B1-uttrykk-draft': os.path.join(project_root, 'draft', 'b1', 'uttrykk-b1-new.json'),
    # 'B2-draft': os.path.join(project_root, 'draft', 'b2', 'vocab-b2-new.json'),
    # 'B2-uttrykk-draft': os.path.join(project_root, 'draft', 'b2', 'uttrykk-b2-new.json'),
    # 'C-draft': os.path.join(project_root, 'draft', 'c', 'vocab-c-new.json'),
    # 'C-draft-uttrykk': os.path.join(project_root, 'draft', 'c', 'uttrykk-c-new.json'),
    # 'C-extracted-vocab': os.path.join(project_root, 'draft', 'c', 'extracted-vocab-c.json'),
    # 'C-extracted-uttrykk': os.path.join(project_root, 'draft', 'c', 'extracted-uttrykk-c.json'),
}

data_by_file = {}
counts = {}
for level, path in files.items():
    if not os.path.exists(path):
        print(f"⚠️  Skipping missing file: {path}")
        continue
    with open(path, encoding='utf-8') as f:
        data_by_file[level] = json.load(f)
    counts[level] = len(data_by_file[level])

print(f"Entry counts: {counts}")
total = sum(counts.values())
print(f"Total entries: {total}\n")

# norsk_lower -> list of (original_norsk, level, category)
# full_norsk_map: norsk_lower -> list of (level, entry_dict), used by --details
norsk_map = defaultdict(list)
full_norsk_map = defaultdict(list)
# normalized_key -> list of (original_norsk, level, category) / (level, entry_dict)
normalized_map = defaultdict(list)
full_normalized_map = defaultdict(list)
for level, entries in data_by_file.items():
    for entry in entries:
        norsk = entry.get('norsk', '').strip()
        cat = entry.get('category', '?')
        key = norsk.lower()
        norsk_map[key].append((norsk, level, cat))
        full_norsk_map[key].append((level, entry))
        norm_key = normalize_norsk(norsk)
        normalized_map[norm_key].append((norsk, level, cat))
        full_normalized_map[norm_key].append((level, entry))

within = {}
cross = {}
for k, entries in norsk_map.items():
    if len(entries) < 2:
        continue
    # Deliberately split senses (distinct non-empty `sense` on every entry) are not duplicates.
    if has_distinct_senses(full_norsk_map[k]):
        continue
    levels = [e[1] for e in entries]
    if len(set(levels)) == 1:
        within[k] = entries
    else:
        cross[k] = entries

# Normalized duplicates: same word once gender/plural/ubøy./å- markers are
# stripped, but NOT already caught above (i.e. the raw 'norsk' strings
# actually differ — otherwise it's just a re-report of an exact dupe).
normalized_dupes = {}
for k, entries in normalized_map.items():
    if len(entries) < 2:
        continue
    raw_variants = set(e[0].lower() for e in entries)
    if len(raw_variants) < 2:
        continue
    normalized_dupes[k] = entries

output = []
output.append(f"=== CROSS-FILE DUPLICATES ({len(cross)}) ===")
output.append("(Same 'norsk' value appears in different level files)")
output.append("")
for k in sorted(cross.keys()):
    entries = cross[k]
    parts = "  |  ".join(f"{e[1]} [{e[2]}]" for e in entries)
    output.append(f"  {entries[0][0]!r:45s}  →  {parts}")

output.append("")
output.append(f"=== WITHIN-FILE DUPLICATES ({len(within)}) ===")
output.append("(Same 'norsk' value appears twice in the same file)")
output.append("")
for k in sorted(within.keys()):
    entries = within[k]
    parts = "  |  ".join(f"{e[1]} [{e[2]}]" for e in entries)
    output.append(f"  {entries[0][0]!r:45s}  →  {parts}")

output.append("")
output.append(f"=== NORMALIZED DUPLICATES ({len(normalized_dupes)}) ===")
output.append("(Same word once gender/(pl.)/(b.pl.)/(ubøy.)/'å ' markers are stripped, "
              "but the raw 'norsk' text differs — not caught by the exact-match "
              "sections above, e.g. 'elv (en)' vs 'elv (en/ei)')")
output.append("")
for k in sorted(normalized_dupes.keys()):
    entries = normalized_dupes[k]
    parts = "  |  ".join(f"{e[0]!r} [{e[1]}/{e[2]}]" for e in entries)
    output.append(f"  {k!r:30s}  →  {parts}")

result_text = "\n".join(output)
print(result_text)

# Write report next to this script (or to --out)
out_path = os.path.abspath(args.out) if args.out else os.path.join(script_dir, "vocab_duplicate_report.txt")
with open(out_path, 'w', encoding='utf-8') as f:
    f.write(f"Entry counts: {counts}\n")
    f.write(f"Total entries: {total}\n\n")
    f.write(result_text)
print(f"\nResults written to: {out_path}")


# ---------------------------------------------------------------------------
# --details: write full side-by-side entry pairs for every duplicate group,
# so each match can be reviewed and a keep/delete/merge decision made quickly.
# ---------------------------------------------------------------------------
if args.details:
    FIELDS = [
        'id', 'lemma', 'sense', 'english', 'ukrainian', 'spanish', 'german',
        'example', 'example_english', 'category', 'part',
    ]

    def format_group(key, group_entries, index):
        norsk_display = group_entries[0][1].get('norsk', key)
        lines = []
        lines.append("=" * 80)
        lines.append(f"[{index}] DUPLICATE: {norsk_display!r}  ({len(group_entries)} entries)")
        lines.append("=" * 80)
        for n, (level, entry) in enumerate(group_entries, start=1):
            header = f"  --- {n}: {level} ".ljust(78, '-')
            lines.append(header)
            for field in FIELDS:
                val = entry.get(field)
                if val in (None, ''):
                    continue
                lines.append(f"      {field:16s}: {val}")
        lines.append("")
        return "\n".join(lines)

    details_output = []
    details_output.append(f"Entry counts: {counts}")
    details_output.append(f"Total entries: {total}")
    details_output.append("")
    details_output.append(f"=== CROSS-FILE DUPLICATES ({len(cross)}) — full side-by-side entries ===")
    details_output.append("")
    idx = 1
    for k in sorted(cross.keys()):
        details_output.append(format_group(k, full_norsk_map[k], idx))
        idx += 1

    details_output.append(f"=== WITHIN-FILE DUPLICATES ({len(within)}) — full side-by-side entries ===")
    details_output.append("")
    idx = 1
    for k in sorted(within.keys()):
        details_output.append(format_group(k, full_norsk_map[k], idx))
        idx += 1

    details_output.append(f"=== NORMALIZED DUPLICATES ({len(normalized_dupes)}) — full side-by-side entries ===")
    details_output.append("")
    idx = 1
    for k in sorted(normalized_dupes.keys()):
        details_output.append(format_group(k, full_normalized_map[k], idx))
        idx += 1

    details_text = "\n".join(details_output)

    outputs_dir = os.path.join(script_dir, "outputs")
    os.makedirs(outputs_dir, exist_ok=True)
    details_path = os.path.join(outputs_dir, "find-dupes-details.txt")
    with open(details_path, 'w', encoding='utf-8') as f:
        f.write(details_text)
    print(f"Details written to: {details_path}")
