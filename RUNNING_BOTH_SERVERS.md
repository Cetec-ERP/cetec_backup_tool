# Running Both Frontend and Backend Servers

This guide explains how to run both the React frontend and Node.js backend servers simultaneously.

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
- Runs on: http://localhost:5173
- Hot reload enabled
- React development server

### **Backend Only (Express)**
```bash
npm run server
```
- Runs on: http://localhost:3001
- CETEC API proxy
- MySQL database integration

## 🌐 **API Endpoints**

### **Backend API Endpoint**
- **URL**: `/api/cetec/customer`
- **Method**: GET
- **Query Parameters**:
  - `preshared_token` (required): Your CETEC API token
  - `id` (optional): Customer ID filter
  - `name` (optional): Customer name filter
  - `external_key` (optional): External key filter
  - `columns` (optional): Specific columns to return
  - `filter_billing` (optional): Set to 'true' to filter by ok_to_bill status

### **Response Format**
The backend now returns enriched data with MySQL database verification:
```json
{
  "customers": [
    {
      "id": 123,
      "name": "Customer Name",
      "domain": "customer.com",
      "database_exists": true,
      "ok_to_bill": 1,
      // ... other fields
    }
  ],
  "metadata": {
    "total_customers": 344,
    "mysql_enabled": true,
    "timestamp": "2025-01-13T..."
  }
}
```

## 🔐 **Environment Variables**

### **Required Variables**
Create a `.env` file in your project root with these variables:

```bash
# Server Configuration
PORT=3001

# CETEC API Configuration
API_URL=https://yourdomain.cetecerp.com

# Frontend Configuration (Vite will use these)
VITE_CETEC_DOMAIN=yourdomain.cetecerp.com
VITE_PRESHARED_TOKEN=your_preshared_token_here
VITE_API_PROTOCOL=https

# MySQL Database Configuration
# Note: We don't specify a database since we're checking for database existence
MYSQL_HOST=your_mysql_host
MYSQL_USER=your_mysql_username
MYSQL_PASSWORD=your_mysql_password
# MYSQL_DATABASE=not_needed (we're checking if databases exist, not connecting to one)
MYSQL_PORT=3306  # Optional - MySQL default is 3306
```

### **Important Notes**
- **Vite Variables**: Only variables prefixed with `VITE_` are accessible in the frontend
- **Backend Variables**: Node.js can access any environment variable
- **MySQL Security**: Database credentials are only accessible on the backend
- **API_URL**: Should be the base domain (e.g., `https://internal.cetecerp.com`)

## 🗄️ **MySQL Integration**

The backend now automatically checks if a MySQL database exists for each customer's domain:

- **Query**: `SHOW DATABASES LIKE '[domain]'`
- **Result**: Adds `database_exists` field to each customer record
- **Error Handling**: Continues processing even if MySQL connection fails
- **Performance**: Processes all customers sequentially (manageable for 344 records)

### **Database Existence Values**
- `true`: Database exists
- `false`: Database does not exist
- `null`: MySQL error occurred (connection failed, etc.)

## 🚨 **Troubleshooting**

### **Common Issues**

1. **Port Already in Use**
   ```bash
   lsof -ti:3001 | xargs kill -9  # Kill process on port 3001
   lsof -ti:5173 | xargs kill -9  # Kill process on port 5173
   ```

2. **MySQL Connection Failed**
   - Check your `.env` file has correct MySQL credentials
   - Verify MySQL server is running and accessible
   - Check firewall/network settings

3. **CORS Errors**
   - Ensure backend is running on port 3001
   - Check that frontend is making requests to `http://localhost:3001`

4. **Environment Variables Not Loading**
   - Restart your server after updating `.env`
   - Verify `.env` file is in the project root
   - Check for syntax errors in `.env` file

### **Server Status Check**
```bash
# Check if servers are running
lsof -i :3001  # Backend
lsof -i :5173  # Frontend
```

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