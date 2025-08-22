import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 5001;

const requiredEnvVars = ['API_URL'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.warn(`Warning: Missing environment variables: ${missingEnvVars.join(', ')}`);
  console.warn('Server will start with default values, but some features may not work properly.');
}

const mysqlConfig = {
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  port: process.env.MYSQL_PORT || 3306,
  
  ...(process.env.NODE_ENV === 'development' && process.env.MYSQL_SOCKET && { 
    socketPath: process.env.MYSQL_SOCKET 
  }),
  
  ...(process.env.NODE_ENV === 'development' && process.env.MYSQL_SOCKET ? {
    connectTimeout: 10000,
    connectionLimit: 10,
    multipleStatements: false,
    dateStrings: true,
    charset: 'utf8mb4',
  } : {
    connectTimeout: 60000,
    connectionLimit: 5,
    ssl: false,
    multipleStatements: false,
    dateStrings: true,
    charset: 'utf8mb4',
    keepAliveInitialDelay: 10000,
    enableKeepAlive: true,
  }),
};

let mysqlPool = null;
let residentDBsConfig = null;

async function loadResidentDBsConfig() {
  try {
    const configPath = path.join(__dirname, 'src', 'config', 'resident-dbs.json');
    const configData = await fs.readFile(configPath, 'utf8');
    residentDBsConfig = JSON.parse(configData);

  } catch (error) {
    console.warn('[CONFIG] Could not load resident DBs configuration:', error.message);
    residentDBsConfig = {};
  }
}

const timestampDataPath = path.join(__dirname, 'data', 'pull-timestamps.json');

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

