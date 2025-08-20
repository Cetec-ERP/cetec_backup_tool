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
      
      const response = await axios.get(url, { timeout: 60000 }); // Increased timeout for MySQL operations
      
      // Handle the new enriched data structure
      if (response.data && response.data.customers) {
        setData(response.data.customers);
        setFilteredData(response.data.customers); // Initialize filtered data
        if (response.data.metadata) {
          // console.log('Processing metadata:', response.data.metadata); // Removed console.log
        }
      } else {
        setData(response.data); // Fallback for old data structure
        setFilteredData(response.data); // Initialize filtered data
        // console.log('Received data in legacy format'); // Removed console.log
      }
      
      setLoading(false);
    } catch (err: any) {
      console.error('Error during backup process:', err);
      
      let errorMessage = err.message || 'An error occurred during backup';
      
      // Provide more helpful error messages for common issues
      if (err.code === 'ECONNABORTED') {
        errorMessage = 'Request timed out. Please check your nework connection and try again.';
      } else if (err.response?.status === 500) {
        errorMessage = 'Server error occurred. Please try again.';
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

  const handleTimestampUpdate = (customerId: string, timestamp: string, databaseExists?: any) => {
    setData(prevData => {
      const updatedData = prevData.map(customer => 
        customer.id === customerId 
          ? { 
              ...customer, 
              lastPulled: timestamp,
              ...(databaseExists !== undefined && { database_exists: databaseExists })
            }
          : customer
      );
      return updatedData;
    });
    
    setFilteredData(prevFilteredData => {
      const updatedFilteredData = prevFilteredData.map(customer => 
        customer.id === customerId 
          ? { 
              ...customer, 
              lastPulled: timestamp,
              ...(databaseExists !== undefined && { database_exists: databaseExists })
            }
          : customer
      );
      return updatedFilteredData;
    });
  };

  const handleDatabaseStatusUpdate = (customerId: string, databaseExists: any) => {
    console.log('=== DATABASE STATUS UPDATE CALLED ===');
    console.log('Customer ID:', customerId);
    console.log('Database exists value:', databaseExists);
    console.log('Current data length:', data.length);
    console.log('Current filteredData length:', filteredData.length);
    
    setData(prevData => {
      const updatedData = prevData.map(customer => 
        customer.id === customerId 
          ? { ...customer, database_exists: databaseExists }
          : customer
      );
      console.log('Updated data for customer:', customerId, 'New database_exists:', databaseExists);
      return updatedData;
    });
    
    setFilteredData(prevFilteredData => {
      const updatedFilteredData = prevFilteredData.map(customer => 
        customer.id === customerId 
          ? { ...customer, database_exists: databaseExists }
          : customer
      );
      console.log('Updated filteredData for customer:', customerId, 'New database_exists:', databaseExists);
      return updatedFilteredData;
    });
  };

  return (
    <div className="app-container">
      <h1 className="app-header">
        {/* Cetec ERP Internal Backup Tool */}
        Backups
      </h1>
      
      <div className="button-container">
        <button 
          className="backup-button"
          onClick={handleSubmit}
        >
          Fetch Customer Data
        </button>
        
        <p>
          Click to get a list of active customers, environment links, and backup info. 
        </p>
      </div>

      {loading && (
        <div className="loading-container">
          <p className='header-text'>
            Processing request and checking databases...
          </p>
        </div>
      )}
      
      {error && (
        <div className="error-container">
          <strong className='header-text'>Error:</strong> {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* Combined Search, Filter, and Summary Section */}
          <div className="combined-header-section">
            {/* Search and Filter */}
            <div className="search-filter-row">
              <SearchAndFilter 
                data={data} 
                onFilterChange={setFilteredData}
              />
            </div>
            
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
                <div className="summary-item">
                  <span className="summary-label">Priority Support:</span>
                  <span className="summary-value info">
                    {filteredData.filter((customer: any) => {
                      const prioritySupport = String(customer.priority_support || '').toLowerCase().trim();
                      return prioritySupport === 'lite' || prioritySupport === 'l' || 
                             prioritySupport === 'standard' || prioritySupport === 'std' || prioritySupport === 's' ||
                             prioritySupport === 'enterprise' || prioritySupport === 'ent' || prioritySupport === 'e';
                    }).length}
                  </span>
                </div>
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
            onTimestampUpdate={handleTimestampUpdate}
            onDatabaseStatusUpdate={handleDatabaseStatusUpdate}
          />
        </>
      )}
    </div>
  );
}

export default App;
