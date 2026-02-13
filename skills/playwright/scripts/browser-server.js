#!/usr/bin/env node
// Playwright Browser Server - persistent browser with stdin/stdout communication
// Usage: node browser-server.js
// Send JSON commands via stdin, receive JSON responses via stdout

const { chromium } = require('playwright');
const readline = require('readline');

const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

let browser = null;
let page = null;
let lastActivity = Date.now();

async function init() {
    console.error('[server] Launching browser...');
    browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 }
    });
    page = await context.newPage();
    console.error('[server] Browser ready');
}

async function execute(command, args = []) {
    lastActivity = Date.now();

    // Navigation commands
    if (command === 'open' || command === 'goto') {
        await page.goto(args[0], { waitUntil: 'domcontentloaded', timeout: 30000 });
        return { title: await page.title(), url: page.url() };
    }

    if (!page) {
        throw new Error('No page open. Use "open <url>" first.');
    }

    switch (command) {
        case 'title':
            return await page.title();

        case 'url':
            return page.url();

        case 'content':
            return await page.textContent('body');

        case 'html':
            return await page.content();

        case 'screenshot':
            const path = args[0] || '/tmp/playwright-screenshot.png';
            await page.screenshot({ path, fullPage: true });
            return path;

        case 'click':
            await page.click(args[0]);
            return 'clicked';

        case 'type':
            await page.fill(args[0], args[1] || '');
            return 'typed';

        case 'eval':
            return await page.evaluate(args[0]);

        case 'exists':
            return (await page.$(args[0])) !== null;

        case 'links':
            return await page.$$eval('a', as => as.map(a => ({
                text: a.textContent?.trim() || '',
                href: a.href || ''
            })).filter(l => l.href));

        case 'wait':
            await page.waitForSelector(args[0], { timeout: 30000 });
            return 'found';

        case 'text':
            return await page.textContent(args[0]);

        case 'get-value':
            return await page.inputValue(args[0]);

        case 'close':
            if (browser) {
                await browser.close();
                browser = null;
                page = null;
            }
            return 'closed';

        case 'ping':
            return 'pong';

        default:
            throw new Error(`Unknown command: ${command}`);
    }
}

async function shutdown() {
    console.error('[server] Shutting down...');
    if (browser) {
        try { await browser.close(); } catch {}
    }
    process.exit(0);
}

function sendResponse(data) {
    console.log(JSON.stringify(data));
}

async function idleCheck() {
    if (browser && Date.now() - lastActivity > INACTIVITY_TIMEOUT_MS) {
        console.error('[server] Auto-closing due to inactivity');
        await shutdown();
    }
}

async function main() {
    await init();

    // Set up readline interface
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
    });

    rl.on('line', async (line) => {
        if (!line.trim()) return;

        try {
            const { command, args } = JSON.parse(line);
            const result = await execute(command, args);
            sendResponse({ ok: true, result });
        } catch (err) {
            sendResponse({ ok: false, error: err.message });
        }
    });

    // Handle signals
    process.on('SIGTERM', () => shutdown());
    process.on('SIGINT', () => shutdown());

    // Idle check
    setInterval(idleCheck, 30000);

    console.error('[server] Ready for commands');
}

main().catch(err => {
    console.error('[server] Fatal:', err.message);
    process.exit(1);
});