async function saveTimestampData(data) {
  try {
    await fs.writeFile(timestampDataPath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error saving timestamp data:', error);
  }
}

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

function hasResidentDatabase(domain) {
  if (!residentDBsConfig || !domain) {
    return false;
  }
  
  const hasDB = domain.toLowerCase() in residentDBsConfig || 
         Object.keys(residentDBsConfig).some(key => key.toLowerCase() === domain.toLowerCase());
  
  return hasDB;
}

function getResidentDatabaseName(domain) {
  if (!residentDBsConfig || !domain) return null;
  
  if (domain in residentDBsConfig) {
    return residentDBsConfig[domain];
  }
  
  const matchingKey = Object.keys(residentDBsConfig).find(key => 
    key.toLowerCase() === domain.toLowerCase()
  );
  
  return matchingKey ? residentDBsConfig[matchingKey] : null;
}

async function initializeMySQLPool() {
  if (!isMySQLConfigured) {
    return;
  }
  
  try {
    mysqlPool = mysql.createPool(mysqlConfig);
    
    const testConnection = await mysqlPool.getConnection();
    testConnection.release();
  } catch (error) {
    console.error('[MYSQL] Failed to initialize MySQL pool:', error.message);
    mysqlPool = null;
  }
}

const isMySQLConfigured = mysqlConfig.host && mysqlConfig.user && mysqlConfig.password;

async function checkDatabaseExists(domain, isResidentHosting = false) {
  if (!mysqlPool) {
    throw new Error('MySQL pool not initialized');
  }

  let connection;
  try {
    connection = await mysqlPool.getConnection();
    
    let databaseName = domain;
    if (isResidentHosting) {
      const residentDBName = getResidentDatabaseName(domain);
      if (residentDBName) {
        databaseName = residentDBName;
      } else {
        throw new Error(`No database mapping found for resident hosting domain: ${domain}`);
      }
    }
    
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

async function enrichCustomerData(customers) {
  if (!customers || !Array.isArray(customers)) {
    return customers;
  }

  const enrichedCustomers = [];
  let mysqlErrors = 0;

  const batchSize = 5;
  const batches = [];
  
  for (let i = 0; i < customers.length; i += batchSize) {
    batches.push(customers.slice(i, i + batchSize));
  }

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    
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
    
    try {
      const batchResults = await Promise.race([
        Promise.all(batchPromises),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Batch timeout')), 60000)
        )
      ]);
      
      enrichedCustomers.push(...batchResults);
    } catch (batchError) {
      console.error(`Batch ${batchIndex + 1} failed:`, batchError.message);
      
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

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "http://backups.cetecerpdevel.com:5002");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json());

app.get("/api/test-mysql", async (req, res) => {
  if (!isMySQLConfigured) {
    return res.json({ 
      status: 'not_configured', 
      message: 'MySQL not configured in environment variables' 
    });
  }
  
  try {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const useSocket = isDevelopment && process.env.MYSQL_SOCKET;
    const connectionMethod = useSocket ? 'cloud_sql_proxy' : 'direct_host';
    
    const connection = await mysql.createConnection({
      host: useSocket ? undefined : mysqlConfig.host,
      user: mysqlConfig.user,
      password: mysqlConfig.password,
      port: useSocket ? undefined : mysqlConfig.port,
      socketPath: useSocket || undefined,
      connectTimeout: useSocket ? 10000 : 30000
    });
    
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

app.get("/api/cetec/customer", async (req, res) => {
  let cetecUrl = '';
  
  try {
    const { id, name, external_key, columns, preshared_token } = req.query;
    
    if (!preshared_token) {
      return res.status(400).json({ error: "preshared_token is required" });
    }

    const queryParams = new URLSearchParams();
    if (id) queryParams.append('id', id);
    if (name) queryParams.append('name', name);
    if (external_key) queryParams.append('external_key', external_key);
    if (columns) queryParams.append('columns', columns);
    
    queryParams.append('ok_to_bill', '1');
    
    if (!columns) {
      queryParams.append('columns', 'id,name,domain,ok_to_bill,priority_support,resident_hosting,test_environment,itar_hosting_bc,num_prod_users,num_full_users,techx_password');
    }
    
    queryParams.append('preshared_token', preshared_token);

    let apiUrl = process.env.API_URL || 'https://4-19-fifo.cetecerpdevel.com';
    
    if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
      apiUrl = `https://${apiUrl}`;
    }
    
    cetecUrl = `${apiUrl}/api/customer?${queryParams.toString()}`;
    
    const response = await axios.get(cetecUrl, {
      timeout: 10000,
    });

    let responseData = response.data;
    
    if (Array.isArray(responseData)) {
      responseData = responseData.filter(customer => {
        const okToBill = customer.ok_to_bill;
        return okToBill && okToBill !== 0 && okToBill !== '' && okToBill !== '0' && okToBill !== 'false';
      });
    }
    
    if (Array.isArray(responseData)) {
      responseData = responseData.filter(customer => customer.id !== 5165);
    }
    
    let enrichedData = responseData;
    let mysqlStatus = 'disabled';
    
    if (isMySQLConfigured && Array.isArray(responseData) && responseData.length > 0) {
      try {
        const customersToCheck = responseData.filter(customer => {
          const isResidentHosting = customer.resident_hosting === true || customer.resident_hosting === 1;
          const isItarHosting = customer.itar_hosting_bc === true || customer.itar_hosting_bc === 1;
          const hasValidDomain = customer.domain && customer.domain.trim() !== '' && customer.domain !== 'undefined';
          
          if (!hasValidDomain) return false;
          
          if (isItarHosting) return false;
          
          if (isResidentHosting) {
            const hasDB = hasResidentDatabase(customer.domain);
            return hasDB;
          }
          
          return true;
        });
        
        if (customersToCheck.length > 0) {
          enrichedData = await enrichCustomerData(customersToCheck);
          
          const enrichedMap = new Map();
          enrichedData.forEach(customer => {
            enrichedMap.set(customer.id, customer);
          });
          
          enrichedData = responseData.map(customer => {
            const enriched = enrichedMap.get(customer.id);
            if (enriched) {
              return enriched;
            } else {
              const isResidentHosting = customer.resident_hosting === true || customer.resident_hosting === 1;
              const isItarHosting = customer.itar_hosting_bc === true || customer.itar_hosting_bc === 1;
              const hasValidDomain = customer.domain && customer.domain.trim() !== '' && customer.domain !== 'undefined';
              
              let dbExistsValue;
              if (!hasValidDomain) {
                dbExistsValue = 'invalid_domain';
              } else if (isItarHosting) {
                dbExistsValue = 'itar_hosting';
              } else if (isResidentHosting) {
                if (hasResidentDatabase(customer.domain)) {
                  dbExistsValue = 'resident_hosting';
                } else {
                  dbExistsValue = 'unavailable';
                }
              } else {
                dbExistsValue = 'mysql_disabled';
              }
              
              return { ...customer, database_exists: dbExistsValue };
            }
          });
        } else {
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

    const timestampData = await loadTimestampData();
    
    enrichedData = enrichedData.map(customer => {
      const customerIdStr = String(customer.id);
      const timestampInfo = timestampData[customerIdStr] || timestampData[customer.id];
      
      return {
        ...customer,
        lastPulled: timestampInfo ? timestampInfo.lastPulled : null
      };
    });

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
          billing_filter: 'completed',
          mysql_enrichment: mysqlStatus
        }
      }
    };

    res.json(result);
    
  } catch (error) {
    console.error("Error in customer data processing:", error.message);
  }
});

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

app.post("/api/backup/request", async (req, res) => {
  const timestamp = new Date().toISOString();
  const requestId = Math.random().toString(36).substr(2, 9);
  console.log(`[BACKEND] Backup request received for database: ${req.body.dbname} at ${timestamp} - Request ID: ${requestId}`);
  try {
    const { dbname } = req.body;
    
    if (!dbname) {
      return res.status(400).json({ error: "Database name is required" });
    }
    
    const backupApiUrl = `http://dev.cetecerpdevel.com:3399/getbackup?password=${process.env.TECHX_PASSWORD}&dbname=${encodeURIComponent(dbname)}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 45000);
    
    const backupResponse = await fetch(backupApiUrl, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
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
    if (error.name === 'AbortError') {
      res.status(408).json({
        success: false,
        error: "Request timeout",
        message: "Backup request timed out - external service took too long to respond"
      });
    } else {
      console.error('Error in backup request:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: "Backup request failed"
      });
    }
  }
});

app.post("/api/mysql/check", async (req, res) => {
  try {
    const { customerId, domain, residentHosting, itarHosting } = req.body;
    
    if (!customerId || !domain) {
      return res.status(400).json({ error: "Customer ID and domain are required" });
    }
    
    let databaseExists = false;
    
    if (itarHosting || (residentHosting && !residentDBsConfig[domain])) {
      databaseExists = 'unavailable';
    } else {
      try {
        let dbName = domain;
        if (residentHosting && residentDBsConfig[domain]) {
          dbName = residentDBsConfig[domain];
        }
        
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

app.listen(port, async () => {
  console.log(`Server running at http://backups.cetecerpdevel.com:${port}`);
  
  if (isMySQLConfigured) {
    await initializeMySQLPool();
    await loadResidentDBsConfig();
  }
}).on('error', (error) => {
  console.error('Failed to start server:', error.message);
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Please stop the process using that port or change the PORT environment variable.`);
  }
  process.exit(1);
});
