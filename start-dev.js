#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m'
};

function log(prefix, message, color = colors.reset) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${color}[${timestamp}] ${prefix}:${colors.reset} ${message}`);
}

// Start backend server
function startBackend() {
  log('BACKEND', 'Starting Node.js server...', colors.blue);
  
  const backend = spawn('node', ['server.js'], {
    cwd: __dirname,
    stdio: 'pipe',
    env: { ...process.env, NODE_ENV: 'development' }
  });

  backend.stdout.on('data', (data) => {
    log('BACKEND', data.toString().trim(), colors.blue);
  });

  backend.stderr.on('data', (data) => {
    log('BACKEND', data.toString().trim(), colors.red);
  });

  backend.on('error', (error) => {
    log('BACKEND', `Failed to start: ${error.message}`, colors.red);
  });

  backend.on('close', (code) => {
    if (code !== 0) {
      log('BACKEND', `Process exited with code ${code}`, colors.red);
    }
  });

  return backend;
}

// Start frontend server
function startFrontend() {
  log('FRONTEND', 'Starting Vite dev server...', colors.green);
  
  const frontend = spawn('npm', ['run', 'dev'], {
    cwd: __dirname,
    stdio: 'pipe',
    env: { ...process.env, NODE_ENV: 'development' }
  });

  frontend.stdout.on('data', (data) => {
    log('FRONTEND', data.toString().trim(), colors.green);
  });

  frontend.stderr.on('data', (data) => {
    log('FRONTEND', data.toString().trim(), colors.red);
  });

  frontend.on('error', (error) => {
    log('FRONTEND', `Failed to start: ${error.message}`, colors.red);
  });

  frontend.on('close', (code) => {
    if (code !== 0) {
      log('FRONTEND', `Process exited with code ${code}`, colors.red);
    }
  });

  return frontend;
}

// Main function
function main() {
  log('MAIN', 'Starting development environment...', colors.cyan);
  log('MAIN', 'Press Ctrl+C to stop all servers', colors.yellow);
  
  const backend = startBackend();
  const frontend = startFrontend();

  // Handle process termination
  function cleanup() {
    log('MAIN', 'Shutting down servers...', colors.yellow);
    
    // Kill both processes
    backend.kill('SIGTERM');
    frontend.kill('SIGTERM');
    
    // Force kill after 5 seconds if they don't respond
    setTimeout(() => {
      backend.kill('SIGKILL');
      frontend.kill('SIGKILL');
      process.exit(0);
    }, 5000);
  }

  // Handle various termination signals
  process.on('SIGINT', cleanup);   // Ctrl+C
  process.on('SIGTERM', cleanup);  // kill command
  process.on('SIGQUIT', cleanup);  // Ctrl+\

  // Handle process exit
  process.on('exit', () => {
    log('MAIN', 'Development environment stopped', colors.cyan);
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    log('MAIN', `Uncaught Exception: ${error.message}`, colors.red);
    cleanup();
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    log('MAIN', `Unhandled Rejection at: ${promise}, reason: ${reason}`, colors.red);
    cleanup();
    process.exit(1);
  });
}

// Start the development environment
main();
