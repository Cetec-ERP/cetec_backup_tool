import React from 'react';

interface DataTableProps {
  data: any[];
  title?: string;
  columns?: string[]; // Optional array of column keys to display
}

const DataTable: React.FC<DataTableProps> = ({ data }) => {
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
    'test_domain',
    'itar_hosting_bc',
    'database_exists',
    'actions' // New actions column
  ];

  // Filter to only show the columns we want
  const columnsToShow = displayColumns.filter(col => 
    allKeys.includes(col) || col === 'actions'
  );

  const handleActionClick = (domain: string) => {
    console.log('Action button clicked for domain:', domain);
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
                 key === 'test_domain' ? 'Test Domain' :
                 key === 'itar_hosting_bc' ? 'ITAR Hosting' :
                 key === 'database_exists' ? 'Database Exists' :
                 key === 'actions' ? 'Actions' :
                 key.charAt(0).toUpperCase() + key.slice(1)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => (
            <tr key={index} className="table-row">
              {columnsToShow.map(key => {
                if (key === 'actions') {
                  // Check if we should show the action button
                  const isItarHosting = Boolean(item.itar_hosting_bc); // Any truthy value means ITAR hosting
                  const isDatabaseUnavailable = item.database_exists === 'unavailable';
                  
                  // Debug logging to understand the values
                  console.log(`Row ${index}: itar_hosting_bc =`, item.itar_hosting_bc, `(type: ${typeof item.itar_hosting_bc}), isItarHosting =`, isItarHosting);
                  console.log(`Row ${index}: database_exists =`, item.database_exists, `(type: ${typeof item.database_exists}), isDatabaseUnavailable =`, isDatabaseUnavailable);
                  
                  // Don't show button for ITAR hosting or unavailable database rows
                  if (isItarHosting || isDatabaseUnavailable) {
                    console.log(`Row ${index}: Hiding button - ITAR hosting or unavailable database`);
                    return (
                      <td key={key} className="table-cell">
                        <span className="no-action">—</span>
                      </td>
                    );
                  }
                  
                  console.log(`Row ${index}: Showing button - eligible for action`);
                  return (
                    <td key={key} className="table-cell">
                      <button 
                        className="action-button"
                        onClick={() => handleActionClick(item.domain || 'No Domain')}
                      >
                        Action
                      </button>
                    </td>
                  );
                }

                let value: any;
                let isMissing = false;

                if (key === 'total_users') {
                  const prodUsers = item.num_prod_users || 0;
                  const fullUsers = item.num_full_users || 0;
                  value = prodUsers + fullUsers;
                } else if (key === 'database_exists') {
                  const dbExists = item.database_exists;
                  if (dbExists === true || dbExists === 'true' || dbExists === 1) {
                    value = 'Yes';
                  } else if (dbExists === false || dbExists === 'false' || dbExists === 0) {
                    value = 'No';
                  } else if (dbExists === 'resident_hosting') {
                    value = 'Resident Hosting';
                  } else if (dbExists === 'itar_hosting') {
                    value = 'ITAR Hosting';
                  } else if (dbExists === 'mysql_disabled') {
                    value = 'MySQL Disabled';
                  } else if (dbExists === 'mysql_error') {
                    value = 'MySQL Error';
                  } else if (dbExists === 'batch_timeout') {
                    value = 'Batch Timeout';
                  } else if (dbExists === 'invalid_domain') {
                    value = 'Invalid Domain';
                  } else if (dbExists === 'unavailable') {
                    value = 'Unavailable';
                  } else if (dbExists === null) {
                    value = 'Error';
                  } else {
                    value = '—';
                  }
                } else {
                  value = item[key];
                }

                isMissing = value === undefined || value === null || value === '';

                // Special rendering for ID column - make it a clickable link
                if (key === 'id' && !isMissing && value !== '—') {
                  const customerUrl = `https://internal.cetecerpbeta.com/react/customer/${value}/view?newversion=1`;
                  return (
                    <td 
                      key={key} 
                      className="table-cell"
                      data-missing={isMissing}
                    >
                      <a 
                        href={customerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="customer-link"
                      >
                        {value}
                      </a>
                    </td>
                  );
                }

                return (
                  <td 
                    key={key} 
                    className="table-cell"
                    data-missing={isMissing}
                  >
                    {isMissing ? '—' : value}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DataTable;
