import React, { useState } from 'react';
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
        const mysqlCheckResponse = await fetch('http://localhost:3001/api/mysql/check', {
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

            if (onDatabaseStatusUpdate) {
              onDatabaseStatusUpdate(item.id, databaseExists);
            }

            if (databaseExists !== 'unavailable' && databaseExists !== false) {
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

  const handleActionClick = async (item: any) => {
    try {
      setPollingCustomers(prev => new Set(prev).add(String(item.id)));
      
      const timestampResponse = await fetch('http://localhost:3001/api/pull/record', {
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
        
        const dbName = domain;
        if (item.resident_hosting && item.database_exists === 'unavailable') {
          return;
        }
        
        const backupApiUrl = `http://localhost:3001/api/backup/request`;
        
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
  };

  return (
    <div className="customer-cards-container">
      
      <div className="cards-grid">
        {data.map((item, index) => (
          <CustomerCard
            key={index}
            item={item}
            hiddenDevelButtons={hiddenDevelButtons}
            isPolling={pollingCustomers.has(String(item.id))}
            onActionClick={handleActionClick}
            onTimestampUpdate={onTimestampUpdate}
            onDatabaseStatusUpdate={onDatabaseStatusUpdate}
          />
        ))}
      </div>
    </div>
  );
};

export default DataTable;
