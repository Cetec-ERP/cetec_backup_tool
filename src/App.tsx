import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { config } from './config';
import './App.css';

function App() {
  const [data, setData] = useState<any>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const startBackupProcess = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Make request with just the preshared token
      const url = `http://localhost:3001/api/cetec/customer?preshared_token=${config.presharedToken}`;
      console.log('Starting backup process:', url);
      
      const response = await axios.get(url, {
        timeout: 10000,
      });
      
      setData(response.data);
      setLoading(false);
    } catch (err: any) {
      console.error('Error during backup process:', err);
      setError(err.message || 'An error occurred during backup');
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    startBackupProcess();
  };

  return (
    <div className="app-container">
      <h1 className="app-header">
        Cetec ERP Internal Backup Tool
      </h1>
      
      <div className="button-container">
        <button 
          className="backup-button"
          onClick={handleSubmit}
        >
          Fetch Customer Data
        </button>
        <p className="button-description">
          Click to fetch a list of active customers
        </p>
      </div>

      {loading && (
        <div className="loading-container">
          <p>Processing request...</p>
        </div>
      )}
      
      {error && (
        <div className="error-container">
          <strong>Error:</strong> {error}
        </div>
      )}

      {!loading && !error && data && (
        <div className="data-container">
          <h2 className="data-header">Customers</h2>
          <pre className="json-display">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default App;
