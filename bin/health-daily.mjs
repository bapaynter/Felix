#!/usr/bin/env node
/**
 * Daily Health Monitor - Runs once daily at 6 AM UTC
 * Deep health checks, security monitoring, cleanup
 * No LLM usage - pure Node.js checks
 */

import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

const WORKSPACE = '/home/pi/.openclaw/workspace';
const LOG_FILE = join(WORKSPACE, 'memory', 'health-daily.log');
const SUMMARY_FILE = join(WORKSPACE, 'memory', 'health-summary.json');

const repos = ['ion', 'pmk', 'electric_lab_vue3', 'pmk_js', 'pharmacy_ai_agent', 'provider-admin-portal', 'obsidian'];

async function runDailyHealthCheck() {
    const timestamp = new Date().toISOString();
    const results = {
        timestamp,
        checks: {},
        issues: [],
        summary: {}
    };
    
    try {
        console.log('Starting daily health check...');
        
        // 1. Repository health checks
        console.log('Checking repository health...');
        const repoResults = await checkRepositoryHealth();
        results.checks.repositories = repoResults;
        results.issues.push(...repoResults.issues);
        
        // 2. Security monitoring
        console.log('Running security checks...');
        const securityResults = await checkSecurity();
        results.checks.security = securityResults;
        results.issues.push(...securityResults.issues);
        
        // 3. Log cleanup
        console.log('Cleaning up old logs...');
        const cleanupResults = await cleanupLogs();
        results.checks.cleanup = cleanupResults;
        
        // 4. System health summary
        console.log('Generating health summary...');
        const healthSummary = await generateHealthSummary();
        results.summary = healthSummary;
        
        // 5. Check for stuck cron jobs
        console.log('Checking cron job health...');
        const cronResults = await checkCronHealth();
        results.checks.cron = cronResults;
        results.issues.push(...cronResults.issues);
        
        // Save results
        writeFileSync(SUMMARY_FILE, JSON.stringify(results, null, 2));
        
        // Log to daily file
        const logEntry = `${timestamp} - Daily health check completed\n`;
        execSync(`echo "${logEntry}" >> "${LOG_FILE}"`, { timeout: 5000 });
        
        // If we have issues, send alert
        if (results.issues.length > 0) {
            const alertMessage = results.issues.map(issue => 
                `🔍 ${issue.type}: ${issue.message}`
            ).join('\n\n');
            
            const cronJob = {
                name: "Daily Health Summary",
                schedule: { kind: "at", at: new Date(Date.now() + 60000).toISOString() },
                payload: { 
                    kind: "systemEvent", 
                    text: `📊 DAILY HEALTH SUMMARY\n\n${alertMessage}\n\nFull report: ${SUMMARY_FILE}`
                },
                sessionTarget: "main",
                enabled: true
            };
            
            const cronFile = join(WORKSPACE, 'memory', 'daily-health-summary.json');
            writeFileSync(cronFile, JSON.stringify(cronJob, null, 2));
            
            console.log(`Daily check found ${results.issues.length} issues`);
        } else {
            console.log('Daily health check: All systems healthy');
        }
        
        console.log('Daily health check completed');
        process.exit(0);
        
    } catch (err) {
        const errorLog = `${timestamp} - ERROR: Daily health check failed: ${err.message}\n`;
        execSync(`echo "${errorLog}" >> "${LOG_FILE}"`, { timeout: 5000 });
        console.error('Daily health check failed:', err.message);
        process.exit(1);
    }
}

async function checkRepositoryHealth() {
    const result = { healthy: 0, issues: [], details: [] };
    
    for (const repo of repos) {
        const repoPath = join(WORKSPACE, repo);
        const repoResult = { repo, status: 'healthy', issues: [] };
        
        try {
            // Check if repo exists
            if (!existsSync(repoPath)) {
                repoResult.status = 'missing';
                repoResult.issues.push('Repository directory missing');
                result.issues.push({ type: 'repository', message: `${repo}: directory missing` });
                continue;
            }
            
            // Check git status
            const status = execSync('git status --porcelain', {
                cwd: repoPath,
                encoding: 'utf8',
                timeout: 10000
            });
            
            if (status.trim()) {
                repoResult.status = 'dirty';
                repoResult.issues.push('Uncommitted changes');
                result.issues.push({ type: 'repository', message: `${repo}: has uncommitted changes` });
            }
            
            // Check for stale repos (no updates in 7 days)
            const lastCommit = execSync('git log -1 --format="%ct"', {
                cwd: repoPath,
                encoding: 'utf8',
                timeout: 10000
            }).trim();
            
            const daysSinceCommit = Math.floor((Date.now() / 1000 - parseInt(lastCommit)) / 86400);
            if (daysSinceCommit > 7) {
                repoResult.issues.push(`No commits for ${daysSinceCommit} days`);
                result.issues.push({ type: 'repository', message: `${repo}: stale (${daysSinceCommit} days)` });
            }
            
            // Weekly git fsck (corruption check)
            const today = new Date().getDay();
            if (today === 0) { // Sunday
                try {
                    execSync('git fsck --no-dangling', { 
                        cwd: repoPath, 
                        timeout: 60000,
                        stdio: ['pipe', 'pipe', 'pipe']
                    });
                } catch (fsckErr) {
                    repoResult.status = 'corrupted';
                    repoResult.issues.push('Git fsck found issues');
                    result.issues.push({ type: 'repository', message: `${repo}: possible corruption` });
                }
            }
            
        } catch (err) {
            repoResult.status = 'error';
            repoResult.issues.push(`Check failed: ${err.message}`);
            result.issues.push({ type: 'repository', message: `${repo}: check failed` });
        }
        
        result.details.push(repoResult);
        if (repoResult.status === 'healthy') result.healthy++;
    }
    
    return result;
}

