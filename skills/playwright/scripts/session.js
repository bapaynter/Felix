#!/usr/bin/env node
// Playwright Persistent Session Manager
// Usage: node session.js <url> <cmd1> [cmd2] ...
// Example: node session.js https://example.com "click|.btn" "type|#email|test" "eval|title"

const { chromium } = require('playwright');

async function main() {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.error('Usage: node session.js <url> <cmd1> [cmd2] ...');
        console.error('');
        console.error('Commands (pipe-separated):');
        console.error('  click|selector');
        console.error('  type|selector|text');
        console.error('  eval|javascript');
        console.error('  exists|selector');
        console.error('  wait|selector');
        console.error('  screenshot|[path]');
        console.error('  get-title');
        console.error('  get-content');
        console.error('  get-links');
        console.error('');
        console.error('Example:');
        console.error('  node session.js https://example.com "click|.btn" "type|#email|me@com" "eval|title"');
        process.exit(1);
    }

    const url = args[0];
    const commands = args.slice(1);

    console.error('[session] Starting browser...');

    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    console.error('[session] Page loaded');

    for (const cmd of commands) {
        const parts = cmd.split('|');
        const action = parts[0];
        const arg1 = parts[1];
        const arg2 = parts.slice(1).join('|'); // Join rest for type command

        try {
            switch (action) {
                case 'get-title':
                    console.log(await page.title());
                    break;
                case 'get-content':
                    console.log(await page.textContent('body'));
                    break;
                case 'get-links':
                    const links = await page.$$eval('a', as => as.map(a => ({
                        text: a.textContent?.trim() || '',
                        href: a.href || ''
                    })).filter(l => l.href));
                    console.log(JSON.stringify(links, null, 2));
                    break;
                case 'click':
                    await page.click(arg1);
                    console.log('clicked');
                    break;
                case 'type':
                    await page.fill(arg1, arg2);
                    console.log('typed');
                    break;
                case 'eval':
                    const result = await page.evaluate(arg1);
                    console.log(result);
                    break;
                case 'exists':
                    const el = await page.$(arg1);
                    console.log(el ? 'true' : 'false');
                    break;
                case 'wait':
                    await page.waitForSelector(arg1, { timeout: 30000 });
                    console.log('found');
                    break;
                case 'screenshot':
                    await page.screenshot({ path: arg1 || '/tmp/screenshot.png', fullPage: true });
                    console.log('screenshot saved');
                    break;
                default:
                    console.error('Unknown command:', action);
            }
        } catch (err) {
            console.error('Error in', action + ':', err.message);
            await browser.close();
            process.exit(1);
        }
    }

    await browser.close();
    console.error('[session] Done');
}

main().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
});