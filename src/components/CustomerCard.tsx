import React from 'react';

interface CustomerCardProps {
  item: any;
  hiddenDevelButtons: Set<string>;
  isPolling: boolean;
  onActionClick: (item: any) => void;
}

const CustomerCard: React.FC<CustomerCardProps> = ({ 
  item, 
  hiddenDevelButtons, 
  isPolling, 
  onActionClick
}) => {
  const techxPassword = import.meta.env.VITE_TECHX_PASSWORD;

  const isUnavailableForBackups = (): boolean => {
    if (item.resident_hosting && item.database_exists === 'unavailable') {
      return true;
    }
    return false;
  };

  const renderActions = () => {
    if (isUnavailableForBackups()) {
      return null;
    }
    
    // If polling is active, show disabled "Pulling..." button with spinner
    if (isPolling) {
      if (item.database_exists === true && item.lastPulled) {
        return (
          <button 
            className="action-button refresh"
            disabled
            title="Backup in progress..."
          >
            <div className="polling-spinner"></div>
            Pulling...
          </button>
        );
      }
      
      return (
        <button 
          className="action-button primary"
          disabled
          title="Backup in progress..."
        >
          <div className="polling-spinner"></div>
          Pulling...
        </button>
      );
    }
    
    // Normal state - show enabled buttons
    if (item.database_exists === true && item.lastPulled) {
      return (
        <button 
          className="action-button refresh"
          onClick={() => onActionClick(item)}
          title="Re-pull backup"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="button-icon">
            <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
            <polyline points="12,15 12,8"/>
            <polyline points="9,12 12,15 15,12"/>
          </svg>
          Pull Again
        </button>
      );
    }
    
    return (
      <button 
        className="action-button primary"
        onClick={() => onActionClick(item)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="button-icon">
          <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
          <polyline points="12,15 12,8"/>
          <polyline points="9,12 12,15 15,12"/>
        </svg>
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

    const customerUrl = `http://${domain}.cetecerpdevel.com/auth/login?username=techx&password=${encodeURIComponent(techxPassword)}`;
    
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

    const techxProdPassword = item.techx_password;
    if (!techxProdPassword) {
      return null;
    }

    let productionUrl;
    const isResidentHosting = Boolean(item.resident_hosting);
    
    if (isResidentHosting) {
        if (domain.includes('.')) {
            productionUrl = `https://${domain}/auth/login?username=techx&password=${encodeURIComponent(techxProdPassword)}`;
        } else {
            productionUrl = `https://cetecerp.${domain}.com/auth/login?username=techx&password=${encodeURIComponent(techxProdPassword)}`;
        }
    } else {
        productionUrl = `https://${domain}.cetecerp.com/auth/login?username=techx&password=${encodeURIComponent(techxProdPassword)}`;
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

  const renderTestButton = () => {
    const domain = item.domain;
    if (!domain || domain === 'undefined' || domain.trim() === '') {
      return null;
    }

    const testEnvironment = item.test_environment;
    const isResidentHosting = Boolean(item.resident_hosting);
    
    if (!isResidentHosting) {
      if (!testEnvironment || testEnvironment === '0' || testEnvironment === 0) {
        return null;
      }
    }

    let buttonText = 'Test ↗';
    if (testEnvironment && testEnvironment !== '0' && testEnvironment !== 0) {
      if (testEnvironment === 'Update Nightly') {
        buttonText = 'Test (nightly) ↗';
      } else if (testEnvironment === 'Pause Updates') {
        buttonText = 'Test (paused) ↗';
      } else if (testEnvironment === 'Update Weekly') {
        buttonText = 'Test (weekly) ↗';
      }
    }

    if (isResidentHosting && domain.includes('.')) {
      return (
        <button
          className="test-button disabled"
          disabled
          title="Test environment not available for this domain format"
        >
          {buttonText}
        </button>
      );
    }

    let testUrl;
    if (isResidentHosting) {
      testUrl = `https://cetecerp-beta.${domain}.com/auth/login?username=techx&password=${encodeURIComponent(techxPassword)}`;
    } else {
      testUrl = `https://${domain}_test.cetecerp.com/auth/login?username=techx&password=${encodeURIComponent(techxPassword)}`;
    }
    
    return (
      <button
        className="test-button"
        onClick={() => window.open(testUrl, '_blank', 'noopener,noreferrer')}
        title="Open Test Environment"
      >
        {buttonText}
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
          {/* Removed renderPrioritySupport as it was removed from props */}
        </div>
        
        <div className="card-actions">
          <div className="timestamp-display">
            {isUnavailableForBackups() ? (
              <span className="unavailable-text">Backup Unavailable</span>
            ) : item.lastPulled ? (
              <span className="timestamp-text">
                {new Date(item.lastPulled).toLocaleDateString()} {new Date(item.lastPulled).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            ) : (
              <span className="no-timestamp">Never pulled</span>
            )}
          </div>
          
          <div className="action-buttons">
            {renderActions()}
            {renderDevelButton()}
            {renderProductionButton()}
            {renderTestButton()}

          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerCard;
