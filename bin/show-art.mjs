#!/usr/bin/env node
/**
 * Show e621 Art Collection
 */

import { readFileSync } from 'fs';

const MANIFEST_PATH = '/home/pi/.openclaw/workspace/memory/e621-manifest.json';

function loadManifest() {
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  } catch {
    return { images: [] };
  }
}

function run() {
  const manifest = loadManifest();
  const all = manifest.images;
  const unshown = all.filter(i => !i.shown);
  const shown = all.filter(i => i.shown);
  
  console.log('🎨 e621 Art Collection');
  console.log('=======================');
  console.log(`Total: ${all.length}/100`);
  console.log(`🆕 New: ${unshown.length} | ✅ Shown: ${shown.length}`);
  console.log('');
  
  if (unshown.length > 0) {
    console.log('🆕 NEW IMAGES:');
    for (const img of unshown) {
      console.log(`   📅 ${img.fetched.slice(0, 10)} | 🏷️ ${img.tags?.join(', ')}`);
      console.log(`   🔗 ${img.postUrl}`);
    }
  }
  
  if (shown.length > 0) {
    console.log('\n✅ PREVIOUSLY SHOWN:');
    for (const img of shown.slice(-5)) {
      console.log(`   📅 ${img.fetched.slice(0, 10)} | 🏷️ ${img.tags?.join(', ')}`);
    }
    if (shown.length > 5) console.log(`   ...and ${shown.length - 5} more`);
  }
  
  if (all.length === 0) {
    console.log('No art yet. First fetch at next 4-hour mark.');
  }
}

run();