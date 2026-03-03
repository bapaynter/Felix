#!/usr/bin/env node
/**
 * Morning Journal Prompt Script
 * Sends the 5 morning journal questions to the user
 * Triggered by cron at 13:00 UTC weekdays
 */

const MORNING_QUESTIONS = `🌅 **Good morning! Time for your journal reflection.**

1. **What was your first thought after waking up?**

2. **How was your sleep?** (duration, deep sleep, interruptions, dreams)

3. **How do you feel mentally?** (What am I excited about? What's worrying or saddening me?)

4. **What's your energy level?** (1-10 scale)

5. **How do you feel physically?** (Any pain? Taste in the mouth? What do you see? What do you hear?)

Take your time responding. When you're done, I'll analyze your entry and provide feedback.`;

async function main() {
  // Send via OpenClaw's built-in message capability
  // This script is called by cron, which injects a system event
  // The agent then sends this prompt to the user
  
  // Output the prompt so the system event handler can use it
  console.log(JSON.stringify({
    type: 'morning_journal_prompt',
    questions: MORNING_QUESTIONS,
    timestamp: new Date().toISOString()
  }));
}

main().catch(console.error);
