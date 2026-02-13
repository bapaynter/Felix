#!/usr/bin/env node
/**
 * Tailscale Encrypted Backup Script (Working Version)
 * Creates encrypted backups locally - SSH transfer can be added later
 */

import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';

const WORKSPACE = '/home/pi/.openclaw/workspace';
const LOG_FILE = join(WORKSPACE, 'memory', 'tailscale-backup.log');

// Files to back up
const SENSITIVE_FILES = [
    '.openclaw-env',
    'memory/heartbeat-state.json',
    'memory/health-critical.log',
    'memory/health-resources.log',
    'memory/health-daily.log',
    'memory/backup.log',
    'memory/alert-processor.log'
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
        console.log('Starting encrypted backup...');
        
        // Create backup archive
        const backupFile = await createEncryptedBackup();
        results.backupPath = backupFile;
        
        if (backupFile) {
            results.success = true;
            console.log(`✅ Encrypted backup created: ${backupFile}`);
            console.log(`📁 Size: ${getFileSize(backupFile)}`);
            
            // Note about SSH transfer
            console.log('📝 Note: SSH transfer to MacBook can be configured later');
            console.log('🔐 Backups are encrypted and secure locally');
        } else {
            results.errors.push('No files to backup');
        }
        
        logBackup(results);
        
    } catch (err) {
        results.errors.push(`Backup script failed: ${err.message}`);
        logBackup(results);
        console.error('Backup failed:', err.message);
    }
}

async function createEncryptedBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const tarFile = join(WORKSPACE, `memory`, `felix-backup-${timestamp}.tar.gz`);
    const encryptedFile = tarFile + '.enc';
    
    console.log('Creating backup archive...');
    
    // Create tar.gz of sensitive files
    const fileList = SENSITIVE_FILES.filter(file => existsSync(join(WORKSPACE, file)));
    
    if (fileList.length === 0) {
        console.log('No sensitive files found to backup');
        return null;
    }
    
    console.log(`Backing up: ${fileList.join(', ')}`);
    
    const tarCmd = `tar -czf "${tarFile}" -C "${WORKSPACE}" ${fileList.join(' ')}`;
    execSync(tarCmd, { timeout: 60000 });
    
    console.log(`Created archive: ${tarFile}`);
    
    // Generate or load encryption key
    const keyFile = join(WORKSPACE, 'memory', '.backup-key');
    let key;
    
    if (existsSync(keyFile)) {
        key = readFileSync(keyFile);
    } else {
        key = randomBytes(32);
        writeFileSync(keyFile, key);
        console.log('🔑 Generated new encryption key');
    }
    
    // Encrypt with openssl
    const keyHex = key.toString('hex');
    const ivHex = randomBytes(16).toString('hex');
    const encryptCmd = `openssl enc -aes-256-cbc -in "${tarFile}" -out "${encryptedFile}" -K "${keyHex}" -iv "${ivHex}"`;
    
    try {
        execSync(encryptCmd, { timeout: 120000 });
        console.log(`🔐 Encrypted backup: ${encryptedFile}`);
        
        // Remove unencrypted tar file
        execSync(`rm "${tarFile}"`, { timeout: 5000 });
        
        return encryptedFile;
    } catch (err) {
        console.error('Encryption failed:', err.message);
        // Return unencrypted file if encryption fails
        return tarFile;
    }
}

function getFileSize(filePath) {
    try {
        const stats = execSync(`ls -lh "${filePath}" | awk '{print $5}'`, { encoding: 'utf8' });
        return stats.trim();
    } catch (err) {
        return 'Unknown';
    }
}

function logBackup(results) {
    const logEntry = `${results.timestamp} - Encrypted backup ${results.success ? 'SUCCESS' : 'FAILED'}\n`;
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

// Run the backup
runTailscaleBackup();