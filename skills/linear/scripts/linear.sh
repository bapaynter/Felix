#!/bin/bash
# Linear CLI Wrapper
# Usage: linear [command] [options]

set -e

LINEAR_API_KEY="${LINEAR_API_KEY:-}"
ENDPOINT="https://api.linear.app/graphql"

if [ -z "$LINEAR_API_KEY" ]; then
    echo "Error: LINEAR_API_KEY not set"
    echo "Get your key from: https://linear.app/settings/account/security"
    exit 1
fi

# GraphQL query function
query() {
    local q="$1"
    curl -fsSL \
        -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: $LINEAR_API_KEY" \
        --data "{\"query\": \"$q\"}" \
        "$ENDPOINT" 2>/dev/null | jq '.'
}

# Commands
cmd="${1:-help}"

shift || true

case "$cmd" in
    me)
        query 'query { viewer { id name email } }' | jq '.data.viewer'
        ;;
    
    teams)
        query 'query { teams { nodes { id name key description } } }' | jq '.data.teams.nodes[]'
        ;;
    
    issues)
        FILTER=""
        while [ $# -gt 0 ]; do
            case "$1" in
                --team)
                    FILTER="filter: { team: { id: { eq: \"$2\" } } }"
                    shift 2
                    ;;
                --assigned)
                    query 'query { viewer { assignedIssues { nodes { id identifier title state { name } team { name } createdAt url } } } }' | jq '.data.viewer.assignedIssues.nodes[]'
                    exit 0
                    ;;
                *)
                    shift
                    ;;
            esac
        done
        
        if [ -n "$FILTER" ]; then
            query "query { issues($FILTER) { nodes { id identifier title state { name } assignee { name } team { name } createdAt url } } }" | jq '.data.issues.nodes[]'
        else
            query 'query { issues { nodes { id identifier title state { name } assignee { name } team { name } createdAt url } } }' | jq '.data.issues.nodes[]'
        fi
        ;;
    
    issue)
        ISSUE_ID="${1:-}"
        if [ -z "$ISSUE_ID" ]; then
            echo "Usage: linear issue ISSUE-123"
            exit 1
        fi
        query "query { issue(id: \"$ISSUE_ID\") { id identifier title description state { name } assignee { name email } team { name } createdAt updatedAt url } }" | jq '.data.issue'
        ;;
    
    search)
        QUERY="${1:-}"
        if [ -z "$QUERY" ]; then
            echo "Usage: linear search 'query terms'"
            exit 1
        fi
        query "query { issueSearch(query: \"$QUERY\") { nodes { id identifier title state { name } assignee { name } url } } }" | jq '.data.issueSearch.nodes[]'
        ;;
    
    create)
        TITLE="${1:-}"
        TEAM_ID=""
        DESCRIPTION=""
        
        shift || true
        while [ $# -gt 0 ]; do
            case "$1" in
                --team)
                    TEAM_ID="$2"
                    shift 2
                    ;;
                --description)
                    DESCRIPTION="$2"
                    shift 2
                    ;;
                *)
                    shift
                    ;;
            esac
        done
        
        if [ -z "$TITLE" ] || [ -z "$TEAM_ID" ]; then
            echo "Usage: linear create 'Title' --team TEAM_ID [--description 'Description']"
            exit 1
        fi
        
        # Escape quotes for JSON
        TITLE_ESC=$(echo "$TITLE" | sed 's/"/\\"/g')
        DESC_ESC=$(echo "$DESCRIPTION" | sed 's/"/\\"/g')
        
        query "mutation { issueCreate(input: { title: \"$TITLE_ESC\" description: \"$DESC_ESC\" teamId: \"$TEAM_ID\" }) { success issue { id identifier url } } }" | jq '.data.issueCreate'
        ;;
    
    update)
        ISSUE_ID="${1:-}"
        shift || true
        
        if [ -z "$ISSUE_ID" ]; then
            echo "Usage: linear update ISSUE-123 [--state STATE_ID] [--assignee USER_ID]"
            exit 1
        fi
        
        INPUT=""
        while [ $# -gt 0 ]; do
            case "$1" in
                --state)
                    INPUT="${INPUT} stateId: \"$2\""
                    shift 2
                    ;;
                --assignee)
                    INPUT="${INPUT} assigneeId: \"$2\""
                    shift 2
                    ;;
                *)
                    shift
                    ;;
            esac
        done
        
        query "mutation { issueUpdate(id: \"$ISSUE_ID\", input: { $INPUT }) { success issue { id identifier state { name } } } }" | jq '.data.issueUpdate'
        ;;
    
    help|*)
        cat << 'EOF'
Linear CLI

Commands:
  me                    Show authenticated user
  teams                 List all teams
  issues                List issues [--team TEAM_ID] [--assigned]
  issue ISSUE-123       Get issue details
  search 'query'        Search issues
  create 'Title'        Create issue --team TEAM_ID [--description '...']
  update ISSUE-123      Update issue [--state STATE_ID] [--assignee USER_ID]

Environment:
  LINEAR_API_KEY        Required. From https://linear.app/settings/account/security

Examples:
  linear me
  linear teams
  linear issues --assigned
  linear issue CLI-42
  linear create "Fix bug" --team "9cfb..." --description "Details here"
EOF
        ;;
esac
