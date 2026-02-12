# Roleplay Agent Creator Skill

Create custom roleplay agents with character profiles and Deepseek model.

## Overview

This skill helps you build character profiles through interactive questions, then creates dedicated agents for immersive roleplay scenarios.

## Usage

```bash
# Create a new roleplay agent
roleplay create

# This will:
# 1. Ask you questions about the character
# 2. Build a customized system prompt
# 3. Create the agent configuration
# 4. Output the config to add to openclaw.json
```

## Process

1. **Character Profile** - Answer questions about:
   - Character name and species
   - Personality traits
   - Physical description
   - Setting/world
   - Relationship to player
   - Specific kinks/preferences (optional)

2. **System Prompt Generation** - The skill builds a custom system prompt based on your answers + the RPMaster base template

3. **Agent Creation** - Outputs configuration for a new agent using:
   - Custom system prompt
   - Deepseek model
   - Isolated session

## Agent Configuration

After running `roleplay create`, you'll receive a config snippet to add to your `openclaw.json` under `agents.list`:

```json
{
  "id": "rp-[character-name]",
  "name": "[Character Name]",
  "model": "deepseek/deepseek-chat",
  "identity": {
    "name": "[Character Name]",
    "theme": "[Theme]"
  }
}
```

## Requirements

- Deepseek API key configured (or use via OpenRouter)
- OpenClaw config write access

## Notes

- Each roleplay agent runs in isolation
- Agents are configured to use Deepseek specifically
- Character profiles are saved to `memory/roleplay-characters/[name].md`
