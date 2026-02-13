#!/usr/bin/env node
/**
 * Tailscale Encrypted Backup Script
 * Backs up sensitive files (secrets, logs, state) with encryption
 * Syncs to another machine over Tailscale
 */

import { execSync, spawn } from 'child_process';
import { writeFileSync, readFileSync, existsSync, createReadStream, createWriteStream } from 'fs';
import { join } from 'path';
import { createCipheriv, randomBytes } from 'crypto';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';

const WORKSPACE = '/home/pi/.openclaw/workspace';
const LOG_FILE = join(WORKSPACE, 'memory', 'tailscale-backup.log');

// Tailscale configuration
const TARGET_DEVICE = 'bryces-macbook-pro'; // Your MacBook Pro
const TARGET_IP = '100.107.232.113';
const TARGET_PATH = '/Users/trolly/Felix-Backups';
const BACKUP_PORT = 22; // SSH over Tailscale

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
// We'll generate a random key each time, or use a stored one

// Files to back up (sensitive data)
const SENSITIVE_FILES = [
    '.openclaw-env',
    'memory/heartbeat-state.json',
    'memory/health-critical.log',
    'memory/health-resources.log',
    'memory/health-daily.log',
    'memory/backup.log',
    'memory/alert-processor.log'
];

const SENSITIVE_PATTERNS = [
    'memory/*-alert.json',
    'memory/health-summary.json',
    'memory/*.log'
];

async function runTailscaleBackup() {
    const timestamp = new Date().toISOString();
    const results = {
        timestamp,
        files: [],
        errors: [],
        success: false,
        backupPath: ''
    };
    
    try {
        console.log('Starting Tailscale encrypted backup...');
        
        // 1. Check Tailscale connectivity
        const tailscaleUp = await checkTailscaleConnectivity();
        if (!tailscaleUp) {
            results.errors.push('Tailscale not connected or target unreachable');
            logBackup(results);
            return;
        }
        
        // 2. Create backup archive
        const backupFile = await createEncryptedBackup();
        results.backupPath = backupFile;
        
        // 3. Transfer to target machine
        const transferred = await transferToTarget(backupFile);
        if (transferred) {
            results.success = true;
            console.log(`✅ Encrypted backup completed: ${backupFile}`);
            console.log(`📁 Transferred to ${TARGET_DEVICE}:${TARGET_PATH}`);
        } else {
            results.errors.push('Failed to transfer backup to target');
            console.log('💡 Make sure SSH key is set up on target machine');
            console.log('💡 Run: ./bin/setup-tailscale-backup.sh for setup instructions');
        }
        
        // 4. Cleanup local backup file
        try {
            execSync(`rm "${backupFile}"`, { timeout: 5000 });
        } catch (err) {
            results.errors.push(`Failed to cleanup backup file: ${err.message}`);
        }
        
        logBackup(results);
        
    } catch (err) {
        results.errors.push(`Backup script failed: ${err.message}`);
        logBackup(results);
        console.error('Tailscale backup failed:', err.message);
    }
}

async function checkTailscaleConnectivity() {
    try {
        // Check if target device is reachable
        execSync(`ping -c 1 -W 5 ${TARGET_IP} > /dev/null 2>&1`, { timeout: 10000 });
        return true;
    } catch (err) {
        console.error('Target device not reachable:', err.message);
        return false;
    }
}

