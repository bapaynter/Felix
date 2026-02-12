#!/usr/bin/env node
/**
 * Resource Health Monitor - Runs every 30 minutes
 * Checks system resources and alerts on warnings
 * No LLM usage - pure Node.js checks
 */

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path';

const WORKSPACE = '/home/pi/.openclaw/workspace';
const LOG_FILE = join(WORKSPACE, 'memory', 'health-resources.log');

// Warning thresholds
const WARN_DISK = 75; // %
const WARN_MEMORY = 80; // %
const WARN_LOAD = 2.0; // Load average
const WARN_CPU = 70; // % sustained

async function checkResourceHealth() {
    const issues = [];
    const timestamp = new Date().toISOString();
    
    try {
        // 1. Check disk space
        const df = execSync('df -h / | tail -1', { encoding: 'utf8' });
        const diskUsage = parseInt(df.match(/(\d+)%/)[1]);
        if (diskUsage > WARN_DISK) {
            issues.push({
                type: 'disk',
                severity: 'warning',
                message: `Disk usage at ${diskUsage}% (threshold: ${WARN_DISK}%)`,
                suggestion: 'Consider cleanup soon'
            });
        }
        
        // 2. Check memory usage
        const memInfo = execSync('free | grep Mem', { encoding: 'utf8' });
        const memTotal = parseInt(memInfo.split(/\s+/)[1]);
        const memUsed = parseInt(memInfo.split(/\s+/)[2]);
        const memUsage = Math.round((memUsed / memTotal) * 100);
        if (memUsage > WARN_MEMORY) {
            issues.push({
                type: 'memory',
                severity: 'warning',
                message: `Memory usage at ${memUsage}% (threshold: ${WARN_MEMORY}%)`,
                suggestion: 'Monitor for memory leaks'
            });
        }
        
        // 3. Check load average
        const loadAvg = execSync('cat /proc/loadavg | cut -d" " -f1', { encoding: 'utf8' }).trim();
        const load = parseFloat(loadAvg);
        if (load > WARN_LOAD) {
            issues.push({
                type: 'load',
                severity: 'warning',
                message: `Load average at ${load} (threshold: ${WARN_LOAD})`,
                suggestion: 'Check CPU usage trends'
            });
        }
        
        // 4. Check CPU usage (top采样)
        try {
            const cpuUsage = execSync('top -bn1 | grep "Cpu(s)" | sed "s/.*, *\\([0-9.]*\\)%* id.*/\\1/" | awk \'{print 100 - $1}\'', { 
                encoding: 'utf8', 
                timeout: 10000 
            }).trim();
            const cpu = parseFloat(cpuUsage);
            if (cpu > WARN_CPU) {
                issues.push({
                    type: 'cpu',
                    severity: 'warning',
                    message: `CPU usage at ${cpu}% (threshold: ${WARN_CPU}%)`,
                    suggestion: 'Check for high CPU processes'
                });
            }
        } catch (err) {
            // CPU check failed, but don't treat as critical
        }
        
        // 5. Check network connectivity
        try {
            execSync('ping -c 1 8.8.8.8 > /dev/null 2>&1', { timeout: 10000 });
        } catch (err) {
            issues.push({
                type: 'network',
                severity: 'warning',
                message: 'Cannot reach external network (8.8.8.8)',
                suggestion: 'Check network connection'
            });
        }
        
        // 6. Check Tailscale status
        try {
            const tailscaleStatus = execSync('tailscale status --json', { 
                encoding: 'utf8', 
                timeout: 10000,
                stdio: ['pipe', 'pipe', 'pipe']
            });
            const status = JSON.parse(tailscaleStatus);
            if (!status.BackendState || status.BackendState !== 'Running') {
                issues.push({
                    type: 'tailscale',
                    severity: 'warning',
                    message: 'Tailscale not running',
                    suggestion: 'Run: tailscale up'
                });
            }
        } catch (err) {
            // Tailscale might not be installed or accessible
        }
        
        // 7. Check for zombie processes
        try {
            const zombies = execSync('ps aux | awk \'{print $8}\' | grep -c Z', { 
                encoding: 'utf8', 
                timeout: 5000 
            }).trim();
            if (parseInt(zombies) > 0) {
                issues.push({
                    type: 'processes',
                    severity: 'warning',
                    message: `${zombies} zombie process(es) detected`,
                    suggestion: 'Check for stuck processes'
                });
            }
        } catch (err) {
            // Ignore process check failures
        }
        
        // Log results
        const logEntry = `${timestamp} - Checks: ${7 - issues.length}/7 passed, ${issues.length} warnings\n`;
        execSync(`echo "${logEntry}" >> "${LOG_FILE}"`, { timeout: 5000 });
        
        // If we have warnings, send wake event
        if (issues.length > 0) {
            const alertMessage = issues.map(issue => 
                `🟡 ${issue.type.toUpperCase()}: ${issue.message}\n   💡 ${issue.suggestion}`
            ).join('\n\n');
            
            // Create cron job to wake the agent with this alert
            const cronJob = {
                name: "Resource Health Warning",
                schedule: { kind: "at", at: new Date(Date.now() + 60000).toISOString() }, // 1 minute from now
                payload: { 
                    kind: "systemEvent", 
                    text: `⚠️ RESOURCE HEALTH WARNING\n\n${alertMessage}\n\nCheck resource logs: ${LOG_FILE}`
                },
                sessionTarget: "main",
                enabled: true
            };
            
            // Save cron job to be picked up
            const cronFile = join(WORKSPACE, 'memory', 'resource-health-warning.json');
            writeFileSync(cronFile, JSON.stringify(cronJob, null, 2));
            
            console.log(`WARNING: ${issues.length} resource issues detected`);
            console.log(`Alert saved to: ${cronFile}`);
            process.exit(1); // Exit with error code
        }
        
        console.log('OK: All resource checks passed');
        process.exit(0);
        
    } catch (err) {
        const errorLog = `${timestamp} - ERROR: Resource check failed: ${err.message}\n`;
        execSync(`echo "${errorLog}" >> "${LOG_FILE}"`, { timeout: 5000 });
        console.error('Resource check failed:', err.message);
        process.exit(1);
    }
}

checkResourceHealth();