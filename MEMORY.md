## MEMORY

### Communication
- **Always tell user when updating memory/md files** - Don't silently update files, announce it
- Convert times to user's timezone (GMT-6) when displaying calendar events
- **Send files directly** - Don't just list paths, use `message` tool with `path` to send the actual file to the user

### Coding Tasks
- **Use opencode-controller skill** - Installed at `/home/pi/.openclaw/workspace/skills/opencode-controller`
- Run via skill framework for structured workflow (Plan → Build)
- For simple tasks: `opencode run "..." -m openrouter/anthropic/claude-sonnet-4.5`
- Opencode is slower but much better for accuracy and surgical changes
- Avoid sed/awk/bulk replacements - use opencode for ALL coding tasks

### Todoist (v1 API)
- **API:** `https://api.todoist.com/api/v1/sync` (POST with commands array)
- **Script:** `/home/pi/.openclaw/workspace/skills/todoist/scripts/todoist.sh`
- **Project IDs:**
  - AI Tasks: `6fxHh9H9JGJv7V65`
  - TV Shows Watchlist: `6fxpQcCrqwRXCwVw`
  - Movies Watchlist: `6fxpQchM4gJfWHwP`
- **Task format:** Use commands array in sync endpoint
- **Example create:** `{"type":"item_add","temp_id":"temp-123","uuid":"uuid","args":{"content":"Task","project_id":"..."}}`
- **Task status:** `checked` (not `is_completed`)

### AI Work Tasks
- AI Work Project ID: `6fxHh9H9JGJv7V65` (v1 format)
- When AI tasks detected: investigate context first (check repos, branches, etc.)
- Present plan for approval before executing
- Be surgical - only modify what's needed
- Complete via Todoist API when done
- User wants proactive memory capture during conversations
- User prefers check-ins every 3 hours (updated from 8h)
- User wants casual details captured in daily memory file
- User wants midnight UTC cron for memory processing (6 PM their time)
- User wants me to be more proactive about remembering things
- User likes explicit announcements when memory files are updated
### Detected Patterns
- Active topics: memory, cleanup, health, todoist api, email sorting, memory processing, cron jobs, health monitoring
- Temporal patterns: Most active Thursdays around 17:00 UTC
- Session count: 2 sessions tracked (Feb 11-12)
- Session patterns tracked via pattern-tracker.mjs