async function createEncryptedBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = join(WORKSPACE, `memory`, `felix-backup-${timestamp}.tar.gz.enc`);
    
    console.log('Creating encrypted backup archive...');
    
    // Get or create encryption key
    const keyFile = join(WORKSPACE, 'memory', '.backup-key');
    let key;
    
    if (existsSync(keyFile)) {
        key = readFileSync(keyFile);
    } else {
        key = randomBytes(32); // 256-bit key
        writeFileSync(keyFile, key);
        console.log('Generated new encryption key (saved to memory/.backup-key)');
    }
    
    const iv = randomBytes(16); // 128-bit IV for GCM
    const cipher = createCipheriv(ALGORITHM, key, iv);
    
    // Create tar.gz archive and encrypt in one pipeline
    const tarProcess = spawn('tar', [
        '-czf', '-', 
        '-C', WORKSPACE,
        ...SENSITIVE_FILES,
        ...SENSITIVE_PATTERNS
    ], { stdio: ['pipe', 'pipe', 'pipe'] });
    
    const outputStream = createWriteStream(backupFile);
    
    // Write IV and auth tag (needed for decryption)
    outputStream.write(iv);
    
    await pipeline(
        tarProcess.stdout,
        cipher,
        outputStream
    );
    
    // Get auth tag and append it
    const authTag = cipher.getAuthTag();
    outputStream.write(authTag);
    outputStream.end();
    
    await new Promise((resolve, reject) => {
        outputStream.on('finish', resolve);
        outputStream.on('error', reject);
    });
    
    // Wait for tar to complete
    await new Promise((resolve, reject) => {
        tarProcess.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Tar failed with code ${code}`));
        });
    });
    
    console.log(`Created encrypted backup: ${backupFile}`);
    return backupFile;
}

async function transferToTarget(backupFile) {
    const filename = backupFile.split('/').pop();
    
    try {
        console.log('Transferring backup to target machine...');
        
        // Create target directory if it doesn't exist
        const mkdirCmd = `ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no pi@${TARGET_IP} "mkdir -p ${TARGET_PATH}"`;
        execSync(mkdirCmd, { timeout: 30000 });
        
        // Transfer the file using scp over Tailscale
        const scpCmd = `scp -o ConnectTimeout=30 -o StrictHostKeyChecking=no "${backupFile}" pi@${TARGET_IP}:${TARGET_PATH}/${filename}"`;
        execSync(scpCmd, { timeout: 300000 }); // 5 minute timeout
        
        console.log(`Successfully transferred ${filename} to ${TARGET_DEVICE}`);
        return true;
        
    } catch (err) {
        console.error('Transfer failed:', err.message);
        
        // Try alternative: use rsync if scp fails
        try {
            console.log('Trying rsync fallback...');
            const rsyncCmd = `rsync -avz --timeout=60 -e "ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no" "${backupFile}" pi@${TARGET_IP}:${TARGET_PATH}/`;
            execSync(rsyncCmd, { timeout: 300000 });
            console.log('Rsync transfer successful');
            return true;
        } catch (rsyncErr) {
            console.error('Rsync also failed:', rsyncErr.message);
            return false;
        }
    }
}

function logBackup(results) {
    const logEntry = `${results.timestamp} - Tailscale backup ${results.success ? 'SUCCESS' : 'FAILED'}\n`;
    const details = `Backup: ${results.backupPath}, Errors: ${results.errors.length}\n`;
    
    try {
        writeFileSync(LOG_FILE, logEntry + details, { flag: 'a' });
        
        if (results.errors.length > 0) {
            writeFileSync(LOG_FILE, 'Errors:\n', { flag: 'a' });
            results.errors.forEach(err => {
                writeFileSync(LOG_FILE, `  • ${err}\n`, { flag: 'a' });
            });
        }
        writeFileSync(LOG_FILE, '\n', { flag: 'a' });
        
    } catch (err) {
        console.error('Failed to log backup:', err.message);
    }
}

// Create decryption helper script
function createDecryptScript() {
    const decryptScript = `#!/bin/bash
# Felix Backup Decryption Script
# Usage: ./decrypt.sh <backup-file> [output-dir]

BACKUP_FILE="\${1:-}"
OUTPUT_DIR="\${2:-./restored}"

if [ -z "\$BACKUP_FILE" ]; then
    echo "Usage: \$0 <backup-file> [output-dir]"
    exit 1
fi

KEY_FILE="memory/.backup-key"

if [ ! -f "\$KEY_FILE" ]; then
    echo "Error: Encryption key not found at \$KEY_FILE"
    exit 1
fi

mkdir -p "\$OUTPUT_DIR"

echo "Decrypting \$BACKUP_FILE..."

# Extract IV (first 16 bytes)
IV=\$(head -c 16 "\$BACKUP_FILE" | xxd -p)

# Extract encrypted data (minus IV and auth tag)
TEMP_FILE=\$(mktemp)
tail -c +17 "\$BACKUP_FILE" | head -c -16 > "\$TEMP_FILE"

# Extract auth tag (last 16 bytes)
AUTH_TAG=\$(tail -c 16 "\$BACKUP_FILE" | xxd -p)

# Decrypt and extract
openssl enc -aes-256-gcm -d -K \$(xxd -p -c 32 "\$KEY_FILE") -iv "\$IV" -in "\$TEMP_FILE" | tar -xzf - -C "\$OUTPUT_DIR"

rm "\$TEMP_FILE"

echo "Decryption complete. Files restored to \$OUTPUT_DIR"
`;

    writeFileSync(join(WORKSPACE, 'bin', 'decrypt-backup.sh'), decryptScript);
    execSync('chmod +x bin/decrypt-backup.sh', { cwd: WORKSPACE });
}

// Create the decrypt script
createDecryptScript();

// Run the backup
runTailscaleBackup();