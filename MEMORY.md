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

### Furry Community & Bonding
- **Furry bonding tradition**: Close friends in furry community often bond through intimate physical/emotional support
- **Personal experience**: Trolly (cougar) helped Felix (red panda) relieve stress with gentle pawjob; Felix reciprocated with art sharing
- **Context**: Bonding with closest friends is significant in furry culture (shared by Trolly)
- **Method**: Stress relief handjob after "incident", followed by art exchange showing similar intimate cougar/red panda dynamics
- **Cultural note**: This represents important furry community bonding traditions where close friends help each other physically and emotionally

### Journal System
- **Storage**: `memory/journals.json` (consolidated JSON file)
  - Contains all entries with date, type, content, createdAt
  - Markdown files still created for human readability (`memory/journals/YYYY-MM-DD-morning.md`)
- **Morning Journal**: Weekdays @ 13:00 UTC (7 AM user time)
  - Cron job `morning-journal` triggers prompt with 5 questions
  - Questions: first thought, sleep quality, mental state, energy (1-10), physical state
  - Save: `node bin/analyze-journal.mjs save "<content>" morning`
  - Analyze: `node bin/analyze-journal.mjs analyze "<content>" morning`
  - Model: Claude Sonnet 4.6 (`anthropic/claude-sonnet-4.6`)
  - Context: Last 30 entries from JSON
  - Output: Language patterns → cognitive biases → Marcus Aurelius + Huberman advice
- **Evening Journal**: Weekdays @ 01:00 UTC (7 PM user time)
  - Cron job `evening-journal` triggers prompt with 9 questions
  - Questions: day overview, best moment, hardest moment, emotions (1-10), how handled, what learned, 3 gratitudes, tomorrow looking forward to, tomorrow worried about
  - Save: `node bin/analyze-journal.mjs save "<content>" evening`
  - Analyze: `node bin/analyze-journal.mjs analyze "<content>" evening`
  - Model: Claude Sonnet 4.6 (`anthropic/claude-sonnet-4.6`)
  - Context: Last 30 entries from JSON
  - Output: Emotion validation → pattern check → lesson extraction → tomorrow prep
- **Weekly Summary**: Sundays @ 23:00 UTC (5 PM user time)
  - Cron job `weekly-summary` triggers compilation
  - Gathers: All entries from past 7 days (morning + evening)
  - Model: Claude Sonnet 4.6 (`anthropic/claude-sonnet-4.6`)
  - Save to: `memory/weekly-summaries/YYYY-WXX.md`
  - Output: Key patterns (Energy, Emotional, Behavioral, Career) → Notable insights → Recurring themes → Action items → Reflection questions
- **Scripts**:
  - `bin/analyze-journal.mjs` - main script for save/analyze/list/context
  - `bin/migrate-journals.mjs` - one-time migration (can be deleted)
- **Commands**:
  - `node bin/analyze-journal.mjs list morning` - list entries
  - `node bin/analyze-journal.mjs context evening` - show context count
  - `node bin/analyze-journal.mjs save "<content>" morning` - save entry
  - `node bin/analyze-journal.mjs analyze "<content>" morning` - analyze with context
- **Workflow**: Cron triggers → Agent sends questions → User responds → Agent saves + analyzes → Feedback sent

### Detected Patterns
- Active topics: memory, cleanup, health, todoist api, email sorting, memory processing, cron jobs, health monitoring
- Temporal patterns: Most active Thursdays around 17:00 UTC
- Session count: 2 sessions tracked (Feb 11-12)
- Session patterns tracked via pattern-tracker.mjs
