# Running Both Frontend and Backend Servers

This guide explains how to run both the React frontend and Node.js backend servers simultaneously for the CETEC Backup Puller application.

## 🚀 **Quick Start**

### **Option 1: Enhanced Concurrently (Recommended)**
```bash
npm run dev:full
```
This uses an improved `concurrently` configuration with better signal handling.

### **Option 2: Custom Process Manager (Most Reliable)**
```bash
npm run dev:custom
```
This uses a custom Node.js script that provides the most reliable process management and signal handling.

### **Option 3: Manual Port Cleanup**
If you encounter port conflicts:
```bash
npm run kill:ports
npm run dev:full
```

All options will start both the frontend (Vite) and backend (Express) servers.

## 🔧 **Individual Server Commands**

### **Frontend Only (Vite)**
```bash
npm run dev
```
- Runs on: http://backups.cetecerpdevel.com:5002
- Hot reload enabled
- React development server

### **Backend Only (Express)**
```bash
npm run server
```
- Runs on: http://backups.cetecerpdevel.com:5001
- CETEC API proxy with MySQL integration
- Customer data enrichment and backup management

## 🌐 **API Endpoints**

### **Backend API Endpoints**

#### **Customer Data**
- **URL**: `GET /api/cetec/customer`
- **Purpose**: Fetch customer data with MySQL database verification
- **Query Parameters**:
  - `preshared_token` (required): Your CETEC API token
  - `id` (optional): Customer ID filter
  - `name` (optional): Customer name filter
  - `external_key` (optional): External key filter
  - `columns` (optional): Specific columns to return

#### **Backup Operations**
- **URL**: `POST /api/pull/record`
- **Purpose**: Record backup pull timestamps
- **Body**: `{ "customerId": "123" }`

- **URL**: `POST /api/backup/request`
- **Purpose**: Request backup operations
- **Body**: `{ "dbname": "database_name" }`

#### **Database Management**
- **URL**: `POST /api/mysql/check`
- **Purpose**: Check specific customer database status
- **Body**: `{ "customerId": "123", "domain": "example.com", "residentHosting": false, "itarHosting": false }`

- **URL**: `GET /api/test-mysql`
- **Purpose**: Test MySQL connection and configuration

### **Response Format**
The backend returns enriched data with MySQL database verification:
```json
{
  "customers": [
    {
      "id": 123,
      "name": "Customer Name",
      "domain": "customer.com",
      "database_exists": true,
      "ok_to_bill": 1,
      "priority_support": "Enterprise",
      "resident_hosting": false,
      "test_environment": "Update Nightly",
      "itar_hosting_bc": false,
      "num_prod_users": 150,
      "num_full_users": 25,
      "techx_password": "encrypted_password",
      "lastPulled": "2025-01-13T10:30:00.000Z"
    }
  ],
  "metadata": {
    "total_customers": 344,
    "mysql_status": "completed",
    "mysql_enabled": true,
    "api_url": "https://yourdomain.cetecerp.com/api/customer?...",
    "timestamp": "2025-01-13T10:30:00.000Z",
    "summary": {
      "total_customers": 344,
      "existing_databases": 298,
      "resident_hosting": 23,
      "itar_hosting": 12,
      "invalid_domains": 0,
      "no_database": 11
    },
    "processing_steps": {
      "api_fetch": "completed",
      "billing_filter": "completed",
      "mysql_enrichment": "completed"
    }
  }
}
```

## 🔐 **Environment Variables**

### **Required Variables**
Create a `.env` file in your project root with these variables:

```bash
# Server Configuration
PORT=5001

# CETEC API Configuration
API_URL=https://yourdomain.cetecerp.com

# Frontend Configuration (Vite will use these)
VITE_API_URL=http://localhost:5001  # Points to local backend
VITE_CETEC_DOMAIN=yourdomain.cetecerp.com
VITE_PRESHARED_TOKEN=your_preshared_token_here
VITE_API_PROTOCOL=https

# MySQL Database Configuration
MYSQL_HOST=your_mysql_host
MYSQL_USER=your_mysql_username
MYSQL_PASSWORD=your_mysql_password
MYSQL_PORT=3306

# Optional: Cloud SQL Proxy (for development)
MYSQL_SOCKET=/tmp/cloudsql/your-project:your-region:your-instance
```

