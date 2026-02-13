#!/bin/bash
# Tailscale Backup Setup Script
# Sets up SSH access for encrypted backups

echo "🔧 Setting up Tailscale backup system..."

# Check if Tailscale is running
if ! tailscale status >/dev/null 2>&1; then
    echo "❌ Tailscale is not running. Please start it first."
    exit 1
fi

echo "✅ Tailscale is running"

# Check if we can reach the target device
TARGET_IP="100.107.232.113"
if ping -c 1 -W 5 "$TARGET_IP" >/dev/null 2>&1; then
    echo "✅ Target device ($TARGET_IP) is reachable"
else
    echo "❌ Target device not reachable. Check Tailscale connectivity."
    exit 1
fi

# Generate SSH key if it doesn't exist
SSH_KEY="$HOME/.ssh/felix_backup"
if [ ! -f "$SSH_KEY" ]; then
    echo "🔑 Generating SSH key for backup access..."
    ssh-keygen -t ed25519 -f "$SSH_KEY" -N "" -C "felix-backup@$(hostname)"
    echo "✅ SSH key generated"
else
    echo "✅ SSH key already exists"
fi

# Display the public key for manual setup
echo ""
echo "📤 Public key to add to target machine (~/.ssh/authorized_keys):"
echo "--------------------------------------------------"
cat "$SSH_KEY.pub"
echo "--------------------------------------------------"
echo ""
echo "Instructions:"
echo "1. Copy the public key above"
echo "2. On your MacBook Pro, add it to ~/.ssh/authorized_keys"
echo "3. Test connection: ssh -i $SSH_KEY pi@$TARGET_IP"
echo ""
echo "After setup, run: node bin/backup-tailscale.mjs"