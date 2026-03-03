#!/usr/bin/env node
/**
 * Journal Analysis Script
 * Analyzes journal entries using OpenRouter (Gemini 3 Pro Preview)
 * Provides language analysis, cognitive bias detection, and personalized advice
 */

import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, basename } from 'path';
import { config } from 'dotenv';

// Load environment
config({ path: '/home/pi/.openclaw/workspace/.openclaw-env' });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const JOURNALS_DIR = '/home/pi/.openclaw/workspace/memory/journals';

const MORNING_ANALYSIS_PROMPT = `Above you'll find my reflection immediately after waking up. 

A) Analyze the language used in my recent entries. Pay attention to:
1. Recurring words or phrases
2. Emotional tone of the statements
3. Metaphors or analogies used
4. Words indicating limiting beliefs

B) Process this fragment for cognitive biases and self-confirmation tendencies, suggesting alternative approaches to these topics or potential traps my thinking might lead me into.

C) Conclude the morning reflection with:
- One high-quality paragraph of personalized advice from Marcus Aurelius that relates directly to my goals, challenges, and dilemmas
- One high-quality paragraph of personalized advice from Andrew Huberman addressing my current state

Keep responses direct and specific to my actual situation, not generic advice.`;

const EVENING_ANALYSIS_PROMPT = `You are my reflection partner helping me process the day's emotions and extract lessons.

Help me with:
1. Emotion validation: Normalize what I'm feeling
2. Pattern check: Have I mentioned similar struggles recently?
3. Lesson extraction: What's the real learning here beyond the surface?
4. Tomorrow prep: Based on what I'm worried about, what's one thing I can do to feel more prepared?

Your tone should be warm but honest. Don't sugarcoat patterns I need to address.`;

async function callOpenRouter(entries, todayEntry, journalType = 'morning') {
  // Build context from last 30 entries
  const contextEntries = entries
    .slice(-30)
    .map(e => `## ${e.date}\n${e.content}`)
    .join('\n\n---\n\n');
  
  const todayDate = new Date().toISOString().split('T')[0];
  const analysisPrompt = journalType === 'morning' ? MORNING_ANALYSIS_PROMPT : EVENING_ANALYSIS_PROMPT;
  
  const systemPrompt = journalType === 'morning'
    ? `You are a thoughtful journal analyst who provides insightful, personalized feedback. You help the user recognize patterns in their thinking, identify cognitive biases, and offer practical wisdom. You're direct and specific, never generic.`
    : `You are a warm but honest reflection partner helping process emotions and extract lessons from daily experiences. You validate feelings while gently pointing out patterns that need attention.`;
  
  const messages = [
    {
      role: 'system',
      content: systemPrompt
    },
    {
      role: 'user',
      content: `## Previous Journal Entries

${contextEntries || 'No previous entries yet.'}

---

## Today's Entry (${todayDate})

${todayEntry}

---

${analysisPrompt}`
    }
  ];
  
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://openclaw.ai',
      'X-Title': 'OpenClaw Journal Analysis'
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

function getEntries(journalType = 'morning') {
  if (!existsSync(JOURNALS_DIR)) {
    return [];
  }
  
  const files = readdirSync(JOURNALS_DIR)
    .filter(f => f.endsWith(`-${journalType}.md`))
    .sort()
    .map(f => {
      const content = readFileSync(join(JOURNALS_DIR, f), 'utf-8');
      const date = f.replace(`-${journalType}.md`, '');
      return { date, content };
    });
  
  return files;
}

function saveEntry(content, journalType = 'morning') {
  if (!existsSync(JOURNALS_DIR)) {
    mkdirSync(JOURNALS_DIR, { recursive: true });
  }
  
  const date = new Date().toISOString().split('T')[0];
  const filename = `${date}-${journalType}.md`;
  const filepath = join(JOURNALS_DIR, filename);
  
  writeFileSync(filepath, content, 'utf-8');
  return filepath;
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command === 'analyze') {
    // Analyze a specific entry
    const todayEntry = args[1];
    const journalType = args[2] || 'morning';
    if (!todayEntry) {
      console.error('Usage: analyze-journal.mjs analyze "<entry content>" [morning|evening]');
      process.exit(1);
    }
    
    const entries = getEntries(journalType);
    const analysis = await callOpenRouter(entries, todayEntry, journalType);
    console.log(analysis);
    
  } else if (command === 'save') {
    // Save an entry
    const content = args[1];
    const type = args[2] || 'morning';
    if (!content) {
      console.error('Usage: analyze-journal.mjs save "<content>" [morning|evening]');
      process.exit(1);
    }
    
    const filepath = saveEntry(content, type);
    console.log(JSON.stringify({ saved: filepath }));
    
  } else if (command === 'list') {
    // List entries
    const type = args[1] || 'morning';
    const entries = getEntries(type);
    console.log(JSON.stringify(entries, null, 2));
    
  } else {
    console.error('Commands: analyze, save, list');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
