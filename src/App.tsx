import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { config } from './config';
import DataTable from './components/DataTable';
import SearchAndFilter from './components/SearchAndFilter';
import DarkModeToggle from './components/DarkModeToggle';
import './App.css';

interface Customer {
  id: string;
  name: string;
  domain: string;
  database_exists: any;
  itar_hosting_bc?: any;
  resident_hosting?: any;
  total_users?: any;
  ok_to_bill?: any;
  priority_support?: any;
  test_environment?: any;
  lastPulled?: any;
  validation_status?: string;
  validation_error?: string;
  // ... other properties
}

interface ValidationResult {
  domain: string;
  reachable: boolean | undefined;
  status?: number;
  error?: string;
  finalUrl?: string;
  reason?: string;
}

const App: React.FC = () => {
  const [data, setData] = useState<Customer[]>([]);
  const [filteredData, setFilteredData] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [hiddenDevelButtons, setHiddenDevelButtons] = useState<Set<string>>(new Set());
  const [pollingCustomers, setPollingCustomers] = useState<Set<string>>(new Set());
  const [validationCache, setValidationCache] = useState<Map<string, ValidationResult>>(new Map());
  const [isValidating, setIsValidating] = useState(false);

  const startBackupProcess = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const endpoint = 'cetec/customer';
      const apiBaseUrl = import.meta.env.VITE_API_URL || '/api';
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
      
      // Batch validate all domains that need validation
      await batchValidateDomains(sortedCustomers);
      
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

    // Update validation cache when database status changes
    if (databaseExists === true) {
      // Find the customer to get their domain
      const customer = data.find(c => c.id === customerId);
      if (customer && customer.domain) {
        setValidationCache(prevCache => {
          const newCache = new Map(prevCache);
          // Mark the domain as reachable since we now know the database exists
          newCache.set(customer.domain, {
            domain: customer.domain,
            reachable: true,
            status: 200,
            finalUrl: `http://${customer.domain}.cetecerpdevel.com/auth/login_new`
          });
          return newCache;
        });
      }
    }
  };

  // Calculate summary statistics including validation results
  const getSummaryStats = () => {
    const total = data.length;
    const residentHosting = data.filter(item => item.resident_hosting).length;
    const itarHosting = data.filter(item => item.itar_hosting_bc).length;
    
    return { total, residentHosting, itarHosting };
  };

  // Batch validation function to efficiently validate multiple domains at once
  const batchValidateDomains = useCallback(async (customers: Customer[]) => {
    const customersToValidate = customers.filter(customer => 
      customer.domain && 
      customer.domain.trim() !== '' && 
      customer.domain !== 'undefined' &&
      !customer.itar_hosting_bc && 
      !customer.resident_hosting &&
      (customer.database_exists === 'pending_validation' || 
       customer.database_exists === false || 
       customer.database_exists === 'unavailable' ||
       customer.database_exists === 'error' ||
       customer.database_exists === 'validation_error')
    );

    if (customersToValidate.length === 0) {
      return;
    }

    setIsValidating(true);

    try {
      const apiBaseUrl = import.meta.env.VITE_API_URL || '/api';
      
      const validationPromises = customersToValidate.map(async (customer) => {
        try {
          const response = await axios.post(`${apiBaseUrl}/validate-environment`, {
            customerId: customer.id,
            domain: customer.domain,
            residentHosting: customer.resident_hosting,
            itarHosting: customer.itar_hosting_bc
          }, { timeout: 10000 });
          
          return {
            customerId: customer.id,
            domain: customer.domain,
            environmentStatus: response.data.environmentStatus,
            success: response.data.success
          };
        } catch (error: any) {
          return {
            customerId: customer.id,
            domain: customer.domain,
            environmentStatus: 'error',
            success: false,
            error: error.message
          };
        }
      });

      const results = await Promise.all(validationPromises);

      // Update customer data with environment validation results
      setData(prevData => prevData.map(customer => {
        const validationResult = results.find(result => result.customerId === customer.id);
        if (validationResult && validationResult.success) {
          // Map environment status to database_exists for compatibility
          // Only set to true if environment is actually ready
          // For all other cases, keep the original status or set to false
          let databaseExists;
          switch (validationResult.environmentStatus) {
            case 'ready':
              databaseExists = true; // Environment is ready - show Devel button
              break;
            case 'not_ready':
              databaseExists = false; // Environment exists but not ready - no button
              break;
            case 'unavailable':
              databaseExists = 'unavailable'; // ITAR/resident hosting - no button
              break;
            default:
              databaseExists = false; // Any other error - no button
          }
          
          return {
            ...customer,
            database_exists: databaseExists
          };
        }
        return customer;
      }));

      // Also update filtered data to keep UI in sync
      setFilteredData(prevFilteredData => prevFilteredData.map(customer => {
        const validationResult = results.find(result => result.customerId === customer.id);
        if (validationResult && validationResult.success) {
          // Map environment status to database_exists for compatibility
          // Only set to true if environment is actually ready
          // For all other cases, keep the original status or set to false
          let databaseExists;
          switch (validationResult.environmentStatus) {
            case 'ready':
              databaseExists = true; // Environment is ready - show Devel button
              break;
            case 'not_ready':
              databaseExists = false; // Environment exists but not ready - no button
              break;
            case 'unavailable':
              databaseExists = 'unavailable'; // ITAR/resident hosting - no button
              break;
            default:
              databaseExists = false; // Any other error - no button
          }
          
          return {
            ...customer,
            database_exists: databaseExists
          };
        }
        return customer;
      }));

    } catch (error) {
      console.error('Batch validation failed:', error);
    } finally {
      setIsValidating(false);
    }
  }, []);

  return (
    <div className="app-container">
      <div className="header-section">
        <h1 className="app-header">
          Support Environments 
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
                Loading customer data...
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
          
            {filteredData.length > 0 && (() => {
              const stats = getSummaryStats();
              return (
                <>
                  <div className="summary-item">
                    <span className="summary-label">Total:</span>
                    <span className="summary-value">{stats.total}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Resident:</span>
                    <span className="summary-value warning">
                      {stats.residentHosting}
                    </span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">ITAR:</span>
                    <span className="summary-value danger">
                      {stats.itarHosting}
                    </span>
                  </div>
                  
                  {isValidating && (
                    <div className="summary-item">
                      <span className="summary-label">Validating:</span>
                      <span className="summary-value info">
                        <div className="polling-spinner"></div>
                        Checking links...
                      </span>
                    </div>
                  )}
                  
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
              );
            })()}
          </>
        ) : null}
      </div>

      {!loading && !error && data && (
        <DataTable 
          data={filteredData}
          title="Customers"
          columns={[
            'id', 'name', 'total_users', 'domain', 'database_exists',
            'ok_to_bill', 'priority_support', 'resident_hosting', 'test_environment', 'itar_hosting_bc'
          ]}
          onTimestampUpdate={handleTimestampUpdate}
          onDatabaseStatusUpdate={handleDatabaseStatusUpdate}
          validationCache={validationCache}
        />
      )}
    </div>
  );
}

export default App;
