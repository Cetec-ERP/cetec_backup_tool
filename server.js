import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from 'url';

dotenv.config();

// ES modules equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;

// Validate required environment variables
const requiredEnvVars = ['API_URL'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.warn(`Warning: Missing environment variables: ${missingEnvVars.join(', ')}`);
  console.warn('Server will start with default values, but some features may not work properly.');
}

// MySQL connection configuration
const mysqlConfig = {
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  // Remove database requirement since we're checking for database existence
  // database: process.env.MYSQL_DATABASE,
  port: process.env.MYSQL_PORT || 3306,
  
  // Environment-based connection selection
  // Development: Use Cloud SQL Proxy socket if available
  // Production: Use direct host connection
  ...(process.env.NODE_ENV === 'development' && process.env.MYSQL_SOCKET && { 
    socketPath: process.env.MYSQL_SOCKET 
  }),
  
  // Connection settings (optimized for local socket vs remote)
  ...(process.env.NODE_ENV === 'development' && process.env.MYSQL_SOCKET ? {
    // Local socket connection (Cloud SQL Proxy) - fast and reliable
    connectTimeout: 10000,        // 10 seconds for local connections
    acquireTimeout: 10000,        // 10 seconds for local connections
    acquireTimeoutMillis: 10000,  // Alternative timeout setting
    createTimeoutMillis: 10000,   // Time to create connection
    destroyTimeoutMillis: 5000,   // Time to destroy connection
    idleTimeoutMillis: 30000,     // How long connection can be idle
    reapIntervalMillis: 1000,     // How often to check for dead connections
    createRetryIntervalMillis: 200, // Retry interval for failed connections
    
    // Connection pool settings for local socket
    max: 10,                      // Higher max connections for local
    min: 2,                       // Higher min connections for local
    
    // Local connection specific settings
    multipleStatements: false,    // Security: prevent multiple statements
    dateStrings: true,            // Better date handling
    charset: 'utf8mb4',           // Modern charset support
  } : {
    // Remote connection optimizations (when not using socket)
    connectTimeout: 60000,        // 60 seconds to establish connection (remote servers can be slow)
    acquireTimeout: 60000,        // 60 seconds to acquire connection from pool
    acquireTimeoutMillis: 60000,  // Alternative timeout setting
    createTimeoutMillis: 60000,   // Time to create connection
    destroyTimeoutMillis: 10000,  // Time to destroy connection
    idleTimeoutMillis: 60000,     // How long connection can be idle
    reapIntervalMillis: 1000,     // How often to check for dead connections
    createRetryIntervalMillis: 1000, // Retry interval for failed connections (longer for remote)
    
    // Connection pool settings for remote servers
    max: 5,                       // Lower max connections for remote (was 10)
    min: 1,                       // Lower min connections for remote (was 2)
    
    // Remote connection specific settings
    ssl: false,                   // Disable SSL for now (can cause issues with some remote servers)
    multipleStatements: false,    // Security: prevent multiple statements
    dateStrings: true,            // Better date handling
    charset: 'utf8mb4',           // Modern charset support
    
    // Network settings
    keepAliveInitialDelay: 10000, // Keep connections alive
    enableKeepAlive: true,        // Enable keep-alive for remote connections
  }),
};

// Create a connection pool instead of individual connections
let mysqlPool = null;
let residentDBsConfig = null;

// Load resident databases configuration
async function loadResidentDBsConfig() {
  try {
    const configPath = path.join(__dirname, 'src', 'config', 'resident-dbs.json');
    const configData = await fs.readFile(configPath, 'utf8');
    residentDBsConfig = JSON.parse(configData);
    console.log(`Resident DBs configuration loaded: ${Object.keys(residentDBsConfig).length} mappings`);
  } catch (error) {
    console.warn('Warning: Could not load resident DBs configuration:', error.message);
    residentDBsConfig = {};
  }
}

// Timestamp tracking functionality
const timestampDataPath = path.join(__dirname, 'data', 'pull-timestamps.json');

