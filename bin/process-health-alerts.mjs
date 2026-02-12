#!/usr/bin/env node
/**
 * Cron Alert Manager - Checks for health alert files and creates cron jobs
 * Runs every minute to process health alerts
 */

import { existsSync, unlinkSync, readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const WORKSPACE = '/home/pi/.openclaw/workspace';

async function processHealthAlerts() {
    const alerts = [
        'memory/critical-health-alert.json',
        'memory/resource-health-warning.json',
        'memory/daily-health-summary.json'
    ];
    
    for (const alertFile of alerts) {
        const fullPath = join(WORKSPACE, alertFile);
        
        if (existsSync(fullPath)) {
            try {
                // Read and parse the alert
                const alertData = JSON.parse(readFileSync(fullPath, 'utf8'));
                
                // Create the cron job using the cron tool
                const cronCmd = `node -e "
const cron = require('cron');
const cronJob = ${JSON.stringify(alertData)};
console.log(JSON.stringify(cronJob));
" | curl -X POST http://localhost:18789/cron/add \
  -H 'Content-Type: application/json' \
  -d @-`;
                
                execSync(cronCmd, { timeout: 10000 });
                
                // Remove the alert file
                unlinkSync(fullPath);
                
                console.log(`Processed alert: ${alertFile}`);
                
            } catch (err) {
                console.error(`Failed to process alert ${alertFile}:`, err.message);
                // Try to remove the file to avoid loops
                try {
                    unlinkSync(fullPath);
                } catch (removeErr) {
                    // Ignore
                }
            }
        }
    }
}

processHealthAlerts();