import React, { useState } from 'react';
import TableRow from './TableRow';

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

  // Get all unique keys from the data
  const allKeys = Array.from(
    new Set(data.flatMap(item => Object.keys(item)))
  );

  // Define the columns we want to display and their order
  const displayColumns = [
    'id',
    'name', 
    'total_users',
    'domain',
    'ok_to_bill',
    'priority_support',
    'resident_hosting',
    'test_environment',
    'itar_hosting_bc',
    'database_exists',
    'actions' // Actions column (Pull button + timestamp)
  ];

  // Filter to only show the columns we want
  const columnsToShow = displayColumns.filter(col => 
    allKeys.includes(col) || col === 'actions'
  );

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
    <div className="table-container">
      <table className="data-table">
        <thead>
          <tr>
            {columnsToShow.map(key => (
              <th key={key} className="table-header">
                {key === 'total_users' ? 'Total Users' :
                 key === 'ok_to_bill' ? 'OK to Bill' :
                 key === 'priority_support' ? 'Priority Support' :
                 key === 'resident_hosting' ? 'Resident Hosting' :
                 key === 'test_environment' ? 'Test Environment' :
                 key === 'itar_hosting_bc' ? 'ITAR Hosting' :
                 key === 'database_exists' ? 'Devel Environment' :
                 key === 'actions' ? 'Pull Backup' :
                 key.charAt(0).toUpperCase() + key.slice(1)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => (
            <TableRow
              key={index}
              item={item}
              columnsToShow={columnsToShow}
              hiddenDevelButtons={hiddenDevelButtons}
              onActionClick={handleActionClick}
              onTimestampUpdate={onTimestampUpdate}
              onDatabaseStatusUpdate={onDatabaseStatusUpdate}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DataTable;
