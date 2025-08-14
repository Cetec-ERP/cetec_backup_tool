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
      
      const response = await axios.get(url, { timeout: 60000 }); // Increased timeout for MySQL operations
      
      // Handle the new enriched data structure
      if (response.data && response.data.customers) {
        setData(response.data.customers);
        console.log(`Received ${response.data.customers.length} customers with ${useMySQL ? 'MySQL enrichment' : 'API data only'}`);
        if (response.data.metadata) {
          console.log('Processing metadata:', response.data.metadata);
        }
      } else {
        setData(response.data); // Fallback for old data structure
        console.log('Received data in legacy format');
      }
      
      setLoading(false);
    } catch (err: any) {
      console.error('Error during backup process:', err);
      
      let errorMessage = err.message || 'An error occurred during backup';
      
      // Provide more helpful error messages for common issues
      if (err.code === 'ECONNABORTED') {
        errorMessage = 'Request timed out. MySQL operations may take longer than expected for large datasets. Try again or use the fast mode (without MySQL) for quicker results.';
      } else if (err.response?.status === 500) {
        errorMessage = 'Server error occurred. Check the backend logs for more details.';
      } else if (err.message?.includes('Network Error')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      }
      
      setError(errorMessage);
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
              ? 'Processing request and checking databases... (this may take a minute for large datasets)'
              : 'Processing request...'
            }
          </p>
          {useMySQL && (
            <p style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
              ⏱️ MySQL operations can take time when processing many customers
            </p>
          )}
        </div>
      )}
      
      {error && (
        <div className="error-container">
          <strong>Error:</strong> {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* Summary Statistics */}
          <div className="summary-container">
            <div className="summary-stats">
              <div className="summary-item">
                <span className="summary-label">Total Customers:</span>
                <span className="summary-value">{data.length}</span>
              </div>
              {useMySQL && (
                <>
                  <div className="summary-item">
                    <span className="summary-label">Existing Databases:</span>
                    <span className="summary-value success">
                      {data.filter((customer: any) => customer.database_exists === true).length}
                    </span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">No Database:</span>
                    <span className="summary-value warning">
                      {data.filter((customer: any) => customer.database_exists === false).length}
                    </span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Resident Hosting:</span>
                    <span className="summary-value info">
                      {data.filter((customer: any) => customer.database_exists === 'resident_hosting').length}
                    </span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">ITAR Hosting:</span>
                    <span className="summary-value info">
                      {data.filter((customer: any) => customer.database_exists === 'itar_hosting').length}
                    </span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Invalid Domains:</span>
                    <span className="summary-value error">
                      {data.filter((customer: any) => customer.database_exists === 'invalid_domain').length}
                    </span>
                  </div>
                </>
              )}
              {!useMySQL && (
                <>
                  <div className="summary-item">
                    <span className="summary-label">Resident Hosting:</span>
                    <span className="summary-value info">
                      {data.filter((customer: any) => customer.database_exists === 'resident_hosting').length}
                    </span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">ITAR Hosting:</span>
                    <span className="summary-value info">
                      {data.filter((customer: any) => customer.database_exists === 'itar_hosting').length}
                    </span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Invalid Domains:</span>
                    <span className="summary-value error">
                      {data.filter((customer: any) => customer.database_exists === 'invalid_domain').length}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          <DataTable 
            data={data}
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
        </>
      )}
    </div>
  );
}

export default App;
