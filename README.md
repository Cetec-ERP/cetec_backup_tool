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

# MySQL Configuration
MYSQL_HOST=your_mysql_host
MYSQL_USER=your_mysql_user
MYSQL_PASSWORD=your_mysql_password
MYSQL_PORT=3306
MYSQL_SOCKET=/path/to/cloudsql/socket
```

### MySQL Setup

The application automatically checks for database existence and `usage_stats` table presence. See [ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md) for detailed MySQL configuration.

### Cloud SQL Proxy (Optional)

For development environments, you can use Google Cloud SQL Proxy for faster connections. See [CLOUD_SQL_PROXY_SETUP.md](./CLOUD_SQL_PROXY_SETUP.md) for setup instructions.

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
3. **Database Status**: See which customers have backup databases available
4. **Environment Access**: Quick access to Production, Development, and Test environments
5. **Backup Operations**: Pull backups with automatic timestamp tracking

### API Endpoints

- `GET /api/cetec/customer` - Fetch customer data with MySQL enrichment
- `POST /api/pull/record` - Record backup pull timestamps
- `POST /api/backup/request` - Request backup operations
- `POST /api/mysql/check` - Check specific customer database status
- `GET /api/test-mysql` - Test MySQL connection

## 🔧 Development

### Project Structure

```
cetec_backup_puller/
├── src/
│   ├── components/          # React components
│   │   ├── CustomerCard.tsx # Individual customer display
│   │   ├── DataTable.tsx    # Customer list container
│   │   └── SearchAndFilter.tsx # Search and filtering UI
│   ├── config/              # Configuration files
│   │   └── resident-dbs.json # Resident hosting database mappings
│   ├── App.tsx              # Main application component
│   └── main.tsx             # Application entry point
├── server.js                # Express backend server
├── start-dev.js             # Development process manager
└── package.json             # Dependencies and scripts
```

### Available Scripts

- `npm run dev` - Start frontend development server
- `npm run server` - Start backend server
- `npm run dev:full` - Start both servers with concurrently
- `npm run dev:custom` - Start both servers with custom process manager
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run kill:ports` - Kill processes on ports 5001 and 5002

## 🚨 Troubleshooting

### Common Issues

1. **Port Conflicts**: Use `npm run kill:ports` to clear occupied ports
2. **MySQL Connection**: Verify credentials and network access
3. **CORS Errors**: Ensure backend is running on port 5001
4. **Environment Variables**: Restart server after updating `.env`

### Server Status Check

```bash
# Check if servers are running
lsof -i :5001  # Backend
lsof -i :5002  # Frontend
```

## 📚 Documentation

### Getting Started
- **[Quick Start Guide](./QUICK_START.md)** - Get up and running in 10 minutes
- **[Environment Setup](./ENVIRONMENT_SETUP.md)** - MySQL and environment configuration
- **[Cloud SQL Proxy Setup](./CLOUD_SQL_PROXY_SETUP.md)** - Google Cloud SQL Proxy configuration

### Advanced Topics
- **[API Setup](./API_SETUP.md)** - CETEC API integration details
- **[Running Both Servers](./RUNNING_BOTH_SERVERS.md)** - Development server management

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is for internal use by CETEC ERP team members.

## 🆘 Support

For issues or questions:
1. Check the [Quick Start Guide](./QUICK_START.md) for common solutions
2. Review the troubleshooting section above
3. Check server logs for error details
4. Contact the development team
