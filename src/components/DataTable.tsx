import React from 'react';

interface DataTableProps {
  data: any[];
  title?: string;
  columns?: string[]; // Optional array of column keys to display
}

const DataTable: React.FC<DataTableProps> = ({ data, title = "Data", columns }) => {
  // Function to safely get values from objects, handling missing properties and null values
  const getValue = (item: any, key: string): string => {
    if (!item || typeof item !== 'object') return '—';
    if (!item.hasOwnProperty(key)) return '—';
    if (item[key] === null || item[key] === undefined) return '—';
    if (item[key] === '') return '—';
    return String(item[key]);
  };

  // Function to format column headers for better readability
  const formatColumnHeader = (key: string): string => {
    const headerMap: { [key: string]: string } = {
      'id': 'ID',
      'name': 'Customer Name',
      'num_prod_users': 'Production Users',
      'num_full_users': 'Full Users',
      'total_users': 'Total Users',
      'domain': 'Domain',
      'ok_to_bill': 'OK to Bill',
      'priority_support': 'Priority Support',
      'resident_hosting': 'Resident Hosting',
      'test_environment': 'Test Environment',
      'test_domain': 'Test Domain',
      'itar_hosting_bc': 'ITAR Hosting BC'
    };
    
    // Return mapped header if available, otherwise format generically
    return headerMap[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Function to render data as a table
  const renderDataTable = (data: any[]) => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return <p>No data available</p>;
    }

    // Always use the specified columns, even if they don't exist in the data
    let keys: string[];
    if (columns && columns.length > 0) {
      // Use all specified columns, regardless of whether they exist in the data
      keys = [...columns];
    } else {
      // Fall back to showing all available keys (original behavior)
      const allKeys = new Set<string>();
      data.forEach(item => {
        if (item && typeof item === 'object') {
          Object.keys(item).forEach(key => allKeys.add(key));
        }
      });
      keys = Array.from(allKeys).sort();
    }

    // Add computed columns if the required fields are specified
    const computedKeys: string[] = [];
    if (keys.includes('num_prod_users') && keys.includes('num_full_users')) {
      computedKeys.push('total_users');
    }
    const allKeys = [...keys, ...computedKeys];

    return (
      <div className="table-container">
        <table className="data-table">
                    <thead>
            <tr>
              {allKeys.map(key => (
                <th key={key} className="table-header">
                  {key === 'total_users' ? 'Total Users' : formatColumnHeader(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr key={index} className="table-row">
                {allKeys.map(key => {
                  const value = key === 'total_users' 
                    ? (() => {
                        const prodUsers = parseInt(getValue(item, 'num_prod_users')) || 0;
                        const fullUsers = parseInt(getValue(item, 'num_full_users')) || 0;
                        return prodUsers + fullUsers;
                      })()
                    : getValue(item, key);
                  
                  const isMissing = value === '—';
                  
                  return (
                    <td 
                      key={key} 
                      className="table-cell"
                      data-missing={isMissing}
                    >
                      {value}
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

    return (
    <div className="data-container">
      <div className="data-header-container">
        <h2 className="data-header">{title}</h2>
      </div>

      {renderDataTable(data)}
    </div>
  );
};

export default DataTable;
