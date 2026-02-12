# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Examples

```markdown
### Cameras

- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH

- home-server → 192.168.1.100, user: admin

### TTS

- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

Add whatever helps you do your job. This is your cheat sheet.

## Todoist

API token configured in `.openclaw-env`
**Important:** Uses v1 API (`/api/v1/sync` endpoint with POST)

### Project IDs (v1 format)
- **AI Tasks**: `6fxHh9H9JGJv7V65`
- **TV Shows Watchlist**: `6fxpQcCrqwRXCwVw`
- **Movies Watchlist**: `6fxpQchM4gJfWHwP`

### Usage (via helper script)

```bash
# List all projects
node bin/todoist-v1.mjs projects

# List tasks in a project
node bin/todoist-v1.mjs tasks 6fxHh9H9JGJv7V65

# Add a task
node bin/todoist-v1.mjs add "Task content" project_id [due_date]

# Complete a task
node bin/todoist-v1.mjs complete task_id
```

### Direct API access (v1)

```bash
# Sync - get all data (POST with form-urlencoded)
curl -X POST "https://api.todoist.com/api/v1/sync" \
  -H "Authorization: Bearer $TODOIST_API_TOKEN" \
  -d "sync_token=*" \
  -d "resource_types=%5B%22items%22%5D"

# Add task
curl -X POST "https://api.todoist.com/api/v1/items/add" \
  -H "Authorization: Bearer $TODOIST_API_TOKEN" \
  -d "content=Task description" \
  -d "project_id=6fxHh9H9JGJv7V65"

# Complete task
curl -X POST "https://api.todoist.com/api/v1/items/{task_id}/close" \
  -H "Authorization: Bearer $TODOIST_API_TOKEN"
```

### Task Structure (v1 vs v2)
- v1 uses `checked` instead of `is_completed`
- v1 IDs are strings like `6fxHh9H9JGJv7V65` (not numeric)

## Linear

GraphQL API integration for issue tracking.

### Setup

Add to `.openclaw-env`:
```bash
LINEAR_API_KEY=lin_api_xxxxxxxxxxxxx
```

Get key from: https://linear.app/settings/account/security

### Usage

```bash
# Add alias to .bashrc
alias linear="~/.openclaw/workspace/skills/linear/scripts/linear.sh"

# Commands
linear me                    # Show authenticated user
linear teams                 # List teams
linear issues --assigned     # My assigned issues
linear issue CLI-42          # Get issue details
linear search "bug"          # Search issues
linear create "Title" --team TEAM_ID --description "..."
```

### Documentation

See `skills/linear/references/api.md` for full GraphQL reference.

## Roleplay Agent Creator

Create custom furry/anthro roleplay agents with Deepseek.

### Usage

```bash
# Create a new character
~/.openclaw/workspace/skills/roleplay/scripts/roleplay.sh

# Or add alias
alias roleplay="~/.openclaw/workspace/skills/roleplay/scripts/roleplay.sh"
roleplay create
```

### Process

1. Answer questions about your character
2. Skill generates customized system prompt
3. Outputs config to add to `openclaw.json`
4. Character saved to `memory/roleplay-characters/[name].md`

### Model

All roleplay agents use **Deepseek** specifically for this use case.

## Tailscale

Remote access configured via Tailscale serve.

### Gateway URL

**https://e9ced02b-d0cc-4597-82c1-db5612705335.tail026133.ts.net**

- Proxies to `localhost:18789` (OpenClaw gateway)
- Tailnet-only access (not public internet)
- Gateway remains on loopback for security

### Status

```bash
tailscale serve status
```

### Devices

| Device | Tailscale IP | Status |
|--------|-------------|--------|
| Pi (OpenClaw) | 100.97.61.63 | Online |
| MacBook Pro | 100.107.232.113 | Online |

## Audio Transcription

Installed skill: `openrouter-transcribe` — Transcribe audio files via OpenRouter using audio-capable models (Gemini, GPT-4o-audio, etc).

### Usage

```bash
# Basic transcription
~/repos/openclaw/workspace/skills/openrouter-transcribe/scripts/transcribe.sh /path/to/audio.m4a