### **Important Notes**
- **Vite Variables**: Only variables prefixed with `VITE_` are accessible in the frontend
- **Backend Variables**: Node.js can access any environment variable
- **MySQL Security**: Database credentials are only accessible on the backend
- **API_URL**: Should be the base domain (e.g., `https://internal.cetecerp.com`)

## 🗄️ **MySQL Integration**

The backend automatically checks if a MySQL database exists for each customer's domain:

- **Query**: Checks for `usage_stats` table in customer database
- **Result**: Adds `database_exists` field to each customer record
- **Error Handling**: Continues processing even if MySQL connection fails
- **Performance**: Processes customers in batches with individual timeouts

### **Database Existence Values**
- `true`: Database exists with `usage_stats` table
- `false`: Database does not exist
- `resident_hosting`: Customer uses resident hosting with database mapping
- `itar_hosting`: Customer uses ITAR hosting
- `unavailable`: ITAR or resident hosting without database mapping
- `mysql_error`: MySQL error occurred
- `batch_timeout`: Database check timed out
- `invalid_domain`: Customer has no valid domain

## 🚨 **Troubleshooting**

### **Common Issues**

1. **Port Already in Use**
   ```bash
   lsof -ti:5001 | xargs kill -9  # Kill process on port 5001
   lsof -ti:5002 | xargs kill -9  # Kill process on port 5002
   
   # Or use the provided script
   npm run kill:ports
   ```

2. **MySQL Connection Failed**
   - Check your `.env` file has correct MySQL credentials
   - Verify MySQL server is running and accessible
   - Check firewall/network settings
   - See [ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md) for detailed MySQL setup

3. **CORS Errors**
   - Ensure backend is running on port 5001
   - Check that frontend is making requests to `http://backups.cetecerpdevel.com:5001`
   - Verify CORS headers are properly set

4. **Environment Variables Not Loading**
   - Restart your server after updating `.env`
   - Verify `.env` file is in the project root
   - Check for syntax errors in `.env` file
   - Ensure no spaces around `=` signs

5. **CETEC API Connection Issues**
   - Verify `API_URL` is correct and accessible
   - Check `preshared_token` is valid
   - Ensure network connectivity to CETEC domain

### **Server Status Check**
```bash
# Check if servers are running
lsof -i :5001  # Backend
lsof -i :5002  # Frontend

# Check server logs
# Backend logs appear in the terminal where you ran npm run server
# Frontend logs appear in the terminal where you ran npm run dev
```

### **Debug Information**

The backend provides detailed error information through the `/api/test-mysql` endpoint:

```bash
curl http://backups.cetecerpdevel.com:5001/api/test-mysql
```

This will show:
- Connection method (socket vs direct host)
- Environment detection
- MySQL configuration details
- Any connection errors

## 📝 **Development Workflow**

1. **Start Development**: `npm run dev:full`
2. **Make Changes**: Edit files in `src/` or `server.js`
3. **Auto-Reload**: Frontend automatically reloads, backend requires restart
4. **Restart Backend**: Stop and restart with `npm run server` if needed
5. **View Logs**: Check terminal for both frontend and backend logs

## 🔄 **Restarting Servers**

- **Frontend**: Automatically restarts on file changes
- **Backend**: Restart manually after changes to `server.js` or `.env`
- **Full Restart**: Stop both with `Ctrl+C`, then run `npm run dev:full` again

## 🚀 **Production Deployment**

### **Environment Setup**
```bash
# Set production environment
NODE_ENV=production

# Use production MySQL credentials
MYSQL_HOST=production_mysql_host
MYSQL_USER=production_user
MYSQL_PASSWORD=production_password

# Set production CETEC API URL
API_URL=https://production.cetecerp.com
```

### **Process Management**
- Use PM2 or similar process manager for production
- Set up proper logging and monitoring
- Configure health checks for the backend API

## 📚 **Related Documentation**

- [README.md](./README.md) - Main application documentation
- [ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md) - MySQL and environment configuration
- [CLOUD_SQL_PROXY_SETUP.md](./CLOUD_SQL_PROXY_SETUP.md) - Google Cloud SQL Proxy configuration
- [API_SETUP.md](./API_SETUP.md) - CETEC API integration details