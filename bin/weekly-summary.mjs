#!/usr/bin/env node
/**
 * Weekly Summary Script
 * Compiles journal entries from the past week and analyzes them
 */

import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';

// Load environment
config({ path: '/home/pi/.openclaw/workspace/.openclaw-env' });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const JOURNALS_DIR = '/home/pi/.openclaw/workspace/memory/journals';
const SUMMARIES_DIR = '/home/pi/.openclaw/workspace/memory/weekly-summaries';

const WEEKLY_SUMMARY_PROMPT = `Review this week's journaling entries and create a comprehensive weekly summary.

Structure:

**Week of [dates]**

**Key Patterns Observed:**
- Energy: [trends in energy levels, sleep, focus]
- Emotional: [recurring emotional states, triggers]
- Behavioral: [habits, avoidances, breakthroughs]
- Career: [strategic vs tactical time allocation]

**Notable Insights:**
- [3-5 significant realizations from this week]

**Recurring Themes:**
- [Issues or topics that appeared multiple times]

**Action Items to Consider:**
- [2-3 concrete things I might address next week]

**Questions for Deeper Reflection:**
- [1-2 questions I should sit with]

Be specific. Quote from my entries when relevant. Flag anything that seems like a pattern I'm not seeing.`;

function getWeekEntries() {
  if (!existsSync(JOURNALS_DIR)) {
    return [];
  }
  
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const files = readdirSync(JOURNALS_DIR)
    .filter(f => f.endsWith('.md'))
    .filter(f => {
      const dateStr = f.replace(/-(morning|evening)\.md$/, '');
      const fileDate = new Date(dateStr);
      return fileDate >= weekAgo && fileDate <= now;
    })
    .sort()
    .map(f => {
      const content = readFileSync(join(JOURNALS_DIR, f), 'utf-8');
      const date = f.replace('.md', '');
      return { date, content };
    });
  
  return files;
}

function getWeekNumber() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const pastDaysOfYear = (now - startOfYear) / 86400000;
  const weekNum = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function getDateRange() {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const format = (d) => d.toISOString().split('T')[0];
  return `${format(weekAgo)} to ${format(now)}`;
}

async function callOpenRouter(entries) {
  const entriesText = entries
    .map(e => `## ${e.date}\n${e.content}`)
    .join('\n\n---\n\n');
  
  const dateRange = getDateRange();
  
  const messages = [
    {
      role: 'system',
      content: `You are a thoughtful weekly reflection analyst who helps identify patterns and insights across journal entries. You provide specific, actionable feedback and are not afraid to point out patterns the writer might be missing.`
    },
    {
      role: 'user',
      content: `## Journal Entries for ${dateRange}

${entriesText || 'No entries this week.'}

---

${WEEKLY_SUMMARY_PROMPT}`
    }
  ];
  
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://openclaw.ai',
      'X-Title': 'OpenClaw Weekly Summary'
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-pro-preview',
      messages,
      temperature: 0.7
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }
  
  const data = await response.json();
  return data.choices[0].message.content;
}

function saveSummary(content) {
  if (!existsSync(SUMMARIES_DIR)) {
    mkdirSync(SUMMARIES_DIR, { recursive: true });
  }
  
  const weekId = getWeekNumber();
  const filename = `${weekId}.md`;
  const filepath = join(SUMMARIES_DIR, filename);
  
  const fullContent = `# Weekly Summary - Week of ${getDateRange()}

Generated: ${new Date().toISOString()}

---

${content}
`;
  
  writeFileSync(filepath, fullContent, 'utf-8');
  return filepath;
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command === 'generate') {
    // Generate weekly summary
    const entries = getWeekEntries();
    
    if (entries.length === 0) {
      console.log('No journal entries found for the past week.');
      return;
    }
    
    console.log(`Found ${entries.length} entries for the past week.`);
    
    const summary = await callOpenRouter(entries);
    const filepath = saveSummary(summary);
    
    console.log('\n--- WEEKLY SUMMARY ---\n');
    console.log(summary);
    console.log(`\n--- Saved to: ${filepath} ---`);
    
  } else if (command === 'list') {
    // List entries for the week
    const entries = getWeekEntries();
    console.log(JSON.stringify(entries, null, 2));
    
  } else {
    console.error('Commands: generate, list');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
