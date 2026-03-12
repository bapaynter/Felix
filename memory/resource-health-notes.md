# Resource Health Notes - 2026-03-11

## Zombie Process Issue

**Zombie PID 1550** identified stuck since **2026-02-16** (~25 days at time of check)
- Parent: lircd (PID 1536) - Linux Infrared Remote Control daemon
- Start time: Feb 16th
- Status: Still present, no system impact

**Root Cause:**
lircd daemon spawns child processes for remote control commands but doesn't properly call `wait()` to reap children. This is a common daemon quirk.

**Impact:**
- No system degradation observed
- No impact on OpenClaw functionality
- Normal system operation despite zombie presence

**Cleanup Attempt:**
Script in `bin/health-resources.mjs` attempts to clean zombies >24h old by killing parent process. However, killing lircd could disrupt infrared remote functionality, so the script logged it but didn't forcefully terminate.

**Recommendation:**
- **Accept as known quirk** - System functions properly
- **Monitor** - If number of zombies grows, consider restart
- **Avoid rebooting just for this specific zombie**

**Related:**
See `/home/pi/.openclaw/workspace/memory/health-resources.log` for full monitoring history.
