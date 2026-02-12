---
name: gemini-vision
description: Convert images to text using Gemini 1.5 Flash via OpenRouter. Useful when your primary model doesn't have vision capabilities.
---

# Gemini Vision

Convert images to text descriptions using Gemini 3 Flash Preview through OpenRouter's API.

## Prerequisites

- `OPENROUTER_API_KEY` environment variable set (already configured in your setup)
- `curl` installed

## Usage

### Basic image to text

```bash
skills/gemini-vision/scripts/describe.sh /path/to/image.jpg
```

### With custom prompt

```bash
skills/gemini-vision/scripts/describe.sh /path/to/image.jpg "Describe the humor in this meme"
```

## Output

Returns a text description of the image content.

## Example use case

When your default model (Minimax) can't process images, use this skill to get image descriptions first, then feed that text to your main model.

```bash
# Get description
description=$(skills/gemini-vision/scripts/describe.sh image.jpg)

# Use with your main model
echo "$description"
```