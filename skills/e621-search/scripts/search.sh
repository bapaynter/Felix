#!/usr/bin/env bash
# e621 Search Script
# Searches e621 for posts matching tags and returns a random result

set -e

API_KEY="${E621_API_KEY:-}"
USER_AGENT="OpenClawBot/1.0 (by Felix)"
BASE_URL="https://e621.net/posts.json"

# Parse arguments
TAGS=""
RATING=""
LIMIT=50

while [[ $# -gt 0 ]]; do
  case $1 in
    --tags)
      TAGS="$2"
      shift 2
      ;;
    --rating)
      RATING="$2"
      shift 2
      ;;
    --limit)
      LIMIT="$2"
      shift 2
      ;;
    *)
      # If no flag, assume it's tags
      if [[ -z "$TAGS" ]]; then
        TAGS="$1"
      fi
      shift
      ;;
  esac
done

# Build search query
QUERY="$TAGS"
if [[ -n "$RATING" ]]; then
  QUERY="$QUERY rating:$RATING"
fi

# URL encode the query (basic)
ENCODED_QUERY=$(echo "$QUERY" | sed 's/ /%20/g' | sed 's/:/%3A/g' | sed 's/+/%2B/g')

# Make API request
# Note: API key auth via headers requires additional setup, using unauthenticated for now
# which allows reasonable rate limits for personal use
RESPONSE=$(curl -s -A "$USER_AGENT" \
  "${BASE_URL}?tags=${ENCODED_QUERY}&limit=${LIMIT}" 2>/dev/null || echo '{"posts":[]}')

# Check if we got results
POST_COUNT=$(echo "$RESPONSE" | jq -r '.posts | length' 2>/dev/null || echo "0")

if [[ "$POST_COUNT" -eq 0 ]]; then
  echo '{"error":"No posts found","count":0}'
  exit 1
fi

# Pick a random post
RANDOM_INDEX=$((RANDOM % POST_COUNT))
SELECTED_POST=$(echo "$RESPONSE" | jq -r ".posts[$RANDOM_INDEX]" 2>/dev/null)

# Extract relevant info
POST_ID=$(echo "$SELECTED_POST" | jq -r '.id')
FILE_URL=$(echo "$SELECTED_POST" | jq -r '.file.url')
PREVIEW_URL=$(echo "$SELECTED_POST" | jq -r '.preview.url')
SAMPLE_URL=$(echo "$SELECTED_POST" | jq -r '.sample.url')
RATING=$(echo "$SELECTED_POST" | jq -r '.rating')
TAGS_GENERAL=$(echo "$SELECTED_POST" | jq -r '.tags.general | join(", ")' | cut -d',' -f1-10)
ARTIST=$(echo "$SELECTED_POST" | jq -r '.tags.artist | join(", ")' | cut -d',' -f1-3)

# Build output
jq -n \
  --arg id "$POST_ID" \
  --arg file_url "$FILE_URL" \
  --arg preview_url "$PREVIEW_URL" \
  --arg sample_url "$SAMPLE_URL" \
  --arg rating "$RATING" \
  --arg tags "$TAGS_GENERAL" \
  --arg artist "$ARTIST" \
  --argjson count "$POST_COUNT" \
  '{
    id: $id,
    file_url: $file_url,
    preview_url: $preview_url,
    sample_url: $sample_url,
    rating: $rating,
    tags: $tags,
    artist: $artist,
    post_url: "https://e621.net/posts/\($id)",
    count: $count
  }'