// Load timestamp data
async function loadTimestampData() {
  try {
    const dataDir = path.dirname(timestampDataPath);
    await fs.mkdir(dataDir, { recursive: true });
    const data = await fs.readFile(timestampDataPath, 'utf8');
    const parsedData = JSON.parse(data);
    return parsedData;
  } catch (error) {
    return {};
  }
}

// Save timestamp data
async function saveTimestampData(data) {
  try {
    await fs.writeFile(timestampDataPath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error saving timestamp data:', error);
  }
}

// Record pull button click
async function recordPullClick(customerId) {
  try {
    const timestampData = await loadTimestampData();
    const now = new Date().toISOString();
    
    timestampData[customerId] = {
      lastPulled: now,
      customerId: customerId
    };
    
    await saveTimestampData(timestampData);
    return { success: true, timestamp: now };
  } catch (error) {
    console.error('Error recording pull click:', error);
    return { success: false, error: error.message };
  }
}

// Check if a domain has a resident database mapping
function hasResidentDatabase(domain) {
  if (!residentDBsConfig || !domain) {
    return false;
  }
  
  const hasDB = domain.toLowerCase() in residentDBsConfig || 
         Object.keys(residentDBsConfig).some(key => key.toLowerCase() === domain.toLowerCase());
  
  return hasDB;
}

// Get database name for a resident hosting domain
function getResidentDatabaseName(domain) {
  if (!residentDBsConfig || !domain) return null;
  
  // Try exact match first
  if (domain in residentDBsConfig) {
    return residentDBsConfig[domain];
  }
  
  // Try case-insensitive match
  const matchingKey = Object.keys(residentDBsConfig).find(key => 
    key.toLowerCase() === domain.toLowerCase()
  );
  
  return matchingKey ? residentDBsConfig[matchingKey] : null;
}

// Initialize MySQL pool
async function initializeMySQLPool() {
  if (!isMySQLConfigured) {
    return;
  }
  
  try {
    mysqlPool = mysql.createPool(mysqlConfig);
    
    // Test the pool with a simple connection
    const testConnection = await mysqlPool.getConnection();
    testConnection.release();
  } catch (error) {
    console.error('Failed to initialize MySQL pool:', error.message);
    mysqlPool = null;
  }
}

// Check if MySQL is properly configured
const isMySQLConfigured = mysqlConfig.host && mysqlConfig.user && mysqlConfig.password;

// Function to check if a database exists and has the usage_stats table
async function checkDatabaseExists(domain, isResidentHosting = false) {
  if (!mysqlPool) {
    throw new Error('MySQL pool not initialized');
  }

  let connection;
  try {
    connection = await mysqlPool.getConnection();
    
    // For resident hosting customers, use the database name from the mapping
    let databaseName = domain;
    if (isResidentHosting) {
      const residentDBName = getResidentDatabaseName(domain);
      if (residentDBName) {
        databaseName = residentDBName;
      } else {
        throw new Error(`No database mapping found for resident hosting domain: ${domain}`);
      }
    }
    
    // Check if database exists AND has the usage_stats table
    const query = `
      SELECT COUNT(*) as table_count 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'usage_stats'
    `;
    const params = [databaseName];
    
    const [rows] = await Promise.race([
      connection.execute(query, params),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout')), 30000)
      )
    ]);
    
    return rows[0].table_count > 0;
  } catch (error) {
    console.error(`Error checking database for domain ${domain}:`, error.message);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// Function to enrich customer data with database existence info
async function enrichCustomerData(customers) {
  if (!customers || !Array.isArray(customers)) {
    return customers;
  }

  const enrichedCustomers = [];
  let mysqlErrors = 0;

  // Process customers in smaller batches to avoid overwhelming the connection pool
  const batchSize = 5;
  const batches = [];
  
  for (let i = 0; i < customers.length; i += batchSize) {
    batches.push(customers.slice(i, i + batchSize));
  }

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    
    // Process batch in parallel with individual timeouts
    const batchPromises = batch.map(async (customer) => {
      try {
        const isResidentHosting = customer.resident_hosting === true || customer.resident_hosting === 1;
        const hasUsageStatsTable = await checkDatabaseExists(customer.domain, isResidentHosting);
        
        return {
          ...customer,
          database_exists: hasUsageStatsTable
        };
      } catch (error) {
        console.error(`Error enriching customer ${customer.id} (${customer.domain}):`, error.message);
        return {
          ...customer,
          database_exists: 'mysql_error'
        };
      }
    });
    
    // Wait for batch to complete with overall timeout
    try {
      const batchResults = await Promise.race([
        Promise.all(batchPromises),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Batch timeout')), 60000) // 60 seconds per batch
        )
      ]);
      
      enrichedCustomers.push(...batchResults);
    } catch (batchError) {
      console.error(`Batch ${batchIndex + 1} failed:`, batchError.message);
      
      // Add customers from failed batch with error status
      batch.forEach(customer => {
        const enrichedCustomer = { ...customer };
        enrichedCustomer.database_exists = 'batch_timeout';
        enrichedCustomers.push(enrichedCustomer);
        mysqlErrors++;
      });
    }
  }

  if (mysqlErrors > 0) {
    console.warn(`MySQL errors occurred for ${mysqlErrors} customers`);
  }
  
  return enrichedCustomers;
}

