#!/bin/bash
# SSH Connection Test Script

echo "🔍 Testing SSH connection to MacBook..."

TARGET_IP="100.107.232.113"
SSH_KEY="/home/pi/.ssh/felix_backup_new"

echo "Target IP: $TARGET_IP"
echo "SSH Key: $SSH_KEY"
echo ""

# Show the public key
echo "📤 Public key that should be in ~/.ssh/authorized_keys:"
echo "----------------------------------------"
cat "$SSH_KEY.pub"
echo "----------------------------------------"
echo ""

# Test basic connectivity
echo "1. Testing basic ping..."
if ping -c 1 -W 5 "$TARGET_IP" >/dev/null 2>&1; then
    echo "✅ Ping successful"
else
    echo "❌ Ping failed"
    exit 1
fi

# Test SSH connection
echo "2. Testing SSH connection..."
if ssh -o IdentitiesOnly=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=no -i "$SSH_KEY" trolly@"$TARGET_IP" "echo 'SSH connection successful!'" 2>/dev/null; then
    echo "✅ SSH connection successful"
else
    echo "❌ SSH connection failed"
    echo ""
    echo "Troubleshooting steps:"
    echo "1. Add the public key above to ~/.ssh/authorized_keys on MacBook"
    echo "2. Set correct permissions: chmod 600 ~/.ssh/authorized_keys"
    echo "3. Ensure ~/.ssh directory has correct permissions: chmod 700 ~/.ssh"
    echo "4. Check SSH daemon allows public key auth: grep PubkeyAuthentication /etc/ssh/sshd_config"
    echo ""
    echo "To add key on MacBook:"
    echo "mkdir -p ~/.ssh"
    echo "chmod 700 ~/.ssh"
    echo "echo 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIByKNufDduh/CMGT4pFrF0KX1BjIj4VAGaLPZ+5LXG5E felix-backup@e9ced02b-d0cc-4597-82c1-db5612705335.device.electriclab.app' >> ~/.ssh/authorized_keys"
    echo "chmod 600 ~/.ssh/authorized_keys"
fi