#!/usr/bin/env node
/**
 * AI Email Sorting - Uses cheap LLM to categorize emails into 4 folders
 */

import { execSync } from 'child_process';

const GOG_ACCOUNT = 'bpaynter@pharmetika.com';
const CATEGORIES = ['Dev', 'Support', 'Internal', 'Personal', 'GitHub', 'GhostInspector'];

const CATEGORY_DESCRIPTIONS = {
  Dev: 'Code reviews, CI/CD notifications, test results, deployment alerts, technical infrastructure',
  Support: 'Customer tickets, Crisp chat, developer support questions, vendor support, API help requests',
  Internal: 'Team communications, HR, lunch invites, timecards, compliance, company announcements',
  Personal: 'Security alerts, 2FA codes, newsletters, promotions, calendar invites, personal notifications',
  GitHub: 'GitHub notifications, PR reviews, commits, issues, GitHub Actions, repository activity',
  GhostInspector: 'GhostInspector test results, automation alerts, test failures, test reports'
};

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

async function categorizeWithAI(from, subject) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  // Fast path: Pattern matching for common sources (skip AI if clear match)
  // GitHub emails
  if (/@github\.com|notifications@github\.com|noreply@github\.com/i.test(from)) return 'GitHub';
  // GhostInspector emails
  if (/ghostinspector/i.test(from + subject)) return 'GhostInspector';
  // Crisp/Support emails
  if (/crisp\.email|messages@pharmetika|customer support|support@crisp/i.test(from + subject)) return 'Support';
  // Dev emails (CI/CD, deployments, code reviews)
  if (/codex|deployment|test|ci\/cd|build|pull request|PR review|git commit/i.test(from + subject)) return 'Dev';
  // Internal emails
  if (/team|hr|lunch|timecard|michelle|compliance/i.test(from + subject)) return 'Internal';
  
  // If no API key, use Personal as final fallback
  if (!apiKey) return 'Personal';

  const prompt = `Categorize this email into ONE of these categories:
- Dev: CI/CD, deployments, code reviews, test results, git commits, PR notifications
- GitHub: PR reviews, GitHub notifications, code review requests, @mentions on GitHub
- Support: Customer support, Crisp messages, help desk tickets, vendor support
- GhostInspector: Test automation alerts, GhostInspector notifications
- Internal: Team communication, HR, compliance, lunch, timecards
- Personal: Newsletters, promotions, security alerts, non-work emails

Email:
From: ${from}
Subject: ${subject}

Reply with ONLY the category name.`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://openclaw.local'
      },
      body: JSON.stringify({
        model: 'google/gemini-flash-1.5',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 15,
        temperature: 0
      })
    });

    const data = await response.json();
    const category = data.choices?.[0]?.message?.content?.trim();
    
    if (CATEGORIES.includes(category)) return category;
    return 'Personal'; // Default fallback
  } catch (e) {
    console.error('AI categorization failed:', e.message);
    return 'Personal';
  }
}

async function sortEmails() {
  // Get unread emails from inbox
  const output = gogCommand("search 'in:inbox is:unread' --max 20");
  const lines = output.split('\n').filter(l => l.match(/^\S+\t\d{4}-\d{2}-\d{2}/));
  
  if (lines.length === 0) {
    console.log('No emails to sort');
    return { sorted: 0, errors: 0 };
  }

  let sorted = 0;
  let errors = 0;

  for (const line of lines) {
    // Parse: ID	DATE	FROM	SUBJECT	LABELS	THREAD
    // FROM can contain quoted strings like "name" <email>, so we parse by splitting on tabs
    const parts = line.split('\t');
    if (parts.length < 6) continue;
    
    const msgId = parts[0];
    const from = parts[2];
    const subject = parts[3];
    
    // Skip if already has one of our labels (check fails gracefully if API errors)
    try {
      const existingLabels = gogCommand(`get ${msgId} --json`);
      const parsed = JSON.parse(existingLabels);
      const hasOurLabel = parsed.labelIds?.some(id => 
        ['Label_11', 'Label_12', 'Label_13', 'Label_14', 'Dev', 'Support', 'Internal', 'Personal', 'GitHub', 'GhostInspector'].includes(id)
      );
      if (hasOurLabel) continue;
    } catch {}

    // Categorize
    const category = await categorizeWithAI(from, subject);
    
    // Move: archive from inbox + apply label (use msgId, not threadId)
    try {
      gogCommand(`labels modify ${msgId} --add "${category}"`);
      gogCommand(`labels modify ${msgId} --remove "INBOX"`);
      console.log(`→ ${category}: ${subject.substring(0, 50)}...`);
      sorted++;
    } catch (e) {
      console.error(`Failed to move ${msgId}:`, e.message);
      errors++;
    }
  }

  return { sorted, errors };
}

// Run
const result = await sortEmails();
console.log(`\nSorted ${result.sorted} emails, ${result.errors} errors`);
