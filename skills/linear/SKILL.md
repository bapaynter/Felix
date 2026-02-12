# Linear Skill

Integration with Linear issue tracking via GraphQL API.

## Setup

Get your API key from [Linear Settings → Security](https://linear.app/settings/account/security) and add to `.openclaw-env`:

```bash
LINEAR_API_KEY=lin_api_xxxxxxxxxxxxx
```

## Usage

```bash
# List my assigned issues
linear issues --assigned

# List issues in a team
linear issues --team TEAM_ID

# Create an issue
linear create "Issue title" --team TEAM_ID --description "Description"

# Get issue details
linear issue ISSUE-123

# List teams
linear teams

# Search issues
linear search "query"
```

## GraphQL API

**Endpoint:** `https://api.linear.app/graphql`

**Auth Header:** `Authorization: <API_KEY>`

## Common Queries

### Get authenticated user
```graphql
query {
  viewer {
    id
    name
    email
  }
}
```

### List teams
```graphql
query {
  teams {
    nodes {
      id
      name
      key
    }
  }
}
```

### List issues
```graphql
query {
  issues {
    nodes {
      id
      identifier
      title
      state {
        name
      }
      assignee {
        name
      }
      createdAt
    }
  }
}
```

### Create issue
```graphql
mutation {
  issueCreate(input: {
    title: "Title"
    description: "Description"
    teamId: "TEAM_ID"
  }) {
    success
    issue {
      id
      identifier
    }
  }
}
```

### Update issue
```graphql
mutation {
  issueUpdate(id: "ISSUE-123", input: {
    stateId: "STATE_ID"
  }) {
    success
    issue {
      id
      state {
        name
      }
    }
  }
}
```

## Documentation

See `references/api.md` for full query reference.