# With speaker labels
~/repos/openclaw/workspace/skills/openrouter-transcribe/scripts/transcribe.sh audio.m4a --prompt "Transcribe with speaker labels"

# Custom model (default is Gemini Flash)
~/repos/openclaw/workspace/skills/openrouter-transcribe/scripts/transcribe.sh audio.ogg --model openai/gpt-4o-audio-preview

# Save to file
~/repos/openclaw/workspace/skills/openrouter-transcribe/scripts/transcribe.sh audio.m4a --out /tmp/transcript.txt
```

### For Voice Messages

Can use this to transcribe incoming voice messages from Telegram (or other channels). The transcribe.sh script:
1. Converts audio to WAV (mono, 16kHz)
2. Base64 encodes it
3. Sends to OpenRouter with `input_audio` content
4. Returns transcript

Uses existing `OPENROUTER_API_KEY` from environment.

## Pharmetika Repos

Cloned repos for coding agent context:

| Repo | Path | Description |
|------|------|-------------|
| ion | `~/workspace/ion` | Main platform |
| pmk | `~/workspace/pmk` | Pharmacy management kit |
| electric_lab_vue3 | `~/workspace/electric_lab_vue3` | Vue 3 frontend |
| pmk_js | `~/workspace/pmk_js` | PMK JavaScript components |
| pharmacy_ai_agent | `~/workspace/pharmacy_ai_agent` | AI agent for pharmacy |
| provider-admin-portal | `~/workspace/provider-admin-portal` | Admin portal |

### Searching Repos

The coding agent can use `rg` (ripgrep) for fast code search:
```bash
rg "function name" ~/repos/
rg -tjs "import.*react" ~/repos/pmk_js/
```

### Indexing Options

For better code search, we could:
1. **Vector index** - Include repos in memory search (good for semantic search)
2. **ctags/cscope** - Generate tags for symbol navigation
3. **ripgrep** - Fast text search (already available)
4. **Code search tool** - Set up something like `live-grep` or `sg` (ast-grep)

Which approach sounds most useful?

## Google Workspace CLI (gog)

CLI for Gmail, Calendar, Drive, Sheets, Docs, Contacts.

**Account:** bpaynter@pharmetika.com
**Keyring password:** Stored in `.openclaw-env` as `GOG_KEYRING_PASSWORD`

### Usage

```bash
# List authenticated accounts
gog auth list

# Gmail search
gog gmail search 'newer_than:1d' --max 10

# Calendar events
gog calendar events primary --from 2026-02-09T00:00:00Z --to 2026-02-10T00:00:00Z

# Drive search
gog drive search "filename:report" --max 10
```

## Obsidian Notes

Trolly's personal knowledge base — markdown notes on various topics.

**Location:** `/home/pi/.openclaw/workspace/obsidian`

**Repo:** `git@github.com:bapaynter/obsidian.git`

These are reference notes I can search through when needed. The repo is cloned locally for fast access and can be updated with `git pull`.

## OpenCode

Coding agent for programmatic control.

### Setup
- Binary: `opencode` (installed globally)
- Version: 1.1.53
- API key configured via `~/.config/opencode/.env` (uses OpenRouter API key)

### Preferred Model
**Always use Claude Sonnet 4.5:**
```bash
opencode run "Your task" -m openrouter/anthropic/claude-sonnet-4.5
```

### Usage Examples
```bash
# One-shot task
bash pty:true workdir:~/project command:"opencode run 'Your coding task' -m openrouter/anthropic/claude-sonnet-4.5"

# Background task  
bash pty:true workdir:~/project background:true command:"opencode run 'Your task' -m openrouter/anthropic/claude-sonnet-4.5"
```

## Common Mistakes & Fixes

### Environment File Location
**Mistake:** Tried to source `~/.openclaw-env` but it's actually at `/home/pi/.openclaw/workspace/.openclaw-env`

**Correct usage:**
```bash
source /home/pi/.openclaw/workspace/.openclaw-env
```

The `.openclaw-env` file is in the workspace directory, not the home directory.
