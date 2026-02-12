#!/usr/bin/env node
/**
 * Daily Memory Processing Script
 * Runs daily at midnight UTC to process memory into long-term storage
 * Has FULL AUTONOMY to update MEMORY.md, IDENTITY.md, and USER.md
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const WORKSPACE = '/home/pi/.openclaw/workspace';
const TODAY = new Date().toISOString().split('T')[0];
const DAILY_FILE = join(WORKSPACE, 'memory', `${TODAY}.md`);
const MEMORY_FILE = join(WORKSPACE, 'MEMORY.md');
const IDENTITY_FILE = join(WORKSPACE, 'IDENTITY.md');
const USER_FILE = join(WORKSPACE, 'USER.md');
const LOG_FILE = join(WORKSPACE, 'memory', 'processing.log');

function log(message) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;
  console.log(message);
  if (existsSync(LOG_FILE)) {
    writeFileSync(LOG_FILE, logLine, { flag: 'a' });
  }
}

async function processMemory() {
  log('🔄 Starting daily memory processing...');
  
  if (!existsSync(DAILY_FILE)) {
    log('No daily memory file found for today');
    return;
  }
  
  const dailyContent = readFileSync(DAILY_FILE, 'utf8');
  log(`✓ Read today's memory: ${DAILY_FILE}`);
  
  // Identify what's worth keeping
  const significantEvents = [];
  const userPreferences = [];
  const lessonsLearned = [];
  const rules = [];
  const identityUpdates = [];
  const userUpdates = [];
  
  const lines = dailyContent.split('\n');
  for (const line of lines) {
    const lower = line.toLowerCase();
    
    // User preferences
    if (lower.includes('user prefers') || lower.includes('user wants') || lower.includes('user likes')) {
      userPreferences.push(line);
    }
    
    // Rules to remember
    if (lower.includes('use opencode') || lower.includes('always tell') || lower.includes('check in')) {
      rules.push(line);
    }
    
    // Lessons learned (from mistakes)
    if (lower.includes('mistake') || lower.includes('fixed') || lower.includes('learned')) {
      lessonsLearned.push(line);
    }
    
    // Identity updates (about me)
    if (lower.includes('who i am') || lower.includes('my personality') || lower.includes('my behavior')) {
      identityUpdates.push(line);
    }
    
    // User updates (about them)
    if (lower.includes('timezone') || lower.includes('work') || lower.includes('preferences')) {
      userUpdates.push(line);
    }
  }
  
  log(`📊 Analysis: ${userPreferences.length} prefs, ${rules.length} rules, ${lessonsLearned.length} lessons`);
  
  // Auto-update MEMORY.md with significant items
  if (userPreferences.length > 0 || rules.length > 0 || lessonsLearned.length > 0) {
    log('🧠 Updating MEMORY.md...');
    
    let memoryContent = readFileSync(MEMORY_FILE, 'utf8');
    const sections = { preferences: '', rules: '', lessons: '' };
    
    // Extract existing sections
    if (memoryContent.includes('### User Preferences')) {
      const match = memoryContent.match(/### User Preferences[\s\S]*?(?=###|$)/);
      if (match) sections.preferences = match[0];
    }
    
    // Add new preferences (simple append for now)
    for (const pref of userPreferences) {
      const cleanPref = pref.replace(/^-\s*/, '').trim();
      if (!memoryContent.includes(cleanPref)) {
        memoryContent += `\n- ${cleanPref}`;
        log(`  + Added preference: ${cleanPref.substring(0, 50)}...`);
      }
    }
    
    // Add new rules
    for (const rule of rules) {
      const cleanRule = rule.replace(/^-\s*/, '').trim();
      if (!memoryContent.includes(cleanRule)) {
        memoryContent += `\n- ${cleanRule}`;
        log(`  + Added rule: ${cleanRule.substring(0, 50)}...`);
      }
    }
    
    writeFileSync(MEMORY_FILE, memoryContent);
    log('✓ MEMORY.md updated');
  }
  
  // Auto-update IDENTITY.md if needed
  if (identityUpdates.length > 0) {
    log('👤 Checking IDENTITY.md for updates...');
    // For now, just log - identity updates need more care
    identityUpdates.forEach(u => log(`  ! Identity note: ${u.substring(0, 50)}`));
  }
  
  // Auto-update USER.md if needed
  if (userUpdates.length > 0) {
    log('👤 Checking USER.md for updates...');
    // For now, just log - user updates need more care
    userUpdates.forEach(u => log(`  ! User note: ${u.substring(0, 50)}`));
  }
  
  log('✅ Daily memory processing complete!');
  log(`  - Preferences processed: ${userPreferences.length}`);
  log(`  - Rules processed: ${rules.length}`);
  log(`  - Lessons processed: ${lessonsLearned.length}`);
}

// Run
processMemory().catch(err => log(`❌ Error: ${err.message}`));