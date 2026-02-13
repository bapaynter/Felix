# Tailscale Backup Setup Instructions

## On the MacBook Pro (Target Machine)

### 1. Add SSH Key
Copy this public key to `~/.ssh/authorized_keys` on your MacBook:

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIA8xsgqbm6KjVa30+bS4iefiEmwWb0DNB4FgYpiZ/lrw felix-backup@e9ced02b-d0cc-4597-82c1-db5612705335.device.electriclab.app
```

### 2. Create Backup Directory
```bash
mkdir -p ~/Felix-Backups
chmod 755 ~/Felix-Backups
```

### 3. Test Connection
From the Pi, test the SSH connection:
```bash
ssh -i ~/.ssh/felix_backup pi@100.107.232.113 "ls -la ~/Felix-Backups"
```

### 4. Enable SSH on MacBook (if needed)
```bash
# System Preferences > Sharing > Remote Login
# Or via terminal:
sudo systemsetup -setremotelogin on
```

## What Gets Backed Up

### Encrypted Files:
- `.openclaw-env` (API keys and secrets)
- `memory/heartbeat-state.json` (system state)
- `memory/*.log` (health monitoring logs)
- `memory/*-alert.json` (health alerts)
- `memory/health-summary.json` (daily snapshots)

### Encryption Details:
- **Algorithm:** AES-256-GCM
- **Key:** 256-bit random key (stored in `memory/.backup-key`)
- **IV:** 128-bit per backup
- **Auth Tag:** 128-bit for integrity verification

## Daily Schedule
- **Time:** 3 AM UTC (9 PM your time)
- **Cron:** Runs automatically after Git backup
- **Retention:** Manual cleanup on target machine

## Decryption
If needed, decrypt with:
```bash
./bin/decrypt-backup.sh <backup-file> [output-dir]
```

## Security Notes
- Backups are encrypted before transfer
- SSH key is specific to backup operations
- Tailscale provides private network transport
- Encryption key is stored locally (not in backups)

## Testing
After setup, test manually:
```bash
node bin/backup-tailscale.mjs
```

Should see: "✅ Encrypted backup completed"