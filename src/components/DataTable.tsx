import React, { useState, useCallback } from 'react';
import CustomerCard from './CustomerCard';

interface DataTableProps {
  data: any[];
  title?: string;
  columns?: string[];
  onTimestampUpdate?: (customerId: string, timestamp: string) => void;
  onDatabaseStatusUpdate?: (customerId: string, databaseExists: any) => void;
}

const DataTable: React.FC<DataTableProps> = ({ data, onTimestampUpdate, onDatabaseStatusUpdate }) => {
  const [hiddenDevelButtons, setHiddenDevelButtons] = useState<Set<string>>(new Set());
  const [pollingCustomers, setPollingCustomers] = useState<Set<string>>(new Set());

  const startDatabasePolling = async (item: any, dbName: string) => {
    const maxPollingTime = 30 * 60 * 1000; // 30 minutes maximum
    const pollInterval = 60 * 1000; // 1 minute
    const startTime = Date.now();
    

    
    const pollDatabase = async () => {
      try {
        // Check if we've exceeded maximum polling time
        if (Date.now() - startTime > maxPollingTime) {
          setPollingCustomers(prev => {
            const newSet = new Set(prev);
            newSet.delete(String(item.id));
            return newSet;
          });
          return;
        }
        
        // Check database status
        const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
        const mysqlCheckResponse = await fetch(`${apiBaseUrl}/mysql/check`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            customerId: item.id,
            domain: item.domain,
            residentHosting: item.resident_hosting,
            itarHosting: item.itar_hosting_bc
          }),
        });

        if (mysqlCheckResponse.ok) {
          const mysqlResult = await mysqlCheckResponse.json();

          if (mysqlResult.success) {
            const databaseExists = mysqlResult.databaseExists;
            const timeSinceStart = Date.now() - startTime;

            if (onDatabaseStatusUpdate) {
              onDatabaseStatusUpdate(item.id, databaseExists);
            }

            if (databaseExists !== 'unavailable' && databaseExists !== false) {
              // Database exists, but let's continue polling for a bit to ensure it's stable
              // This handles cases where the external backup service might drop/recreate the database
              const stableTime = 2 * 60 * 1000; // 2 minutes of stability
              
              if (timeSinceStart > stableTime) {
                // Database has been stable for 2 minutes, stop polling
                setHiddenDevelButtons(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(String(item.id));
                  return newSet;
                });
                setPollingCustomers(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(String(item.id));
                  return newSet;
                });
                return;
              }
              // Continue polling to ensure stability
            }
          }
        }
        
        // Schedule next poll if database is not yet available
        setTimeout(pollDatabase, pollInterval);
        
      } catch (error) {
        console.error(`Database polling error for ${item.name} (${dbName}):`, error);
        setTimeout(pollDatabase, pollInterval);
      }
    };
    
    setTimeout(pollDatabase, pollInterval);
  };

  if (!data || data.length === 0) {
    return <div className="no-data">No data available</div>;
  }

  const handleActionClick = useCallback(async (item: any) => {
    // Check if already polling to prevent duplicate calls
    if (pollingCustomers.has(String(item.id))) {
      return;
    }
    
    // ITAR hosting customers cannot pull backups
    if (item.itar_hosting_bc) {
      return;
    }
    
    try {
      setPollingCustomers(prev => new Set(prev).add(String(item.id)));
      
      const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
      const timestampResponse = await fetch(`${apiBaseUrl}/pull/record`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ customerId: item.id }),
      });
      
      if (!timestampResponse.ok) {
        console.warn('Failed to record pull timestamp:', timestampResponse.status);
      } else {
        const timestampData = await timestampResponse.json();
        if (timestampData.success && onTimestampUpdate) {
          onTimestampUpdate(item.id, timestampData.timestamp);
        }
      }
      
      setHiddenDevelButtons(prev => new Set(prev).add(String(item.id)));
      
      const handleBackupRequest = async () => {
        const domain = item.domain;
        if (!domain) {
          return;
        }
        
        // ITAR hosting customers cannot pull backups
        if (item.itar_hosting_bc) {
          return;
        }
        
        const dbName = domain;
        if (item.resident_hosting && item.database_exists === 'unavailable') {
          return;
        }
        
        const backupApiUrl = `${apiBaseUrl}/backup/request`;
        
        fetch(backupApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ dbname: dbName })
        }).then(response => {
          if (!response.ok) {
            console.error(`Backup request failed for ${item.name}: ${response.status}`);
          }
        }).catch(error => {
          console.error(`Backup request error for ${item.name}:`, error);
        });
        
        startDatabasePolling(item, dbName);
      };
      
      handleBackupRequest();
      
    } catch (error) {
      console.error('Error in backup process:', error);
      setPollingCustomers(prev => {
        const newSet = new Set(prev);
        newSet.delete(String(item.id));
        return newSet;
      });
    }
  }, [onTimestampUpdate]);

  return (
    <div className="customer-cards-container">
      
      <div className="cards-grid">
        {data.map((item) => (
          <CustomerCard
            key={item.id}
            item={item}
            hiddenDevelButtons={hiddenDevelButtons}
            isPolling={pollingCustomers.has(String(item.id))}
            onActionClick={handleActionClick}
          />
        ))}
      </div>
    </div>
  );
};

export default DataTable;
