import { useState, useEffect } from 'react';
import axios from 'axios';
import { config } from './config';
import DataTable from './components/DataTable';
import SearchAndFilter from './components/SearchAndFilter';
import DarkModeToggle from './components/DarkModeToggle';
import './App.css';

function App() {
  const [data, setData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const startBackupProcess = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const endpoint = 'cetec/customer';
      const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
      const url = `${apiBaseUrl}/${endpoint}?preshared_token=${config.presharedToken}`;
      
      const response = await axios.get(url, { timeout: 60000 });
      
      let customersToSort = [];
      
      if (response.data && response.data.customers && Array.isArray(response.data.customers)) {
        customersToSort = response.data.customers;
      } else if (response.data && Array.isArray(response.data)) {
        customersToSort = response.data;
      } else {
        console.error('Unexpected API response format:', response.data);
        throw new Error('API returned unexpected data format');
      }
      
      if (customersToSort.length === 0) {
        setData([]);
        setFilteredData([]);
        setLoading(false);
        return;
      }
      
      const sortedCustomers = customersToSort.sort((a: any, b: any) => {
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });
      
      setData(sortedCustomers);
      setFilteredData(sortedCustomers);
      
      setLoading(false);
    } catch (err: any) {
      console.error('Error during backup process:', err);
      
      let errorMessage = err.message || 'An error occurred during backup';
      
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

  useEffect(() => {
    startBackupProcess();
  }, []);



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
    setData(prevData => {
      const updatedData = prevData.map(customer => 
        customer.id === customerId 
          ? { ...customer, database_exists: databaseExists }
          : customer
      );
      return updatedData;
    });
    
    setFilteredData(prevFilteredData => {
      const updatedFilteredData = prevFilteredData.map(customer => 
        customer.id === customerId 
          ? { ...customer, database_exists: databaseExists }
          : customer
      );
      return updatedFilteredData;
    });
  };

  return (
    <div className="app-container">
      <div className="header-section">
        <h1 className="app-header">
          Cetec ERP Backup Tool 
        </h1>
        <DarkModeToggle />
      </div>
      
      <div className="combined-header-section">
        {loading ? (
          <>
            <div className="loading-placeholder">
              <div className="search-placeholder"></div>
            </div>
            <div className="loading-placeholder">
              <div className="refresh-placeholder"></div>
            </div>
            <div className="loading-placeholder">
              <div className="summary-placeholder"></div>
            </div>
            <div className="loading-placeholder">
              <div className="summary-placeholder"></div>
            </div>
            <div className="loading-placeholder">
              <div className="summary-placeholder"></div>
            </div>
            <div className="loading-placeholder">
              <div className="summary-placeholder"></div>
            </div>
            <div className="loading-placeholder">
              <div className="summary-placeholder"></div>
            </div>
            <div className="loading-overlay">
              <p className='header-text'>
                Loading customer data and checking databases...
              </p>
            </div>
          </>
        ) : error ? (
          <div className="error-container">
            <strong className='header-text'>Error:</strong> {error}
          </div>
        ) : data ? (
          <>
            <SearchAndFilter 
              data={data} 
              onFilterChange={setFilteredData}
              onRefresh={startBackupProcess}
              loading={loading}
            />
          
              <div className="summary-item">
                <span className="summary-label">Total:</span>
                <span className="summary-value">{filteredData.length}</span>
              </div>
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
          </>
        ) : null}
      </div>

      {!loading && !error && data && (
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
      )}
    </div>
  );
}

export default App;
