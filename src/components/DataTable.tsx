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
    
    console.log(`🕐 [POLLING] Starting database polling for ${item.name} (${dbName}), checking every ${pollInterval/1000} seconds...`);
    
    // Customer should already be in polling set from handleActionClick
    
    const pollDatabase = async () => {
      try {
        // Check if we've exceeded maximum polling time
        if (Date.now() - startTime > maxPollingTime) {
          console.log(`⏰ [POLLING] Timeout reached for ${item.name} (${dbName}) after ${maxPollingTime/60000} minutes`);
          setPollingCustomers(prev => {
            const newSet = new Set(prev);
            newSet.delete(String(item.id));
            return newSet;
          });
          return;
        }
        
        // Check database status
        console.log(`🔍 [POLLING] Checking database status for ${item.name} (${dbName})...`);
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
            console.log(`📊 [POLLING] Database status for ${item.name} (${dbName}): ${databaseExists}`);

            if (onDatabaseStatusUpdate) {
              onDatabaseStatusUpdate(item.id, databaseExists);
            }

            // If database is now available, show devel button and stop polling
            if (databaseExists !== 'unavailable' && databaseExists !== false) {
              console.log(`🎉 [POLLING] Database found! Stopping polling for ${item.name} (${dbName})`);
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
              return; // Stop polling
            } else {
              console.log(`⏳ [POLLING] Database not ready yet for ${item.name} (${dbName}), will check again in ${pollInterval/1000} seconds...`);
            }
          }
        }
        
        // Schedule next poll if database is not yet available
        setTimeout(pollDatabase, pollInterval);
        
      } catch (error) {
        console.log(`❌ [POLLING] Error checking database for ${item.name} (${dbName}):`, error);
        console.error(`Database polling error for ${item.name} (${dbName}):`, error);
        // Continue polling even if there's an error
        setTimeout(pollDatabase, pollInterval);
      }
    };
    
    // Start the first poll after a short delay
    console.log(`⏰ [POLLING] First database check for ${item.name} (${dbName}) scheduled in ${pollInterval/1000} seconds`);
    setTimeout(pollDatabase, pollInterval);
  };

  if (!data || data.length === 0) {
    return <div className="no-data">No data available</div>;
  }

  const handleActionClick = async (item: any) => {
    try {
      // Immediately set polling state to show "Pulling..." button
      console.log(`🔄 [POLLING] Starting backup process for ${item.name} (ID: ${item.id})`);
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
        
        let dbName = domain;
        if (item.resident_hosting && item.database_exists === 'unavailable') {
          return;
        }
        
        const backupApiUrl = `http://localhost:3001/api/backup/request`;
        
        console.log(`🚀 [BACKUP] Sending backup request for ${item.name} (${dbName})...`);
        
        // Send backup request but don't wait for response - proceed directly to polling
        fetch(backupApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ dbname: dbName })
        }).then(response => {
          if (response.ok) {
            console.log(`✅ [BACKUP] Backup request response received for ${item.name}: ${response.status}`);
          } else {
            console.log(`⚠️ [BACKUP] Backup request returned error for ${item.name}: ${response.status}`);
          }
        }).catch(error => {
          console.log(`❌ [BACKUP] Backup request error for ${item.name}:`, error);
        });
        
        console.log(`🔄 [POLLING] Starting database polling immediately for ${item.name} (${dbName})...`);
        
        // Start polling immediately without waiting for backup response
        startDatabasePolling(item, dbName);
      };
      
      handleBackupRequest();
      
    } catch (error) {
      console.log(`❌ [POLLING] General error for ${item.name}, removing from polling:`, error);
      console.error('Error in backup process:', error);
      // Remove from polling set if there was an error
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
