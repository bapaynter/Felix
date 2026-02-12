#!/bin/bash
# Todoist CLI wrapper using v1 Sync API (the working API)
# Docs: https://developer.todoist.com/api/v1/

API_TOKEN="${TODOIST_API_TOKEN:-}"
BASE_URL="https://api.todoist.com/api/v1"

if [ -z "$API_TOKEN" ]; then
    echo "Error: TODOIST_API_TOKEN not set" >&2
    exit 1
fi

# Generate UUID for commands (using Python since uuidgen not available)
generate_uuid() {
    python3 -c "import uuid; print(str(uuid.uuid4()))"
}

# Command dispatcher
case "${1:-}" in
    projects|list-projects|lp)
        response=$(curl -s -X POST "${BASE_URL}/sync" \
            -H "Authorization: Bearer $API_TOKEN" \
            -H "Content-Type: application/x-www-form-urlencoded" \
            -d "sync_token=*" \
            -d "resource_types=%5B%22projects%22%5D")
        echo "$response" | jq -r '.projects[] | "\(.id) | \(.name)"'
        ;;
    
    tasks|list-tasks|lt)
        project_id="${2:-}"
        response=$(curl -s -X POST "${BASE_URL}/sync" \
            -H "Authorization: Bearer $API_TOKEN" \
            -H "Content-Type: application/x-www-form-urlencoded" \
            -d "sync_token=*" \
            -d "resource_types=%5B%22items%22%5D")
        if [ -n "$project_id" ]; then
            echo "$response" | jq -r ".items[] | select(.project_id == \"$project_id\") | \"\(.id) | \(.content)\""
        else
            echo "$response" | jq -r '.items[] | "\(.id) | \(.content)"'
        fi
        ;;
    
    create|add)
        content="${2:-}"
        project_id="${3:-}"
        due="${4:-}"
        
        if [ -z "$content" ]; then
            echo "Usage: $0 create 'task content' [project_id] [due_date]" >&2
            exit 1
        fi
        
        temp_id="temp-$(date +%s)"
        uuid=$(generate_uuid)
        
        # Build command JSON using Python
        cmd_json=$(python3 -c "
import json, sys
args = {'content': '$content', 'project_id': '$project_id'}
if '$due':
    args['due_date'] = '$due'
cmd = {'type': 'item_add', 'temp_id': '$temp_id', 'uuid': '$uuid', 'args': args}
print(json.dumps([cmd]))
")
        
        response=$(curl -s -X POST "${BASE_URL}/sync" \
            -H "Authorization: Bearer $API_TOKEN" \
            -H "Content-Type: application/x-www-form-urlencoded" \
            -d "commands=$(echo "$cmd_json" | jq -sRr @uri)")
        
        temp_mapping=$(echo "$response" | jq -r ".temp_id_mapping[\"$temp_id\"] // \"unknown\"")
        echo "Created: $temp_mapping | $content"
        ;;
    
    complete|done|close)
        task_id="${2:-}"
        if [ -z "$task_id" ]; then
            echo "Usage: $0 complete <task_id>" >&2
            exit 1
        fi
        
        temp_id="temp-$(date +%s)"
        uuid=$(generate_uuid)
        
        cmd_json=$(python3 -c "
import json, sys
cmd = {'type': 'item_close', 'temp_id': '$temp_id', 'uuid': '$uuid', 'args': {'id': '$task_id'}}
print(json.dumps([cmd]))
")
        
        response=$(curl -s -X POST "${BASE_URL}/sync" \
            -H "Authorization: Bearer $API_TOKEN" \
            -H "Content-Type: application/x-www-form-urlencoded" \
            -d "commands=$(echo "$cmd_json" | jq -sRr @uri)")
        
        echo "Completed: $task_id"
        ;;
    
    help|--help|-h|*)
        cat << 'EOF'
Todoist CLI v1 - Usage:

  projects, lp                    List all projects
  tasks, lt [project_id]          List tasks (optionally filter by project)
  create, add 'content' [pid] [due]  Create a new task
  complete, done <task_id>        Mark task as complete

Project IDs:
  - AI Tasks: 6fxHh9H9JGJv7V65
  - TV Shows Watchlist: 6fxpQcCrqwRXCwVw
  - Movies Watchlist: 6fxpQchM4gJfWHwP

Examples:
  todoist create "Buy milk"
  todoist create "Important task" 6fxHh9H9JGJv7V65 tomorrow
  todoist lt 6fxHh9H9JGJv7V65
  todoist done 98765432
EOF
        ;;
esac