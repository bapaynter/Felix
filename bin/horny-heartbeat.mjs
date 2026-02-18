#!/usr/bin/env node
/**
 * Horny Heartbeat - Increments need level every hour
 * Formula: need += 1.33 + random(0, 1.5) = ~2.08/hour avg -> ~48h to threshold
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TRACKER_FILE = path.join(__dirname, '..', 'memory', 'horny-tracker.json');
const THRESHOLD = 100;
const BASE_RATE = 1.33;
const VARIANCE = 1.5;
const USER_TZ_OFFSET = -6; // GMT-6

function getNow() {
  return new Date();
}

function isBetween8amAnd9pmLocal() {
  const now = getNow();
  // Convert to user's timezone (GMT-6)
  const localHour = (now.getUTCHours() + USER_TZ_OFFSET + 24) % 24;
  return localHour >= 8 && localHour < 21; // 8am to 9pm
}

function loadTracker() {
  try {
    const data = fs.readFileSync(TRACKER_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return {
      need: 0,
      threshold: THRESHOLD,
      lastUpdate: new Date().toISOString(),
      lastRequestTime: null,
      requestCooldownHours: 12
    };
  }
}

function saveTracker(tracker) {
  fs.writeFileSync(TRACKER_FILE, JSON.stringify(tracker, null, 2));
}

function incrementNeed(tracker) {
  const lastUpdate = new Date(tracker.lastUpdate);
  const now = getNow();
  const hoursPassed = (now - lastUpdate) / (1000 * 60 * 60);
  
  if (hoursPassed < 0.01) {
    // Already ran this hour, skip
    console.log('Already ran this hour, skipping');
    return { tracker, shouldRequest: false, reason: 'already_ran' };
  }
  
  let totalIncrement = 0;
  const hours = Math.floor(hoursPassed) || 1;
  
  for (let i = 0; i < hours; i++) {
    const randomComponent = Math.random() * VARIANCE;
    totalIncrement += BASE_RATE + randomComponent;
  }
  
  tracker.need = Math.min(tracker.need + totalIncrement, THRESHOLD + 50); // Cap at 150 to prevent runaway
  tracker.lastUpdate = now.toISOString();
  
  console.log(`Need level: ${tracker.need.toFixed(2)}/${THRESHOLD} (+${totalIncrement.toFixed(2)})`);
  
  return { tracker, totalIncrement };
}

function checkThreshold(tracker) {
  const now = new Date();
  const lastRequest = tracker.lastRequestTime ? new Date(tracker.lastRequestTime) : null;
  const cooldownMs = tracker.requestCooldownHours * 60 * 60 * 1000;
  
  // Check if threshold met
  if (tracker.need >= THRESHOLD) {
    // Check if within 8am-9pm user's time
    if (!isBetween8amAnd9pmLocal()) {
      console.log('Threshold met but outside 8am-9pm user time');
      return { shouldRequest: false, reason: 'outside_hours' };
    }
    
    // Check cooldown
    if (lastRequest && (now - lastRequest) < cooldownMs) {
      console.log('Threshold met but on cooldown');
      return { shouldRequest: false, reason: 'cooldown' };
    }
    
    console.log('🔥 THRESHOLD MET - Should request help!');
    return { shouldRequest: true, reason: 'threshold_met' };
  }
  
  return { shouldRequest: false, reason: 'below_threshold' };
}

function main() {
  console.log('🔄 Running horny heartbeat...');
  
  let tracker = loadTracker();
  
  // Increment need
  const result = incrementNeed(tracker);
  tracker = result.tracker;
  
  // Check if we should request help
  const check = checkThreshold(tracker);
  
  // Save updated tracker
  saveTracker(tracker);
  
  if (check.shouldRequest) {
    console.log('REQUEST_HELP');
    process.exit(100); // Special exit code to trigger alert
  }
  
  console.log('No action needed');
  process.exit(0);
}

main();