async function checkSecurity() {
    const result = { issues: [], details: [] };
    
    try {
        // Check for failed SSH attempts
        const sshFailures = execSync('grep "Failed password" /var/log/auth.log 2>/dev/null | wc -l || echo "0"', {
            encoding: 'utf8',
            timeout: 10000
        }).trim();
        
        const failures = parseInt(sshFailures);
        if (failures > 10) {
            result.issues.push({ type: 'security', message: `${failures} failed SSH attempts detected` });
        }
        result.details.push({ check: 'ssh_failures', count: failures });
        
        // Check for unusual processes
        const suspiciousProcs = execSync('ps aux | grep -E "(nc|netcat|wget|curl.*sh|/bin/sh)" | grep -v grep | wc -l || echo "0"', {
            encoding: 'utf8',
            timeout: 10000
        }).trim();
        
        const procs = parseInt(suspiciousProcs);
        if (procs > 0) {
            result.issues.push({ type: 'security', message: `${procs} potentially suspicious processes running` });
        }
        result.details.push({ check: 'suspicious_processes', count: procs });
        
        // Check firewall status
        try {
            const firewallStatus = execSync('sudo ufw status | head -1', {
                encoding: 'utf8',
                timeout: 5000
            }).trim();
            
            if (firewallStatus.includes('inactive')) {
                result.issues.push({ type: 'security', message: 'Firewall is inactive' });
            }
            result.details.push({ check: 'firewall', status: firewallStatus });
        } catch (err) {
            result.details.push({ check: 'firewall', status: 'unknown' });
        }
        
    } catch (err) {
        result.issues.push({ type: 'security', message: `Security check failed: ${err.message}` });
    }
    
    return result;
}

async function cleanupLogs() {
    const result = { cleaned: 0, errors: [] };
    
    try {
        // Clean old health logs (keep 30 days)
        const healthLogs = execSync('find memory -name "health-*.log" -mtime +30 -delete 2>/dev/null; echo "done"', {
            encoding: 'utf8',
            timeout: 10000
        }).trim();
        
        // Clean old git activity logs (keep 90 days)
        const gitLogs = execSync('find memory -name "git-activity-*.md" -mtime +90 -delete 2>/dev/null; echo "done"', {
            encoding: 'utf8',
            timeout: 10000
        }).trim();
        
        // Clean old heartbeat state backups (keep 7 days)
        const stateBackups = execSync('find memory -name "heartbeat-state*.json.backup" -mtime +7 -delete 2>/dev/null; echo "done"', {
            encoding: 'utf8',
            timeout: 10000
        }).trim();
        
        result.cleaned = 3; // Number of cleanup operations
    } catch (err) {
        result.errors.push(err.message);
    }
    
    return result;
}

async function generateHealthSummary() {
    const summary = {};
    
    try {
        // System uptime
        const uptime = execSync('uptime -p', { encoding: 'utf8' }).trim();
        summary.uptime = uptime;
        
        // Disk usage
        const df = execSync('df -h / | tail -1', { encoding: 'utf8' });
        summary.disk = df.match(/(\d+)%/)[1] + '%';
        
        // Memory usage
        const memInfo = execSync('free | grep Mem', { encoding: 'utf8' });
        const memTotal = parseInt(memInfo.split(/\s+/)[1]);
        const memUsed = parseInt(memInfo.split(/\s+/)[2]);
        summary.memory = Math.round((memUsed / memTotal) * 100) + '%';
        
        // Load average
        const loadAvg = execSync('cat /proc/loadavg | cut -d" " -f1-3', { encoding: 'utf8' }).trim();
        summary.load = loadAvg;
        
        // OpenClaw version
        try {
            const version = execSync('openclaw --version 2>/dev/null || echo "unknown"', { encoding: 'utf8' }).trim();
            summary.openclaw = version;
        } catch (err) {
            summary.openclaw = 'unknown';
        }
        
    } catch (err) {
        summary.error = err.message;
    }
    
    return summary;
}

async function checkCronHealth() {
    const result = { issues: [], details: [] };
    
    try {
        // Check if cron service is running
        const cronStatus = execSync('systemctl is-active cron', { encoding: 'utf8' }).trim();
        if (cronStatus !== 'active') {
            result.issues.push({ type: 'cron', message: `Cron service is ${cronStatus}` });
        }
        result.details.push({ check: 'cron_service', status: cronStatus });
        
        // Check for stuck cron jobs (processes running > 2 hours)
        const longRunning = execSync('ps aux | grep cron | grep -v grep | awk \'{if ($10 > "02:00") print $2}\' | wc -l || echo "0"', {
            encoding: 'utf8',
            timeout: 5000
        }).trim();
        
        const longCount = parseInt(longRunning);
        if (longCount > 0) {
            result.issues.push({ type: 'cron', message: `${longCount} cron jobs running > 2 hours` });
        }
        result.details.push({ check: 'long_running_jobs', count: longCount });
        
    } catch (err) {
        result.issues.push({ type: 'cron', message: `Cron health check failed: ${err.message}` });
    }
    
    return result;
}

runDailyHealthCheck();