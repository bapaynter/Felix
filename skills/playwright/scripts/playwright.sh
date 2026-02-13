#!/usr/bin/env node
// Playwright Persistent Browser Manager
// Maintains browser state across multiple commands
// Usage: node playwright.sh <command> [args...]

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

const SERVER = path.join(__dirname, 'browser-server.js');
const PID_FILE = '/tmp/playwright-browser.pid';

let serverProc = null;
let currentUrl = null;

function getPid() {
    try { return parseInt(fs.readFileSync(PID_FILE, 'utf8')); } catch { return null; }
}

function isRunning(pid) {
    try { process.kill(pid, 0); return true; } catch { return false; }
}

async function startServer() {
    return new Promise((resolve, reject) => {
        console.error('[manager] Starting browser server...');

        serverProc = spawn('node', [SERVER], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let stderr = '';
        const rl = readline.createInterface({ input: serverProc.stderr, terminal: false });

        rl.on('line', (line) => {
            stderr += line + '\n';
            console.error(line);
            if (line.includes('[server] Ready')) {
                fs.writeFileSync(PID_FILE, serverProc.pid.toString());
                resolve(serverProc);
            }
        });

        serverProc.on('error', reject);

        setTimeout(() => reject(new Error('Server startup timeout')), 10000);
    });
}

async function sendCommand(pid, command, args = []) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            resolve({ ok: false, error: 'timeout' });
        }, 30000);

        // Use file-based IPC
        const cmdFile = `/tmp/playwright-cmd-${pid}.json`;
        const respFile = `/tmp/playwright-resp-${pid}.json`;

        try {
            try { fs.unlinkSync(respFile); } catch {}
            fs.writeFileSync(cmdFile, JSON.stringify({ command, args }));

            // Signal server
            try { process.kill(pid, 'USR1'); } catch {}

            // Poll for response
            let attempts = 0;
            const check = setInterval(() => {
                attempts++;
                if (fs.existsSync(respFile)) {
                    clearInterval(check);
                    clearTimeout(timeout);
                    try {
                        const resp = JSON.parse(fs.readFileSync(respFile, 'utf8'));
                        try { fs.unlinkSync(respFile); } catch {}
                        try { fs.unlinkSync(cmdFile); } catch {}
                        resolve(resp);
                    } catch (e) {
                        try { fs.unlinkSync(cmdFile); } catch {}
                        resolve({ ok: false, error: e.message });
                    }
                }
                if (attempts > 100) { // 10 seconds max
                    clearInterval(check);
                    clearTimeout(timeout);
                    try { fs.unlinkSync(cmdFile); } catch {}
                    resolve({ ok: false, error: 'timeout' });
                }
            }, 100);
        } catch (e) {
            resolve({ ok: false, error: e.message });
        }
    });
}

async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.error('Usage: node playwright.sh <command> [args...]');
        console.error('');
        console.error('Commands:');
        console.error('  open <url>              - Open page, start session');
        console.error('  title                   - Get page title');
        console.error('  url                     - Get current URL');
        console.error('  content                 - Get page text');
        console.error('  html                    - Get HTML');
        console.error('  screenshot [path]       - Take screenshot');
        console.error('  click <selector>        - Click element');
        console.error('  type <selector> <text>  - Type text');
        console.error('  eval <js>              - Execute JavaScript');
        console.error('  exists <selector>       - Check element exists');
        console.error('  links                   - List links');
        console.error('  wait <selector>        - Wait for element');
        console.error('  close                   - End session');
        console.error('  status                  - Check server status');
        console.error('  kill                    - Stop server');
        process.exit(1);
    }

    const command = args[0];
    const cmdArgs = args.slice(1);

    // Special commands
    if (command === 'kill' || command === 'stop') {
        const pid = getPid();
        if (pid && isRunning(pid)) {
            console.error('[manager] Stopping server...');
            try { process.kill(pid, 'SIGTERM'); } catch {}
            try { fs.unlinkSync(PID_FILE); } catch {}
        }
        console.error('[manager] Stopped');
        return;
    }

    if (command === 'status') {
        const pid = getPid();
        if (pid && isRunning(pid)) {
            console.error('[manager] Server running (PID:', pid + ')');
        } else {
            console.error('[manager] Server not running');
        }
        return;
    }

    // Start server if needed
    let serverPid = getPid();
    if (!serverPid || !isRunning(serverPid)) {
        try {
            await startServer();
            serverPid = getPid();
        } catch (err) {
            console.error('Failed to start server:', err.message);
            process.exit(1);
        }
    }

    // Prepare args
    let serverArgs = [];
    if (command === 'open') {
        serverArgs = [cmdArgs[0]];
    } else if (command === 'type') {
        serverArgs = [cmdArgs[0], cmdArgs.slice(1).join(' ')];
    } else if (command === 'screenshot' && cmdArgs[0]) {
        serverArgs = [cmdArgs[0]];
    } else {
        serverArgs = cmdArgs;
    }

    // Send command using SERVER's PID
    const resp = await sendCommand(serverPid, command, serverArgs);

    if (resp.ok) {
        if (typeof resp.result === 'object') {
            console.log(JSON.stringify(resp.result, null, 2));
        } else {
            console.log(resp.result);
        }
    } else {
        console.error('Error:', resp.error);
        process.exit(1);
    }
}

main().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
});