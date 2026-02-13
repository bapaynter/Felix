#!/usr/bin/env node
/**
 * Cron Alert Manager - Checks for health alert files and creates cron jobs
 * Runs every minute to process health alerts
 */

import { existsSync, unlinkSync, readFileSync, writeFileSync } from 'fs';
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
                
                // Create a simple script that uses the cron tool
                const alertScript = `
import { cron } from 'openclaw';
cron.add(${JSON.stringify(alertData)}).then(() => {
    console.log('Alert cron job created successfully');
    process.exit(0);
}).catch(err => {
    console.error('Failed to create alert:', err.message);
    process.exit(1);
});
`;
                
                const scriptPath = join(WORKSPACE, '.temp-alert-script.mjs');
                writeFileSync(scriptPath, alertScript);
                
                // Run the script with full node path
                execSync(`/home/pi/.nvm/versions/node/v25.6.0/bin/node ${scriptPath}`, { 
                    timeout: 10000,
                    cwd: WORKSPACE 
                });
                
                // Clean up
                unlinkSync(scriptPath);
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