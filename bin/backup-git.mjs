#!/usr/bin/env node
/**
 * Git Backup Script - Daily automatic backup to GitHub
 * Pushes workspace changes to private repo with smart commit messages
 */

import { execSync, spawn } from 'child_process';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

const WORKSPACE = '/home/pi/.openclaw/workspace';
const LOG_FILE = join(WORKSPACE, 'memory', 'backup.log');

async function runGitBackup() {
    const timestamp = new Date().toISOString();
    const results = {
        timestamp,
        changes: [],
        errors: [],
        success: false
    };
    
    try {
        console.log('Starting Git backup...');
        
        // 1. Check if we have changes to backup
        try {
            const status = execSync('git status --porcelain', {
                cwd: WORKSPACE,
                encoding: 'utf8',
                timeout: 30000
            });
            
            if (!status.trim()) {
                console.log('No changes to backup');
                results.success = true;
                logBackup(results);
                return;
            }
            
            // Parse changes for smart commit message
            const changes = parseGitStatus(status);
            results.changes = changes;
            
            console.log(`Found ${changes.length} changes to backup`);
            
        } catch (err) {
            results.errors.push(`Git status failed: ${err.message}`);
            logBackup(results);
            return;
        }
        
        // 2. Add all changes
        try {
            execSync('git add .', {
                cwd: WORKSPACE,
                timeout: 60000,
                stdio: ['pipe', 'pipe', 'pipe']
            });
            console.log('Added all changes to git');
        } catch (err) {
            results.errors.push(`Git add failed: ${err.message}`);
            logBackup(results);
            return;
        }
        
        // 3. Create smart commit message
        const commitMessage = generateCommitMessage(results.changes);
        
        try {
            execSync(`git commit -m "${commitMessage}"`, {
                cwd: WORKSPACE,
                timeout: 60000,
                stdio: ['pipe', 'pipe', 'pipe']
            });
            console.log(`Committed with message: ${commitMessage}`);
        } catch (err) {
            results.errors.push(`Git commit failed: ${err.message}`);
            logBackup(results);
            return;
        }
        
        // 4. Push to origin
        try {
            execSync('git push origin master', {
                cwd: WORKSPACE,
                timeout: 120000,
                stdio: ['pipe', 'pipe', 'pipe']
            });
            console.log('Pushed to GitHub');
            results.success = true;
            
        } catch (err) {
            results.errors.push(`Git push failed: ${err.message}`);
            // Try to handle common push issues
            if (err.message.includes('detached')) {
                try {
                    execSync('git checkout master', { cwd: WORKSPACE, timeout: 30000 });
                    execSync('git push origin master', { cwd: WORKSPACE, timeout: 120000 });
                    results.errors.push('Fixed detached HEAD and pushed successfully');
                    results.success = true;
                } catch (retryErr) {
                    results.errors.push(`Retry failed: ${retryErr.message}`);
                }
            }
        }
        
        logBackup(results);
        
        if (results.success) {
            console.log(`✅ Backup completed successfully`);
            console.log(`📊 Changes: ${results.changes.length}`);
            console.log(`📝 Commit: ${commitMessage}`);
        } else {
            console.log(`❌ Backup failed with ${results.errors.length} errors`);
            results.errors.forEach(err => console.log(`   • ${err}`));
        }
        
    } catch (err) {
        results.errors.push(`Backup script failed: ${err.message}`);
        logBackup(results);
        console.error('Backup failed:', err.message);
    }
}

function parseGitStatus(statusOutput) {
    const changes = [];
    const lines = statusOutput.trim().split('\n');
    
    for (const line of lines) {
        const status = line.substring(0, 2);
        const file = line.substring(3);
        
        let type = 'modified';
        let category = 'other';
        
        if (status.includes('M')) type = 'modified';
        else if (status.includes('A')) type = 'added';
        else if (status.includes('D')) type = 'deleted';
        else if (status.includes('R')) type = 'renamed';
        else if (status.includes('??')) type = 'untracked';
        
        // Categorize files
        if (file.startsWith('memory/')) category = 'memory';
        else if (file.startsWith('bin/')) category = 'scripts';
        else if (file.startsWith('skills/')) category = 'skills';
        else if (file.includes('.md')) category = 'docs';
        else if (file === '.gitignore') category = 'config';
        else if (file.includes('HEARTBEAT') || file.includes('AGENTS')) category = 'system';
        
        changes.push({ type, category, file });
    }
    
    return changes;
}

function generateCommitMessage(changes) {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const categories = {};
    
    // Group changes by category
    for (const change of changes) {
        if (!categories[change.category]) {
            categories[change.category] = [];
        }
        categories[change.category].push(change);
    }
    
    // Build commit message
    let message = `🤖 Auto-backup ${date}`;
    
    const categoryEmojis = {
        memory: '🧠',
        scripts: '⚙️',
        skills: '🎭',
        docs: '📝',
        config: '⚙️',
        system: '🔧',
        other: '📦'
    };
    
    const parts = [];
    for (const [category, categoryChanges] of Object.entries(categories)) {
        const emoji = categoryEmojis[category] || '📦';
        const count = categoryChanges.length;
        
        if (category === 'memory') {
            const memoryFiles = categoryChanges.filter(c => c.file.includes('.md'));
            const logs = categoryChanges.filter(c => c.file.includes('.log'));
            let desc = '';
            if (memoryFiles.length > 0) desc += `${memoryFiles.length} memories`;
            if (logs.length > 0) desc += `${desc ? ', ' : ''}${logs.length} logs`;
            parts.push(`${emoji} ${desc || `${count} files`}`);
        } else if (category === 'scripts') {
            parts.push(`${emoji} ${count} script${count > 1 ? 's' : ''}`);
        } else if (category === 'skills') {
            parts.push(`${emoji} ${count} skill${count > 1 ? 's' : ''}`);
        } else {
            parts.push(`${emoji} ${count} ${category}`);
        }
    }
    
    if (parts.length > 0) {
        message += '\n\n' + parts.join(' | ');
    }
    
    // Add summary of most important changes
    const importantChanges = changes.filter(c => 
        c.category === 'memory' || 
        c.category === 'scripts' || 
        c.category === 'system'
    );
    
    if (importantChanges.length > 0 && importantChanges.length <= 5) {
        message += '\n\nKey changes:\n';
        for (const change of importantChanges.slice(0, 3)) {
            const action = change.type === 'added' ? '➕' : 
                          change.type === 'deleted' ? '🗑️' : '📝';
            message += `${action} ${change.file}\n`;
        }
    }
    
    return message;
}

function logBackup(results) {
    const timestamp = results.timestamp;
    const logEntry = `${timestamp} - Backup ${results.success ? 'SUCCESS' : 'FAILED'}\n`;
    const details = `Changes: ${results.changes.length}, Errors: ${results.errors.length}\n`;
    
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
runGitBackup();