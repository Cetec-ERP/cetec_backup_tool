import { useState } from 'react';
import axios from 'axios';
import { config } from './config';
import { DataTable } from './components';
import './App.css';

function App() {
  const [data, setData] = useState<any>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useMySQL, setUseMySQL] = useState(false);

  const startBackupProcess = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Choose endpoint based on MySQL preference
      const endpoint = useMySQL ? 'api/cetec/customer' : 'api/cetec/customer/fast';
      const url = `http://localhost:3001/${endpoint}?preshared_token=${config.presharedToken}`;
      
      console.log(`Starting backup process: ${url} (MySQL: ${useMySQL ? 'enabled' : 'disabled'})`);
      
      const response = await axios.get(url, {
        timeout: 15000, // Increased timeout for MySQL operations
      });
      
      // Handle the new enriched data structure
      if (response.data && response.data.customers) {
        setData(response.data.customers);
        console.log(`Received ${response.data.customers.length} customers with ${useMySQL ? 'MySQL enrichment' : 'API data only'}`);
        if (response.data.metadata) {
          console.log('Processing metadata:', response.data.metadata);
        }
      } else {
        // Fallback for old data structure
        setData(response.data);
        console.log('Received data in legacy format');
      }
      
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
        <div className="controls-row">
          <label className="mysql-toggle">
            <input
              type="checkbox"
              checked={useMySQL}
              onChange={(e) => setUseMySQL(e.target.checked)}
            />
            <span>Enable MySQL Database Checking</span>
          </label>
        </div>
        
        <button 
          className="backup-button"
          onClick={handleSubmit}
        >
          Fetch Customer Data
        </button>
        
        <p className="button-description">
          {useMySQL 
            ? 'Click to fetch customers with database verification (slower but more complete)'
            : 'Click to fetch customers quickly (API data only)'
          }
        </p>
      </div>

      {loading && (
        <div className="loading-container">
          <p>
            {useMySQL 
              ? 'Processing request and checking databases...'
              : 'Processing request...'
            }
          </p>
        </div>
      )}
      
      {error && (
        <div className="error-container">
          <strong>Error:</strong> {error}
        </div>
      )}

      {!loading && !error && data && (
        <DataTable 
          data={data.filter((customer: any) => {
            // Filter out customers where ok_to_bill is null, 0, or empty string
            const okToBill = customer.ok_to_bill;
            return okToBill !== null && okToBill !== 0 && okToBill !== '';
          })}
          title={`Customers${useMySQL ? ' (with Database Verification)' : ' (with Hosting Status)'}`}
          columns={[
            'id',
            'name',
            'total_users',
            'domain',
            'database_exists',
            'ok_to_bill',
            'priority_support',
            'resident_hosting',
            'test_environment',
            'test_domain',
            'itar_hosting_bc'
          ]}
        />
      )}
    </div>
  );
}

export default App;
