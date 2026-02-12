#!/usr/bin/env node
/**
 * Calendar Reminders Setup
 * Runs daily at 6 AM UTC (midnight your time)
 * Creates reminder cron jobs for the day's events
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = '/home/pi/.openclaw/workspace';

// Load environment
const envPath = join(WORKSPACE, '.openclaw-env');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.substring(0, eqIdx);
        const value = trimmed.substring(eqIdx + 1);
        if (key.startsWith('export ')) {
          process.env[key.substring(7)] = value;
        } else {
          process.env[key] = value;
        }
      }
    }
  });
}

const GOG_PASSWORD = process.env.GOG_KEYRING_PASSWORD || 'openclaw';
const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:18789';
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || '';
const { execSync } = require('child_process');

function getTodayEvents() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const from = today.toISOString();
  const to = tomorrow.toISOString();

  console.log(`Querying calendar for ${from} to ${to}`);

  try {
    const output = execSync(
      `GOG_KEYRING_PASSWORD="${GOG_PASSWORD}" gog calendar events primary --from "${from}" --to "${to}" --json`,
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, timeout: 30000 }
    );
    return JSON.parse(output);
  } catch (error) {
    console.error('Failed to fetch calendar events:', error.message);
    return [];
  }
}

function deduplicateEvents(events) {
  const seen = new Map();

  for (const event of events) {
    // Create key from title + start time
    const start = event.start?.dateTime || event.start?.date || event.start;
    const key = `${event.summary}_${start}`;
    if (!seen.has(key)) {
      seen.set(key, event);
    }
  }

  return Array.from(seen.values());
}

function deleteOldReminderCrons() {
  if (!GATEWAY_TOKEN) {
    console.log('No gateway token configured, skipping cleanup');
    return;
  }

  try {
    const output = execSync(
      `curl -s "${GATEWAY_URL}/api/gateway/cron" -H "Authorization: Bearer ${GATEWAY_TOKEN}"`,
      { encoding: 'utf8', timeout: 5000 }
    );

    const jobs = JSON.parse(output);
    const calendarReminders = jobs.filter(j =>
      j.name && j.name.startsWith('calendar-reminder-')
    );

    for (const job of calendarReminders) {
      execSync(
        `curl -s -X DELETE "${GATEWAY_URL}/api/gateway/cron/${job.id}" -H "Authorization: Bearer ${GATEWAY_TOKEN}"`,
        { encoding: 'utf8' }
      );
      console.log(`Deleted old reminder: ${job.name}`);
    }
  } catch (error) {
    console.log('No old reminders to clean up (or gateway unavailable)');
  }
}

function createReminderCron(event) {
  const eventStart = new Date(event.start?.dateTime || event.start?.date || event.start);
  const reminderTime = new Date(eventStart.getTime() - 60 * 60 * 1000); // 1 hour before

  // Skip if reminder time has already passed
  if (reminderTime <= new Date()) {
    console.log(`Skipping "${event.summary}" - reminder time already passed`);
    return;
  }

  const reminderISO = reminderTime.toISOString();
  const eventTimeStr = eventStart.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Chicago'
  });

  const message = `📅 **Upcoming in 1 hour:** ${event.summary} at ${eventTimeStr}`;

  const cronJob = {
    name: `calendar-reminder-${event.id || Date.now()}`,
    schedule: { kind: 'at', at: reminderISO },
    payload: {
      kind: 'agentTurn',
      message: `Send this announcement to the chat: "${message}"`
    },
    sessionTarget: 'isolated',
    delivery: { mode: 'announce' },
    enabled: true
  };

  if (!GATEWAY_TOKEN) {
    console.log(`Would create reminder for: ${event.summary} at ${reminderISO}`);
    return null;
  }

  try {
    const response = execSync(
      `curl -s -X POST "${GATEWAY_URL}/api/gateway/cron" -H "Authorization: Bearer ${GATEWAY_TOKEN}" -H "Content-Type: application/json" -d '${JSON.stringify(cronJob)}'`,
      { encoding: 'utf8', timeout: 5000 }
    );

    const result = JSON.parse(response);
    console.log(`Created reminder: ${event.summary} at ${eventTimeStr}`);
    return result;
  } catch (error) {
    console.error(`Failed to create reminder for ${event.summary}:`, error.message);
    return null;
  }
}

async function main() {
  console.log('=== Calendar Reminders Setup ===');
  console.log(`Running at: ${new Date().toISOString()}`);
  console.log(`Timezone: America/Chicago (GMT-6)`);
  console.log('');

  console.log('Cleaning up old reminder crons...');
  deleteOldReminderCrons();

  console.log('Fetching today\'s events...');
  const events = getTodayEvents();

  if (!events.events || events.events.length === 0) {
    console.log('No events found for today.');
    return;
  }

  const uniqueEvents = deduplicateEvents(events.events);
  console.log(`Found ${events.events.length} events, ${uniqueEvents.length} unique`);

  console.log('Creating reminder crons (1 hour before)...');
  let created = 0;
  for (const event of uniqueEvents) {
    const result = createReminderCron(event);
    if (result || !GATEWAY_TOKEN) created++;
  }

  console.log(`\n=== Done: Created ${created} reminder(s) ===`);
}

main().catch(console.error);
