---
name: e621-search
description: Search e621 furry image board for posts by tags and rating. Returns a random matching post with image URL. Use when user asks for furry art, e621 posts, or specific tag searches on e621. Triggers include "search e621", "find e621 post", "e621 [tags]", "show me furry art from e621".
---

# e621 Search

Search e621 (furry image board) for posts matching specific tags and optionally filter by rating.

## Prerequisites

- `E621_API_KEY` environment variable set (for higher rate limits)
- `jq` installed for JSON parsing

## Usage

### Basic search

```bash
# Search by tags
skills/e621-search/scripts/search.sh "red_panda male"

# With explicit rating filter
skills/e621-search/scripts/search.sh --tags "red_panda male" --rating s

# Higher limit for more variety
skills/e621-search/scripts/search.sh "fox" --limit 100
```

### Rating values

- `s` - Safe
- `q` - Questionable  
- `e` - Explicit

### Tag syntax

- Space-separated tags (AND search)
- Use `~tag1 ~tag2` for OR search
- Use `-tag` to exclude
- Metatags: `rating:s`, `score:>100`, `favcount:>50`

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
2. Call search.sh with tags and optional rating
3. Parse JSON response
4. Send image using `file_url` or `sample_url`
5. Include post link and artist info in caption

## Notes

- Returns random post from results to avoid repeats
- Respects e621 API limits (use API key for higher limits)
- Always include proper User-Agent header
