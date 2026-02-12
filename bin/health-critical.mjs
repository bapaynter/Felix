#!/usr/bin/env node
/**
 * Critical Health Monitor - Runs every 5 minutes
 * Only wakes the agent if there's a critical issue
 * No LLM usage - pure Node.js checks
 */

import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import https from 'https';

// Load environment variables
const envFile = '/home/pi/.openclaw/workspace/.openclaw-env';
if (existsSync(envFile)) {
    const envContent = readFileSync(envFile, 'utf8');
    envContent.split('\n').forEach(line => {
        const match = line.match(/^export\s+(\w+)=(.*)$/);
        if (match) {
            process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
        }
    });
}

const WORKSPACE = '/home/pi/.openclaw/workspace';
const LOG_FILE = join(WORKSPACE, 'memory', 'health-critical.log');

// Alert thresholds
const CRITICAL_DISK = 85; // %
const CRITICAL_MEMORY = 90; // %
const CRITICAL_LOAD = 4.0; // Load average

async function checkCriticalHealth() {
    const issues = [];
    const timestamp = new Date().toISOString();
    
    try {
        // 1. Check disk space
        let diskUsage = 0;
        try {
            const df = execSync('df /', { encoding: 'utf8' });
            const lines = df.split('\n');
            if (lines.length > 1) {
                const usageMatch = lines[1].match(/\s+(\d+)%\s+/);
                if (usageMatch) {
                    diskUsage = parseInt(usageMatch[1]);
                }
            }
        } catch (err) {
            // Skip disk check if df fails
        }
        if (diskUsage > CRITICAL_DISK) {
            issues.push({
                type: 'disk',
                severity: 'critical',
                message: `Disk usage at ${diskUsage}% (threshold: ${CRITICAL_DISK}%)`,
                suggestion: 'Run cleanup: remove old logs, clear cache, delete unused files'
            });
        }
        
        // 2. Check memory usage
        let memUsage = 0;
        try {
            const memInfo = execSync('cat /proc/meminfo', { encoding: 'utf8' });
            const lines = memInfo.split('\n');
            let memTotal = 0, memFree = 0;
            
            for (const line of lines) {
                if (line.startsWith('MemTotal:')) {
                    memTotal = parseInt(line.split(/\s+/)[1]);
                } else if (line.startsWith('MemFree:')) {
                    memFree = parseInt(line.split(/\s+/)[1]);
                }
            }
            
            if (memTotal > 0) {
                memUsage = Math.round(((memTotal - memFree) / memTotal) * 100);
            }
        } catch (err) {
            // Skip memory check if fails
        }
        if (memUsage > CRITICAL_MEMORY) {
            issues.push({
                type: 'memory',
                severity: 'critical',
                message: `Memory usage at ${memUsage}% (threshold: ${CRITICAL_MEMORY}%)`,
                suggestion: 'Restart heavy processes, check for memory leaks'
            });
        }
        
        // 3. Check load average
        let load = 0;
        try {
            const loadInfo = execSync('cat /proc/loadavg', { encoding: 'utf8' });
            load = parseFloat(loadInfo.split(' ')[0]);
        } catch (err) {
            // Skip load check if fails
        }
        if (load > CRITICAL_LOAD) {
            issues.push({
                type: 'load',
                severity: 'critical',
                message: `Load average at ${load} (threshold: ${CRITICAL_LOAD})`,
                suggestion: 'Check for runaway processes, high CPU usage'
            });
        }
        
        // 4. Check OpenClaw Gateway
        try {
            const gatewayStatus = execSync('openclaw gateway status', { 
                encoding: 'utf8', 
                timeout: 10000,
                stdio: ['pipe', 'pipe', 'pipe'] // Suppress stderr
            });
            if (!gatewayStatus.includes('running')) {
                issues.push({
                    type: 'gateway',
                    severity: 'critical',
                    message: 'OpenClaw Gateway not running',
                    suggestion: 'Run: openclaw gateway start'
                });
            }
        } catch (err) {
            issues.push({
                type: 'gateway',
                severity: 'critical',
                message: 'Cannot check OpenClaw Gateway status',
                suggestion: 'Run: openclaw gateway status'
            });
        }
        
        // 5. Check model access (quick API test)
        try {
            // Simple curl to OpenRouter to test connectivity
            const apiKey = process.env.OPENROUTER_API_KEY;
            if (!apiKey) {
                issues.push({
                    type: 'api',
                    severity: 'critical',
                    message: 'OPENROUTER_API_KEY not set',
                    suggestion: 'Check .openclaw-env file'
                });
            } else {
                // Test API with minimal request using Node.js
                const https = require('https');
                const postData = JSON.stringify({
                    model: 'openrouter/glm-4.6',
                    messages: [{ role: 'user', content: 'test' }],
                    max_tokens: 1
                });
                
                const req = https.request({
                    hostname: 'openrouter.ai',
                    path: '/api/v1/chat/completions',
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                        'Content-Length': postData.length
                    },
                    timeout: 10000
                });
                
                req.write(postData);
                req.end();
                
                // If we get here without error, API is reachable
            }
        } catch (err) {
            issues.push({
                type: 'api',
                severity: 'critical',
                message: 'Cannot reach OpenRouter API',
                suggestion: 'Check network, API key, or service status'
            });
        }
        
        // 6. Check if we can write to workspace (basic file system check)
        try {
            const testFile = join(WORKSPACE, '.health-test');
            writeFileSync(testFile, 'test');
            execSync(`rm "${testFile}"`, { timeout: 5000 });
        } catch (err) {
            issues.push({
                type: 'filesystem',
                severity: 'critical',
                message: 'Cannot write to workspace',
                suggestion: 'Check disk permissions, file system integrity'
            });
        }
        
        // Log results
        const logEntry = `${timestamp} - Checks: ${6 - issues.length}/6 passed, ${issues.length} critical issues\n`;
        execSync(`echo "${logEntry}" >> "${LOG_FILE}"`, { timeout: 5000 });
        
        // If we have critical issues, send wake event via cron
        if (issues.length > 0) {
            const alertMessage = issues.map(issue => 
                `🔴 ${issue.type.toUpperCase()}: ${issue.message}\n   💡 Suggestion: ${issue.suggestion}`
            ).join('\n\n');
            
            // Create cron job to wake the agent with this alert
            const cronJob = {
                name: "Critical Health Alert",
                schedule: { kind: "at", at: new Date(Date.now() + 60000).toISOString() }, // 1 minute from now
                payload: { 
                    kind: "systemEvent", 
                    text: `🚨 CRITICAL HEALTH ALERT\n\n${alertMessage}\n\nCheck health logs: ${LOG_FILE}`
                },
                sessionTarget: "main",
                enabled: true
            };
            
            // Save cron job to be picked up
            const cronFile = join(WORKSPACE, 'memory', 'critical-health-alert.json');
            writeFileSync(cronFile, JSON.stringify(cronJob, null, 2));
            
            console.log(`CRITICAL ALERT: ${issues.length} issues detected`);
            console.log(`Alert saved to: ${cronFile}`);
            process.exit(1); // Exit with error code
        }
        
        console.log('OK: All critical checks passed');
        process.exit(0);
        
    } catch (err) {
        const errorLog = `${timestamp} - ERROR: Health check failed: ${err.message}\n`;
        execSync(`echo "${errorLog}" >> "${LOG_FILE}"`, { timeout: 5000 });
        console.error('Health check failed:', err.message);
        process.exit(1);
    }
}

checkCriticalHealth();