#!/bin/bash

# OpenRouter Image Generation Script
# Usage: imagine.sh "prompt" [--model MODEL] [--aspect-ratio RATIO] [--size SIZE] [--output FILE]

set -e

# Load environment
source /home/pi/.openclaw/workspace/.openclaw-env

# Default values
MODEL="google/gemini-2.5-flash-image"
ASPECT_RATIO="1:1"
IMAGE_SIZE="1K"
OUTPUT=""
PROMPT=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --model)
            MODEL="$2"
            shift 2
            ;;
        --aspect-ratio)
            ASPECT_RATIO="$2"
            shift 2
            ;;
        --size)
            IMAGE_SIZE="$2"
            shift 2
            ;;
        --output)
            OUTPUT="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 \"prompt\" [--model MODEL] [--aspect-ratio RATIO] [--size SIZE] [--output FILE]"
            echo ""
            echo "Options:"
            echo "  --model         Model to use (default: google/gemini-2.5-flash-image)"
            echo "  --aspect-ratio  Aspect ratio (default: 1:1)"
            echo "                  Options: 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9"
            echo "  --size          Image size (default: 1K)"
            echo "                  Options: 1K, 2K, 4K"
            echo "  --output        Save image to file"
            exit 0
            ;;
        *)
            if [[ -z "$PROMPT" ]]; then
                PROMPT="$1"
            else
                echo "Error: Unexpected argument: $1"
                exit 1
            fi
            shift
            ;;
    esac
done

if [[ -z "$PROMPT" ]]; then
    echo "Error: Prompt is required"
    echo "Usage: $0 \"prompt\" [--model MODEL] [--aspect-ratio RATIO] [--size SIZE] [--output FILE]"
    exit 1
fi

# Check for API key
if [[ -z "$OPENROUTER_API_KEY" ]]; then
    echo "Error: OPENROUTER_API_KEY not set"
    exit 1
fi

echo "Generating image..." >&2
echo "Prompt: $PROMPT" >&2
echo "Model: $MODEL" >&2
echo "Aspect ratio: $ASPECT_RATIO" >&2
echo "Size: $IMAGE_SIZE" >&2

# Build image_config JSON
IMAGE_CONFIG="{}"
if [[ "$ASPECT_RATIO" != "1:1" ]] || [[ "$IMAGE_SIZE" != "1K" ]]; then
    IMAGE_CONFIG="{\"aspect_ratio\": \"$ASPECT_RATIO\", \"image_size\": \"$IMAGE_SIZE\"}"
fi

# Call OpenRouter chat completions API (NOT images/generations)
RESPONSE=$(curl -s -X POST "https://openrouter.ai/api/v1/chat/completions" \
    -H "Authorization: Bearer $OPENROUTER_API_KEY" \
    -H "Content-Type: application/json" \
    -H "HTTP-Referer: https://openclaw.ai" \
    -H "X-Title: OpenClaw" \
    -d @- <<EOF
{
  "model": "$MODEL",
  "messages": [
    {
      "role": "user",
      "content": "$PROMPT"
    }
  ],
  "modalities": ["image", "text"],
  "image_config": $IMAGE_CONFIG,
  "stream": false
}
EOF
)

# Check for errors
if echo "$RESPONSE" | grep -q "error"; then
    ERROR_MSG=$(echo "$RESPONSE" | jq -r '.error.message // "Unknown error"' 2>/dev/null || echo "$RESPONSE" | head -c 500)
    echo "Error from API: $ERROR_MSG" >&2
    exit 1
fi

# Extract image URL from response
IMAGE_URL=$(echo "$RESPONSE" | jq -r '.choices[0].message.images[0].image_url.url // empty' 2>/dev/null)

if [[ -z "$IMAGE_URL" ]]; then
    echo "Error: No image URL in response" >&2
    echo "Response preview: $(echo "$RESPONSE" | head -c 1000)" >&2
    exit 1
fi

# Check if it's a data URL or regular URL
if [[ "$IMAGE_URL" == data:* ]]; then
    # Base64 data URL
    if [[ -n "$OUTPUT" ]]; then
        # Extract base64 data and save to file
        BASE64_DATA=$(echo "$IMAGE_URL" | sed 's/data:image\/[a-z]*;base64,//')
        echo "$BASE64_DATA" | base64 -d > "$OUTPUT"
        echo "Image saved to: $OUTPUT" >&2
    fi
else
    # Regular URL
    if [[ -n "$OUTPUT" ]]; then
        curl -s -L "$IMAGE_URL" -o "$OUTPUT"
        echo "Image saved to: $OUTPUT" >&2
    fi
fi

# Return JSON response
REVISED_PROMPT=$(echo "$RESPONSE" | head -c 10000 | jq -r '.choices[0].message.content // empty' 2>/dev/null || echo "")

# Use python for JSON to avoid jq arg limit
echo "{\"image_url\": \"${IMAGE_URL:0:100}...\", \"revised_prompt\": \"${REVISED_PROMPT:0:200}\", \"model\": \"$MODEL\", \"aspect_ratio\": \"$ASPECT_RATIO\", \"size\": \"$IMAGE_SIZE\"}"