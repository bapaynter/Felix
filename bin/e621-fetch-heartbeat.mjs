#!/usr/bin/env node
/**
 * e621 Heartbeat Fetcher
 * Uses existing e621-search skill to fetch images based on patterns
 * - Excludes previously failed tags
 * - Picks ONE topic from recent conversation
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, readdirSync } from 'fs';
import { join } from 'path';

const MANIFEST_PATH = '/home/pi/.openclaw/workspace/memory/e621-manifest.json';
const FAILED_TAGS_PATH = '/home/pi/.openclaw/workspace/memory/e621-failed-tags.json';
const IMAGES_DIR = '/home/pi/.openclaw/workspace/images/e621';
const MAX_IMAGES = 100;
const MIN_SCORE = 100; // Only fetch images with score >= 100

const TOPIC_TAG_MAP = {
  'mountain biking': 'mountain_biking',
  'climbing': 'climbing',
  'rock climbing': 'rock_climbing',
  'board games': 'board_game',
  'cycling': 'cycling',
  'hiking': 'hiking',
  'gaming': 'gaming',
  'memory': 'memory',
  'health': 'health',
  'cleanup': 'cleanup',
  'coding': 'coding',
  'programming': 'programming'
};

function loadManifest() {
  if (existsSync(MANIFEST_PATH)) {
    return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  }
  return { images: [] };
}

function saveManifest(manifest) {
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

function loadFailedTags() {
  if (existsSync(FAILED_TAGS_PATH)) {
    return JSON.parse(readFileSync(FAILED_TAGS_PATH, 'utf8'));
  }
  return { failed: [], lastUpdated: null };
}

function saveFailedTags(failedData) {
  failedData.lastUpdated = new Date().toISOString();
  writeFileSync(FAILED_TAGS_PATH, JSON.stringify(failedData, null, 2));
}

function getRecentTopicsFromMemory() {
  const topics = new Set();
  
  // Get topics from patterns.json
  try {
    const patterns = JSON.parse(readFileSync('/home/pi/.openclaw/workspace/memory/patterns.json', 'utf8'));
    if (patterns.topics) {
      Object.keys(patterns.topics).forEach(t => topics.add(t));
    }
  } catch {}
  
  // Get topics from today's memory file
  try {
    const today = new Date().toISOString().split('T')[0];
    const memoryPath = `/home/pi/.openclaw/workspace/memory/${today}.md`;
    if (existsSync(memoryPath)) {
      const content = readFileSync(memoryPath, 'utf8');
      // Extract topics mentioned (simple heuristic)
      const words = content.toLowerCase().match(/\b\w+\b/g) || [];
      const commonTopics = ['mountain biking', 'climbing', 'cycling', 'hiking', 'gaming', 'board games', 'weed', 'coding', 'programming'];
      commonTopics.forEach(t => {
        if (content.toLowerCase().includes(t)) topics.add(t);
      });
    }
  } catch {}
  
  // Get topics from yesterday's memory
  try {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const memoryPath = `/home/pi/.openclaw/workspace/memory/${yesterday}.md`;
    if (existsSync(memoryPath)) {
      const content = readFileSync(memoryPath, 'utf8');
      const commonTopics = ['mountain biking', 'climbing', 'cycling', 'hiking', 'gaming', 'board games', 'weed', 'coding', 'programming'];
      commonTopics.forEach(t => {
        if (content.toLowerCase().includes(t)) topics.add(t);
      });
    }
  } catch {}
  
  return Array.from(topics);
}

function topicToTag(topic) {
  return TOPIC_TAG_MAP[topic.toLowerCase()] || topic.toLowerCase().replace(/\s+/g, '_');
}

function cleanupOldImages(manifest) {
  const validImages = manifest.images.filter(img => existsSync(img.path));
  
  if (validImages.length >= MAX_IMAGES) {
    validImages.sort((a, b) => new Date(a.fetched) - new Date(b.fetched));
    const toDelete = validImages.slice(0, validImages.length - MAX_IMAGES + 1);
    
    for (const img of toDelete) {
      try {
        unlinkSync(img.path);
        console.log(`🗑️  Deleted: ${img.filename}`);
      } catch (e) {
        console.error(`Failed to delete ${img.filename}:`, e.message);
      }
    }
    return validImages.slice(validImages.length - MAX_IMAGES + 1);
  }
  return validImages;
}

async function run() {
  console.log('🎨 e621 Heartbeat Fetcher');
  console.log('==========================');
  
  const recentTopics = getRecentTopicsFromMemory();
  console.log(`📊 Recent topics: ${recentTopics.join(', ')}`);
  
  const failedData = loadFailedTags();
  const failedTags = new Set(failedData.failed);
  console.log(`🚫 Failed tags: ${Array.from(failedTags).join(', ') || 'none'}`);
  
  // Build smart tag list: valid recent topics first, then fallbacks
  const tagCandidates = [
    ...recentTopics.map(topicToTag).filter(t => !failedTags.has(t)),
    'red_panda',
    'furry'
  ].filter((v, i, a) => a.indexOf(v) === i); // dedupe
  
  console.log(`🏷️  Will try: ${tagCandidates.join(', ')}`);
  
  // Try ONE tag at a time
  let result;
  let usedTag = null;
  
  for (const tag of tagCandidates) {
    console.log(`🔍 Searching: "${tag}"`);
    
    try {
      const output = execSync(
        `/home/pi/.openclaw/workspace/skills/e621-search/scripts/search.sh "${tag}" --limit 50 --min-score ${MIN_SCORE}`,
        { encoding: 'utf8', timeout: 30000 }
      );
      result = JSON.parse(output);
      
      if (result.file_url && !result.error) {
        console.log('✅ Found image!');
        usedTag = tag;
        break;
      } else {
        console.log(`⚠️  No results for "${tag}"`);
      }
    } catch (e) {
      console.log(`⚠️  Search failed for "${tag}": ${e.message}`);
    }
    
    // Small delay between attempts
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  if (!result || !result.file_url || result.error) {
    console.log('❌ No image found after all attempts');
    return;
  }
  
  // Handle null file_url (can happen with some posts)
  if (!result.file_url || result.file_url === 'null') {
    console.log('⚠️  Post has no direct file URL, skipping');
    return;
  }
  
  // Track failed tags if this search failed previously
  // (We already excluded them, but good to note)
  
  console.log(`📥 Downloading: ${result.post_url} (score: ${result.score})`);
  
  // Download image
  const imageResp = await fetch(result.file_url);
  const buffer = await imageResp.arrayBuffer();
  
  // Save file
  let ext = '.jpg';
  if (result.file_url.endsWith('.png')) ext = '.png';
  else if (result.file_url.endsWith('.gif')) ext = '.gif';
  else if (result.file_url.endsWith('.webp')) ext = '.webp';
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `e621-${timestamp}${ext}`;
  const filepath = join(IMAGES_DIR, filename);
  
  mkdirSync(IMAGES_DIR, { recursive: true });
  writeFileSync(filepath, Buffer.from(buffer));
  console.log(`✅ Saved: ${filename}`);
  
  // Update manifest
  const manifest = loadManifest();
  manifest.images = cleanupOldImages(manifest);
  manifest.images.push({
    filename,
    path: filepath,
    tags: usedTag ? [usedTag] : [],
    postId: result.id,
    postUrl: result.post_url,
    fetched: new Date().toISOString(),
    shown: false
  });
  saveManifest(manifest);
  
  console.log(`📋 Collection: ${manifest.images.length}/${MAX_IMAGES}`);
}

run();