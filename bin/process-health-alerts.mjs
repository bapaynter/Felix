#!/usr/bin/env node
/**
 * Cron Alert Manager - Checks for health alert files and creates cron jobs
 * Runs every minute to process health alerts
 * Uses openclaw CLI directly via child process - no module imports needed
 */

import { existsSync, unlinkSync, readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const WORKSPACE = '/home/pi/.openclaw/workspace';
const OPENCLAW = '/home/pi/.nvm/versions/node/v25.6.0/bin/openclaw';
const NODE_PATH = '/home/pi/.nvm/versions/node/v25.6.0/bin/node';

async function processHealthAlerts() {
    const alerts = [
        'memory/critical-health-alert.json',
        'memory/resource-health-warning.json',
        'memory/daily-health-summary.json'
    ];

    // Check for reboot trigger first
    const rebootTriggerPath = join(WORKSPACE, '.reboot-trigger');
    if (existsSync(rebootTriggerPath)) {
        console.log('Reboot trigger detected!');
        try {
            // Use safe reboot script
            execSync(`${NODE_PATH} ${join(WORKSPACE, 'bin/safe-reboot.mjs')}`, {
                timeout: 30000,
                cwd: WORKSPACE
            });
            // If we get here, reboot failed
            console.log('Reboot did not execute - system may have shut down');
        } catch (err) {
            // Expected - reboot kills the process
            console.log('Reboot initiated successfully');
        }
        return;
    }

    for (const alertFile of alerts) {
        const fullPath = join(WORKSPACE, alertFile);

        if (existsSync(fullPath)) {
            try {
                // Read and parse the alert
                const alertData = JSON.parse(readFileSync(fullPath, 'utf8'));

                console.log(`Processing alert: ${alertFile}`);

                // Build openclaw cron add command from alert data
                let cmdArgs = [];

                // Schedule options
                if (alertData.schedule.kind === 'at') {
                    cmdArgs.push(`--at ${alertData.schedule.at}`);
                } else if (alertData.schedule.kind === 'every') {
                    cmdArgs.push(`--every ${alertData.schedule.everyMs}ms`);
                } else if (alertData.schedule.kind === 'cron') {
                    cmdArgs.push(`--cron "${alertData.schedule.expr}"`);
                    if (alertData.schedule.tz) {
                        cmdArgs.push(`--tz ${alertData.schedule.tz}`);
                    }
                }

                // Session target
                if (alertData.sessionTarget) {
                    cmdArgs.push(`--session ${alertData.sessionTarget}`);
                }

                // Payload
                if (alertData.payload.kind === 'systemEvent') {
                    // Escape quotes in the system event text
                    const escapedText = alertData.payload.text.replace(/"/g, '\\"');
                    cmdArgs.push(`--system-event "${escapedText}"`);
                } else if (alertData.payload.kind === 'agentTurn') {
                    // Escape quotes in the message
                    const escapedMessage = alertData.payload.message.replace(/"/g, '\\"');
                    cmdArgs.push(`--message "${escapedMessage}"`);
                    if (alertData.payload.model) {
                        cmdArgs.push(`--model ${alertData.payload.model}`);
                    }
                    if (alertData.payload.thinking) {
                        cmdArgs.push(`--thinking ${alertData.payload.thinking}`);
                    }
                }

                // Name
                if (alertData.name) {
                    cmdArgs.push(`--name "${alertData.name.replace(/"/g, '\\"')}"`);
                }

                // Delivery options
                if (alertData.delivery) {
                    if (alertData.delivery.channel) {
                        cmdArgs.push(`--channel ${alertData.delivery.channel}`);
                    }
                    if (alertData.delivery.to) {
                        cmdArgs.push(`--to ${alertData.delivery.to}`);
                    }
                    if (alertData.delivery.bestEffort) {
                        cmdArgs.push('--best-effort-deliver');
                    }
                }

                // Build the full command
                const fullCmd = `${OPENCLAW} cron add ${cmdArgs.join(' ')} --json`;

                // Execute
                const result = execSync(fullCmd, {
                    timeout: 10000,
                    shell: '/bin/sh'
                });

                console.log(`Cron job created successfully for ${alertFile}`);
                console.log(result.toString());

                // Remove the alert file
                unlinkSync(fullPath);
                console.log(`Removed alert file: ${alertFile}`);

            } catch (err) {
                console.error(`Failed to process alert ${alertFile}:`, err.message);
                // Try to remove the file to avoid infinite loops
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