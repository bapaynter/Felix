#!/usr/bin/env node
/**
 * e621 Heartbeat Fetcher
 * Uses existing e621-search skill to fetch images based on patterns
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';

const MANIFEST_PATH = '/home/pi/.openclaw/workspace/memory/e621-manifest.json';
const IMAGES_DIR = '/home/pi/.openclaw/workspace/images/e621';
const MAX_IMAGES = 100;

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
  'cleanup': 'cleanup'
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

function getTopTopics() {
  try {
    const patterns = JSON.parse(readFileSync('/home/pi/.openclaw/workspace/memory/patterns.json', 'utf8'));
    return Object.keys(patterns.topics || {}).slice(0, 3);
  } catch {
    return ['furry', 'anthro'];
  }
}

function topicsToTags(topics) {
  return topics.map(t => TOPIC_TAG_MAP[t.toLowerCase()] || t.toLowerCase().replace(/\s+/g, '_')).join(' ');
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
  
  const topics = getTopTopics();
  console.log(`📊 Topics: ${topics.join(', ')}`);
  
  const tags = topicsToTags(topics);
  console.log(`🏷️  Tags: ${tags}`);
  
  // Call existing search script - retry until we get an image
  let result;
  let attempts = 0;
  const maxAttempts = 10;
  const searchTags = [tags, 'furry anthro', 'anthro solo', 'furry male', 'furry female'];
  
  while (attempts < maxAttempts) {
    try {
      const searchTag = searchTags[Math.min(attempts, searchTags.length - 1)];
      console.log(`🔍 Attempt ${attempts + 1}: searching "${searchTag}"`);
      
      const output = execSync(
        `/home/pi/.openclaw/workspace/skills/e621-search/scripts/search.sh "${searchTag}" --limit 50`,
        { encoding: 'utf8', timeout: 30000 }
      );
      result = JSON.parse(output);
      
      if (result.file_url && !result.error) {
        console.log('✅ Found image!');
        break;
      }
    } catch (e) {
      console.log(`⚠️  Attempt ${attempts + 1} failed: ${e.message}`);
    }
    
    attempts++;
    
    if (attempts < maxAttempts) {
      console.log('🔄 Retrying in 2 seconds...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  if (!result || !result.file_url || result.error) {
    console.log('❌ No image found after all attempts');
    return;
  }
  
  console.log(`📥 Downloading: ${result.post_url}`);
  
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
    tags: tags.split(' '),
    postId: result.id,
    postUrl: result.post_url,
    fetched: new Date().toISOString(),
    shown: false
  });
  saveManifest(manifest);
  
  console.log(`📋 Collection: ${manifest.images.length}/${MAX_IMAGES}`);
}

run();