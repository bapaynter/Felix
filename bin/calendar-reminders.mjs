#!/usr/bin/env node
/**
 * Calendar Reminders Setup
 * Runs daily at 6 AM UTC (midnight your time)
 * Creates reminder cron jobs for the day's events
 * 
 * NOTE: Calendar reminder cron jobs require the gateway cron API which isn't
 * currently exposed via REST. This script fetches events and logs them.
 * The daily-digest cron job handles displaying events.
 */

import { readFileSync } from 'fs';
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

import { existsSync } from 'fs';

const GOG_PASSWORD = process.env.GOG_KEYRING_PASSWORD || 'openclaw';
const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:18789';
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || '';
import { execSync } from 'child_process';

const GOG_CMD = '/home/pi/.local/bin/gog';

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
      `GOG_KEYRING_PASSWORD="${GOG_PASSWORD}" ${GOG_CMD} calendar events primary --from "${from}" --to "${to}" --json`,
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
    const start = event.start?.dateTime || event.start?.date || event.start;
    const key = `${event.summary}_${start}`;
    if (!seen.has(key)) {
      seen.set(key, event);
    }
  }

  return Array.from(seen.values());
}

async function main() {
  console.log('=== Calendar Reminders Setup ===');
  console.log(`Running at: ${new Date().toISOString()}`);
  console.log(`Timezone: America/Chicago (GMT-6)`);
  console.log('');

  console.log('Fetching today\'s events...');
  const events = getTodayEvents();

  if (!events.events || events.events.length === 0) {
    console.log('No events found for today.');
    console.log('');
    console.log('NOTE: Calendar reminder cron creation is not available in this version.');
    console.log('The daily-digest will still show events from Google Calendar.');
    return;
  }

  const uniqueEvents = deduplicateEvents(events.events);
  console.log(`Found ${events.events.length} events, ${uniqueEvents.length} unique`);
  console.log('');

  console.log('Events found:');
  for (const event of uniqueEvents) {
    const start = new Date(event.start?.dateTime || event.start?.date || event.start);
    const timeStr = start.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/Chicago'
    });
    console.log(`  - ${event.summary} at ${timeStr}`);
  }

  console.log('');
  console.log('NOTE: Calendar reminder cron creation is not available in this version.');
  console.log('The daily-digest will still show events from Google Calendar.');
}

main().catch(console.error);