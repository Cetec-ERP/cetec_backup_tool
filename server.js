import express from "express";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

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

// Proxy endpoint for CETEC ERP API
app.get("/api/cetec/customer", async (req, res) => {
  let cetecUrl = ''; // Declare outside try block for error handling
  
  try {
    const { id, name, external_key, columns, preshared_token } = req.query;
    
    console.log('Received request with query params:', req.query);
    
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
    console.log('Proxying request to:', cetecUrl);
    
    const response = await axios.get(cetecUrl, {
      timeout: 10000,
    });

    res.json(response.data);
  } catch (error) {
    console.error("Error proxying to CETEC API:", error);
    console.error("Full error object:", JSON.stringify(error, null, 2));
    
    // Send more detailed error information
    res.status(500).json({ 
      error: "Failed to fetch from CETEC API",
      details: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: cetecUrl
    });
  }
});



app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
