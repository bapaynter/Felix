# Todoist REST API v2 Reference

## Base URL
```
https://api.todoist.com/rest/v2
```

## Authentication
All requests require an `Authorization: Bearer TOKEN` header.

## Endpoints

### Projects

#### List Projects
```http
GET /projects
```
Response: Array of Project objects

#### Get Project
```http
GET /projects/{id}
```

#### Create Project
```http
POST /projects
Content-Type: application/json

{
  "name": "Project Name",
  "parent_id": null,
  "color": "red",
  "is_favorite": false
}
```

Colors: `berry_red`, `red`, `orange`, `yellow`, `olive_green`, `lime_green`, `green`, `mint_green`, `teal`, `sky_blue`, `light_blue`, `blue`, `grape`, `violet`, `lavender`, `magenta`, `salmon`, `charcoal`, `grey`, `taupe`

### Tasks

#### List Tasks
```http
GET /tasks
GET /tasks?project_id={id}
GET /tasks?filter=today
```

#### Get Task
```http
GET /tasks/{id}
```

#### Create Task
```http
POST /tasks
Content-Type: application/json

{
  "content": "Task name",
  "description": "Details",
  "project_id": "123",
  "section_id": "456",
  "parent_id": "789",
  "order": 1,
  "labels": ["urgent", "work"],
  "priority": 2,
  "due_string": "tomorrow",
  "due_date": "2025-02-10",
  "due_datetime": "2025-02-10T10:00:00",
  "assignee_id": "user_id"
}
```

#### Update Task
```http
POST /tasks/{id}
Content-Type: application/json
```
Same fields as Create Task.

#### Complete Task
```http
POST /tasks/{id}/close
```

#### Uncomplete Task
```http
POST /tasks/{id}/reopen
```

#### Delete Task
```http
DELETE /tasks/{id}
```

## Data Types

### Task Object
```json
{
  "id": "12345",
  "project_id": "67890",
  "section_id": null,
  "content": "Task name",
  "description": "Details",
  "completed": false,
  "label_ids": [],
  "priority": 2,
  "comment_count": 0,
  "creator_id": "11111",
  "created_at": "2025-02-09T10:00:00.000000Z",
  "due": {
    "date": "2025-02-10",
    "datetime": "2025-02-10T10:00:00",
    "string": "tomorrow",
    "lang": "en"
  },
  "url": "https://todoist.com/showTask?id=12345"
}
```

### Project Object
```json
{
  "id": "12345",
  "name": "My Project",
  "comment_count": 0,
  "order": 1,
  "color": "red",
  "is_shared": false,
  "is_favorite": false,
  "is_inbox_project": false,
  "is_team_inbox": false,
  "view_style": "list",
  "url": "https://todoist.com/showProject?id=12345",
  "parent_id": null
}
```

## Natural Language Due Dates

- `today`, `tomorrow`
- `Monday`, `next Monday`
- `in 2 days`, `in 3 weeks`
- `Feb 15`, `2025-02-15`
- `every day`, `every week`, `every month`
- `every Monday`, `every 2 weeks`
