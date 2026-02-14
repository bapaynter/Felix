---
name: e621-search
description: Search e621 furry image board for posts by tags and rating. Returns a random matching post with image URL. Use when user asks for furry art, e621 posts, or specific tag searches on e621. Triggers include "search e621", "find e621 post", "e621 [tags]", "show me furry art from e621".
---

# e621 Search

Search e621 (furry image board) for posts matching specific tags and optionally filter by rating.

## Features

- **Tag Alias Resolution** - Automatically resolves common misspellings, aliases, and variants to canonical e621 tags
- **Fuzzy Matching** - Finds tags even with partial or slightly incorrect input
- **Random Results** - Returns a random post from matching results to avoid repeats

## Prerequisites

- `E621_API_KEY` environment variable set (for higher rate limits)
- `jq` installed for JSON parsing
- Python3 for tag resolution

## Usage

### Basic search

```bash
# Search by tags (tags are automatically resolved)
skills/e621-search/scripts/search.sh "red_panda male"

# With explicit rating filter
skills/e621-search/scripts/search.sh --tags "red_panda male" --rating s

# Higher limit for more variety
skills/e621-search/scripts/search.sh "fox" --limit 100
```

### Tag Resolution Examples

The resolver automatically converts common aliases to canonical tags:

```bash
# These all resolve to the same thing:
"vulpine"           # → fox
"doggo"             # → domestic_dog
"vixen"             # → fox
"femboy"            # → femboy (exact match)
"k9"                # → canine
```

### Rating values

- `s` - Safe
- `q` - Questionable
- `e` - Explicit (default if not specified)

### Tag syntax

- Space-separated tags (AND search)
- Use `~tag1 ~tag2` for OR search
- Use `-tag` to exclude
- Metatags: `rating:s`, `score:>100`, `favcount:>50`

### Options

| Option | Description |
|--------|-------------|
| `--tags "..."` | Tags to search |
| `--rating s\|q\|e` | Rating filter |
| `--limit N` | Number of results to fetch (default: 50) |
| `--no-resolve` | Skip tag alias resolution |
| `-v, --verbose` | Show resolved tags |

## Tag Resolver Tool

Use the resolver independently to check tag mappings:

```bash
# Resolve single tag
scripts/resolve-tag.sh "vulpine"           # → fox
scripts/resolve-tag.sh -v "doggo"          # → domestic_dog (alias match)

# Show all matches for a tag
scripts/resolve-tag.sh -a "vixen"
# Output:
#   === vixen ===
#     fox (alias: vixen, posts: 441291)
#     canine (alias: vixengirl, posts: 1498197)
```

## Response format

JSON output with:
- `id` - Post ID
- `file_url` - Full resolution image URL
- `preview_url` - Thumbnail URL
- `sample_url` - Medium resolution URL
- `rating` - s/q/e
- `tags` - General tags (truncated)
- `artist` - Artist tags
- `post_url` - Link to e621 post page
- `count` - Total results found

## Example workflow

1. Parse user's tag request
2. Resolve tags using alias database (e.g., "vulpine" → "fox")
3. Call search.sh with resolved tags and optional rating
4. Parse JSON response
5. Send image using `file_url` or `sample_url`
6. Include post link and artist info in caption

## Notes

- Returns random post from results to avoid repeats
- Respects e621 API limits (use API key for higher limits)
- Tag database contains ~140K alias mappings
- Character names (tags with parentheses) are excluded from resolution