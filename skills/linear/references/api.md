# Linear GraphQL API Reference

**Endpoint:** `https://api.linear.app/graphql`  
**Auth:** `Authorization: <API_KEY>` (from Settings → Security)

## Queries

### User
```graphql
query {
  viewer {
    id
    name
    email
    admin
  }
}
```

### Teams
```graphql
query {
  teams {
    nodes {
      id
      name
      key
      description
    }
  }
}
```

### Team by ID
```graphql
query {
  team(id: "TEAM_UUID") {
    id
    name
    key
    states {
      nodes {
        id
        name
        type
      }
    }
  }
}
```

### Issues
```graphql
query {
  issues(
    filter: {
      state: { type: { in: ["started", "unstarted"] } }
    }
  ) {
    nodes {
      id
      identifier
      title
      description
      state {
        id
        name
        type
      }
      assignee {
        id
        name
      }
      team {
        id
        name
      }
      createdAt
      updatedAt
      url
    }
  }
}
```

### Issue by ID
```graphql
query {
  issue(id: "ISSUE-123") {
    id
    identifier
    title
    description
    state {
      name
    }
    assignee {
      name
      email
    }
    team {
      name
    }
    comments {
      nodes {
        id
        body
        user {
          name
        }
        createdAt
      }
    }
    url
  }
}
```

### My Assigned Issues
```graphql
query {
  assignedIssues {
    nodes {
      id
      identifier
      title
      state {
        name
      }
      team {
        name
      }
      createdAt
      url
    }
  }
}
```

## Mutations

### Create Issue
```graphql
mutation {
  issueCreate(input: {
    title: "Issue Title"
    description: "Markdown description"
    teamId: "TEAM_UUID"
    assigneeId: "USER_UUID"  # optional
    stateId: "STATE_UUID"     # optional
    priority: 1               # 0=none, 1=urgent, 2=high, 3=normal, 4=low
  }) {
    success
    issue {
      id
      identifier
      url
    }
  }
}
```

### Update Issue
```graphql
mutation {
  issueUpdate(
    id: "ISSUE-123",
    input: {
      title: "New Title"
      stateId: "STATE_UUID"
      assigneeId: "USER_UUID"
      priority: 2
    }
  ) {
    success
    issue {
      id
      identifier
      state {
        name
      }
    }
  }
}
```

### Add Comment
```graphql
mutation {
  commentCreate(input: {
    issueId: "ISSUE_UUID"
    body: "Comment text"
  }) {
    success
    comment {
      id
      body
      user {
        name
      }
    }
  }
}
```

## Filters

### By State Type
```graphql
query {
  issues(filter: { state: { type: { eq: "started" } } }) {
    nodes { id title }
  }
}
```

### By Team
```graphql
query {
  issues(filter: { team: { id: { eq: "TEAM_UUID" } } }) {
    nodes { id title }
  }
}
```

### By Assignee
```graphql
query {
  issues(filter: { assignee: { id: { eq: "USER_UUID" } } }) {
    nodes { id title }
  }
}
```

### Search
```graphql
query {
  issueSearch(query: "search terms") {
    nodes {
      id
      identifier
      title
      url
    }
  }
}
```

## State Types

- `backlog` - Not started
- `unstarted` - Todo
- `started` - In progress
- `completed` - Done
- `canceled` - Canceled

## SDK

The [Linear SDK](https://www.npmjs.com/package/@linear/sdk) is recommended for TypeScript projects:

```bash
npm install @linear/sdk
```

```typescript
import { LinearClient } from "@linear/sdk";
const linear = new LinearClient({ apiKey: "YOUR_KEY" });
```

## Explorer

Use [Apollo Studio](https://studio.apollographql.com/public/Linear-API/variant/current/home) to explore the schema interactively.