// Enable CORS for React app
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "http://localhost:5173");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Parse JSON bodies
app.use(express.json());

// Test MySQL connection endpoint
app.get("/api/test-mysql", async (req, res) => {
  if (!isMySQLConfigured) {
    return res.json({ 
      status: 'not_configured', 
      message: 'MySQL not configured in environment variables' 
    });
  }
  
  try {
    
    // Determine connection method
    const isDevelopment = process.env.NODE_ENV === 'development';
    const useSocket = isDevelopment && process.env.MYSQL_SOCKET;
    const connectionMethod = useSocket ? 'cloud_sql_proxy' : 'direct_host';
    
    if (useSocket) {
    } else {
    }
    
    const connection = await mysql.createConnection({
      host: useSocket ? undefined : mysqlConfig.host,
      user: mysqlConfig.user,
      password: mysqlConfig.password,
      port: useSocket ? undefined : mysqlConfig.port,
      socketPath: useSocket || undefined,
      connectTimeout: useSocket ? 10000 : 30000
    });
    
    
    // Test a simple query
    const [rows] = await connection.execute('SELECT 1 as test');
    
    await connection.end();
    
    res.json({ 
      status: 'success', 
      message: 'MySQL connection and query test successful',
      environment: process.env.NODE_ENV || 'development',
      connection_method: connectionMethod,
      connection_type: useSocket ? 'unix_socket' : 'tcp',
      socket_path: useSocket || null,
      host: useSocket ? null : mysqlConfig.host,
      port: useSocket ? null : mysqlConfig.port,
      user: mysqlConfig.user
    });
    
  } catch (error) {
    console.error('MySQL connection test failed:', error.message);
    console.error('Full error:', error);
    
    const isDevelopment = process.env.NODE_ENV === 'development';
    const useSocket = isDevelopment && process.env.MYSQL_SOCKET;
    const connectionMethod = useSocket ? 'cloud_sql_proxy' : 'direct_host';
    
    res.json({ 
      status: 'error', 
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      environment: process.env.NODE_ENV || 'development',
      connection_method: connectionMethod,
      connection_type: useSocket ? 'unix_socket' : 'tcp',
      socket_path: useSocket || null,
      host: useSocket ? null : mysqlConfig.host,
      port: useSocket ? null : mysqlConfig.port,
      user: mysqlConfig.user
    });
  }
});

