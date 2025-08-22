# Environment Setup

## Required Environment Variables

### Frontend Environment Variables
```bash
# API Configuration
VITE_API_URL=http://backups.cetecerpdevel.com:5001
VITE_CETEC_DOMAIN=internal.cetecerp.com
VITE_PRESHARED_TOKEN=your_token_here
VITE_API_PROTOCOL=https
```

### Backend Environment Variables
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

## Environment-Specific Configuration

### Local Development
Create a `.env` file in your project root:
```bash
VITE_API_URL=http://localhost:5001
VITE_CETEC_DOMAIN=localhost
VITE_PRESHARED_TOKEN=your_dev_token
VITE_API_PROTOCOL=http
```

### Production Server
Create a `.env` file on your production server:
```bash
VITE_API_URL=http://backups.cetecerpdevel.com:5001
VITE_CETEC_DOMAIN=backups.cetecerpdevel.com
VITE_PRESHARED_TOKEN=your_production_token
VITE_API_PROTOCOL=http
```

## Testing the Configuration

### Test Backend API
```bash
# Test from local machine
curl http://backups.cetecerpdevel.com:5001/api/test-mysql

# Test from server
curl http://localhost:5001/api/test-mysql
```

### Test Frontend
1. Navigate to your frontend URL
2. Check browser console for any API errors
3. Verify API calls are going to the correct endpoint
