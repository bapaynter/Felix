#!/usr/bin/env node
/**
 * Sort last 100 emails in inbox
 */

import { execSync } from 'child_process';

const GOG_ACCOUNT = 'bpaynter@pharmetika.com';
const CATEGORIES = ['Dev', 'Support', 'Internal', 'Personal', 'GitHub', 'GhostInspector'];

function getKeyringPassword() {
  try {
    const envContent = execSync('cat /home/pi/.openclaw/workspace/.openclaw-env', { encoding: 'utf8' });
    const match = envContent.match(/GOG_KEYRING_PASSWORD=(.+)/);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

function gogCommand(cmd) {
  const password = getKeyringPassword();
  if (!password) {
    console.error('No keyring password found');
    return '';
  }
  
  try {
    const output = execSync(
      `export GOG_KEYRING_PASSWORD="${password}" && gog gmail ${cmd} --account ${GOG_ACCOUNT} --plain`,
      { encoding: 'utf8', timeout: 30000 }
    );
    return output.trim();
  } catch (e) {
    const stderr = e.stderr || '';
    const stdout = e.stdout || '';
    if (stderr.includes('already has label')) {
      return 'label_exists';
    }
    console.error(`gog command failed: ${cmd} - ${stderr || stdout}`);
    return '';
  }
}

function categorize(from, subject) {
  // GitHub emails
  if (/@github\.com|notifications@github\.com|noreply@github\.com/i.test(from)) return 'GitHub';
  // GhostInspector emails
  if (/ghostinspector/i.test(from + subject)) return 'GhostInspector';
  // Crisp/Support emails
  if (/crisp\.email|messages@pharmetika|customer support|support@crisp/i.test(from + subject)) return 'Support';
  // Dev emails
  if (/codex|deployment|test|ci\/cd|build|pull request|PR review|git commit/i.test(from + subject)) return 'Dev';
  // Internal emails
  if (/team|hr|lunch|timecard|michelle|compliance/i.test(from + subject)) return 'Internal';
  // Personal emails
  if (/medium\.com|newsletter|promotion|security alert|2fa|mfa/i.test(from + subject)) return 'Personal';
  return 'Personal';
}

async function sortEmails() {
  const output = execSync(
    `export GOG_KEYRING_PASSWORD="${getKeyringPassword()}" && gog gmail search 'in:inbox' --max 100 --account ${GOG_ACCOUNT} --plain`,
    { encoding: 'utf8', timeout: 30000 }
  );
  
  const lines = output.split('\n').filter(l => l.match(/^\S+\t\d{4}-\d{2}-\d{2}/));
  
  let sorted = 0;
  let skipped = 0;
  let errors = 0;

  for (const line of lines) {
    const parts = line.split('\t');
    if (parts.length < 6) continue;
    
    const msgId = parts[0];
    const from = parts[2];
    const subject = parts[3];
    const labels = parts[4] || '';
    
    // Skip if already has one of our labels
    const hasOurLabel = CATEGORIES.some(cat => labels.includes(cat));
    if (hasOurLabel) {
      skipped++;
      continue;
    }

    const category = categorize(from, subject);
    
    try {
      gogCommand(`labels modify ${msgId} --add "${category}"`);
      gogCommand(`labels modify ${msgId} --remove "INBOX"`);
      console.log(`→ ${category}: ${subject.substring(0, 45)}...`);
      sorted++;
    } catch (e) {
      console.error(`Failed to move ${msgId}:`, e.message);
      errors++;
    }
  }

  console.log(`\nSorted ${sorted} emails, ${skipped} already labeled, ${errors} errors`);
}

sortEmails();