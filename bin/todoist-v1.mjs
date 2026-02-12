#!/usr/bin/env node
/**
 * Todoist v1 API Helper
 * Uses the /api/v1/sync endpoint (POST with form-urlencoded)
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { readFileSync } from 'fs';

const STATE_FILE = process.env.HOME + '/.openclaw/workspace/.openclaw-env';

function getToken() {
  try {
    const envContent = readFileSync(STATE_FILE, 'utf8');
    const match = envContent.match(/TODOIST_API_TOKEN=(.+)/);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

function v1Sync(resourceTypes = ['items']) {
  const token = getToken();
  if (!token) {
    console.error('No TODOIST_API_TOKEN found');
    process.exit(1);
  }

  const encodedTypes = encodeURIComponent(JSON.stringify(resourceTypes));
  const cmd = `curl -fsSL -X POST "https://api.todoist.com/api/v1/sync" -H "Authorization: Bearer ${token}" -d "sync_token=*" -d "resource_types=${encodedTypes}"`;
  
  try {
    const output = execSync(cmd, { encoding: 'utf8', timeout: 30000 });
    return JSON.parse(output);
  } catch (e) {
    console.error('API call failed:', e.message);
    return {};
  }
}

function addTask(content, projectId, dueDate = null) {
  const token = getToken();
  if (!token) {
    console.error('No TODOIST_API_TOKEN found');
    process.exit(1);
  }

  let data = `content=${encodeURIComponent(content)}`;
  if (projectId) data += `&project_id=${projectId}`;
  if (dueDate) data += `&due_date=${encodeURIComponent(dueDate)}`;

  const cmd = `curl -fsSL -X POST "https://api.todoist.com/api/v1/items/add" -H "Authorization: Bearer ${token}" -d "${data}"`;
  
  try {
    const output = execSync(cmd, { encoding: 'utf8', timeout: 30000 });
    return JSON.parse(output);
  } catch (e) {
    console.error('Failed to add task:', e.message);
    return null;
  }
}

function completeTask(taskId) {
  const token = getToken();
  if (!token) {
    console.error('No TODOIST_API_TOKEN found');
    process.exit(1);
  }

  const cmd = `curl -fsSL -X POST "https://api.todoist.com/api/v1/items/${taskId}/close" -H "Authorization: Bearer ${token}"`;
  
  try {
    execSync(cmd, { encoding: 'utf8', timeout: 30000 });
    return true;
  } catch (e) {
    console.error('Failed to complete task:', e.message);
    return false;
  }
}

function getProjects() {
  const data = v1Sync(['projects']);
  return data.projects || [];
}

function getTasks(projectId = null) {
  const data = v1Sync(['items']);
  let tasks = data.items || [];
  
  if (projectId) {
    tasks = tasks.filter(t => t.project_id === projectId);
  }
  
  return tasks;
}

// CLI usage
const command = process.argv[2];
const args = process.argv.slice(3);

switch (command) {
  case 'projects':
    const projects = getProjects();
    console.log(JSON.stringify(projects, null, 2));
    break;
    
  case 'tasks':
    const projectFilter = args[0] || null;
    const taskList = getTasks(projectFilter);
    console.log(JSON.stringify(taskList, null, 2));
    break;
    
  case 'add':
    if (args.length < 2) {
      console.log('Usage: node bin/todoist-v1.mjs add "Task content" project_id [due_date]');
      process.exit(1);
    }
    const task = addTask(args[0], args[1], args[2]);
    console.log(JSON.stringify(task, null, 2));
    break;
    
  case 'complete':
    if (!args[0]) {
      console.log('Usage: node bin/todoist-v1.mjs complete task_id');
      process.exit(1);
    }
    const result = completeTask(args[0]);
    console.log(result ? 'Task completed' : 'Failed');
    break;
    
  default:
    console.log('Todoist v1 API Helper');
    console.log('Commands: projects, tasks, add, complete');
    console.log('Examples:');
    console.log('  node bin/todoist-v1.mjs projects');
    console.log('  node bin/todoist-v1.mjs tasks 6fxHh9H9JGJv7V65');
    console.log('  node bin/todoist-v1.mjs add "Watch TV show" 6fxpQcCrqwRXCwVw');
    console.log('  node bin/todoist-v1.mjs complete task_id');
}