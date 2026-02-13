# Playwright Browser Skill

Headless browser control using Playwright for OpenClaw - with persistent browser sessions.

## Persistent Browser Mode (Recommended)

Start a browser server that stays open and accepts commands one at a time:

### For OpenClaw Agent

The agent can start a background browser session and interact with it:

```javascript
// Start browser server in background
exec({
    command: 'node /home/pi/.openclaw/workspace/skills/playwright/scripts/browser-server.js',
    background: true,
    pty: false
});

// Send commands to the running session
process({
    action: 'write',
    sessionId: '<session-id>',
    data: '{"command":"open","args":["https://example.com"]}\n'
});

// Read response
process({
    action: 'log',
    sessionId: '<session-id>',
    limit: 1
});
```

### Manual Usage

```bash
# Terminal 1: Start server
node scripts/browser-server.js

# Terminal 2: Send commands via stdin
echo '{"command":"open","args":["https://example.com"]}' | nc localhost -
echo '{"command":"title","args":[]}' | nc localhost -
echo '{"command":"type","args":["#email","user@example.com"]}' | nc localhost -
echo '{"command":"click","args":[".submit"]}' | nc localhost -
```

## Commands

All commands are JSON objects sent via stdin:

```json
{"command":"<command>","args":[...]}
```

### Navigation
- `open <url>` - Open page
- `goto <url>` - Navigate to URL

### Reading Page State
- `title` - Get page title
- `url` - Get current URL
- `content` - Get all text content
- `html` - Get full HTML
- `text <selector>` - Get text from element
- `get-value <selector>` - Get input field value
- `exists <selector>` - Check if element exists (returns true/false)
- `links` - List all links

### Interaction
- `click <selector>` - Click element
- `type <selector> <text>` - Fill input field
- `wait <selector>` - Wait for element to appear
- `eval <javascript>` - Execute JavaScript

### Utility
- `screenshot [path]` - Take screenshot (default: /tmp/playwright-screenshot.png)
- `ping` - Check server is alive
- `close` - Close browser and exit server

## Example Workflow

```javascript
// Agent opens a form
exec({ command: 'node browser-server.js', background: true });

// Navigate to page
process({ action: 'write', sessionId: 'abc', data: '{"command":"open","args":["https://site.com/form"]}\n' });

// Read current state
process({ action: 'write', sessionId: 'abc', data: '{"command":"get-value","args":["#comment"]}\n' });
// Response: {"ok":true,"result":""}

// Fill form
process({ action: 'write', sessionId: 'abc', data: '{"command":"type","args":["#comment","First draft"]}\n' });

// *** USER INPUT PAUSE HERE ***
// Agent can ask user "What should the final text be?"
// User responds: "Actually, make it say XYZ"

// Continue with user input
process({ action: 'write', sessionId: 'abc', data: '{"command":"type","args":["#comment","XYZ"]}\n' });

// Submit
process({ action: 'write', sessionId: 'abc', data: '{"command":"click","args":[".submit"]}\n' });

// Verify
process({ action: 'write', sessionId: 'abc', data: '{"command":"wait","args":[".success"]}\n' });
```

## One-Shot Session Mode

For fully automated workflows (no pauses):

```bash
node scripts/session.js "https://site.com" "type|#email|me" "click|.submit"
```

## Auto-Cleanup

- Browser closes automatically after 10 minutes of inactivity
- Responds to SIGTERM/SIGINT for graceful shutdown
- Each command resets the inactivity timer

## Requirements

- Node.js
- Playwright: `npm install playwright`
- Browser binaries: `npx playwright install chromium`
- System dependencies (already installed)