// Proxy endpoint for CETEC ERP API with MySQL enrichment
app.get("/api/cetec/customer", async (req, res) => {
  let cetecUrl = ''; // Declare outside try block for error handling
  
  try {
    const { id, name, external_key, columns, preshared_token } = req.query;
    
    if (!preshared_token) {
      return res.status(400).json({ error: "preshared_token is required" });
    }

    // Step 1: Fetch data from CETEC API
    
    // Build query string with all parameters
    const queryParams = new URLSearchParams();
    if (id) queryParams.append('id', id);
    if (name) queryParams.append('name', name);
    if (external_key) queryParams.append('external_key', external_key);
    if (columns) queryParams.append('columns', columns);
    
    // Always request only billing-enabled customers to reduce data transfer and processing
    queryParams.append('ok_to_bill', '1');
    
    // Limit columns to only what we need for better performance
    if (!columns) {
      queryParams.append('columns', 'id,name,domain,ok_to_bill,priority_support,resident_hosting,test_environment,test_domain,itar_hosting_bc,num_prod_users,num_full_users,techx_password');
    }
    
    queryParams.append('preshared_token', preshared_token);

    let apiUrl = process.env.API_URL || 'https://4-19-fifo.cetecerpdevel.com';
    
    // Ensure the URL has a protocol
    if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
      apiUrl = `https://${apiUrl}`;
    }
    
    cetecUrl = `${apiUrl}/api/customer?${queryParams.toString()}`;
    
    const response = await axios.get(cetecUrl, {
      timeout: 10000,
    });

    let responseData = response.data;
    
    // Step 2: Filter customers by ok_to_bill since the API parameter may not be working as expected
    // This ensures we only process billing-enabled customers
    if (Array.isArray(responseData)) {
      
      responseData = responseData.filter(customer => {
        const okToBill = customer.ok_to_bill;
        // Filter for truthy values (1, true, "1", etc.) and exclude falsy values (0, false, "", null, undefined)
        return okToBill && okToBill !== 0 && okToBill !== '' && okToBill !== '0' && okToBill !== 'false';
      });
    } else {
    }
    
    // Step 3: Enrich filtered data with MySQL database existence checks
    let enrichedData = responseData;
    let mysqlStatus = 'disabled';
    
    
    if (isMySQLConfigured && Array.isArray(responseData) && responseData.length > 0) {
      
      try {
        // Only check MySQL for customers who are hosted on our infrastructure
        // (not resident hosting and not ITAR hosting)
        // EXCEPT for resident hosting customers who have databases listed in resident-dbs.json
        const customersToCheck = responseData.filter(customer => {
          const isResidentHosting = customer.resident_hosting === true || customer.resident_hosting === 1;
          const isItarHosting = customer.itar_hosting_bc === true || customer.itar_hosting_bc === 1;
          const hasValidDomain = customer.domain && customer.domain.trim() !== '' && customer.domain !== 'undefined';
          
          // Skip if no valid domain
          if (!hasValidDomain) return false;
          
          // Skip ITAR hosting customers
          if (isItarHosting) return false;
          
          // For resident hosting customers, only check if they have a database mapping
          if (isResidentHosting) {
            const hasDB = hasResidentDatabase(customer.domain);
            if (hasDB) {
              const dbName = getResidentDatabaseName(customer.domain);
            } else {
            }
            return hasDB;
          }
          
          // Check all other customers (infrastructure hosting)
          return true;
        });
        
        
        if (customersToCheck.length > 0) {
          
          enrichedData = await enrichCustomerData(customersToCheck);
          
          // Create a map of enriched customers by ID
          const enrichedMap = new Map();
          enrichedData.forEach(customer => {
            enrichedMap.set(customer.id, customer);
          });
          
          // Merge the enriched data back with the original data
          enrichedData = responseData.map(customer => {
            const enriched = enrichedMap.get(customer.id);
            if (enriched) {
              return enriched; // Use enriched data if available
            } else {
              // For customers not checked, set database_exists based on hosting status
              const isResidentHosting = customer.resident_hosting === true || customer.resident_hosting === 1;
              const isItarHosting = customer.itar_hosting_bc === true || customer.itar_hosting_bc === 1;
              const hasValidDomain = customer.domain && customer.domain.trim() !== '' && customer.domain !== 'undefined';
              
              let dbExistsValue;
              if (!hasValidDomain) {
                dbExistsValue = 'invalid_domain';
              } else if (isItarHosting) {
                dbExistsValue = 'itar_hosting';
              } else if (isResidentHosting) {
                // For resident hosting, check if they have a database mapping
                if (hasResidentDatabase(customer.domain)) {
                  dbExistsValue = 'resident_hosting'; // This shouldn't happen here, but safety net
                } else {
                  dbExistsValue = 'unavailable'; // Resident hosting without database mapping
                }
              } else {
                dbExistsValue = 'mysql_disabled'; // This shouldn't happen, but safety net
              }
              
              return { ...customer, database_exists: dbExistsValue };
            }
          });
        } else {
          // No customers need MySQL checking, set appropriate values
          enrichedData = responseData.map(customer => {
            const isResidentHosting = customer.resident_hosting === true || customer.resident_hosting === 1;
            const isItarHosting = customer.itar_hosting_bc === true || customer.itar_hosting_bc === 1;
            const hasValidDomain = customer.domain && customer.domain.trim() !== '' && customer.domain !== 'undefined';
            
            let dbExistsValue;
            if (!hasValidDomain) {
              dbExistsValue = 'invalid_domain';
            } else if (isResidentHosting) {
              dbExistsValue = 'resident_hosting';
            } else if (isItarHosting) {
              dbExistsValue = 'itar_hosting';
            } else {
              dbExistsValue = 'mysql_disabled';
            }
            
            return { ...customer, database_exists: dbExistsValue };
          });
        }
        
        mysqlStatus = 'completed';
      } catch (mysqlError) {
        console.error('Step 3 failed: MySQL enrichment error:', mysqlError.message);
        
        // Set database_exists values based on hosting status when MySQL fails
        enrichedData = responseData.map(customer => {
          const isResidentHosting = customer.resident_hosting === true || customer.resident_hosting === 1;
          const isItarHosting = customer.itar_hosting_bc === true || customer.itar_hosting_bc === 1;
          const hasValidDomain = customer.domain && customer.domain.trim() !== '' && customer.domain !== 'undefined';
          
          let dbExistsValue;
          if (!hasValidDomain) {
            dbExistsValue = 'invalid_domain';
          } else if (isResidentHosting) {
            dbExistsValue = 'resident_hosting';
          } else if (isItarHosting) {
            dbExistsValue = 'itar_hosting';
          } else {
            dbExistsValue = 'mysql_error';
          }
          
          return { ...customer, database_exists: dbExistsValue };
        });
        
        mysqlStatus = 'failed';
      }
    } else {
      // Set database_exists values based on hosting status when MySQL is disabled
      enrichedData = responseData.map(customer => {
        const isResidentHosting = customer.resident_hosting === true || customer.resident_hosting === 1;
        const isItarHosting = customer.itar_hosting_bc === true || customer.itar_hosting_bc === 1;
        const hasValidDomain = customer.domain && customer.domain.trim() !== '' && customer.domain !== 'undefined';
        
        let dbExistsValue;
        if (!hasValidDomain) {
          dbExistsValue = 'invalid_domain';
        } else if (isResidentHosting) {
          dbExistsValue = 'resident_hosting';
        } else if (isItarHosting) {
          dbExistsValue = 'itar_hosting';
        } else {
          dbExistsValue = 'mysql_disabled';
        }
        
        return { ...customer, database_exists: dbExistsValue };
      });
      
      mysqlStatus = 'skipped';
    }

    // Load and add timestamp data for each customer
    const timestampData = await loadTimestampData();
    
    enrichedData = enrichedData.map(customer => {
      // Convert customer ID to string for consistent lookup
      const customerIdStr = String(customer.id);
      const timestampInfo = timestampData[customerIdStr] || timestampData[customer.id];
      
      return {
        ...customer,
        lastPulled: timestampInfo ? timestampInfo.lastPulled : null
      };
    });

    // Step 4: Prepare final response
    
    // Calculate summary statistics for display
    const totalCustomers = enrichedData.length;
    const existingDatabases = enrichedData.filter(customer => customer.database_exists === true).length;
    const residentHosting = enrichedData.filter(customer => customer.database_exists === 'resident_hosting').length;
    const itarHosting = enrichedData.filter(customer => customer.database_exists === 'itar_hosting').length;
    const invalidDomains = enrichedData.filter(customer => customer.database_exists === 'invalid_domain').length;
    const noDatabase = enrichedData.filter(customer => customer.database_exists === false).length;
    
    const result = {
      customers: enrichedData,
      metadata: {
        total_customers: totalCustomers,
        mysql_status: mysqlStatus,
        mysql_enabled: isMySQLConfigured,
        api_url: cetecUrl,
        timestamp: new Date().toISOString(),
        summary: {
          total_customers: totalCustomers,
          existing_databases: existingDatabases,
          resident_hosting: residentHosting,
          itar_hosting: itarHosting,
          invalid_domains: invalidDomains,
          no_database: noDatabase
        },
        processing_steps: {
          api_fetch: 'completed',
          billing_filter: 'completed', // Backend filtering applied
          mysql_enrichment: mysqlStatus
        }
      }
    };

    res.json(result);
    
  } catch (error) {
    console.error("Error in customer data processing:", error.message);
  }
});

