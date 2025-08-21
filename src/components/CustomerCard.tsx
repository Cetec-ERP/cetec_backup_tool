import React from 'react';
import residentDBsConfig from '../config/resident-dbs.json';

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
  // Check if a domain has a resident database mapping
  const hasResidentDatabase = (domain: string): boolean => {
    if (!residentDBsConfig || !domain) {
      return false;
    }
    
    const hasDB = domain.toLowerCase() in residentDBsConfig || 
           Object.keys(residentDBsConfig).some(key => key.toLowerCase() === domain.toLowerCase());
    
    return hasDB;
  };

  // Check if customer is unavailable for backups
  const isUnavailableForBackups = (): boolean => {
    const isItarHosting = Boolean(item.itar_hosting_bc);
    const isResidentHosting = Boolean(item.resident_hosting);
    const domain = item.domain;
    
    // First condition: ITAR hosting customers
    if (isItarHosting) {
      return true;
    }
    
    // Second condition: Resident hosting customers without database mapping
    if (isResidentHosting && domain) {
      return !hasResidentDatabase(domain);
    }
    
    return false;
  };

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
      return <span className="no-priority">No Support Tier</span>;
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
    // Check if customer is unavailable for backups
    if (isUnavailableForBackups()) {
      return null;
    }
    
    // If database exists and has been pulled before, show refresh button
    if (item.database_exists === true && item.lastPulled) {
      return (
        <button 
          className="action-button refresh"
          onClick={() => onActionClick(item)}
          title="Re-pull backup"
        >
          <svg className="refresh-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
            <path d="M21 3v5h-5"/>
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
            <path d="M3 21v-5h5"/>
          </svg>
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

  const renderProductionButton = () => {
    const domain = item.domain;
    if (!domain || domain === 'undefined' || domain.trim() === '') {
      return null;
    }

    const techxPassword = item.techx_password;
    if (!techxPassword) {
      return null;
    }

    // Determine the production URL based on domain format
    let productionUrl;
    if (domain.includes('.')) {
      // Domain contains a period - use the domain as-is
      productionUrl = `https://${domain}/auth/login?username=techx&password=${encodeURIComponent(techxPassword)}`;
    } else {
      // Domain doesn't contain a period - append .cetecerp.com
      productionUrl = `https://${domain}.cetecerp.com/auth/login?username=techx&password=${encodeURIComponent(techxPassword)}`;
    }
    
    return (
      <button
        className="production-button"
        onClick={() => window.open(productionUrl, '_blank', 'noopener,noreferrer')}
        title="Open Production Environment"
      >
        Production ↗
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
            {item.itar_hosting_bc && (
              <span className="itar-chip">
                {String(item.itar_hosting_bc)}
              </span>
            )}
          </div>
        </div>
        
        <div className="priority-chip-container">
          {renderPrioritySupport()}
        </div>
        
        <div className="card-actions">
          <div className="timestamp-display">
            {isUnavailableForBackups() ? (
              <span className="unavailable-text">Unavailable</span>
            ) : item.lastPulled ? (
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
            {renderProductionButton()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerCard;
