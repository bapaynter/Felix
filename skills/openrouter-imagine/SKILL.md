---
name: openrouter-imagine
description: Generate images using OpenRouter's image generation models (Gemini 3 Pro, etc.)
triggers:
- "generate image"
- "imagine"
- "make art"
- "openrouter image"
- "create image"
---

# OpenRouter Imagine

Generate images using OpenRouter's image generation models.

## How It Works

OpenRouter uses the **regular chat completions API** with `modalities` parameter — NOT a separate images endpoint. Models that support image generation have "image" in their output_modalities.

## Prerequisites

- `OPENROUTER_API_KEY` environment variable set (in `.openclaw-env`)
- `curl` and `jq` installed

## Usage

### Basic generation

```bash
# Generate with default model (gemini-2.5-flash-image)
skills/openrouter-imagine/scripts/imagine.sh "A red panda in a beanie sitting at a computer"

# With custom model
skills/openrouter-imagine/scripts/imagine.sh "Cyberpunk city at night" --model google/gemini-2.5-flash-image

# With aspect ratio and size
skills/openrouter-imagine/scripts/imagine.sh "Landscape" --aspect-ratio "16:9" --size "4K"

# Save to file
skills/openrouter-imagine/scripts/imagine.sh "Cute furry character" --output /path/to/image.png
```

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `--model` | Model to use | `google/gemini-2.5-flash-image` |
| `--aspect-ratio` | Image aspect ratio | `1:1` |
| `--size` | Image resolution | `1K` |
| `--output` | Save to file | (stdout only) |

### Aspect Ratios

| Ratio | Dimensions |
|-------|------------|
| 1:1 | 1024×1024 (default) |
| 2:3 | 832×1248 |
| 3:2 | 1248×832 |
| 3:4 | 864×1184 |
| 4:3 | 1184×864 |
| 4:5 | 896×1152 |
| 5:4 | 1152×896 |
| 9:16 | 768×1344 |
| 16:9 | 1344×768 |
| 21:9 | 1536×672 |

### Sizes

| Size | Quality |
|------|---------|
| 1K | Standard (default) |
| 2K | Higher resolution |
| 4K | Highest resolution |

## Response format

Returns JSON with:
- `image_url` - Generated image URL (data URL or remote URL)
- `revised_prompt` - The prompt used (may be modified by model)
- `model` - Model used
- `aspect_ratio` - Aspect ratio used
- `size` - Size used

## Example

```bash
$ ~/.openclaw/workspace/skills/openrouter-imagine/scripts/imagine.sh "A sleepy red panda in a beanie drinking coffee" --aspect-ratio "4:5"

{
  "image_url": "data:image/png;base64:...",
  "revised_prompt": "A sleepy red panda wearing a beanie holding a coffee cup...",
  "model": "google/gemini-2.5-flash-image",
  "aspect_ratio": "4:5",
  "size": "1K"
}
```

## Image Output

Images are returned as base64-encoded data URLs (e.g., `data:image/png;base64,...`). Use `--output` to save directly to a file.

## Available Image Models

Check OpenRouter docs or `/api/v1/models` for current options. Examples:
- `google/gemini-2.5-flash-image` - Fast Gemini image generation
- `google/gemini-3-pro-image-preview` - Higher quality Gemini
- `black-forest-labs/flux.2-pro` - Flux (if available)
- `sourceful/riverflow-v2-standard-preview` - Sourceful models

## Notes

- Uses `/api/v1/chat/completions` with `modalities: ["image", "text"]`
- Image generation may be slower than text generation
- Not all models support image generation — check output_modalities