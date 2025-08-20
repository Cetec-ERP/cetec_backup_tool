import React, { useState } from 'react';
import CustomerCard from './CustomerCard';

interface DataTableProps {
  data: any[];
  title?: string;
  columns?: string[]; // Optional array of column keys to display
  onTimestampUpdate?: (customerId: string, timestamp: string) => void; // Callback to update timestamp in parent
  onDatabaseStatusUpdate?: (customerId: string, databaseExists: any) => void; // Callback to update database status
}

const DataTable: React.FC<DataTableProps> = ({ data, onTimestampUpdate, onDatabaseStatusUpdate }) => {
  // Track which customers have had their Devel buttons hidden after Pull
  const [hiddenDevelButtons, setHiddenDevelButtons] = useState<Set<string>>(new Set());

  if (!data || data.length === 0) {
    return <div className="no-data">No data available</div>;
  }

  const handleActionClick = async (item: any) => {
    try {
      // Record the pull timestamp FIRST, before doing anything else
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
        // Update the UI with the new timestamp immediately
        const timestampData = await timestampResponse.json();
        if (timestampData.success && onTimestampUpdate) {
          onTimestampUpdate(item.id, timestampData.timestamp);
        }
      }
      
      // Immediately hide the Devel button for this customer
      setHiddenDevelButtons(prev => new Set(prev).add(String(item.id)));
      
      // Schedule the MySQL check immediately - this is the important part!
      const timeoutId = setTimeout(async () => {
        try {
          // Instead of calling the API, make a direct MySQL check for this specific customer
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

              setHiddenDevelButtons(prev => {
                const newSet = new Set(prev);
                newSet.delete(String(item.id));
                return newSet;
              });
            }
          }
        } catch (error) {
          console.error('MySQL check failed:', error);
        }
      }, 60000); // 1 minute delay
      
      // Now handle the backup request as a completely separate, non-blocking operation
      const handleBackupRequest = async () => {
        try {
          const domain = item.domain;
          if (!domain) {
            return;
          }
          
          let dbName = domain;
          if (item.resident_hosting && item.database_exists === 'unavailable') {
            return;
          }
          
          const backupApiUrl = `http://localhost:3001/api/backup/request`;
          
          // Add a timeout to prevent hanging
          const controller = new AbortController();
          const timeoutId = setTimeout(() => {
            controller.abort();
          }, 10000); // 10 second timeout
          
          const backupResponse = await fetch(backupApiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ dbname: dbName }),
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);

          if (!backupResponse.ok) {
            throw new Error(`Backup request failed: ${backupResponse.status}`);
          }

          const backupResult = await backupResponse.json();

        } catch (backupError: any) {
          // Backup request failed silently (non-blocking)
        }
      };
      
      // Start the backup request in a separate thread (non-blocking)
      handleBackupRequest().catch(error => {
        console.error('Backup request thread error:', error);
      });
      
    } catch (error) {
      console.error('Error in backup process:', error);
    }
  };

  return (
    <div className="customer-cards-container">
      <h2 className="section-title">Customer Database Status</h2>
      <div className="cards-grid">
        {data.map((item, index) => (
          <CustomerCard
            key={index}
            item={item}
            hiddenDevelButtons={hiddenDevelButtons}
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
