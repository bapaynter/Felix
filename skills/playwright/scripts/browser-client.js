#!/usr/bin/env node
// Playwright Browser Client - communicates with server via stdin/stdout

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const SERVER_SCRIPT = path.join(__dirname, 'browser-server.js');
const PID_FILE = '/tmp/playwright-browser.pid';
const LOG_FILE = '/tmp/playwright-browser.log';
const TIMEOUT = 30000;

function isServerRunning() {
    try {
        const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8'));
        process.kill(pid, 0);
        return pid;
    } catch {
        return null;
    }
}

function startServer() {
    return new Promise((resolve, reject) => {
        console.error('[client] Starting browser server...');

        const proc = spawn('node', [SERVER_SCRIPT], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        proc.stdout.setEncoding('utf8');
        proc.stderr.setEncoding('utf8');

        let stderr = '';
        proc.stderr.on('data', (data) => {
            stderr += data;
            if (stderr.includes('[server] Ready')) {
                fs.writeFileSync(PID_FILE, proc.pid.toString());
                resolve(proc);
            }
        });

        proc.on('error', reject);

        // Timeout
        setTimeout(() => {
            reject(new Error('Server startup timeout'));
        }, 10000);
    });
}

async function sendCommand(proc, command, args = []) {
    return new Promise((resolve, reject) => {
        let stdout = '';
        let resolved = false;

        const timeout = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                resolve({ success: false, error: 'timeout' });
            }
        }, TIMEOUT);

        proc.stdout.on('data', (data) => {
            stdout += data;

            // Check for complete JSON line
            const lines = stdout.split('\n');
            stdout = lines.pop();

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const result = JSON.parse(line);
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timeout);
                        resolve(result);
                    }
                    return;
                } catch {
                    // Not complete yet
                }
            }
        });

        proc.on('error', (err) => {
            if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                reject(err);
            }
        });

        // Send command
        proc.stdin.write(JSON.stringify({ command, args }) + '\n');
    });
}

async function runStateless(command, url, extraArgs = []) {
    const { chromium } = require('playwright');

    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    let result;
    switch (command) {
        case 'title':
            result = await page.title();
            break;
        case 'content':
            result = await page.textContent('body');
            break;
        case 'html':
            result = await page.content();
            break;
        case 'screenshot':
            result = await page.screenshot({
                path: extraArgs[0] || '/tmp/screenshot.png',
                fullPage: true
            });
            break;
        default:
            throw new Error(`Unknown command: ${command}`);
    }

    await browser.close();
    return result;
}

async function main() {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.error('Usage: node browser-client.js <command> <url> [args...]');
        console.error('');
        console.error('Stateless: title|content|html|screenshot');
        console.error('Stateful: open|click|type|eval|exists|links|wait|close');
        process.exit(1);
    }

    const command = args[0];
    const url = args[1];
    const extraArgs = args.slice(2);

    // Stateless commands
    if (['title', 'content', 'html', 'screenshot'].includes(command)) {
        try {
            const result = await runStateless(command, url, extraArgs);
            console.log(result);
        } catch (err) {
            console.error('Error:', err.message);
            process.exit(1);
        }
        return;
    }

    // Stateful commands
    let pid = isServerRunning();
    let proc = null;

    if (!pid) {
        try {
            proc = await startServer();
            pid = proc.pid;
        } catch (err) {
            console.error('Failed to start server:', err.message);
            process.exit(1);
        }
    } else {
        // Attach to existing server process
        const { spawn } = require('child_process');
        proc = spawn('node', [SERVER_SCRIPT], {
            stdio: ['pipe', 'pipe', 'pipe']
        });
        proc.stdout.setEncoding('utf8');
        proc.stderr.setEncoding('utf8');
    }

    // For open command, use URL as first arg
    let serverArgs = [];
    if (command === 'open') {
        serverArgs = [url];
    } else if (command === 'type') {
        serverArgs = [extraArgs[0], extraArgs.slice(1).join(' ')];
    } else if (command === 'screenshot' && url) {
        serverArgs = [url, extraArgs[0] || '/tmp/screenshot.png'];
    } else if (url && !['click', 'eval', 'exists', 'links', 'wait', 'close'].includes(command)) {
        serverArgs = [url];
    } else {
        serverArgs = extraArgs;
    }

    try {
        const response = await sendCommand(proc, command, serverArgs);

        if (response.success) {
            if (typeof response.result === 'object') {
                console.log(JSON.stringify(response.result, null, 2));
            } else {
                console.log(response.result);
            }
        } else {
            console.error('Error:', response.error);
            process.exit(1);
        }

        // Keep process running for future commands (stateful mode)
        if (command !== 'close') {
            // Store the process for future use
            // For now, just return - the server stays running
        }
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

main();