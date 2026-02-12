#!/bin/bash
# Convert image to text using Gemini 1.5 Flash via OpenRouter

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <image_path> [prompt]" >&2
    exit 1
fi

IMAGE_PATH="$1"
PROMPT="${2:-Describe this image in detail.}"

if [ ! -f "$IMAGE_PATH" ]; then
    echo "Error: File not found: $IMAGE_PATH" >&2
    exit 1
fi

# Source environment if available
if [ -f "/home/pi/.openclaw/workspace/.openclaw-env" ]; then
    source "/home/pi/.openclaw/workspace/.openclaw-env"
elif [ -f "$HOME/.openclaw/workspace/.openclaw-env" ]; then
    source "$HOME/.openclaw/workspace/.openclaw-env"
fi

if [ -z "$OPENROUTER_API_KEY" ]; then
    echo "Error: OPENROUTER_API_KEY not set" >&2
    exit 1
fi

# Convert image to base64
IMAGE_BASE64=$(base64 -w 0 "$IMAGE_PATH")

# Create temp file for JSON payload
TEMP_JSON=$(mktemp)
trap "rm -f $TEMP_JSON" EXIT

# Write JSON to temp file (avoids argument list limits)
cat > "$TEMP_JSON" << EOF
{
  "model": "google/gemini-3-flash-preview",
  "messages": [
    {
      "role": "user",
      "content": [
        {"type": "text", "text": "$PROMPT"},
        {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,$IMAGE_BASE64"}}
      ]
    }
  ]
}
EOF

# Call OpenRouter API using the temp file
curl -s "https://openrouter.ai/api/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "HTTP-Referer: https://openclaw.ai" \
  -d @"$TEMP_JSON" | jq -r '.choices[0].message.content'

exit 0