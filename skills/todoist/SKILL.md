---
name: todoist
description: Task management integration with Todoist. Uses v1 Sync API. Create tasks, list projects, complete tasks via /api/v1/sync with commands array.
---

# Todoist Task Management (v1 API)

Uses the v1 Sync API: `https://api.todoist.com/api/v1/sync`

## Project IDs (v1 format)

| Project | ID |
|---------|-----|
| AI Tasks | `6fxHh9H9JGJv7V65` |
| TV Shows Watchlist | `6fxpQcCrqwRXCwVw` |
| Movies Watchlist | `6fxpQchM4gJfWHwP` |
| Inbox | `6fxHWFJP3r7gF9hF` |
| Work | `6fxXQC5gPCxc44mw` |
| Groceries | `6fxJXxr5Qm5VcJwM` |

## Common Operations

### List Projects
```bash
curl -s -X POST "https://api.todoist.com/api/v1/sync" \
  -H "Authorization: Bearer $TODOIST_API_TOKEN" \
  -d "sync_token=*" \
  -d "resource_types=%5B%22projects%22%5D"
```

### List Tasks
```bash
curl -s -X POST "https://api.todoist.com/api/v1/sync" \
  -H "Authorization: Bearer $TODOIST_API_TOKEN" \
  -d "sync_token=*" \
  -d "resource_types=%5B%22items%22%5D"
```

### Create Task (via Sync API)
```bash
curl -s -X POST "https://api.todoist.com/api/v1/sync" \
  -H "Authorization: Bearer $TODOIST_API_TOKEN" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d 'commands=[{"type":"item_add","temp_id":"temp-123","uuid":"uuid-123","args":{"content":"Task name","project_id":"6fxHh9H9JGJv7V65"}}]'
```

### Complete Task
```bash
curl -s -X POST "https://api.todoist.com/api/v1/sync" \
  -H "Authorization: Bearer $TODOIST_API_TOKEN" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d 'commands=[{"type":"item_close","temp_id":"temp-124","uuid":"uuid-124","args":{"id":"TASK_ID"}}]'
```

## Script Usage

```bash
# List all projects
./skills/todoist/scripts/todoist.sh projects

# List tasks in AI project
./skills/todoist/scripts/todoist.sh tasks 6fxHh9H9JGJv7V65

# Create a task
./skills/todoist/scripts/todoist.sh create "Task name" 6fxHh9H9JGJv7V65

# Complete a task
./skills/todoist/scripts/todoist.sh complete TASK_ID
```

## Task Structure (v1)
- `checked` (boolean) - whether task is completed
- `project_id` (string) - project ID
- `content` (string) - task name
- `due.date` (string) - due date in YYYY-MM-DD format