// Endpoint to record pull button clicks
app.post("/api/pull/record", async (req, res) => {
  try {
    const { customerId } = req.body;
    
    if (!customerId) {
      return res.status(400).json({ error: "Customer ID is required" });
    }
    
    const result = await recordPullClick(customerId);
    
    if (result.success) {
      res.json({
        success: true,
        customerId: customerId,
        timestamp: result.timestamp,
        message: "Pull timestamp recorded successfully"
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        message: "Failed to record pull timestamp"
      });
    }
    
  } catch (error) {
    console.error('Error recording pull click:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Internal server error"
    });
  }
});

// Endpoint to proxy backup requests (avoiding CORS issues)
app.post("/api/backup/request", async (req, res) => {
  try {
    const { dbname } = req.body;
    
    if (!dbname) {
      return res.status(400).json({ error: "Database name is required" });
    }
    
    const backupApiUrl = `http://dev.cetecerpdevel.com:3399/getbackup?password=REMOVED&dbname=${encodeURIComponent(dbname)}`;
    
    const backupResponse = await fetch(backupApiUrl);
    
    if (!backupResponse.ok) {
      throw new Error(`Backup request failed: ${backupResponse.status}`);
    }
    
    const backupResult = await backupResponse.json();
    
    res.json({
      success: true,
      result: backupResult,
      message: "Backup request successful"
    });
    
  } catch (error) {
    console.error('Error in backup request:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Backup request failed"
    });
  }
});

