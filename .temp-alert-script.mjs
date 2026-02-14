
import { cron } from 'openclaw';
cron.add({"name":"Resource Health Warning","schedule":{"kind":"at","at":"2026-02-14T01:31:02.138Z"},"payload":{"kind":"systemEvent","text":"⚠️ RESOURCE HEALTH WARNING\n\n🟡 PROCESSES: 1 zombie process(es) detected\n   💡 Check for stuck processes\n\nCheck resource logs: /home/pi/.openclaw/workspace/memory/health-resources.log"},"sessionTarget":"main","enabled":true}).then(() => {
    console.log('Alert cron job created successfully');
    process.exit(0);
}).catch(err => {
    console.error('Failed to create alert:', err.message);
    process.exit(1);
});
