#!/usr/bin/env node
/**
 * Heartbeat Runner - Rotating Check System
 * Calculates most overdue check and runs it
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const STATE_FILE = '/home/pi/.openclaw/workspace/memory/heartbeat-state.json';
const WORKSPACE = '/home/pi/.openclaw/workspace';

// Load state
let state;
try {
    state = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
} catch (err) {
    console.error('Failed to load state:', err.message);
    process.exit(1);
}

// Initialize alerted emails tracking if not present
if (!state.alertedEmails) {
    state.alertedEmails = [];
}

const now = new Date();
const currentHour = now.getHours();
const nowMs = now.getTime();

// Calculate overdue score for each check
let mostOverdue = null;
let maxScore = -1;

for (const [name, check] of Object.entries(state.checks)) {
    // Check if within active hours
    if (check.activeHours) {
        if (currentHour < check.activeHours.start || currentHour >= check.activeHours.end) {
            continue; // Outside active window
        }
    }
    
    // Calculate overdue score
    const lastRun = check.lastRun ? new Date(check.lastRun).getTime() : 0;
    const elapsedMs = nowMs - lastRun;
    const intervalMs = check.intervalMinutes * 60 * 1000;
    const overdueScore = elapsedMs / intervalMs;
    
    if (overdueScore > maxScore) {
        maxScore = overdueScore;
        mostOverdue = name;
    }
}

// If nothing is overdue enough (score < 1.0), return OK
if (!mostOverdue || maxScore < 1.0) {
    console.log('HEARTBEAT_OK');
    process.exit(0);
}

// Run the most overdue check
const check = state.checks[mostOverdue];
console.log(`Running check: ${mostOverdue} (overdue: ${maxScore.toFixed(2)}x)`);

let findings = null;

try {
    switch (mostOverdue) {
        case 'todoist':
            findings = checkTodoist();
            break;
        case 'git_update':
            findings = checkGitUpdate();
            break;
        case 'proactive_scans':
            findings = runProactiveScans();
            break;
        case 'e621_fetch':
            findings = checkE621();
            break;
        default:
            console.log(`Unknown check: ${mostOverdue}`);
            process.exit(0);
    }
    
    // Update state
    check.lastRun = now.toISOString();
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    
    // Report or OK
    if (findings && findings.hasActionable) {
        console.log(`\n🔔 ${check.description}`);
        console.log(findings.message);
        // If there's a file to send, output the path for the agent
        if (findings.file) {
            console.log(`__FILE__:${findings.file}`);
        }
        if (findings.caption) {
            console.log(`__CAPTION__:${findings.caption}`);
        }
    } else {
        console.log('HEARTBEAT_OK');
    }
    
} catch (err) {
    console.error(`Check failed: ${err.message}`);
    console.log('HEARTBEAT_OK'); // Don't spam on errors
}

// Check implementations
function checkTodoist() {
    try {
        const token = process.env.TODOIST_API_TOKEN;
        if (!token) {
            return { hasActionable: false };
        }
        
        // Use v1 API sync endpoint with POST
        const output = execSync(
            `curl -fsSL -X POST "https://api.todoist.com/api/v1/sync" -H "Authorization: Bearer ${token}" -d "sync_token=*" -d "resource_types=%5B%22items%22%5D" 2>/dev/null || echo "{}"`,
            { encoding: 'utf8', timeout: 30000 }
        );
        const data = JSON.parse(output);
        const tasks = data.items || [];
        
        // AI Work project ID (from .openclaw-env and observed tasks)
        const AI_WORK_PROJECT_ID = '6fxHh9H9JGJv7V65';
        
        // Check for overdue or due-soon tasks
        const nowStr = new Date().toISOString().split('T')[0];
        const overdue = tasks.filter(t => t.due && t.due.date < nowStr);
        const dueToday = tasks.filter(t => t.due && t.due.date === nowStr);
        
        // Check for AI work tasks that need review
        const aiTasks = tasks.filter(t => t.project_id === AI_WORK_PROJECT_ID && !t.checked);
        
        if (overdue.length === 0 && dueToday.length === 0 && aiTasks.length === 0) {
            return { hasActionable: false };
        }
        
        let msg = '';
        
        // AI Work tasks take priority - investigate and provide context
        if (aiTasks.length > 0) {
            msg += `🤖 AI Work Tasks Found (${aiTasks.length}):\n`;
            msg += '─'.repeat(40) + '\n';
            
            for (const task of aiTasks) {
                msg += `\n📋 Task: ${task.content}\n`;
                msg += `   ID: ${task.id}\n`;
                if (task.due?.date) {
                    msg += `   Due: ${task.due.date}\n`;
                }
                if (task.description) {
                    msg += `   Description: ${task.description}\n`;
                }
                
                // Investigate context based on task content
                const investigation = investigateAITask(task, tasks);
                if (investigation) {
                    msg += `   \n   📊 Investigation:\n`;
                    investigation.split('\n').forEach(line => {
                        msg += `      ${line}\n`;
                    });
                }
            }
            
            msg += '\n' + '─'.repeat(40) + '\n';
            msg += 'Reply "review AI task [id]" to analyze in depth,\n';
            msg += 'or "do AI task [id]" to get approval + execute.\n';
        }
        
        if (overdue.length > 0) {
            msg += `\n⚠️ ${overdue.length} overdue task${overdue.length > 1 ? 's' : ''}\n`;
            msg += overdue.map(t => `  • ${t.content.substring(0, 50)}`).join('\n');
        }
        
        if (dueToday.length > 0) {
            msg += `\n📋 ${dueToday.length} task${dueToday.length > 1 ? 's' : ''} due today\n`;
            msg += dueToday.map(t => `  • ${t.content.substring(0, 50)}`).join('\n');
        }
        
        return { hasActionable: true, message: msg };
    } catch (err) {
        return { hasActionable: false };
    }
}

function investigateAITask(task, allTasks) {
    const content = task.content.toLowerCase();
    const description = (task.description || '').toLowerCase();
    const combined = content + ' ' + description;
    
    let investigation = '';
    
    // Electric lab PR task
    if (content.includes('electric lab') || content.includes('electricLab') || combined.includes('electriclab')) {
        try {
            const electricLabPath = join(WORKSPACE, 'electric_lab_vue3');
            if (existsSync(electricLabPath)) {
                // Check for the branch
                try {
                    execSync('git fetch --quiet', { cwd: electricLabPath, timeout: 10000 });
                    const branches = execSync('git branch -r | grep more_space', { cwd: electricLabPath, encoding: 'utf8', timeout: 10000 });
                    investigation += `- Branch 'more_space_between_buttons' exists\n`;
                } catch (e) {
                    investigation += `- Branch may not exist or not fetched yet\n`;
                }
                
                // Check current branch and status
                try {
                    const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: electricLabPath, encoding: 'utf8', timeout: 5000 });
                    const status = execSync('git status --porcelain', { cwd: electricLabPath, encoding: 'utf8', timeout: 5000 });
                    investigation += `- Current branch: ${currentBranch.trim()}\n`;
                    investigation += `- Has uncommitted changes: ${status.trim() ? 'Yes' : 'No'}\n`;
                } catch (e) {
                    // Ignore
                }
            }
        } catch (e) {
            investigation += `- Could not access electric_lab_vue3 repo\n`;
        }
    }
    
    // AI call center monitoring task
    if (content.includes('ai call center') || combined.includes('call center')) {
        investigation += `- Project: pharmacy_ai_agent or ion (check for AI call center code)\n`;
        investigation += `- Task: Add observability/monitoring\n`;
        investigation += `- Suggest: Check for existing monitoring (Prometheus, logs, alerts)\n`;
    }
    
    // Shipping labels task
    if (combined.includes('shipping label') || combined.includes('203dpi')) {
        investigation += `- Documentation task\n`;
        investigation += `- Location: Likely in pmk/docs or local_settings files\n`;
    }
    
    // General task investigation
    if (!investigation) {
        investigation += `- Task type: ${content.includes('fix') ? 'Bug fix' : content.includes('add') ? 'Feature' : content.includes('update') ? 'Update' : 'General'}\n`;
        investigation += `- Priority: ${task.priority || 'Unknown'}\n`;
        investigation += `- Check relevant repos based on task content\n`;
    }
    
    return investigation;
}

function checkGitUpdate() {
    const repos = ['ion', 'pmk', 'electric_lab_vue3', 'pmk_js', 'pharmacy_ai_agent', 'provider-admin-portal', 'obsidian'];
    const updated = [];
    const failed = [];
    const importantChanges = [];
    const securityUpdates = [];
    
    for (const repo of repos) {
        const repoPath = join(WORKSPACE, repo);
        try {
            // Fetch latest
            execSync('git fetch --quiet', { cwd: repoPath, timeout: 30000 });
            const behind = execSync('git rev-list HEAD..@{u} --count', {
                cwd: repoPath,
                encoding: 'utf8',
                timeout: 10000
            }).trim();
            
            const commitsBehind = parseInt(behind) || 0;
            if (commitsBehind > 0) {
                // Get commit details before pulling
                const commits = execSync('git log --oneline HEAD..@{u}', {
                    cwd: repoPath,
                    encoding: 'utf8',
                    timeout: 10000
                }).trim().split('\n');
                
                // Check for important changes
                const important = detectImportantChanges(repo, commits);
                if (important.length > 0) {
                    importantChanges.push({ repo, changes: important });
                }
                
                // Check for security updates
                const security = detectSecurityUpdates(repo, commits);
                if (security.length > 0) {
                    securityUpdates.push({ repo, updates: security });
                }
                
                // Pull the changes
                execSync('git pull --quiet', { cwd: repoPath, timeout: 60000 });
                updated.push({ repo, commits: commitsBehind, summaries: commits.slice(0, 3) });
                
                // Log to daily file
                logGitActivity(repo, commits);
            }
            
            // Health check: alert if repo is far behind
            if (commitsBehind > 50) {
                importantChanges.push({ 
                    repo, 
                    changes: [`⚠️ Repo is ${commitsBehind} commits behind! Consider more frequent updates.`] 
                });
            }
            
        } catch (err) {
            failed.push({ repo, error: err.message });
        }
    }
    
    // Build message
    if (updated.length === 0 && importantChanges.length === 0 && securityUpdates.length === 0) {
        return { hasActionable: false };
    }
    
    let msg = '🔄 Git sync:\n';
    
    // Report updates
    if (updated.length > 0) {
        msg += updated.map(u => {
            let line = `  • ${u.repo}: +${u.commits} commits`;
            if (u.summaries.length > 0) {
                line += `\n    ${u.summaries.join('\n    ')}`;
            }
            return line;
        }).join('\n') + '\n';
    }
    
    // Report important changes
    if (importantChanges.length > 0) {
        msg += '\n🔔 Important changes:\n';
        importantChanges.forEach(ic => {
            msg += `  • ${ic.repo}:\n`;
            ic.changes.forEach(change => msg += `    ${change}\n`);
        });
    }
    
    // Report security updates
    if (securityUpdates.length > 0) {
        msg += '\n🔒 Security updates:\n';
        securityUpdates.forEach(su => {
            msg += `  • ${su.repo}:\n`;
            su.updates.forEach(update => msg += `    ${update}\n`);
        });
    }
    
    // Report failures
    if (failed.length > 0) {
        msg += '\n❌ Failed:\n';
        failed.forEach(f => msg += `  • ${f.repo}: ${f.error}\n`);
    }
    
    return { hasActionable: true, message: msg.trim() };
}

function detectImportantChanges(repo, commits) {
    const important = [];
    
    for (const commit of commits) {
        const message = commit.toLowerCase();
        
        // Breaking changes
        if (message.includes('breaking') || message.includes('major') || message.includes('!')) {
            important.push(`🚨 Breaking: ${commit}`);
        }
        
        // Config changes
        if (message.includes('config') || message.includes('env') || message.includes('settings')) {
            important.push(`⚙️ Config: ${commit}`);
        }
        
        // Major package updates
        if (message.includes('package') && (message.includes('major') || message.includes('bump'))) {
            important.push(`📦 Package: ${commit}`);
        }
        
        // Database migrations
        if (message.includes('migration') || message.includes('schema')) {
            important.push(`🗄️ Database: ${commit}`);
        }
        
        // API changes
        if (message.includes('api') && (message.includes('endpoint') || message.includes('route'))) {
            important.push(`🌐 API: ${commit}`);
        }
    }
    
    return important;
}

function detectSecurityUpdates(repo, commits) {
    const security = [];
    
    for (const commit of commits) {
        const message = commit.toLowerCase();
        
        // Security keywords
        if (message.includes('security') || message.includes('vulnerability') || 
            message.includes('cve') || message.includes('patch')) {
            security.push(`🔒 ${commit}`);
        }
        
        // Dependency updates (might include security patches)
        if (message.includes('dependabot') || message.includes('update dependencies')) {
            security.push(`📦 ${commit}`);
        }
    }
    
    return security;
}

function logGitActivity(repo, commits) {
    try {
        const today = new Date().toISOString().split('T')[0];
        const logFile = join(WORKSPACE, 'memory', `git-activity-${today}.md`);
        
        let log = `# Git Activity - ${today}\n\n`;
        log += `## ${repo}\n`;
        commits.forEach(commit => {
            log += `- ${commit}\n`;
        });
        log += '\n';
        
        // Append to log file
        execSync(`echo "${log.replace(/"/g, '\\"')}" >> "${logFile}"`, { timeout: 5000 });
    } catch (err) {
        // Ignore logging errors
    }
}

function runProactiveScans() {
    const findings = [];
    const now = new Date();

    // NOTE: Disk, memory (RAM), and load checks are handled by health-critical-simple.mjs (every 5 min)
    // This function focuses on file-based and service health checks

    // 1. Memory growth check - monitor memory/*.md file sizes (file storage, not RAM)
    try {
        const memoryPath = join(WORKSPACE, 'memory');
        const du = execSync(`du -sh ${memoryPath}/*.md 2>/dev/null | tail -1`, { encoding: 'utf8' });
        const size = du.trim().split('\t')[0];
        // Alert if memory folder > 1MB
        const totalSize = execSync(`du -sb ${memoryPath}/*.md 2>/dev/null | awk '{sum+=$1} END {print sum}'`, { encoding: 'utf8' }).trim();
        if (parseInt(totalSize) > 1048576) {
            findings.push(`📁 Memory folder at ${size} (>1MB)`);
        }
    } catch (err) {
        // Ignore if files don't exist
    }

    // 2. Cron health check - check for cron jobs file
    try {
        const cronFile = '/home/pi/.openclaw/cron/jobs.json';
        if (existsSync(cronFile)) {
            const cronData = JSON.parse(readFileSync(cronFile, 'utf8'));
            if (!cronData.jobs || cronData.jobs.length === 0) {
                findings.push(`⚠️ Cron scheduler has no jobs`);
            }
        } else {
            findings.push(`⚠️ Cron jobs file not found`);
        }
    } catch (err) {
        findings.push(`❌ Cron health check failed: ${err.message}`);
    }

    // 3. Backup verification - check last backup timestamp
    const backupLogs = [
        { file: '/home/pi/.openclaw/workspace/memory/backup.log', name: 'Git backup' },
        { file: '/home/pi/.openclaw/workspace/memory/tailscale-backup.log', name: 'Tailscale backup' }
    ];
    for (const backup of backupLogs) {
        try {
            // Search for any ISO timestamp in the file (not just last line)
            const content = execSync(`cat ${backup.file} 2>/dev/null`, { encoding: 'utf8' });
            const timestamps = content.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g) || [];
            if (timestamps.length > 0) {
                // Use the most recent timestamp
                const lastTimestamp = timestamps[timestamps.length - 1];
                const backupTime = new Date(lastTimestamp);
                const hoursAgo = (now - backupTime) / (1000 * 60 * 60);
                if (hoursAgo > 24) {
                    findings.push(`⚠️ ${backup.name} backup > 24h ago`);
                }
            } else {
                findings.push(`⚠️ ${backup.name} - no timestamp found`);
            }
        } catch (err) {
            findings.push(`⚠️ ${backup.name} log not found`);
        }
    }

    if (findings.length === 0) {
        return { hasActionable: false };
    }

    return { hasActionable: true, message: `🔧 Proactive scan:\n  • ${findings.join('\n  • ')}` };
}

function checkE621() {
    // Silently fetch and store art - don't send automatically
    // User can ask for art with "show me e621" or "send me some art"
    try {
        const output = execSync('node bin/e621-fetch-heartbeat.mjs', {
            cwd: WORKSPACE,
            encoding: 'utf8',
            timeout: 60000
        });
        
        console.log(output);
        
        // Just store silently - no automatic sending
        console.log('📥 Art fetched and stored silently. Ask me to show you some!');
        
        return { hasActionable: false };
    } catch (err) {
        console.error('e621 fetch failed:', err.message);
        return { hasActionable: false };
    }
}
