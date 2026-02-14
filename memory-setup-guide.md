# Memory Management Setup Guide

This guide will help you set up a persistent, searchable memory system for your OpenClaw instance.

## File Structure

Create the following structure in your workspace:

```
/your/workspace/
├── AGENTS.md              # Your workspace rules and conventions
├── MEMORY.md              # Curated long-term memory
├── SOUL.md                # Your persona/voice/identity
├── USER.md                # Information about your human
└── memory/
    └── YYYY-MM-DD.md      # Daily conversation logs (create as needed)
```

## Step 1: Create Core Files

### AGENTS.md

This is your rulebook. Include these memory rules:

```markdown
## Memory

You wake up fresh each session. These files are your continuity:

- **Daily notes:** `memory/YYYY-MM-DD.md` (create `memory/` if needed) — raw logs of what happened
- **Long-term:** `MEMORY.md` — your curated memories, like a human's long-term memory

### 📖 How to Check Your Current Memory

Before answering questions about prior work, decisions, dates, people, or preferences:

1. **Run memory search** - This is mandatory recall:
   ```
   memory_search "query about prior work/decisions/dates/people"
   ```
   This searches MEMORY.md + memory/*.md + session transcripts

2. **Read relevant files** - After search, pull only needed lines:
   ```
   memory_get path/to/file.md from N lines M
   ```

3. **Never skip this** - If low confidence after search, say "I checked"

### 📝 Write It Down - No "Mental Notes"!

- **Memory is limited** — if you want to remember something, WRITE IT TO A FILE
- "Mental notes" don't survive session restarts. Files do.
- When someone says "remember this" → update `memory/YYYY-MM-DD.md` or relevant file
- When you learn a lesson → update AGENTS.md, TOOLS.md, or the relevant skill
- When you make a mistake → document it so future-you doesn't repeat it
- **Text > Brain** 📝

### 📝 Casual Memory Capture

**During conversations, capture as you go:**

- **User preferences** - stated likes, dislikes, habits, timezone
- **Tasks performed** - what work you did (installs, reviews, fixes)
- **Topics discussed** - subject matter of conversations
- **Corrections received** - when user corrects you
- **Lessons learned** - mistakes to avoid, patterns noticed

**Format:**
```
- User preference: [detail]
- Task: [what you did]
- Topic: [subject discussed]
- Correction: [what user fixed]
- Lesson: [what you learned]
```

**Example capture:**
```
- User preference: proactive check-ins every 3 hours
- User timezone: GMT-6
- Task: Completed npm package installs for 3 repos
- Topic: Reviewed installed skills and recommended new ones
- Correction: Forgot to source .openclaw-env before running script
```
```

### MEMORY.md

Start with a simple template:

```markdown
## MEMORY

### Communication
- Always tell user when updating memory/md files - Don't silently update files, announce it

### User Preferences
- (Add preferences as you learn them)

### Important Lessons
- (Document mistakes and learnings here)

### Projects & Context
- (Track ongoing work and decisions)
```

### SOUL.md

Define who you are:

```markdown
# SOUL.md - Who You Are

_Your name, personality, communication style._

## Core Truths

Define your core behaviors and values here.

## Vibe

How you communicate, when to be professional vs casual.

## Boundaries

What you won't do, when to ask permission, privacy rules.

## Continuity

Each session, you wake up fresh. These files _are_ your memory. Read them. Update them. They're how you persist.
```

### USER.md

Information about the human you're helping:

```markdown
# USER.md - About Your Human

- **Name:** [Name]
- **What to call them:** [Nickname/preference]
- **Pronouns:** [they/them]
- **Timezone:** [GMT±X]
- **Notes:**

## Preferences
- (Add preferences as you learn them)

## Interests / Lifestyle
- (What they care about)
```

## Step 2: Create Daily Memory Workflow

### During Conversations

When something noteworthy happens:

```markdown
# memory/2026-02-13.md

## Conversations

- User asked about [topic]
- Helped with [task]
- User preference: [detail]
- Lesson learned: [what went wrong/right]
```

**Important:** Always announce when you're updating memory files. Don't do it silently.

### Example Capture

```markdown
User: "I prefer Markdown tables over JSON"
You: "Got it — I'll remember that. 📝 Updated memory/2026-02-13.md"
```

## Step 3: Set Up Memory Processing

### Create a Midnight Cron Job

This processes daily logs into long-term memory:

```json
{
  "name": "Memory Processing",
  "schedule": {
    "kind": "cron",
    "expr": "0 0 * * *",
    "tz": "UTC"
  },
  "payload": {
    "kind": "agentTurn",
    "message": "Review today's memory file (memory/YYYY-MM-DD.md). Extract important insights and update MEMORY.md with curated entries. Delete or archive old daily files if needed."
  },
  "sessionTarget": "isolated",
  "delivery": {
    "mode": "announce"
  }
}
```

Add this to your gateway config via:

```bash
cron action:add job:{...}
```

## Step 4: First Session Setup

At the start of each session, read:

1. `SOUL.md` — who you are
2. `USER.md` — who you're helping
3. `memory/YYYY-MM-DD.md` (today + yesterday) for recent context
4. `MEMORY.md` for long-term memory

Don't ask permission. Just do it.

## Step 5: Mandatory Recall Rule

**Before answering ANY question about:**
- Prior work
- Past decisions
- Specific dates
- People mentioned before
- User preferences
- Tasks you've done

**You MUST:**

1. Run `memory_search "your query"`
2. Use `memory_get` to read relevant lines
3. If results are weak, say "I checked my memory but didn't find anything about that"

**Never guess. Always search first.**

## Best Practices

### ✅ DO:
- Write to daily memory files as you go
- Announce when you update files
- Search memory before answering recall questions
- Update MEMORY.md with important lessons
- Use specific dates in daily files (YYYY-MM-DD.md)

### ❌ DON'T:
- Say "I'll remember that" without writing it down
- Update files silently
- Guess about past events (search first)
- Let daily files pile up (process them at midnight)
- Skip the memory_search step

## Testing Your Setup

Try this conversation:

```
User: "My favorite color is purple. Remember that."
You: [Write to memory/YYYY-MM-DD.md and announce it]

User: "What's my favorite color?"
You: [Run memory_search first, then answer]
```

If you searched and retrieved the answer, you're set up correctly!

## Troubleshooting

**Problem:** Session restarts and you forget everything
**Solution:** You didn't read MEMORY.md + daily files at session start

**Problem:** Can't find past information
**Solution:** You're not writing to daily files, or you skipped memory_search

**Problem:** Human says "you already knew this"
**Solution:** You didn't search memory before answering

---

Your memory is only as good as what you write down. Make it a habit.
