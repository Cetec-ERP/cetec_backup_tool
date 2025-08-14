import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config();

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

// Initialize MySQL pool
async function initializeMySQLPool() {
  if (!isMySQLConfigured) {
    console.log('MySQL not configured, skipping pool initialization');
    return;
  }
  
  try {
    console.log('Initializing MySQL connection pool...');
    mysqlPool = mysql.createPool(mysqlConfig);
    
    // Test the pool with a simple connection
    const testConnection = await mysqlPool.getConnection();
    console.log('MySQL pool test connection successful');
    testConnection.release();
    console.log('MySQL connection pool initialized successfully');
  } catch (error) {
    console.error('Failed to initialize MySQL pool:', error.message);
    mysqlPool = null;
  }
}

// Check if MySQL is properly configured
const isMySQLConfigured = mysqlConfig.host && mysqlConfig.user && mysqlConfig.password;

// Function to check if a database exists for a given domain
async function checkDatabaseExists(domain) {
  if (!isMySQLConfigured || !mysqlPool) {
    console.warn('MySQL not configured or pool not initialized, skipping database existence check');
    return null;
  }

  let connection = null;
  try {
    // Get connection from pool with timeout
    connection = await Promise.race([
      mysqlPool.getConnection(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 30000)
      )
    ]);
    
    // Use SELECT FROM information_schema to check if database exists
    // This is more compatible with parameter binding than SHOW DATABASES
    const query = 'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?';
    const params = [domain];
    
    const [rows] = await Promise.race([
      connection.execute(query, params),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout')), 30000)
      )
    ]);
    
    // If rows.length > 0, database exists
    const exists = rows.length > 0;
    return exists;
  } catch (error) {
    console.error(`Error checking database for domain ${domain}:`, error.message);
    if (error.code === 'ETIMEDOUT') {
      console.error(`Timeout error for ${domain} - this may indicate network latency or server overload`);
    }
    return null; // Return null to indicate error
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error(`Error releasing connection for ${domain}:`, releaseError.message);
      }
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
      const enrichedCustomer = { ...customer };
      
      if (customer.domain) {
        const dbExists = await checkDatabaseExists(customer.domain);
        enrichedCustomer.database_exists = dbExists;
        
        if (dbExists === null) {
          mysqlErrors++;
        }
      } else {
        enrichedCustomer.database_exists = null;
      }
      
      return enrichedCustomer;
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

