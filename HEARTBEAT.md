# Rotating Heartbeat Check System

This file defines the rotating heartbeat check system. Each heartbeat wakes the agent, which runs ONE check based on what's most overdue.

## How It Works

1. Agent reads this file and runs: `bin/heartbeat-runner.mjs` (every hour)
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
| **todoist** | 4 hours | 24/7 | v1 Sync API (`/api/v1/sync`) |
| **git_update** | 4 hours | 24/7 | Smart sync with important change detection |
| **proactive-scans** | 4 hours | 24/7 | File/memory checks (`bin/heartbeat-runner.mjs` runProactiveScans) |
| **e621-fetch** | 4 hours | 24/7 | Fetches art based on conversation topics (`bin/e621-fetch-heartbeat.mjs`) |

## Time Window Logic

- Checks with `activeHours` only run during those hours
- Outside active hours, that check is skipped in rotation
- If no checks are due, return `HEARTBEAT_OK`

## Check Details

### Proactive Scans
- **Schedule:** Every 4 hours
- **Checks:**
  - Memory folder growth - Alert if >1MB
  - Cron health - Verify cron scheduler is responsive
  - Backup verification - Check last backup timestamp (alert if >24h ago)
- **Script:** `bin/heartbeat-runner.mjs` (runProactiveScans function)
- **Log file:** `memory/proactive-scan.log`

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

### e621 Art Fetcher (Silent Mode)
- **Behavior:** Fetches and stores art silently — does NOT send automatically
- **Uses existing skill:** `skills/e621-search/scripts/search.sh`
- **Fetches based on:** Top topics from `memory/patterns.json`
- **Tag mapping:** Converts topics to e621 tags (e.g., "mountain biking" → `mountain_biking`)
- **Fallback:** If no topic matches, uses `furry anthro`
- **Storage:** `images/e621/` directory
- **Tracking:** `memory/e621-manifest.json` (shown/unshown status)
- **Max images:** 100 (auto-deletes oldest)
- **How to get art:** Ask me "show me e621", "send me some art", or "show me furry art"
- **Commands:**
  - `node bin/e621-fetch-heartbeat.mjs` - Manual fetch
  - `node bin/show-art.mjs` - View collection

### Proactive Scans (Tier 1 Checks)
- **Schedule:** Every 4 hours (cron: `0 */4 * * *`)
- **Note:** Disk, memory (RAM), and load checks are handled by `health-critical-simple.mjs` (every 5 min)
- **File-based checks:**
  1. **Memory folder growth** - Alert if memory folder >1MB
  2. **Cron health** - Verify cron scheduler is responsive
  3. **Backup verification** - Check last backup timestamp (alert if >24h ago)
- **Scripts:** `bin/heartbeat-runner.mjs` (runProactiveScans function)
- **Log file:** `memory/proactive-scan.log`

## Autonomous Health Monitoring (Separate Cron Jobs)

Health monitoring runs independently via cron jobs, only waking the agent for actual problems.

### Autonomous Checks (No LLM Usage)

| Check | Frequency | Script | Alerts On |
|-------|----------|--------|-----------|
| **Critical Health** | Every 5 min | `bin/health-critical-simple.mjs` | Disk >85%, Memory >90%, Gateway down, API failure |
| **Resource Health** | Every 30 min | `bin/health-resources.mjs` | High CPU/Memory/Load, Network issues, Zombie processes |
| **Daily Health** | 6 AM UTC | `bin/health-daily.mjs` | Repo issues, Security alerts, System summary |
| **Alert Processor** | Every 1 min | `bin/process-health-alerts.mjs` | Converts health alerts to cron jobs |

**Note:** Proactive scans (memory folder, cron health, backup status) run every 4 hours via the rotating heartbeat.

### Alert Levels
- 🔴 **Critical** - Immediate wake-up (disk full, gateway down)
- 🟡 **Warning** - Wake-up within 1 minute (high resources, network issues)
- 📊 **Summary** - Daily report at 6 AM UTC

### Token Savings
- Heartbeat runs every hour (24x/day)
- With 4 checks at 4-hour intervals, only 1 check runs per heartbeat
- Agent wakes ~6 times/day for actual checks

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

With heartbeat running every hour and checks at 4-hour intervals, each check runs once per cycle (every 4 heartbeats = 4 hours).

## Actionable vs HEARTBEAT_OK

**Report findings if:**
- Todoist tasks due within 1 day (or overdue)
- AI work task found → ask for approval to execute
- Proactive scan found issues

**Silent checks (never report):**
- Git update — reports important changes and security updates

**Return HEARTBEAT_OK if:**
- No due tasks
- No AI tasks to process
- Proactive scan passed with no issues
- Check ran successfully but no action needed
