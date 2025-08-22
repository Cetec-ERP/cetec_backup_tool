# 🚀 Quick Start Guide - CETEC Backup Puller

This guide will get you up and running with the CETEC Backup Puller application in under 10 minutes.

## 📋 Prerequisites

- **Node.js 18+** and npm installed
- **MySQL server access** (or Google Cloud SQL)
- **CETEC ERP API credentials** (preshared token)
- **Git** for cloning the repository

## 🛠️ Step 1: Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd cetec_backup_puller

# Install dependencies
npm install
```

## ⚙️ Step 2: Environment Configuration

1. **Copy the environment template**:
   ```bash
   cp server.env.example .env
   ```

2. **Edit `.env` with your actual values**:
   ```bash
   # CETEC ERP API Configuration
   API_URL=https://yourdomain.cetecerp.com
   VITE_CETEC_DOMAIN=yourdomain.cetecerp.com
   VITE_PRESHARED_TOKEN=your_actual_token_here
   VITE_API_PROTOCOL=https
   
   # MySQL Database Configuration
   MYSQL_HOST=your_mysql_host
   MYSQL_USER=your_mysql_username
   MYSQL_PASSWORD=your_mysql_password
   MYSQL_PORT=3306
   ```

3. **Replace the placeholder values**:
   - `yourdomain.cetecerp.com` → Your actual CETEC ERP domain
   - `your_actual_token_here` → Your actual preshared token
   - MySQL credentials → Your database connection details

## 🚀 Step 3: Start the Application

```bash
# Start both frontend and backend servers
npm run dev:full
```

This will start:
- **Frontend**: http://localhost:5002 (React + Vite)
- **Backend**: http://localhost:5001 (Node.js + Express)

## ✅ Step 4: Verify Setup

1. **Check Frontend**: Open http://localhost:5002 in your browser
2. **Check Backend**: Visit http://localhost:5001/api/test-mysql
3. **Verify Data Loading**: The app should automatically load customer data

## 🎯 What You'll See

### **Customer Dashboard**
- **Automatic Loading**: Customer data loads automatically on app start
- **Database Verification**: Each customer shows backup database status
- **Environment Access**: Quick access buttons for Production, Development, and Test

### **Key Features**
- **Search & Filter**: Find customers by name, domain, or criteria
- **Backup Management**: Pull backups with timestamp tracking
- **Status Overview**: Summary statistics for all customer types
- **Real-time Updates**: Automatic refresh and status updates

## 🔧 Troubleshooting

### **Common Issues & Solutions**

#### 1. **Port Already in Use**
```bash
# Kill processes on occupied ports
npm run kill:ports

# Then start again
npm run dev:full
```

#### 2. **MySQL Connection Failed**
- Verify MySQL credentials in `.env`
- Check MySQL server is running
- Ensure network connectivity
- See [ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md) for detailed setup

#### 3. **CORS Errors**
- Ensure backend is running on port 5001
- Check frontend makes requests to `http://localhost:5001`
- Verify CORS headers are set correctly

#### 4. **Environment Variables Not Loading**
- Restart server after updating `.env`
- Check `.env` file is in project root
- Ensure no syntax errors (no spaces around `=`)

### **Quick Debug Commands**

```bash
# Check server status
lsof -i :5001  # Backend
lsof -i :5002  # Frontend

# Test MySQL connection
curl http://localhost:5001/api/test-mysql

# Test CETEC API
curl "http://localhost:5001/api/cetec/customer?preshared_token=YOUR_TOKEN"
```

## 📱 Using the Application

### **Basic Operations**

1. **View Customers**: Data loads automatically on startup
2. **Search**: Use the search bar to find specific customers
3. **Filter**: Click "Filters" to apply advanced filtering
4. **Pull Backup**: Click "Pull Backup" for customers without databases
5. **Access Environments**: Use Production, Development, and Test buttons

### **Filter Options**

- **Support Tier**: Lite, Standard, Enterprise
- **Resident Hosting**: Yes/No
- **Backup Status**: Has Backup, No Database, Unavailable
- **ITAR Hosting**: Yes/No
- **Test Environment**: Various options or No

### **Environment Access**

- **Production**: Direct access to production environment
- **Development**: Access to development environment (if database exists)
- **Test**: Access to test environment with enhanced button text

## 🔄 Development Workflow

### **Making Changes**

1. **Frontend Changes**: Automatically reload in browser
2. **Backend Changes**: Restart with `npm run server`
3. **Environment Changes**: Restart both servers

### **Useful Commands**

```bash
# Start only frontend
npm run dev

# Start only backend
npm run server

# Use custom process manager (most reliable)
npm run dev:custom

# Build for production
npm run build

# Run linting
npm run lint
```

## 🚀 Next Steps

### **Advanced Configuration**

- **Cloud SQL Proxy**: See [CLOUD_SQL_PROXY_SETUP.md](./CLOUD_SQL_PROXY_SETUP.md)
- **MySQL Optimization**: See [ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md)
- **Production Deployment**: See [RUNNING_BOTH_SERVERS.md](./RUNNING_BOTH_SERVERS.md)

### **Customization**

- **Resident Hosting**: Configure `src/config/resident-dbs.json`
- **Styling**: Modify `src/App.css`
- **Components**: Extend React components in `src/components/`

## 📚 Additional Resources

- [README.md](./README.md) - Complete application documentation
- [API_SETUP.md](./API_SETUP.md) - API integration details
- [ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md) - MySQL configuration
- [CLOUD_SQL_PROXY_SETUP.md](./CLOUD_SQL_PROXY_SETUP.md) - Cloud SQL setup
- [RUNNING_BOTH_SERVERS.md](./RUNNING_BOTH_SERVERS.md) - Server management

## 🆘 Need Help?

1. **Check this guide** for common solutions
2. **Review error messages** in terminal and browser console
3. **Check server logs** for detailed error information
4. **Verify configuration** in `.env` file
5. **Contact the development team** for complex issues

---

**🎉 Congratulations!** You're now ready to use the CETEC Backup Puller application. The app will automatically load customer data, verify database status, and provide you with comprehensive backup management capabilities.
