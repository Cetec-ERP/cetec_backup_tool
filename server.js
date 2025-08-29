import express from "express";
import axios from "axios";
import dotenv from "dotenv";
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
  res.json({ 
    status: 'deprecated', 
    message: 'MySQL endpoint deprecated - application now uses URL validation instead of database queries',
    environment: process.env.NODE_ENV || 'development',
    note: 'This endpoint will be removed in a future version'
  });
  
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

    // Simplified enrichment without MySQL queries - just set initial status
    const enrichedData = responseData.map(customer => {
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
        // For regular customers, we'll validate the link later instead of MySQL queries
        dbExistsValue = 'pending_validation';
      }
      
      return { ...customer, database_exists: dbExistsValue };
    });

    const timestampData = await loadTimestampData();
    
    enrichedData.forEach(customer => {
      const customerIdStr = String(customer.id);
      const timestampInfo = timestampData[customerIdStr] || timestampData[customer.id];
      customer.lastPulled = timestampInfo ? timestampInfo.lastPulled : null;
    });

    const totalCustomers = enrichedData.length;
    const pendingValidation = enrichedData.filter(customer => customer.database_exists === 'pending_validation').length;
    const residentHosting = enrichedData.filter(customer => customer.database_exists === 'resident_hosting').length;
    const itarHosting = enrichedData.filter(customer => customer.database_exists === 'itar_hosting').length;
    const invalidDomains = enrichedData.filter(customer => customer.database_exists === 'invalid_domain').length;
    
    const result = {
      customers: enrichedData,
      metadata: {
        total_customers: totalCustomers,
        mysql_status: 'link_validation_mode',
        mysql_enabled: false,
        timestamp: new Date().toISOString(),
        summary: {
          total_customers: totalCustomers,
          pending_validation: pendingValidation,
          resident_hosting: residentHosting,
          itar_hosting: itarHosting,
          invalid_domains: invalidDomains
        }
      }
    };

    res.json(result);
    
  } catch (error) {
    console.error('Error in /api/cetec/customer:', error);
    res.status(500).json({
      error: error.message,
      message: "Failed to fetch customer data"
    });
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

// NEW ENDPOINT: URL validation for checking if development environment is ready
app.post("/api/validate-environment", async (req, res) => {
  try {
    const { customerId, domain, residentHosting, itarHosting } = req.body;
    
    if (!customerId || !domain) {
      return res.status(400).json({ error: "Customer ID and domain are required" });
    }
    
    let environmentStatus = 'unavailable';
    
    if (itarHosting || (residentHosting && !residentDBsConfig[domain])) {
      environmentStatus = 'unavailable';
    } else {
      try {
        const develUrl = `http://${domain}.cetecerpdevel.com/auth/login_new`;
        
        const response = await axios.get(develUrl, {
          timeout: 5000,
          maxRedirects: 5,
          validateStatus: (status) => status < 500
        });

        const finalUrl = response.request.res.responseUrl || response.config.url;
        const isRedirectedToMainSite = finalUrl.includes('cetecerp.com') && !finalUrl.includes(domain);

        if (isRedirectedToMainSite) {
          environmentStatus = 'not_ready';
        } else {
          environmentStatus = 'ready';
        }
        
      } catch (axiosError) {
        environmentStatus = 'not_ready';
      }
    }
    
    res.json({
      success: true,
      customerId: customerId,
      domain: domain,
      environmentStatus: environmentStatus
    });
    
  } catch (error) {
    console.error('Error in environment validation:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Environment validation failed"
    });
  }
});

app.post("/api/validate-link", async (req, res) => {
  try {
    const { domain } = req.body;
    if (!domain) {
      return res.status(400).json({ error: "Domain is required" });
    }

    const develUrl = `http://${domain}.cetecerpdevel.com/auth/login_new`;

    try {
      const response = await axios.get(develUrl, {
        timeout: 5000,
        maxRedirects: 5,
        validateStatus: (status) => status < 500
      });

      const finalUrl = response.request.res.responseUrl || response.config.url;
      const isRedirectedToMainSite = finalUrl.includes('cetecerp.com') && !finalUrl.includes(domain);

      if (isRedirectedToMainSite) {
        res.json({ 
          success: true, 
          domain: domain, 
          url: develUrl, 
          reachable: false, 
          status: response.status, 
          finalUrl: finalUrl, 
          reason: 'redirected_to_main_site' 
        });
        return;
      }

      res.json({ 
        success: true, 
        domain: domain, 
        url: develUrl, 
        reachable: true, 
        status: response.status, 
        finalUrl: finalUrl 
      });

    } catch (axiosError) {
      res.json({ 
        success: true, 
        domain: domain, 
        url: develUrl, 
        reachable: false, 
        error: axiosError.message, 
        reason: 'network_error' 
      });
    }
  } catch (error) {
    console.error('Error in link validation:', error);
    res.status(500).json({ success: false, error: error.message, message: "Link validation failed" });
  }
});

app.listen(port, async () => {
  console.log(`Server running at http://backups.cetecerpdevel.com:${port}`);
  
  await loadResidentDBsConfig();
}).on('error', (error) => {
  console.error('Failed to start server:', error.message);
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Please stop the process using that port or change the PORT environment variable.`);
  }
  process.exit(1);
});
