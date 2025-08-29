# CETEC Backup Puller

A comprehensive internal tool for managing customer backups, database verification, and environment access for CETEC ERP customers.

## 🚀 Quick Start

**New to the application?** Start with our [Quick Start Guide](./QUICK_START.md) to get up and running in under 10 minutes!

## ✨ Features

- **Customer Management**: View and filter customers with billing status verification
- **Database Verification**: Automatic MySQL database existence checks with `usage_stats` table validation
- **Environment Access**: Direct links to Production, Development, and Test environments
- **Backup Management**: Pull backup functionality with timestamp tracking
- **Advanced Filtering**: Search and filter by support tier, hosting type, backup status, and more
- **Resident Hosting Support**: Special handling for customers with custom database mappings
- **ITAR Compliance**: Support for ITAR hosting customers with appropriate access controls

## 🏗️ Architecture

- **Frontend**: React + TypeScript + Vite with modern UI components
- **Backend**: Node.js + Express server with MySQL integration
- **Database**: MySQL with automatic connection optimization (Cloud SQL Proxy support)
- **API**: CETEC ERP API integration with backend proxy for enhanced functionality

## 📋 Prerequisites

- Node.js 18+ and npm
- MySQL server access (or Google Cloud SQL)
- CETEC ERP API credentials
- Git

## 🛠️ Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd cetec_backup_puller
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment**:
   ```bash
   cp server.env.example .env
   # Edit .env with your actual values
   ```

4. **Start development servers**:
   ```bash
   npm run dev:full
   ```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in your project root:

```bash
# ========================================
# Environment Variables
# ========================================
# Copy server.env.example to .env and fill in your values:

## Environment Variables

### Frontend Configuration
```bash
# API Configuration
VITE_API_URL=http://backups.cetecerpdevel.com:5001  # Frontend API proxy target
VITE_CETEC_DOMAIN=internal.cetecerp.com
VITE_PRESHARED_TOKEN=your_token_here
VITE_API_PROTOCOL=https
```

### Backend Configuration
```bash
# Server Configuration
NODE_ENV=production
PORT=5001
API_URL=https://internal.cetecerp.com
```

### Environment Validation

The application now uses URL validation to check if development environments are ready instead of database queries. This provides faster response times and more reliable status checking.

## 🚀 Usage

### Starting the Application

```bash
# Start both frontend and backend
npm run dev:full

# Start only frontend
npm run dev

# Start only backend
npm run server

# Use custom process manager (most reliable)
npm run dev:custom
```

### Application Features

1. **Customer Dashboard**: View all customers with automatic data loading
2. **Search & Filter**: Find customers by name, domain, or various criteria
3. **Environment Status**: See which customers have development environments ready
4. **Environment Access**: Quick access to Production, Development, and Test environments
5. **Backup Operations**: Pull backups with automatic timestamp tracking

### API Endpoints

- `GET /api/cetec/customer` - Fetch customer data with environment validation
- `POST /api/pull/record` - Record backup pull timestamps
- `POST /api/backup/request` - Request backup operations
- `POST /api/validate-environment` - Check if development environment is ready
- `POST /api/validate-link` - Validate customer development environment URLs
- `GET /api/test-mysql` - Deprecated endpoint (returns deprecation message)

## 🔧 Development

### Project Structure

```