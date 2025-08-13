# Running Both Frontend and Backend Servers

This guide explains how to run both your React frontend and Node.js backend simultaneously.

## Quick Start

To run both servers at the same time, use:

```bash
npm run dev:full
```

This will start:
- **Backend**: Node.js server on port 3001
- **Frontend**: React app on port 5173 (Vite default)

## Individual Commands

You can also run them separately in different terminals:

### Terminal 1 - Backend Server
```bash
npm run server
```

### Terminal 2 - Frontend App
```bash
npm run dev
```

## What Each Command Does

- **`npm run dev`**: Starts only the React frontend (Vite dev server)
- **`npm run server`**: Starts only the Node.js backend server
- **`npm run dev:full`**: Starts both servers concurrently using the `concurrently` package

## Server Ports

- **Backend**: http://localhost:3001
- **Frontend**: http://localhost:5173
- **Backend API Endpoint**: http://localhost:3001/api/data

## Environment Configuration

You can use a single `.env` file for both servers, or separate them. Here are both approaches:

### Option 1: Single .env File (Recommended)

Create one `.env` file in your project root:

```bash
# Backend Configuration
PORT=3001
API_URL=https://yourdomain.cetecerp.com/api/customer/1
API_TOKEN=your_token_here

# Frontend Configuration (Vite requires VITE_ prefix)
VITE_CETEC_DOMAIN=yourdomain.cetecerp.com
VITE_PRESHARED_TOKEN=your_actual_token_here
VITE_API_PROTOCOL=http
```

**How it works:**
- **Backend** (`server.js`): Reads `PORT`, `API_URL`, `API_TOKEN`
- **Frontend** (`src/config.ts`): Reads `VITE_CETEC_DOMAIN`, `VITE_PRESHARED_TOKEN`, `VITE_API_PROTOCOL`

### Option 2: Separate Files

**Backend** (`.env`):
```bash
PORT=3001
API_URL=https://yourdomain.cetecerp.com/api/customer/1
API_TOKEN=your_token_here
```

**Frontend** (`.env.local`):
```bash
VITE_CETEC_DOMAIN=yourdomain.cetecerp.com
VITE_PRESHARED_TOKEN=your_actual_token_here
VITE_API_PROTOCOL=http
```

### Why VITE_ Prefix?

Vite only exposes environment variables prefixed with `VITE_` to the frontend for security reasons. This prevents accidentally exposing sensitive backend variables to the client.

## How It Works

1. **Backend Server** (`server.js`):
   - Runs on port 3001
   - Handles CORS for the React app
   - Provides API endpoints
   - Can proxy requests to external APIs if needed

2. **Frontend App** (`src/App.tsx`):
   - Runs on port 5173 (Vite default)
   - Makes API calls to your CETEC ERP system
   - Can also call your backend server if needed

## Troubleshooting

### Port Already in Use
If you get "port already in use" errors:
- Check what's running on port 3001: `lsof -i :3001`
- Kill the process: `kill -9 <PID>`
- Or change the port in your `.env` file

### CORS Issues
The backend server is configured with CORS headers for the React app. If you still have issues:
- Check that the backend is running on port 3001
- Verify the CORS headers in `server.js`
- Check browser console for CORS errors

### Concurrently Not Working
If `npm run dev:full` fails:
- Make sure `concurrently` is installed: `npm install concurrently`
- Try running the servers individually in separate terminals

## Development Workflow

1. **Start both servers**: `npm run dev:full`
2. **Make changes to React code**: Auto-reloads in browser
3. **Make changes to server code**: Restart backend server (Ctrl+C, then `npm run server`)
4. **View logs**: Both servers show logs in the same terminal when using `dev:full`

## Production

For production, you'll want to:
- Build the React app: `npm run build`
- Serve static files from the backend
- Use environment variables for production URLs
- Remove CORS headers for same-origin deployment