# Environment-Based MySQL Connection Setup

This guide shows you how to automatically switch between Cloud SQL Proxy (local development) and direct host connections (production) based on your environment.

## 🎯 **How It Works**

The server automatically detects your environment and chooses the right connection method:

- **Development** (`NODE_ENV=development`): Uses Cloud SQL Proxy socket if available
- **Production** (`NODE_ENV=production`): Uses direct host connection
- **Fallback**: If no socket in development, falls back to direct host

## 🚀 **Quick Setup**

### **Local Development (Cloud SQL Proxy)**

1. **Set environment variables**:
   ```bash
   # In your .env.local
   NODE_ENV=development
   MYSQL_SOCKET=/tmp/cloudsql/your-project:your-region:your-instance
   MYSQL_USER=your_mysql_user
   MYSQL_PASSWORD=your_mysql_password
   # MYSQL_HOST and MYSQL_PORT are ignored when using socket
   ```

2. **Start Cloud SQL Proxy**:
   ```bash
   cloud-sql-proxy --unix-socket /tmp/cloudsql your-project:your-region:your-instance
   ```

3. **Test connection**:
   ```bash
   curl http://localhost:3001/api/test-mysql
   ```

### **Production (Direct Host)**

1. **Set environment variables**:
   ```bash
   # In your production .env
   NODE_ENV=production
   MYSQL_HOST=10.24.0.217
   MYSQL_USER=app-pool
   MYSQL_PASSWORD=your_password
   MYSQL_PORT=3306
   # MYSQL_SOCKET is ignored in production
   ```

2. **Test connection**:
   ```bash
   curl http://your-server:3001/api/test-mysql
   ```

## 🔄 **Automatic Switching**

### **Development Mode**
```bash
NODE_ENV=development
MYSQL_SOCKET=/tmp/cloudsql/your-instance
# Result: Uses Cloud SQL Proxy socket
```

### **Production Mode**
```bash
NODE_ENV=production
MYSQL_HOST=10.24.0.217
# Result: Uses direct host connection
```

### **Development Fallback**
```bash
NODE_ENV=development
# No MYSQL_SOCKET set
MYSQL_HOST=10.24.0.217
# Result: Falls back to direct host connection
```

## 📊 **Connection Test Response**

### **Development with Cloud SQL Proxy**
```json
{
  "status": "success",
  "environment": "development",
  "connection_method": "cloud_sql_proxy",
  "connection_type": "unix_socket",
  "socket_path": "/tmp/cloudsql/your-instance",
  "host": null,
  "port": null
}
```

### **Production with Direct Host**
```json
{
  "status": "success",
  "environment": "production",
  "connection_method": "direct_host",
  "connection_type": "tcp",
  "socket_path": null,
  "host": "10.24.0.217",
  "port": 3306
}
```

## 🎭 **Environment Variables Priority**

1. **`NODE_ENV`** - Determines connection strategy
2. **`MYSQL_SOCKET`** - Used only in development
3. **`MYSQL_HOST`** - Used in production or development fallback
4. **`MYSQL_PORT`** - Used with direct host connections

## 🚨 **Important Notes**

- **Cloud SQL Proxy only works in development** - production will ignore `MYSQL_SOCKET`
- **Direct host always works** - can be used in both environments
- **Automatic fallback** - if socket fails in development, falls back to host
- **Performance optimized** - socket connections use faster timeouts

## 🔧 **Troubleshooting**

### **Still Using Direct Host in Development**
- Check `NODE_ENV=development` is set
- Verify `MYSQL_SOCKET` path exists
- Ensure Cloud SQL Proxy is running

### **Socket Connection Failing**
- Check Cloud SQL Proxy status
- Verify socket file permissions
- Check socket path in environment variables

### **Production Connection Issues**
- Verify `NODE_ENV=production`
- Check firewall settings
- Ensure MySQL server is accessible

## 🎯 **Benefits**

- **Zero configuration changes** when deploying
- **Automatic optimization** for each environment
- **Development speed** with Cloud SQL Proxy
- **Production reliability** with direct connections
- **Easy testing** of both connection methods
