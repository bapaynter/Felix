# Rotating Heartbeat Check System

This file defines the rotating heartbeat check system. Each heartbeat wakes the agent, which runs ONE check based on what's most overdue.

## How It Works

1. Agent reads this file and runs: `bin/heartbeat-runner.mjs`
2. Runner calculates which check is most overdue (respecting time windows)
3. Runner executes that check directly (no LLM - fast & cheap)
4. Runner updates `memory/heartbeat-state.json`
5. Runner reports findings, or returns `HEARTBEAT_OK`

## Manual Check (for testing)

```bash
# Run the heartbeat runner manually
node bin/heartbeat-runner.mjs
```

## Check Definitions

| Check | Interval | Active Hours | Command/Action |
|-------|----------|--------------|----------------|
| **email** | 5 min | 9 AM - 9 PM | `gog gmail search` + auto-sort (`node bin/ai-sort-emails.mjs`) |
| **calendar-reminders** | 1440 min | 6 AM UTC only | Setup daily reminder crons (`bin/calendar-reminders.mjs`) |
| **todoist** | 30 min | 24/7 | v1 Sync API (`/api/v1/sync`) |
| **git_status** | 24 hours | 24/7 | **DISABLED** - No longer needed (dedicated machine) |
| **git_update** | 2 hours | 24/7 | Smart sync with important change detection |
| **proactive_scans** | 24 hours | 3 AM only | **REPLACED** by autonomous health monitoring |

## Time Window Logic

- Checks with `activeHours` only run during those hours
- Outside active hours, that check is skipped in rotation
- If no checks are due, return `HEARTBEAT_OK`

## Check Details

### Email Check
- Fetch unread emails via gog CLI
- Alert if: urgent emails, mentions, or >5 unread
- Use: `gog gmail search 'in:inbox is:unread' --max 10`
- **Always run AI sorting** after fetching emails - `node bin/ai-sort-emails.mjs`
- Sorting removes emails from INBOX and applies labels (Dev, Support, Internal, Personal, GitHub, GhostInspector)

### Email Sorting (AI-Powered)
Automatically runs after every email check:
```bash
node bin/ai-sort-emails.mjs
```
Categories:
- **Dev** — Code reviews, CI/CD, deployments, technical infrastructure
- **Support** — Customer tickets, Crisp, vendor support
- **Internal** — Team comms, HR, lunch, compliance
- **Personal** — Security, newsletters, promotions, personal notifications
- **GitHub** — GitHub notifications, PRs, commits, issues
- **GhostInspector** — Test results, automation alerts

Uses Gemini Flash (cheap model via OpenRouter) for categorization. Falls back to pattern matching if no API key.

### Calendar Check
- **REMOVED** - Superseded by calendar-reminders check
- The midnight setup now handles all calendar reminders efficiently

### Calendar Reminders (Daily Setup)
- Runs once daily at **6 AM UTC** (midnight your time, GMT-6)
- Queries Google Calendar for the full day (midnight-midnight, your timezone)
- Deduplicates events by title + start time
- Creates reminder cron jobs for each unique event:
  - 1 hour before event start
  - Sends reminder directly to chat (no agent wake-up)
- Cron jobs are isolated sessions with `delivery.mode="announce"`
- Cleanup: Old reminder crons are removed before creating new ones
- Script: `bin/calendar-reminders.mjs`

### Todoist Check
- List due/overdue tasks via v1 Sync API
- Alert if: tasks due within 1 day (or overdue)
- **AI Work Tasks**: Check the "AI Tasks" project (ID 6fxHh9H9JGJv7V65) proactively
- If tasks exist: pick one, review context, ask user for approval, then execute
- Use: `curl -X POST "https://api.todoist.com/api/v1/sync" -d "sync_token=*" -d "resource_types=%5B%22items%22%5D"`
- **Script**: `skills/todoist/scripts/todoist.sh tasks 6fxHh9H9JGJv7V65`

### AI Work Task Workflow (Proactive)
1. Heartbeat runs Todoist check on AI Tasks project
2. If tasks exist → pick the most relevant/urgent one
3. Agent investigates context (check repos, branches, etc.)
4. Agent presents task + plan to user for approval
5. User approves → agent executes task via Todoist v1 API
6. Agent reports back completion

### Todoist v1 API
- **Base URL**: `https://api.todoist.com/api/v1/sync`
- **Project IDs**:
  - AI Tasks: `6fxHh9H9JGJv7V65`
  - TV Shows Watchlist: `6fxpQcCrqwRXCwVw`
  - Movies Watchlist: `6fxpQchM4gJfWHwP`
- **Task status**: `checked` (not `is_completed`)

### Git Status Check
- **DISABLED** - No longer needed (dedicated machine, no human conflicts)

### Git Update Check (Smart Sync)
- Pull latest changes from all repos with intelligence:
  - `~/workspace/ion`, `~/workspace/pmk`, `~/workspace/electric_lab_vue3`, `~/workspace/pmk_js`
  - `~/workspace/pharmacy_ai_agent`, `~/workspace/provider-admin-portal`, `~/workspace/obsidian`
- **Important change detection:** Alerts on breaking changes, config updates, package bumps
- **Security monitoring:** Flags security patches and dependency updates
- **Health checks:** Alerts if repo falls >50 commits behind
- **Daily logging:** Writes activity to `memory/git-activity-YYYY-MM-DD.md`
- **Optimized:** Direct pull (no stash complexity), parallel fetch planned
- **Alerts on:** Important changes, security updates, repo health issues

### Proactive Scans
- **REPLACED** by autonomous health monitoring system
- See: Autonomous Health Monitoring section below

## Autonomous Health Monitoring

**NEW:** Health monitoring now runs autonomously via cron jobs, only waking the agent for actual problems.

### Autonomous Checks (No LLM Usage)

| Check | Frequency | Script | Alerts On |
|-------|----------|--------|-----------|
| **Critical Health** | Every 5 min | `bin/health-critical.mjs` | Disk >85%, Memory >90%, Gateway down, API failure |
| **Resource Health** | Every 30 min | `bin/health-resources.mjs` | High CPU/Memory/Load, Network issues, Zombie processes |
| **Daily Health** | 6 AM UTC | `bin/health-daily.mjs` | Repo issues, Security alerts, System summary |
| **Alert Processor** | Every 1 min | `bin/process-health-alerts.mjs` | Converts health alerts to cron jobs |

### Alert Levels
- 🔴 **Critical** - Immediate wake-up (disk full, gateway down)
- 🟡 **Warning** - Wake-up within 1 minute (high resources, network issues)
- 📊 **Summary** - Daily report at 6 AM UTC

### Token Savings
- **Before:** Agent wakes every 5-10 minutes = 144+ times/day
- **After:** Agent wakes only on problems = ~1-2 times/day
- **Savings:** ~98% reduction in monitoring tokens

### Log Files
- `memory/health-critical.log` - Critical check results
- `memory/health-resources.log` - Resource check results  
- `memory/health-daily.log` - Daily check results
- `memory/health-summary.json` - Daily health snapshot

## Overdue Calculation

```
overdue_score = (now - lastRun) / intervalMinutes
```

Highest overdue_score wins. Checks outside their active window get score = 0.

## Actionable vs HEARTBEAT_OK

**Report findings if:**
- New emails since last check
- Todoist tasks due within 1 day (or overdue)
- AI work task found → ask for approval to execute
- Proactive scan found issues

**Silent checks (never report):**
- Git status — disabled
- Git update — reports important changes and security updates

**Return HEARTBEAT_OK if:**
- No new emails, no due tasks
- No AI tasks to process
- Check ran successfully but no action needed