// Test MySQL connection endpoint
app.get("/api/test-mysql", async (req, res) => {
  if (!isMySQLConfigured) {
    return res.json({ 
      status: 'not_configured', 
      message: 'MySQL not configured in environment variables' 
    });
  }
  
  try {
    console.log('Testing MySQL connection...');
    
    // Determine connection method
    const isDevelopment = process.env.NODE_ENV === 'development';
    const useSocket = isDevelopment && process.env.MYSQL_SOCKET;
    const connectionMethod = useSocket ? 'cloud_sql_proxy' : 'direct_host';
    
    if (useSocket) {
      console.log(`Using Cloud SQL Proxy socket (development): ${process.env.MYSQL_SOCKET}`);
      console.log(`User: ${mysqlConfig.user}`);
    } else {
      console.log(`Using direct host connection (${isDevelopment ? 'development' : 'production'}): ${mysqlConfig.host}:${mysqlConfig.port}`);
      console.log(`User: ${mysqlConfig.user}`);
    }
    
    const connection = await mysql.createConnection({
      host: useSocket ? undefined : mysqlConfig.host,
      user: mysqlConfig.user,
      password: mysqlConfig.password,
      port: useSocket ? undefined : mysqlConfig.port,
      socketPath: useSocket || undefined,
      connectTimeout: useSocket ? 10000 : 30000
    });
    
    console.log('MySQL connection test successful');
    
    // Test a simple query
    const [rows] = await connection.execute('SELECT 1 as test');
    console.log('MySQL query test successful:', rows);
    
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
    const { id, name, external_key, columns, preshared_token, filter_billing } = req.query;
    
    console.log('Received request with query params:', req.query);
    
    if (!preshared_token) {
      return res.status(400).json({ error: "preshared_token is required" });
    }

    // Step 1: Fetch data from CETEC API
    console.log('Step 1: Fetching data from CETEC API...');
    
    // Build query string with all parameters
    const queryParams = new URLSearchParams();
    if (id) queryParams.append('id', id);
    if (name) queryParams.append('name', name);
    if (external_key) queryParams.append('external_key', external_key);
    if (columns) queryParams.append('columns', columns);
    queryParams.append('preshared_token', preshared_token);

    let apiUrl = process.env.API_URL || 'https://4-19-fifo.cetecerpdevel.com';
    
    // Ensure the URL has a protocol
    if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
      apiUrl = `https://${apiUrl}`;
    }
    
    cetecUrl = `${apiUrl}/api/customer?${queryParams.toString()}`;
    console.log('Proxying request to:', cetecUrl);
    
    const response = await axios.get(cetecUrl, {
      timeout: 10000,
    });

    let responseData = response.data;
    console.log(`Step 1 complete: Received ${responseData.length || 0} customers from API`);

    // Step 2: Filter customers by ok_to_bill if requested OR if MySQL is enabled
    // Always filter when MySQL is enabled to avoid unnecessary database checks
    if ((filter_billing === 'true' || isMySQLConfigured) && Array.isArray(responseData)) {
      console.log('Step 2: Filtering customers by billing status...');
      
      const beforeCount = responseData.length;
      responseData = responseData.filter(customer => {
        const okToBill = customer.ok_to_bill;
        return okToBill !== 0 && okToBill !== '';
      });
      const afterCount = responseData.length;
      console.log(`Step 2 complete: Filtered ${beforeCount} customers down to ${afterCount} billing-enabled customers`);
    } else {
      console.log('Step 2: Skipping billing filter (not requested and MySQL not enabled)');
    }

    // Step 3: Enrich filtered data with MySQL database existence checks
    let enrichedData = responseData;
    let mysqlStatus = 'disabled';
    
    console.log(`Step 3: Starting MySQL enrichment process on ${responseData.length} customers (already filtered by ok_to_bill)`);
    
    if (isMySQLConfigured && Array.isArray(responseData) && responseData.length > 0) {
      console.log(`Step 3: Enriching ${responseData.length} customers with MySQL database checks...`);
      console.log(`MySQL config: host=${mysqlConfig.host}, user=${mysqlConfig.user}, port=${mysqlConfig.port}`);
      
      try {
        // Only check MySQL for customers who are hosted on our infrastructure
        // (not resident hosting and not ITAR hosting)
        const customersToCheck = responseData.filter(customer => {
          const isResidentHosting = customer.resident_hosting === true || customer.resident_hosting === 1;
          const isItarHosting = customer.itar_hosting_bc === true || customer.itar_hosting_bc === 1;
          const hasValidDomain = customer.domain && customer.domain.trim() !== '' && customer.domain !== 'undefined';
          return !isResidentHosting && !isItarHosting && hasValidDomain;
        });
        
        console.log(`Step 3a: Filtering customers for MySQL check - ${customersToCheck.length} out of ${responseData.length} need database verification`);
        
        // Log filtering statistics
        const invalidDomainCount = responseData.filter(customer => {
          const hasValidDomain = customer.domain && customer.domain.trim() !== '' && customer.domain !== 'undefined';
          return !hasValidDomain;
        }).length;
        
        const residentHostingCount = responseData.filter(customer => {
          const isResidentHosting = customer.resident_hosting === true || customer.resident_hosting === 1;
          return isResidentHosting;
        }).length;
        
        const itarHostingCount = responseData.filter(customer => {
          const isItarHosting = customer.itar_hosting_bc === true || customer.itar_hosting_bc === 1;
          return isItarHosting;
        }).length;
        
        console.log(`Step 3a: Filtering breakdown - Total: ${responseData.length}, Invalid domains: ${invalidDomainCount}, Resident hosting: ${residentHostingCount}, ITAR hosting: ${itarHostingCount}, MySQL checks needed: ${customersToCheck.length}`);
        
        if (customersToCheck.length > 0) {
          console.log('Step 3b: Starting MySQL database checks...');
          enrichedData = await enrichCustomerData(customersToCheck);
          console.log('Step 3c: MySQL enrichment completed, merging results...');
          
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
              } else if (isResidentHosting) {
                dbExistsValue = 'resident_hosting';
              } else if (isItarHosting) {
                dbExistsValue = 'itar_hosting';
              } else {
                dbExistsValue = 'mysql_disabled'; // This shouldn't happen, but safety net
              }
              
              return { ...customer, database_exists: dbExistsValue };
            }
          });
        } else {
          console.log('Step 3b: No customers need MySQL checking, setting values by hosting status');
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
        console.log('Step 3 complete: MySQL enrichment finished successfully');
      } catch (mysqlError) {
        console.error('Step 3 failed: MySQL enrichment error:', mysqlError.message);
        console.log('Continuing with unfiltered data due to MySQL error');
        
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
      console.log('Step 3: Skipping MySQL enrichment');
      console.log(`MySQL configured: ${isMySQLConfigured}`);
      console.log(`Response data is array: ${Array.isArray(responseData)}`);
      console.log(`Response data length: ${responseData ? responseData.length : 'undefined'}`);
      
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

    // Step 4: Prepare final response
    console.log('Step 4: Preparing final response...');
    
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
          billing_filter: filter_billing === 'true' ? 'completed' : 'skipped',
          mysql_enrichment: mysqlStatus
        }
      }
    };

    console.log('Step 4 complete: Sending response to client');
    res.json(result);
    
  } catch (error) {
    console.error("Error in customer data processing:", error);
    console.error("Full error object:", JSON.stringify(error, null, 2));
    
    // Send more detailed error information
    res.status(500).json({ 
      error: "Failed to process customer data request",
      details: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: cetecUrl,
      step_failed: error.response ? 'api_fetch' : 'unknown'
    });
  }
});

