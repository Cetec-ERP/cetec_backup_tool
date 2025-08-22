# CETEC ERP API Integration Guide

This guide explains how the CETEC ERP API integration works in the CETEC Backup Puller application, including the backend proxy architecture and enhanced functionality.

## 🏗️ Architecture Overview

The application uses a **backend proxy architecture** where:

1. **Frontend** → Makes requests to local backend server
2. **Backend** → Proxies requests to CETEC ERP API with MySQL enrichment
3. **MySQL Integration** → Automatically checks database existence for each customer
4. **Enhanced Response** → Returns enriched data with backup status and timestamps

## 🔧 Environment Configuration

### 1. Create Environment File

Create a `.env` file in your project root:

```bash
# CETEC ERP API Configuration
API_URL=https://yourdomain.cetecerp.com

# Frontend Configuration (Vite will use these)
VITE_CETEC_DOMAIN=yourdomain.cetecerp.com
VITE_PRESHARED_TOKEN=your_actual_token_here
VITE_API_PROTOCOL=https

# MySQL Database Configuration
MYSQL_HOST=your_mysql_host
MYSQL_USER=your_mysql_username
MYSQL_PASSWORD=your_mysql_password
MYSQL_PORT=3306
```

### 2. Replace Placeholder Values

- `yourdomain.cetecerp.com` → Your actual CETEC ERP domain
- `your_actual_token_here` → Your actual preshared token
- `https` → Your preferred protocol (http or https)
- MySQL credentials → Your database connection details

## 🌐 API Endpoints

### Frontend → Backend (Local)

The frontend makes requests to your local backend server:

```typescript
// Frontend code
const response = await axios.get(
  `http://localhost:5001/api/cetec/customer?preshared_token=${token}`
);
```

### Backend → CETEC ERP API

The backend then proxies to the actual CETEC ERP API:

```bash
GET https://{DOMAIN}.cetecerp.com/api/customer?{PARAMETERS}&preshared_token={TOKEN}
```

## 📊 Enhanced Data Response

### What You Get

Instead of raw CETEC API data, you receive enriched information:

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
    "timestamp": "2025-01-13T10:30:00.000Z",
    "summary": {
      "total_customers": 344,
      "existing_databases": 298,
      "resident_hosting": 23,
      "itar_hosting": 12,
      "invalid_domains": 0,
      "no_database": 11
    }
  }
}
```

### Enhanced Fields

- **`database_exists`**: Boolean indicating if backup database exists
- **`lastPulled`**: Timestamp of last backup pull (if any)
- **`mysql_status`**: Status of MySQL enrichment process
- **`summary`**: Statistical overview of customer data

## 🔍 Query Parameters

### Available Parameters

- **`preshared_token`** (required): Authentication token
- **`id`** (optional): Filter by customer ID
- **`name`** (optional): Filter by customer name
- **`external_key`** (optional): Filter by external key
- **`columns`** (optional): Specific columns to return

### Default Columns

If no columns specified, the backend automatically requests:

```bash
id,name,domain,ok_to_bill,priority_support,resident_hosting,test_environment,itar_hosting_bc,num_prod_users,num_full_users,techx_password
```

## 🗄️ MySQL Integration

### Automatic Database Checks

The backend automatically:

1. **Fetches** customer data from CETEC API
2. **Filters** for billing-enabled customers (`ok_to_bill = 1`)
3. **Checks** MySQL for database existence
4. **Validates** `usage_stats` table presence
5. **Enriches** response with database status

### Database Status Values

- **`true`**: Database exists with `usage_stats` table
- **`false`**: Database doesn't exist
- **`resident_hosting`**: Customer uses resident hosting
- **`itar_hosting`**: Customer uses ITAR hosting
- **`unavailable`**: ITAR or resident hosting without database mapping
- **`mysql_error`**: MySQL connection failed
- **`batch_timeout`**: Database check timed out

## 🔐 Security Features

### Authentication

- **Preshared Token**: Required for all API requests
- **Backend Proxy**: Token never exposed to frontend
- **HTTPS Support**: Secure communication with CETEC API

### Data Protection

- **MySQL Credentials**: Only accessible on backend
- **Customer Data**: Filtered by billing status
- **Error Handling**: Sensitive information not exposed in errors

## 🚀 Usage Examples

### 1. Fetch All Customers

```typescript
const response = await axios.get(
  'http://localhost:5001/api/cetec/customer',
  {
    params: {
      preshared_token: 'your_token_here'
    }
  }
);
```

### 2. Filter by Customer Name

```typescript
const response = await axios.get(
  'http://localhost:5001/api/cetec/customer',
  {
    params: {
      preshared_token: 'your_token_here',
      name: 'Acme Corp'
    }
  }
);
```

### 3. Get Specific Columns

```typescript
const response = await axios.get(
  'http://localhost:5001/api/cetec/customer',
  {
    params: {
      preshared_token: 'your_token_here',
      columns: 'id,name,domain,priority_support'
    }
  }
);
```

## 🧪 Testing

### 1. Start the Application

```bash
npm run dev:full
```

### 2. Test API Endpoint

```bash
curl "http://localhost:5001/api/cetec/customer?preshared_token=YOUR_TOKEN"
```

### 3. Check MySQL Connection

```bash
curl "http://localhost:5001/api/test-mysql"
```

## 🚨 Troubleshooting

### Common Issues

1. **CORS Errors**
   - Ensure backend is running on port 5001
   - Check that frontend makes requests to `http://localhost:5001`

2. **Authentication Errors**
   - Verify preshared token is correct
   - Check token has necessary permissions

3. **MySQL Connection Issues**
   - Verify MySQL credentials in `.env`
   - Check MySQL server accessibility
   - See [ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md) for details

4. **Environment Variables**
   - Restart server after updating `.env`
   - Ensure variables are properly formatted

### Debug Information

The backend provides detailed error information:

```json
{
  "status": "error",
  "message": "MySQL connection failed",
  "environment": "development",
  "connection_method": "direct_host",
  "connection_type": "tcp"
}
```

## 🔄 Production Considerations

- **Environment Variables**: Use production values
- **MySQL Connection**: Ensure reliable database access
- **Error Handling**: Monitor logs for issues
- **Performance**: Consider connection pooling for high traffic
- **Security**: Use HTTPS in production

## 📚 Related Documentation

- [Environment Setup](./ENVIRONMENT_SETUP.md) - MySQL configuration
- [Running Both Servers](./RUNNING_BOTH_SERVERS.md) - Server management
- [README.md](./README.md) - Main application documentation
