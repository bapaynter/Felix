#!/usr/bin/env node
/**
 * Safe reboot script for Orange Pi Zero 3
 * Tries multiple methods to reboot around Allwinner SoC issues
 */

import { execSync } from 'child_process';

async function safeReboot() {
    console.log('Attempting safe reboot...');

    const methods = [
        {
            name: 'reboot -f (force)',
            cmd: 'reboot -f 2>&1',
            timeout: 5000
        },
        {
            name: 'systemctl reboot',
            cmd: 'systemctl reboot 2>&1',
            timeout: 5000
        },
        {
            name: 'watchdog trigger',
            cmd: 'echo 1 > /dev/watchdog 2>&1 || echo V > /dev/watchdog 2>&1',
            timeout: 3000
        },
        {
            name: 'sysrq emergency reboot',
            cmd: 'echo b > /proc/sysrq-trigger 2>&1',
            timeout: 3000
        },
        {
            name: 'kexec (if available)',
            cmd: 'kexec -e 2>&1 || echo "kexec not available"',
            timeout: 5000
        }
    ];

    for (const method of methods) {
        try {
            console.log(`Trying: ${method.name}`);
            execSync(method.cmd, { timeout: method.timeout });
            // If we get here, reboot succeeded (process was killed)
            return { success: true, method: method.name };
        } catch (err) {
            console.log(`  Failed: ${err.message.split('\n')[0]}`);
        }
    }

    return { success: false };
}

safeReboot().then(result => {
    if (result.success) {
        console.log(`Reboot initiated via ${result.method}`);
    } else {
        console.error('All reboot methods failed - manual power cycle may be required');
        process.exit(1);
    }
});