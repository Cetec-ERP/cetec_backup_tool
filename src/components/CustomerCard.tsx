import React from 'react';

interface CustomerCardProps {
  item: any;
  hiddenDevelButtons: Set<string>;
  onActionClick: (item: any) => void;
  onTimestampUpdate?: (customerId: string, timestamp: string) => void;
  onDatabaseStatusUpdate?: (customerId: string, databaseExists: any) => void;
}

const CustomerCard: React.FC<CustomerCardProps> = ({ 
  item, 
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

  const renderPrioritySupport = () => {
    const normalizedValue = normalizePrioritySupport(String(item.priority_support || ''));
    if (normalizedValue === 'false') {
      return <span className="no-priority">No Priority Support</span>;
    }
    
    return (
      <span className={`priority-badge ${normalizedValue.toLowerCase()}`}>
        {normalizedValue}
      </span>
    );
  };

  const renderDatabaseStatus = () => {
    const domain = item.domain;
    if (!domain || domain === 'undefined' || domain.trim() === '') {
      return <span className="status-badge unavailable">No Domain</span>;
    }

    const isItarHosting = Boolean(item.itar_hosting_bc);
    const isResidentHosting = Boolean(item.resident_hosting);
    const databaseExists = item.database_exists === true;
    const isDevelButtonHidden = hiddenDevelButtons.has(String(item.id));
    
    if (isItarHosting) {
      return <span className="status-badge itar">ITAR Hosting</span>;
    }
    
    if (isResidentHosting && !databaseExists) {
      return <span className="status-badge resident">Resident Hosting</span>;
    }
    
    if (!databaseExists) {
      return <span className="status-badge no-database">No Database</span>;
    }
    
    return <span className="status-badge has-database">Has Database</span>;
  };

  const renderActions = () => {
    const isItarHosting = Boolean(item.itar_hosting_bc);
    const isDatabaseUnavailable = item.database_exists === 'unavailable';
    
    if (isItarHosting || isDatabaseUnavailable) {
      return null;
    }
    
    // If database exists and has been pulled before, show refresh icon
    if (item.database_exists === true && item.lastPulled) {
      return (
        <button 
          className="refresh-icon-button"
          onClick={() => onActionClick(item)}
          title="Re-pull backup"
        >
          🔄
        </button>
      );
    }
    
    // Otherwise show Pull Backup button
    return (
      <button 
        className="action-button primary"
        onClick={() => onActionClick(item)}
      >
        Pull Backup
      </button>
    );
  };

  const renderDevelButton = () => {
    const domain = item.domain;
    if (!domain || domain === 'undefined' || domain.trim() === '') {
      return null;
    }

    const isItarHosting = Boolean(item.itar_hosting_bc);
    const isResidentHosting = Boolean(item.resident_hosting);
    const databaseExists = item.database_exists === true;
    const isDevelButtonHidden = hiddenDevelButtons.has(String(item.id));
    
    if (isItarHosting || (isResidentHosting && !databaseExists) || !databaseExists || isDevelButtonHidden) {
      return null;
    }

    const customerUrl = `http://${domain}.cetecerpdevel.com`;
    
    return (
      <button
        className="devel-button"
        onClick={() => window.open(customerUrl, '_blank', 'noopener,noreferrer')}
        title="Open Devel Environment"
      >
        Devel ↗
      </button>
    );
  };

  const totalUsers = Math.round(Number(item.num_prod_users || 0) + Number(item.num_full_users || 0));

  return (
    <div className="customer-card">
      <div className="card-header">
        <div className="customer-info">
          <h3 className="customer-name">
            {item.name}
          </h3>
          <div className="customer-details">
            <a 
              href={`https://internal.cetecerpbeta.com/react/customer/${item.id}/view?newversion=1`}
              target="_blank"
              rel="noopener noreferrer"
              className="customer-link"
            >
              #{item.id}
            </a>
            <span className="total-users">{totalUsers} users</span>
          </div>
        </div>
        
        <div className="priority-chip-container">
          {renderPrioritySupport()}
        </div>
        
        <div className="card-actions">
          <div className="timestamp-display">
            {item.lastPulled ? (
              <span className="timestamp-text">
                {new Date(item.lastPulled).toLocaleDateString()}
              </span>
            ) : (
              <span className="no-timestamp">Never pulled</span>
            )}
          </div>
          
          <div className="action-buttons">
            {renderActions()}
            {renderDevelButton()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerCard;