// Endpoint to check a specific customer's database existence
app.post("/api/mysql/check", async (req, res) => {
  try {
    const { customerId, domain, residentHosting, itarHosting } = req.body;
    
    if (!customerId || !domain) {
      return res.status(400).json({ error: "Customer ID and domain are required" });
    }
    
    // Use the same logic as the initial database checks
    let databaseExists = false;
    
    if (itarHosting || (residentHosting && !residentDBsConfig[domain])) {
      // ITAR hosting or resident hosting without database mapping
      databaseExists = 'unavailable';
    } else {
      // Check if database exists on MySQL server
      try {
        let dbName = domain;
        if (residentHosting && residentDBsConfig[domain]) {
          dbName = residentDBsConfig[domain];
        }
        
        // Check if database exists AND has the usage_stats table
        const [rows] = await mysqlPool.execute(
          `SELECT COUNT(*) as table_count 
           FROM information_schema.TABLES 
           WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'usage_stats'`,
          [dbName]
        );
        
        databaseExists = rows[0].table_count > 0;
      } catch (mysqlError) {
        databaseExists = 'mysql_error';
      }
    }
    
    res.json({
      success: true,
      customerId: customerId,
      domain: domain,
      databaseExists: databaseExists
    });
    
  } catch (error) {
    console.error('Error in MySQL check:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: "MySQL check failed"
    });
  }
});

// Start the server
app.listen(port, async () => {
  console.log(`Server running at http://localhost:${port}`);
  
  // Initialize MySQL pool if configured
  if (isMySQLConfigured) {
    await initializeMySQLPool();
    await loadResidentDBsConfig(); // Load resident DBs config on startup
  }
}).on('error', (error) => {
  console.error('Failed to start server:', error.message);
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Please stop the process using that port or change the PORT environment variable.`);
  }
  process.exit(1);
});
