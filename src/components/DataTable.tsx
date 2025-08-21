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

  if (!data || data.length === 0) {
    return <div className="no-data">No data available</div>;
  }

  const handleActionClick = async (item: any) => {
    try {
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
      
      const timeoutId = setTimeout(async () => {
        try {
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
      }, 60000);
      
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
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => {
            controller.abort();
          }, 10000);
          
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
        }
      };
      
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