// Fast endpoint for API data only (no MySQL enrichment)
app.get("/api/cetec/customer/fast", async (req, res) => {
  let cetecUrl = '';
  
  try {
    const { id, name, external_key, columns, preshared_token, filter_billing } = req.query;
    
    console.log('Fast endpoint: Fetching API data only...');
    
    if (!preshared_token) {
      return res.status(400).json({ error: "preshared_token is required" });
    }

    // Build query string with all parameters
    const queryParams = new URLSearchParams();
    if (id) queryParams.append('id', id);
    if (name) queryParams.append('name', name);
    if (external_key) queryParams.append('external_key', external_key);
    if (columns) queryParams.append('columns', columns);
    queryParams.append('preshared_token', preshared_token);

    let apiUrl = process.env.API_URL || 'https://4-19-fifo.cetecerpdevel.com';
    
    // Ensure the URL has a protocol
    if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
      apiUrl = `https://${apiUrl}`;
    }
    
    cetecUrl = `${apiUrl}/api/customer?${queryParams.toString()}`;
    console.log('Fast endpoint: Proxying request to:', cetecUrl);
    
    const response = await axios.get(cetecUrl, {
      timeout: 10000,
    });

    let responseData = response.data;
    console.log(`Fast endpoint: Received ${responseData.length || 0} customers from API`);

    // Filter customers by ok_to_bill if requested OR if MySQL is enabled
    // Always filter when MySQL is enabled to avoid unnecessary database checks
    if ((filter_billing === 'true' || isMySQLConfigured) && Array.isArray(responseData)) {
      console.log('Fast endpoint: Filtering customers by billing status...');
      const beforeCount = responseData.length;
      responseData = responseData.filter(customer => {
        const okToBill = customer.ok_to_bill;
        return okToBill !== 0 && okToBill !== '';
      });
      const afterCount = responseData.length;
      console.log(`Fast endpoint: Filtered ${beforeCount} customers down to ${afterCount} billing-enabled customers`);
    } else {
      console.log('Fast endpoint: Skipping billing filter (not requested and MySQL not enabled)');
    }

    // Add database_exists field based on hosting status (no MySQL checking)
    responseData = responseData.map(customer => {
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

    // Calculate summary statistics for display
    const totalCustomers = responseData.length;
    const existingDatabases = responseData.filter(customer => customer.database_exists === true).length;
    const residentHosting = responseData.filter(customer => customer.database_exists === 'resident_hosting').length;
    const itarHosting = responseData.filter(customer => customer.database_exists === 'itar_hosting').length;
    const invalidDomains = responseData.filter(customer => customer.database_exists === 'invalid_domain').length;
    const noDatabase = responseData.filter(customer => customer.database_exists === false).length;

    const result = {
      customers: responseData,
      metadata: {
        total_customers: totalCustomers,
        mysql_enabled: false,
        mysql_status: 'skipped',
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
          billing_filter: filter_billing === 'true' ? 'completed' : 'skipped',
          mysql_enrichment: 'skipped'
        }
      }
    };

    console.log('Fast endpoint: Sending response to client');
    res.json(result);
    
  } catch (error) {
    console.error("Fast endpoint error:", error.message);
    
    res.status(500).json({ 
      error: "Failed to fetch customer data",
      details: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: cetecUrl
    });
  }
});

// Start the server
app.listen(port, async () => {
  console.log(`Server running at http://localhost:${port}`);
  
  // Initialize MySQL pool if configured
  if (isMySQLConfigured) {
    console.log('MySQL integration enabled: Yes');
    console.log(`API URL: ${process.env.API_URL || 'not set'}`);
    await initializeMySQLPool();
  } else {
    console.log('MySQL integration enabled: No');
    console.log(`API URL: ${process.env.API_URL || 'not set'}`);
  }
}).on('error', (error) => {
  console.error('Failed to start server:', error.message);
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Please stop the process using that port or change the PORT environment variable.`);
  }
  process.exit(1);
});
