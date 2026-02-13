#!/bin/bash
# Playwright Session Script - multi-step browser session in one call
# Usage: session.sh <url> <command> [args...]

usage() {
    echo "Usage: $0 <url> <command> [args...]"
    echo ""
    echo "Commands:"
    echo "  get-title              - Get page title"
    echo "  get-content            - Get page text content"
    echo "  get-links              - List all links"
    echo "  click <selector>       - Click element"
    echo "  type <selector> <text> - Type text"
    echo "  eval <js>              - Execute JavaScript"
    echo "  exists <selector>      - Check if element exists"
    echo "  screenshot [path]     - Take screenshot"
    echo ""
    echo "Multi-command workflow example:"
    echo '  $0 "https://example.com" "click|.btn" "type|#email|test@example.com" "click|.submit"'
    echo ""
    exit 1
}

if [ $# -lt 2 ]; then
    usage
fi

URL="$1"
shift

node -e "
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.goto('$URL', { waitUntil: 'domcontentloaded' });

    const args = $(printf '%s\n' "$@" | node -e "
        const lines = [];
        process.stdin.on('data', d => lines.push(...d.toString().trim().split('\\n')));
        process.stdin.on('end', () => console.log(JSON.stringify(lines)));
    ");

    for (const arg of args) {
        const parts = arg.split('|');
        const cmd = parts[0];
        const p1 = parts[1];
        const p2 = parts[2];

        switch (cmd) {
            case 'get-title':
                console.log(await page.title());
                break;
            case 'get-content':
                console.log(await page.textContent('body'));
                break;
            case 'get-links':
                console.log(JSON.stringify(await page.\$\$eval('a', a => a.map(x => ({text: x.textContent, href: x.href}))), null, 2));
                break;
            case 'click':
                await page.click(p1);
                console.log('clicked');
                break;
            case 'type':
                await page.fill(p1, p2);
                console.log('typed');
                break;
            case 'eval':
                console.log(await page.evaluate(p1));
                break;
            case 'exists':
                console.log(await page.\$(p1) ? 'true' : 'false');
                break;
            case 'screenshot':
                await page.screenshot({ path: p1 || '/tmp/screenshot.png', fullPage: true });
                console.log('screenshot saved');
                break;
        }
    }
    await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
"