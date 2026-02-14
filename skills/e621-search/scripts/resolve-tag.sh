#!/usr/bin/env bash
# e621 Tag Alias Resolver
# Resolves user input tags to canonical e621 tags using fuzzy matching

set -e

DATA_DIR="$(dirname "$0")/../data"
TAG_DB="$DATA_DIR/tags.csv"
INDEX_FILE="$DATA_DIR/tag-index.txt"
ALIAS_INDEX="$DATA_DIR/alias-index.txt"

# Build optimized index with priority scoring
build_index() {
  echo "Building tag index..." >&2

  # Use Python for proper CSV parsing (handles quoted fields with commas)
  python3 -c "
import csv
import sys

with open('$TAG_DB', 'r', encoding='utf-8') as f:
    reader = csv.reader(f)
    next(reader)  # Skip header
    mappings = {}
    for row in reader:
        if len(row) < 4:
            continue
        canonical = row[0].strip()
        post_count = int(row[2]) if row[2].isdigit() else 0

        # Skip character names (tags with parentheses)
        if '(' in canonical or ':' in canonical:
            continue

        # Parse aliases from quoted field
        aliases_str = row[3] if len(row) > 3 else ''
        aliases = [a.strip() for a in aliases_str.split(',') if a.strip()]

        for alias in aliases:
            # Skip aliases that are character names or too short
            if '(' in alias or ')' in alias or ':' in alias:
                continue
            if len(alias) < 3 and alias not in ['male', 'female', 'fox', 'dog', 'cat']:
                continue

            # Store best canonical for this alias
            if alias not in mappings or post_count > mappings[alias][1]:
                mappings[alias] = (canonical, post_count)

        # Canonical always maps to itself
        if canonical not in mappings or post_count > mappings[canonical][1]:
            mappings[canonical] = (canonical, post_count)

    # Output sorted index
    for alias in sorted(mappings.keys()):
        canonical, count = mappings[alias]
        print(f'{alias}\t{canonical}\t{count}')
" > "$ALIAS_INDEX"

  echo "Index built: $(wc -l < "$ALIAS_INDEX") mappings" >&2
}

# Ensure index exists
if [[ ! -f "$ALIAS_INDEX" ]] || [[ "$TAG_DB" -nt "$ALIAS_INDEX" ]]; then
  build_index
fi

# Resolve a single tag
resolve_tag() {
  local input="$1"
  local result

  # 1. Exact match (case-insensitive) - match tag at start of line
  result=$(grep -i "^${input}[[:space:]]" "$ALIAS_INDEX" | sort -t$'\t' -k3 -rn | head -1)

  if [[ -n "$result" ]]; then
    local canonical=$(echo "$result" | cut -f2)
    local alias=$(echo "$result" | cut -f1)
    local match_type="exact"
    if [[ "$alias" != "$canonical" ]]; then
      match_type="alias"
    fi
    echo "$canonical|$match_type"
    return 0
  fi

  # 2. Starts-with match (e.g., "vulp" → "vulpine")
  result=$(grep -i "^${input}" "$ALIAS_INDEX" | sort -t$'\t' -k3 -rn | head -1)

  if [[ -n "$result" ]]; then
    local canonical=$(echo "$result" | cut -f2)
    echo "${canonical}|prefix"
    return 0
  fi

  # 3. Substring match - find tags containing input
  result=$(grep -i "$input" "$ALIAS_INDEX" | sort -t$'\t' -k3 -rn | head -1)

  if [[ -n "$result" ]]; then
    local canonical=$(echo "$result" | cut -f2)
    echo "${canonical}|substring"
    return 0
  fi

  return 1
}

# Main
if [[ "$1" == "--help" ]] || [[ "$1" == "-h" ]]; then
  echo "Usage: $0 [options] <tag> ..."
  echo ""
  echo "Options:"
  echo "  -v, --verbose    Show match type"
  echo "  -a, --all        Show all matches (not just best)"
  echo ""
  echo "Examples:"
  echo "  $0 vulpine               # → fox"
  echo "  $0 -v doggo              # → domestic_dog (exact match)"
  echo "  $0 -a vixen              # → fox, true_fox"
  exit 0
fi

VERBOSE=false
SHOW_ALL=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    -v|--verbose) VERBOSE=true; shift ;;
    -a|--all) SHOW_ALL=true; shift ;;
    -*) echo "Unknown option: $1"; exit 1 ;;
    *) break ;;
  esac
done

if [[ -z "$1" ]]; then
  echo "Usage: $0 [options] <tag> [tag2] ..."
  exit 1
fi

# Process tags
for tag in "$@"; do
  if $SHOW_ALL; then
    echo "=== $tag ==="
    grep -i "$tag" "$ALIAS_INDEX" | sort -t$'\t' -k3 -rn | head -10 | while read line; do
      alias=$(echo "$line" | cut -f1)
      canonical=$(echo "$line" | cut -f2)
      count=$(echo "$line" | cut -f3)
      echo "  $canonical (alias: $alias, posts: $count)"
    done
  elif $VERBOSE; then
    resolve_tag "$tag"
  else
    resolve_tag "$tag" | cut -d'|' -f1
  fi
done