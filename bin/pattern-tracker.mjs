#!/usr/bin/env node
/**
 * Pattern Tracker - Real-time pattern recognition across sessions
 * 
 * Usage:
 *   node bin/pattern-tracker.mjs track [topic1] [topic2] ...  # Track topics in current session
 *   node bin/pattern-tracker.mjs merge                        # Merge session data into patterns.json
 *   node bin/pattern-tracker.mjs analyze                      # Generate pattern insights
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const WORKSPACE = '/home/pi/.openclaw/workspace';
const PATTERNS_FILE = join(WORKSPACE, 'memory', 'patterns.json');
const SESSION_FILE = join(WORKSPACE, 'memory', 'current-session.json');
const MEMORY_FILE = join(WORKSPACE, 'MEMORY.md');

const TOPIC_KEYWORDS = {
  memory: ['memory', 'remember', 'capture', 'store'],
  cleanup: ['cleanup', 'fix', 'clean', 'organize'],
  health: ['health', 'check', 'monitor', 'alert'],
  heartbeat: ['heartbeat', 'cron', 'schedule'],
  coding: ['code', 'repo', 'git', 'fix', 'implement'],
  email: ['email', 'gmail', 'inbox'],
  calendar: ['calendar', 'event', 'schedule'],
  todoist: ['todoist', 'task', 'project'],
  context: ['context', 'compaction', 'tokens'],
  ai: ['ai', 'model', 'llm', 'deepseek', 'claude'],
  config: ['config', 'setting', 'env', 'openclaw.json']
};

function loadPatterns() {
  if (existsSync(PATTERNS_FILE)) {
    return JSON.parse(readFileSync(PATTERNS_FILE, 'utf8'));
  }
  return {
    topics: {},
    temporal: { days: {}, hours: {} },
    sessionStats: { total: 0, today: 0 },
    lastUpdated: null
  };
}

function savePatterns(patterns) {
  patterns.lastUpdated = new Date().toISOString();
  writeFileSync(PATTERNS_FILE, JSON.stringify(patterns, null, 2));
}

function detectTopics(text) {
  const detected = [];
  const lower = text.toLowerCase();
  
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) {
      detected.push(topic);
    }
  }
  
  return [...new Set(detected)];
}

function trackSession(topics) {
  let session = { topics: [], timestamp: new Date().toISOString() };
  
  if (existsSync(SESSION_FILE)) {
    session = JSON.parse(readFileSync(SESSION_FILE, 'utf8'));
  }
  
  // Add new topics
  for (const topic of topics) {
    if (!session.topics.includes(topic)) {
      session.topics.push(topic);
    }
  }
  
  writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
  console.log(`📊 Tracked: ${topics.join(', ') || '(no new topics)'}`);
}

function mergeSession() {
  if (!existsSync(SESSION_FILE)) {
    console.log('No current session data to merge');
    return;
  }
  
  const session = JSON.parse(readFileSync(SESSION_FILE, 'utf8'));
  const patterns = loadPatterns();
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const hour = now.getHours();
  
  // Update topic counts
  for (const topic of session.topics) {
    if (!patterns.topics[topic]) {
      patterns.topics[topic] = { count: 0, firstSeen: today, lastSeen: today, sessions: [] };
    }
    patterns.topics[topic].count++;
    patterns.topics[topic].lastSeen = today;
    
    // Track session appearances
    if (!patterns.topics[topic].sessions.includes(today)) {
      patterns.topics[topic].sessions.push(today);
    }
  }
  
  // Update temporal patterns
  if (!patterns.temporal.days[dayOfWeek]) {
    patterns.temporal.days[dayOfWeek] = 0;
  }
  patterns.temporal.days[dayOfWeek]++;
  
  if (!patterns.temporal.hours[hour]) {
    patterns.temporal.hours[hour] = 0;
  }
  patterns.temporal.hours[hour]++;
  
  // Update session stats
  patterns.sessionStats.total++;
  if (patterns.sessionStats.lastDate !== today) {
    patterns.sessionStats.today = 1;
    patterns.sessionStats.lastDate = today;
  } else {
    patterns.sessionStats.today++;
  }
  
  savePatterns(patterns);
  
  // Clear session file
  writeFileSync(SESSION_FILE, JSON.stringify({ topics: [], timestamp: new Date().toISOString() }));
  
  console.log(`✅ Merged ${session.topics.length} topics into patterns`);
}

function analyzePatterns() {
  const patterns = loadPatterns();
  const insights = [];
  
  // Top topics
  const sortedTopics = Object.entries(patterns.topics)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5);
  
  if (sortedTopics.length > 0) {
    insights.push(`📊 Top topics: ${sortedTopics.map(([t, d]) => `${t}(${d.count})`).join(', ')}`);
  }
  
  // Temporal patterns
  const busyDay = Object.entries(patterns.temporal.days)
    .sort((a, b) => b[1] - a[1])[0];
  
  if (busyDay) {
    insights.push(`📅 Busiest: ${busyDay[0]} (${busyDay[1]} sessions)`);
  }
  
  // Session stats
  insights.push(`💬 Total sessions: ${patterns.sessionStats.total}, today: ${patterns.sessionStats.today}`);
  
  // Pattern recognition
  const frequentPairs = detectFrequentPairs(patterns);
  if (frequentPairs.length > 0) {
    insights.push(`🔗 Often together: ${frequentPairs.join(', ')}`);
  }
  
  // Output
  if (insights.length === 0) {
    console.log('📊 No patterns detected yet. Keep working!');
    return;
  }
  
  console.log('📊 Pattern Analysis:');
  insights.forEach(i => console.log(`  ${i}`));
  
  // Auto-update MEMORY.md if significant patterns
  if (sortedTopics.length >= 3) {
    updateMemoryWithPatterns(sortedTopics);
  }
}

function detectFrequentPairs(patterns) {
  const pairs = {};
  
  for (const [topic, data] of Object.entries(patterns.topics)) {
    // Check co-occurrence with other topics
    // This is simplified - would need more sophisticated analysis
  }
  
  // Simple heuristic: topics that appear in many sessions together
  return []; // Placeholder for more advanced analysis
}

function updateMemoryWithPatterns(topTopics) {
  if (!existsSync(MEMORY_FILE)) return;
  
  let content = readFileSync(MEMORY_FILE, 'utf8');
  
  // Add pattern insights to memory
  const patternSection = `\n### Detected Patterns\n- Active topics: ${topTopics.map(t => t[0]).join(', ')}\n- Session patterns tracked via pattern-tracker.mjs\n`;
  
  if (!content.includes('### Detected Patterns')) {
    content += patternSection;
    writeFileSync(MEMORY_FILE, content);
    console.log('✅ Updated MEMORY.md with pattern insights');
  }
}

// Main
const command = process.argv[2];

switch (command) {
  case 'track':
    const topics = process.argv.slice(3);
    trackSession(topics);
    break;
  case 'merge':
    mergeSession();
    break;
  case 'analyze':
    analyzePatterns();
    break;
  default:
    console.log('Usage: node bin/pattern-tracker.mjs [track|merge|analyze]');
    console.log('  track [topics] - Track topics in current session');
    console.log('  merge - Merge session data into patterns.json');
    console.log('  analyze - Generate pattern insights');
}