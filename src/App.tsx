import { useState, useEffect } from 'react';
import axios from 'axios';
import { config } from './config';
import DataTable from './components/DataTable';
import SearchAndFilter from './components/SearchAndFilter';
import './App.css';

function App() {
  const [data, setData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true); // Start with loading true since we fetch automatically
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
        // Sort customers alphabetically by name before setting state
        const sortedCustomers = response.data.customers.sort((a: any, b: any) => {
          const nameA = (a.name || '').toLowerCase();
          const nameB = (b.name || '').toLowerCase();
          return nameA.localeCompare(nameB);
        });
        
        setData(sortedCustomers);
        setFilteredData(sortedCustomers); // Initialize filtered data
        if (response.data.metadata) {
          // console.log('Processing metadata:', response.data.metadata); // Removed console.log
        }
      } else {
        // Sort customers alphabetically by name before setting state (fallback for old data structure)
        const sortedCustomers = response.data.sort((a: any, b: any) => {
          const nameA = (a.name || '').toLowerCase();
          const nameB = (b.name || '').toLowerCase();
          return nameA.localeCompare(nameB);
        });
        
        setData(sortedCustomers); // Fallback for old data structure
        setFilteredData(sortedCustomers); // Initialize filtered data
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

  // Automatically fetch data when component mounts
  useEffect(() => {
    startBackupProcess();
  }, []); // Empty dependency array means this runs once when component mounts

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
      </div>

      {loading && (
        <div className="loading-container">
          <p className='header-text'>
            Loading customer data and checking databases...
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
              
              <div className="refresh-section">
                <button 
                  className="refresh-button"
                  onClick={startBackupProcess}
                  disabled={loading}
                >
                  {loading ? 'Loading...' : 'Refresh Data'}
                </button>
              </div>
            </div>
            
            {/* Summary Statistics */}
            <div className="summary-container">
              <div className="summary-stats">
                <div className="summary-item">
                  <span className="summary-label">Total:</span>
                  <span className="summary-value">{filteredData.length}</span>
                </div>
                {/* MySQL specific summary items */}
                <div className="summary-item">
                  <span className="summary-label">Has Backup:</span>
                  <span className="summary-value success">
                    {filteredData.filter((customer: any) => customer.database_exists === true).length}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Resident:</span>
                  <span className="summary-value warning">
                    {filteredData.filter((customer: any) => customer.resident_hosting === true || customer.resident_hosting === 1).length}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">ITAR:</span>
                  <span className="summary-value danger">
                    {filteredData.filter((customer: any) => {
                      const itarValue = customer.itar_hosting_bc;
                      // Debug: log ITAR values to understand the data structure
                      if (itarValue && itarValue !== '' && itarValue !== 'false' && itarValue !== 0) {
                        console.log('ITAR customer found:', customer.name, 'itar_hosting_bc:', itarValue);
                      }
                      // Check for various ITAR values: boolean true/1, string "ITAR", etc.
                      return itarValue === true || itarValue === 1 || 
                             (typeof itarValue === 'string' && itarValue.toLowerCase().includes('itar')) ||
                             (itarValue && itarValue !== '' && itarValue !== 'false' && itarValue !== 0);
                    }).length}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Priority Support:</span>
                  <div className="priority-chips">
                    <span className="priority-chip lite">
                      {filteredData.filter((customer: any) => {
                        const prioritySupport = String(customer.priority_support || '').toLowerCase().trim();
                        return prioritySupport === 'lite' || prioritySupport === 'l';
                      }).length}
                    </span>
                    <span className="priority-chip standard">
                      {filteredData.filter((customer: any) => {
                        const prioritySupport = String(customer.priority_support || '').toLowerCase().trim();
                        return prioritySupport === 'standard' || prioritySupport === 'std' || prioritySupport === 's';
                      }).length}
                    </span>
                    <span className="priority-chip enterprise">
                      {filteredData.filter((customer: any) => {
                        const prioritySupport = String(customer.priority_support || '').toLowerCase().trim();
                        return prioritySupport === 'enterprise' || prioritySupport === 'ent' || prioritySupport === 'e';
                      }).length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DataTable 
            data={filteredData}
            title={`Customers (with Database Verification)`}
            columns={[
              'id', 'name', 'total_users', 'domain', 'database_exists',
              'ok_to_bill', 'priority_support', 'resident_hosting', 'test_environment', 'itar_hosting_bc'
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
