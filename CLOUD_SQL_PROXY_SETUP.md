# Google Cloud SQL Proxy Setup

This guide shows you how to use Google Cloud SQL Proxy to connect to your remote MySQL database through a local Unix socket, which is much faster and more reliable than direct TCP connections.

## 🚀 Quick Setup

### 1. Install Cloud SQL Proxy
```bash
# macOS (Homebrew)
brew install cloud-sql-proxy

# Or download directly
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.1/cloud-sql-proxy.darwin.amd64
chmod +x cloud-sql-proxy
```

### 2. Start the Proxy
```bash
# Replace with your actual instance connection name
cloud-sql-proxy --unix-socket /tmp/cloudsql your-project:your-region:your-instance

# Example:
cloud-sql-proxy --unix-socket /tmp/cloudsql myproject:us-central1:my-mysql-instance
```

### 3. Configure Environment Variables
```bash
# In your .env.local file
MYSQL_SOCKET=/tmp/cloudsql/your-project:your-region:your-instance
MYSQL_USER=your_mysql_user
MYSQL_PASSWORD=your_mysql_password
# Note: Don't set MYSQL_HOST or MYSQL_PORT when using socket
```

## 🔧 Environment Configuration

### For Cloud SQL Proxy (Unix Socket)
```bash
# .env.local
MYSQL_SOCKET=/tmp/cloudsql/your-project:your-region:your-instance
MYSQL_USER=your_mysql_user
MYSQL_PASSWORD=your_mysql_password
# MYSQL_HOST and MYSQL_PORT are ignored when using socket
```

### For Direct Remote Connection (Fallback)
```bash
# .env.local
MYSQL_HOST=10.24.0.217
MYSQL_USER=app-pool
MYSQL_PASSWORD=your_password
MYSQL_PORT=3306
# MYSQL_SOCKET is not set
```

## 🧪 Testing the Connection

### 1. Start Cloud SQL Proxy
```bash
cloud-sql-proxy --unix-socket /tmp/cloudsql your-project:your-region:your-instance
```

### 2. Test the Connection
```bash
curl http://localhost:3001/api/test-mysql
```

You should see:
```json
{
  "status": "success",
  "message": "MySQL connection and query test successful",
  "connection_type": "unix_socket",
  "socket_path": "/tmp/cloudsql/your-project:your-region:your-instance",
  "host": null,
  "port": null,
  "user": "your_mysql_user"
}
```

## 🎯 Benefits of Cloud SQL Proxy

- **Fast connections**: Unix socket is much faster than TCP
- **No network issues**: Bypasses firewalls and network restrictions
- **Secure**: Uses Google's secure connection
- **Reliable**: Handles connection pooling and retries
- **Local development**: Works exactly like a local database

## 🔄 Switching Between Connection Types

### Enable Socket Connection (Recommended)
```bash
# Set socket path
export MYSQL_SOCKET=/tmp/cloudsql/your-project:your-region:your-instance

# Or in .env.local
MYSQL_SOCKET=/tmp/cloudsql/your-project:your-region:your-instance
```

### Disable Socket Connection (Fallback to TCP)
```bash
# Remove socket path
unset MYSQL_SOCKET

# Or in .env.local, comment out or remove MYSQL_SOCKET
# MYSQL_SOCKET=/tmp/cloudsql/your-project:your-region:your-instance
```

## 🚨 Important Notes

- **Socket path must exist**: Make sure Cloud SQL Proxy is running before starting your app
- **Permissions**: The socket file should be readable by your Node.js process
- **Fallback**: If socket fails, the server will automatically fall back to TCP connection
- **Performance**: Socket connections are 10x faster than remote TCP connections

## 🆘 Troubleshooting

### Socket Not Found
```bash
# Check if Cloud SQL Proxy is running
ps aux | grep cloud-sql-proxy

# Check socket file exists
ls -la /tmp/cloudsql/

# Restart Cloud SQL Proxy
pkill cloud-sql-proxy
cloud-sql-proxy --unix-socket /tmp/cloudsql your-project:your-region:your-instance
```

### Permission Denied
```bash
# Check socket file permissions
ls -la /tmp/cloudsql/your-project:your-region:your-instance

# Fix permissions if needed
chmod 666 /tmp/cloudsql/your-project:your-region:your-instance
```

### Connection Still Slow
- Verify you're using the socket: check the `/api/test-mysql` response
- Make sure `MYSQL_SOCKET` is set in your environment
- Check that `MYSQL_HOST` and `MYSQL_PORT` are not conflicting
