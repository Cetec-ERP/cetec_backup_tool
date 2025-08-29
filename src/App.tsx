import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import './App.css';
import SearchAndFilter from './components/SearchAndFilter';
import DataTable from './components/DataTable';
import DarkModeToggle from './components/DarkModeToggle';
import { config } from './config';

// Define proper interfaces for type safety
interface Customer {
  id: string | number;
  name: string;
  domain: string;
  database_exists: boolean | string | null;
  itar_hosting_bc?: boolean;
  resident_hosting?: boolean;
  total_users?: number;
  ok_to_bill?: boolean;
  priority_support?: string;
  test_environment?: boolean | string;
  lastPulled?: string;
  validation_status?: string;
  validation_error?: string;
}

const App: React.FC = () => {
  const [data, setData] = useState<Customer[]>([]);
  const [filteredData, setFilteredData] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationQueue, setValidationQueue] = useState<Set<string>>(new Set());
  const [activeValidations, setActiveValidations] = useState<Set<string>>(new Set());
  
  // Ref to prevent multiple simultaneous queue processing
  const isProcessingQueue = useRef(false);
  
  // Validation queue management
  const MAX_CONCURRENT_VALIDATIONS = 5;
  
  const addToValidationQueue = useCallback((customerId: string) => {
    // Prevent adding the same customer multiple times
    if (validationQueue.has(customerId) || activeValidations.has(customerId)) {
      return;
    }
    
    setValidationQueue(prev => new Set(prev).add(customerId));
  }, [validationQueue, activeValidations]);

  const removeFromValidationQueue = useCallback((customerId: string) => {
    setValidationQueue(prev => {
      const newQueue = new Set(prev);
      newQueue.delete(customerId);
      return newQueue;
    });
  }, []);

  const addToActiveValidations = useCallback((customerId: string) => {
    setActiveValidations(prev => new Set(prev).add(customerId));
  }, []);

  const removeFromActiveValidations = useCallback((customerId: string) => {
    setActiveValidations(prev => {
      const newActive = new Set(prev);
      newActive.delete(customerId);
      return newActive;
    });
  }, []);

  // Process validation queue - now processes multiple customers asynchronously
  const processValidationQueue = useCallback(async () => {
    // Prevent multiple simultaneous executions
    if (isProcessingQueue.current) {
      return;
    }
    
    if (activeValidations.size >= MAX_CONCURRENT_VALIDATIONS || validationQueue.size === 0) {
      return;
    }

    // Mark that we're processing the queue
    isProcessingQueue.current = true;

    try {
      // Process multiple customers up to the concurrent limit
      const customersToProcess = Math.min(
        MAX_CONCURRENT_VALIDATIONS - activeValidations.size,
        validationQueue.size
      );
      
      const customerIds = Array.from(validationQueue).slice(0, customersToProcess);
      
      // Start all validations asynchronously
      const validationPromises = customerIds.map(async (customerId) => {
        // Double-check if this customer is already being validated
        if (activeValidations.has(customerId)) {
          removeFromValidationQueue(customerId);
          return;
        }

        // Move from queue to active
        removeFromValidationQueue(customerId);
        addToActiveValidations(customerId);


        // Find the customer data
        const customer = data.find(c => String(c.id) === customerId);
        if (!customer) {
          removeFromActiveValidations(customerId);
          return;
        }

        try {
          const apiBaseUrl = import.meta.env.VITE_API_URL || '/api';
          const response = await axios.post(`${apiBaseUrl}/validate-environment`, {
            customerId: customer.id,
            domain: customer.domain,
            residentHosting: customer.resident_hosting,
            itarHosting: customer.itar_hosting_bc
          }, { timeout: 10000 });

          if (response.data.success) {
            // Map environment status to database_exists for compatibility
            let databaseExists;
            switch (response.data.environmentStatus) {
              case 'ready':
                databaseExists = true;
                break;
              case 'not_ready':
                databaseExists = false;
                break;
              case 'unavailable':
                databaseExists = 'unavailable';
                break;
              default:
                databaseExists = false;
            }

            // Update customer data
            setData(prevData => prevData.map(c => 
              String(c.id) === customerId 
                ? { ...c, database_exists: databaseExists }
                : c
            ));

            setFilteredData(prevFilteredData => prevFilteredData.map(c => 
              String(c.id) === customerId 
                ? { ...c, database_exists: databaseExists }
                : c
            ));
          }
        } catch (error) {
          console.error(`Validation failed for customer ${customerId}:`, error);
          // Set to false on error to prevent infinite retries
          setData(prevData => prevData.map(c => 
            String(c.id) === customerId 
              ? { ...c, database_exists: false }
              : c
          ));

          setFilteredData(prevFilteredData => prevFilteredData.map(c => 
            String(c.id) === customerId 
              ? { ...c, database_exists: false }
              : c
          ));
        } finally {
          removeFromActiveValidations(customerId);
        }
      });

      // Wait for all validations to complete
      await Promise.all(validationPromises);
      
    } finally {
      // Always mark that we're done processing
      isProcessingQueue.current = false;
    }
  }, [data, validationQueue, activeValidations, removeFromValidationQueue, addToActiveValidations, removeFromActiveValidations]);

  // Watch for changes in queue and active validations to process queue
  useEffect(() => {
    // Only process if we have items in queue and capacity for more validations
    if (validationQueue.size > 0 && activeValidations.size < MAX_CONCURRENT_VALIDATIONS && !isProcessingQueue.current) {
      // Use a small delay to ensure state updates are complete
      const timeoutId = setTimeout(() => {
        processValidationQueue().then(() => {
          // After processing completes, check if there are more items to process
          if (validationQueue.size > 0 && activeValidations.size < MAX_CONCURRENT_VALIDATIONS) {
            // Process more items if available
            setTimeout(() => {
              if (validationQueue.size > 0 && activeValidations.size < MAX_CONCURRENT_VALIDATIONS) {
                processValidationQueue();
              }
            }, 100);
          }
        });
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [validationQueue.size, activeValidations.size, processValidationQueue]);

  const startBackupProcess = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const endpoint = 'cetec/customer';
      const apiBaseUrl = import.meta.env.VITE_API_URL || '/api';
      const url = `${apiBaseUrl}/${endpoint}?preshared_token=${config.presharedToken}`;
      
      const response = await axios.get(url, { timeout: 60000 });
      
      let customersToSort: Customer[] = [];
      
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
      
      const sortedCustomers = customersToSort.sort((a: Customer, b: Customer) => {
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });
      
      setData(sortedCustomers);
      setFilteredData(sortedCustomers);
      
      setLoading(false);
    } catch (err: unknown) {
      let errorMessage = 'An error occurred during backup';
      
      if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      if (err && typeof err === 'object' && 'code' in err) {
        if (err.code === 'ECONNABORTED') {
          errorMessage = 'Request timed out. Please check your network connection and try again.';
        }
      }
      
      if (err && typeof err === 'object' && 'response' in err && err.response && typeof err.response === 'object' && 'status' in err.response) {
        if (err.response.status === 500) {
          errorMessage = 'Server error occurred. Please try again.';
        }
      }
      
      if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string' && err.message.includes('Network Error')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      }
      
      setError(errorMessage);
      setLoading(false);
    }
  };

  useEffect(() => {
    startBackupProcess();
  }, []);



  const handleTimestampUpdate = (customerId: string, timestamp: string, databaseExists?: boolean | string) => {
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

  const handleDatabaseStatusUpdate = (customerId: string, databaseExists: boolean | string) => {
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

  // Calculate summary statistics including validation results
  const getSummaryStats = () => {
    const total = data.length;
    const residentHosting = data.filter(item => item.resident_hosting).length;
    const itarHosting = data.filter(item => item.itar_hosting_bc).length;
    
    // Calculate priority support statistics
    const priorityStats = data.reduce((acc, item) => {
      const priority = String(item.priority_support || '').toLowerCase().trim();
      if (priority === 'lite' || priority === 'l') {
        acc.lite++;
      } else if (priority === 'standard' || priority === 'std' || priority === 's') {
        acc.standard++;
      } else if (priority === 'enterprise' || priority === 'ent' || priority === 'e') {
        acc.enterprise++;
      }
      return acc;
    }, { lite: 0, standard: 0, enterprise: 0 });
    
    return { total, residentHosting, itarHosting, ...priorityStats };
  };

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
          <div className="loading-section">
            <div className="loading-spinner"></div>
            <span>Loading customer data...</span>
          </div>
        ) : error ? (
          <div className="error-section">
            <span className="error-message">{error}</span>
            <button onClick={startBackupProcess} className="retry-button">
              Retry
            </button>
          </div>
        ) : (
          <>
            <SearchAndFilter 
              data={data} 
              onFilterChange={setFilteredData}
              onRefresh={startBackupProcess}
              loading={loading}
            />
            
            {/* Summary Statistics Section */}
            <div className="summary-section">
              <div className="summary-item">
                <span className="summary-label">Total Customers:</span>
                <span className="summary-value">{getSummaryStats().total}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Resident Hosting:</span>
                <span className="summary-value success">{getSummaryStats().residentHosting}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">ITAR Hosting:</span>
                <span className="summary-value">{getSummaryStats().itarHosting}</span>
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
          </>
        )}
      </div>

      {!loading && !error && data && (
        <DataTable 
          data={filteredData} 
          onTimestampUpdate={handleTimestampUpdate}
          onDatabaseStatusUpdate={handleDatabaseStatusUpdate}
          addToValidationQueue={addToValidationQueue}
          isValidationActive={activeValidations.size > 0}
          activeValidations={activeValidations}
        />
      )}
    </div>
  );
}

export default App;
