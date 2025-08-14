import { useState } from 'react';
import axios from 'axios';
import { config } from './config';
import DataTable from './components/DataTable';
import SearchAndFilter from './components/SearchAndFilter';
import './App.css';

function App() {
  const [data, setData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startBackupProcess = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Choose endpoint based on MySQL preference
      const endpoint = 'api/cetec/customer'; // Always use the full endpoint for MySQL checking
      const url = `http://localhost:3001/${endpoint}?preshared_token=${config.presharedToken}`;
      
      console.log(`Starting backup process: ${url} (MySQL: enabled)`);
      
      const response = await axios.get(url, { timeout: 60000 }); // Increased timeout for MySQL operations
      
      // Handle the new enriched data structure
      if (response.data && response.data.customers) {
        setData(response.data.customers);
        setFilteredData(response.data.customers); // Initialize filtered data
        console.log(`Received ${response.data.customers.length} customers with MySQL enrichment`);
        if (response.data.metadata) {
          console.log('Processing metadata:', response.data.metadata);
        }
      } else {
        setData(response.data); // Fallback for old data structure
        setFilteredData(response.data); // Initialize filtered data
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
        <button 
          className="backup-button"
          onClick={handleSubmit}
        >
          Fetch Customer Data
        </button>
        
        <p className="button-description">
          Click to fetch customers with database verification (slower but more complete)
        </p>
      </div>

      {loading && (
        <div className="loading-container">
          <p>
            Processing request and checking databases... (this may take a minute for large datasets)
          </p>
          <p style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
            ⏱️ MySQL operations can take time when processing many customers
          </p>
        </div>
      )}
      
      {error && (
        <div className="error-container">
          <strong>Error:</strong> {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* Search and Filter */}
          <SearchAndFilter 
            data={data} 
            onFilterChange={setFilteredData}
          />
          
          {/* Summary Statistics */}
          <div className="summary-container">
            <div className="summary-stats">
              <div className="summary-item">
                <span className="summary-label">Total Customers:</span>
                <span className="summary-value">{filteredData.length}</span>
              </div>
              {/* MySQL specific summary items */}
              <div className="summary-item">
                <span className="summary-label">Existing Databases:</span>
                <span className="summary-value success">
                  {filteredData.filter((customer: any) => customer.database_exists === true).length}
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">No Database:</span>
                <span className="summary-value warning">
                  {filteredData.filter((customer: any) => customer.database_exists === false).length}
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Resident Hosting:</span>
                <span className="summary-value info">
                  {filteredData.filter((customer: any) => customer.resident_hosting === true || customer.resident_hosting === 1).length}
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Unavailable:</span>
                <span className="summary-value info">
                  {filteredData.filter((customer: any) => customer.database_exists === 'unavailable').length}
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">ITAR Hosting:</span>
                <span className="summary-value info">
                  {filteredData.filter((customer: any) => customer.itar_hosting_bc === true || customer.itar_hosting_bc === 1).length}
                </span>
              </div>
            </div>
          </div>

          <DataTable 
            data={filteredData}
            title={`Customers (with Database Verification)`}
            columns={[
              'id', 'name', 'total_users', 'domain', 'database_exists',
              'ok_to_bill', 'priority_support', 'resident_hosting', 'test_environment', 'test_domain', 'itar_hosting_bc'
            ]}
          />
        </>
      )}
    </div>
  );
}

export default App;
