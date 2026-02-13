
import { cron } from 'openclaw';
cron.add({"name":"Critical Health Alert","schedule":{"kind":"at","at":"2026-02-13T02:01:01.542Z"},"payload":{"kind":"systemEvent","text":"🚨 CRITICAL HEALTH ALERT\n\n🔴 MEMORY: Memory usage at 94% (threshold: 90%)\n   💡 Suggestion: Restart heavy processes, check for memory leaks\n\nCheck health logs: /home/pi/.openclaw/workspace/memory/health-critical.log"},"sessionTarget":"main","enabled":true}).then(() => {
    console.log('Alert cron job created successfully');
    process.exit(0);
}).catch(err => {
    console.error('Failed to create alert:', err.message);
    process.exit(1);
});
