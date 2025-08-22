import React from 'react';

interface TableRowProps {
  item: any;
  columnsToShow: string[];
  hiddenDevelButtons: Set<string>;
  onActionClick: (item: any) => void;
  onTimestampUpdate?: (customerId: string, timestamp: string) => void;
  onDatabaseStatusUpdate?: (customerId: string, databaseExists: any) => void;
}

const TableRow: React.FC<TableRowProps> = ({ 
  item, 
  columnsToShow, 
  hiddenDevelButtons, 
  onActionClick 
}) => {
  // Normalize priority support values to only valid options
  const normalizePrioritySupport = (value: string): string => {
    const normalizedValue = value.toLowerCase().trim();
    
    // Map valid values
    if (normalizedValue === 'lite' || normalizedValue === 'l') {
      return 'Lite';
    } else if (normalizedValue === 'standard' || normalizedValue === 'std' || normalizedValue === 's') {
      return 'Standard';
    } else if (normalizedValue === 'enterprise' || normalizedValue === 'ent' || normalizedValue === 'e') {
      return 'Enterprise';
    }
    
    // Return 'false' for any invalid values
    return 'false';
  };

  const renderCell = (key: string) => {
    if (key === 'actions') {
      // Check if we should show the action button
      const isItarHosting = Boolean(item.itar_hosting_bc);
      const isDatabaseUnavailable = item.database_exists === 'unavailable';
      
      // Don't show button for ITAR hosting or unavailable database rows
      if (isItarHosting || isDatabaseUnavailable) {
        return (
          <td key={key} className="table-cell">
            <span className="no-action">—</span>
          </td>
        );
      }
      
      // Get timestamp info for helper text
      const lastPulled = item.lastPulled;
      const timestampText = lastPulled 
        ? `Last pulled: ${new Date(lastPulled).toLocaleDateString()} ${new Date(lastPulled).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : 'Never pulled';
      
      return (
        <td key={key} className="table-cell">
          <div className="action-button-container">
            <button 
              className="action-button"
              onClick={() => onActionClick(item)}
            >
              Pull
            </button>
            <div className="timestamp-helper">
              {timestampText}
            </div>
          </div>
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
      const domain = item.domain;
      if (!domain || domain === 'undefined' || domain.trim() === '') {
        return (
          <td key={key} className="table-cell">
            <span className="no-action">—</span>
          </td>
        );
      }

      const isItarHosting = Boolean(item.itar_hosting_bc);
      const isResidentHosting = Boolean(item.resident_hosting);
      const databaseExists = item.database_exists === true;
      const isDevelButtonHidden = hiddenDevelButtons.has(String(item.id));
      
      // Don't show button for ITAR hosting, resident hosting without database mapping, when database doesn't exist, or if temporarily hidden
      if (isItarHosting || (isResidentHosting && !databaseExists) || !databaseExists || isDevelButtonHidden) {
        return (
          <td key={key} className="table-cell">
            <span className="no-action">—</span>
          </td>
        );
      }

      const customerUrl = `http://${domain}.cetecerpdevel.com`;

      return (
        <td key={key} className="table-cell">
          <button
            className="devel-environment-btn"
            onClick={() => window.open(customerUrl, '_blank', 'noopener,noreferrer')}
          >
            Devel
          </button>
        </td>
      );
    } else if (key === 'priority_support') {
      // Normalize priority support values
      const normalizedValue = normalizePrioritySupport(String(item[key] || ''));
      if (normalizedValue === 'false') {
        return (
          <td key={key} className="table-cell">
            <span className="no-action">—</span>
          </td>
        );
      }
      value = normalizedValue;
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
  };

  return (
    <tr className="table-row">
      {columnsToShow.map(key => renderCell(key))}
    </tr>
  );
};

export default TableRow;
