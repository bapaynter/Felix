#!/usr/bin/env node
// Playwright Browser Manager - maintains persistent browser session
// Usage: node browser.sh <command> [args...]

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const SERVER = path.join(__dirname, 'browser-server.js');
const PID_FILE = '/tmp/playwright-browser.pid';
const SESSION_DIR = '/tmp/playwright-session';

// Global server process
let serverProc = null;

function getPid() {
    try { return parseInt(fs.readFileSync(PID_FILE, 'utf8')); } catch { return null; }
}

function isRunning(pid) {
    try { process.kill(pid, 0); return true; } catch { return false; }
}

function startServer() {
    console.error('[manager] Starting browser server...');

    serverProc = spawn('node', [SERVER], {
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false
    });

    serverProc.stdout.setEncoding('utf8');
    serverProc.stderr.setEncoding('utf8');

    let stderr = '';
    serverProc.stderr.on('data', (d) => {
        stderr += d;
        if (stderr.includes('[server] Ready')) {
            fs.writeFileSync(PID_FILE, serverProc.pid.toString());
            console.error('[manager] Server started');
        }
    });

    // Response handler
    let respBuf = '';
    serverProc.stdout.on('data', (d) => {
        respBuf += d;
        const lines = respBuf.split('\n');
        respBuf = lines.pop();
        for (const line of lines) {
            if (line.trim()) {
                const resp = JSON.parse(line);
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
        }
    });

    // Give it time to start
    return new Promise((resolve) => setTimeout(resolve, 2000));
}

function sendCommand(pid, command, args = []) {
    // Write to stdin
    const stdin = fs.openSync('/proc/self/fd/0', 'w');
    fs.writeFileSync(stdin, JSON.stringify({ command, args }) + '\n');
    fs.closeSync(stdin);
}

// Main
async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error('Usage: node browser.sh <command> [args...]');
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
        process.exit(1);
    }

    const command = args[0];
    const cmdArgs = args.slice(1);

    // Handle special commands
    if (command === 'kill' || command === 'stop') {
        const pid = getPid();
        if (pid && isRunning(pid)) {
            console.error('[manager] Killing server...');
            try { process.kill(pid, 'SIGTERM'); } catch {}
            try { fs.unlinkSync(PID_FILE); } catch {}
        }
        console.error('[manager] Done');
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

    // Check if server is running
    let pid = getPid();
    if (!pid || !isRunning(pid)) {
        await startServer();
        pid = getPid();
    }

    // For open command, pass URL as first arg
    let serverArgs = [];
    if (command === 'open') {
        serverArgs = [cmdArgs[0]];
    } else if (command === 'type') {
        serverArgs = [cmdArgs[0], cmdArgs.slice(1).join(' ')];
    } else if (command === 'screenshot' && cmdArgs[0]) {
        serverArgs = [cmdArgs[0]]; // path
    } else {
        serverArgs = cmdArgs;
    }

    // Send command via stdin
    const cmd = JSON.stringify({ command: command === 'open' ? 'open' : command, args: serverArgs });

    // Use a temp file for IPC
    const cmdFile = `/tmp/playwright-cmd-${pid}.json`;
    const respFile = `/tmp/playwright-resp-${pid}.json`;
    const lockFile = `/tmp/playwright-lock-${pid}.json`;

    fs.writeFileSync(cmdFile, cmd);
    fs.unlinkSync(respFile); // Clear old response

    // Signal server
    try { process.kill(pid, 'USR1'); } catch {}

    // Wait for response
    let tries = 0;
    while (!fs.existsSync(respFile) && tries < 50) {
        await new Promise(r => setTimeout(r, 100));
        tries++;
    }

    if (fs.existsSync(respFile)) {
        const resp = JSON.parse(fs.readFileSync(respFile, 'utf8'));
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
        fs.unlinkSync(respFile);
    } else {
        console.error('Error: timeout waiting for response');
        process.exit(1);
    }

    fs.unlinkSync(cmdFile);
}

main().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
});