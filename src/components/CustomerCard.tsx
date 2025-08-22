import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface CustomerCardProps {
  item: any;
  hiddenDevelButtons: Set<string>;
  isPolling: boolean;
  onActionClick: (item: any) => void;
  onDatabaseStatusUpdate?: (customerId: string, databaseExists: any) => void;
  validationCache?: Map<string, { 
    reachable: boolean; 
    status?: number; 
    error?: string; 
    finalUrl?: string;
    reason?: string;
  }>;
}

const CustomerCard: React.FC<CustomerCardProps> = ({ 
  item, 
  hiddenDevelButtons, 
  isPolling, 
  onActionClick,
  onDatabaseStatusUpdate,
  validationCache
}) => {
  const techxPassword = import.meta.env.VITE_TECHX_PASSWORD;

  // Get validation status from cache instead of individual validation
  const getValidationStatus = () => {
    if (!validationCache || !item.domain) return 'pending';
    
    const result = validationCache.get(item.domain);
    if (!result) return 'pending';
    
    if (result.reachable) return 'valid';
    if (result.reason === 'redirected_to_main_site') return 'redirected';
    if (result.error || result.reason === 'api_error') return 'error';
    return 'invalid';
  };

  const linkValidationStatus = getValidationStatus();

  // Debug: Log initial customer data for specific test domains only
  useEffect(() => {
    const shouldLog = ['4p', 'ocdlabs', 'bristolmanufacturingllccom'].includes(item.domain?.toLowerCase());
    if (shouldLog) {
      console.log(`🏷️ [CustomerCard] ${item.name} (ID: ${item.id}) - Initial data:`, {
        domain: item.domain,
        database_exists: item.database_exists,
        itar_hosting_bc: item.itar_hosting_bc,
        resident_hosting: item.resident_hosting,
        priority_support: item.priority_support,
        validation_status: linkValidationStatus
      });
    }
  }, [item.id, item.name, item.domain, item.database_exists, item.itar_hosting_bc, item.resident_hosting, item.priority_support, linkValidationStatus]);

  // Remove the old validation logic - no more individual API calls

  const normalizePrioritySupport = (value: string): string => {
    if (!value || value === 'undefined' || value === 'null' || value === '0' || value === 'false') {
      return 'false';
    }
    
    const prioritySupport = String(value).toLowerCase().trim();
    
    if (prioritySupport === 'lite' || prioritySupport === 'l') {
      return 'lite';
    }
    
    if (prioritySupport === 'standard' || prioritySupport === 'std' || prioritySupport === 's') {
      return 'standard';
    }
    
    if (prioritySupport === 'enterprise' || prioritySupport === 'ent' || prioritySupport === 'e') {
      return 'enterprise';
    }
    
    return 'false';
  };

  const renderPrioritySupport = () => {
    const normalizedValue = normalizePrioritySupport(String(item.priority_support || ''));
    if (normalizedValue === 'false') {
      return <span className="no-priority">No support tier</span>;
    }
    
    return (
      <span className={`priority-chip ${normalizedValue}`}>
        {normalizedValue.charAt(0).toUpperCase() + normalizedValue.slice(1)}
      </span>
    );
  };

  const isUnavailableForBackups = (): boolean => {
    // ITAR hosting customers cannot pull backups
    if (item.itar_hosting_bc) {
      return true;
    }
    
    // Resident hosting customers with unavailable database cannot pull backups
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
    const shouldLog = ['4p', 'ocdlabs', 'bristolmanufacturingllccom'].includes(domain?.toLowerCase());
    
    if (!domain || domain === 'undefined' || domain.trim() === '') {
      if (shouldLog) {
        console.log(`🔍 [Devel Button] No domain for ${item.name} (ID: ${item.id})`);
      }
      return null;
    }

    const isItarHosting = Boolean(item.itar_hosting_bc);
    const isResidentHosting = Boolean(item.resident_hosting);
    const isDevelButtonHidden = hiddenDevelButtons.has(String(item.id));
    
    if (shouldLog) {
      console.log(`🔍 [Devel Button] ${item.name} (${domain}) - database_exists: "${item.database_exists}", itar: ${isItarHosting}, resident: ${isResidentHosting}, validationStatus: ${linkValidationStatus}`);
    }
    
    // Handle different database status values
    if (isItarHosting) {
      if (shouldLog) {
        console.log(`🚫 [Devel Button] ${item.name} - ITAR hosting, no devel button`);
      }
      return null;
    }
    
    if (isResidentHosting) {
      if (item.database_exists === 'resident_hosting') {
        if (shouldLog) {
          console.log(`🚫 [Devel Button] ${item.name} - Resident hosting, no devel button`);
        }
        return null; // Resident hosting customers don't get devel buttons
      } else {
        if (shouldLog) {
          console.log(`🚫 [Devel Button] ${item.name} - Unavailable resident hosting, no devel button`);
        }
        return null; // Unavailable resident hosting
      }
    }
    
    // For regular customers, show validation status or devel button
    // Handle both 'pending_validation' and other values that need validation
    if (item.database_exists === 'pending_validation' || 
        item.database_exists === false || 
        item.database_exists === 'unavailable' ||
        item.database_exists === 'error' ||
        item.database_exists === 'validation_error') {
      if (shouldLog) {
        console.log(`⏳ [Devel Button] ${item.name} - Needs validation, status: ${linkValidationStatus}`);
      }
      if (linkValidationStatus === 'pending') {
        return (
          <button className="devel-button pending" disabled>
            Pending...
          </button>
        );
      } else if (linkValidationStatus === 'valid') {
        // Show devel button if validation succeeded
        if (isDevelButtonHidden) {
          return null;
        }
        
        const customerUrl = `http://${domain}.cetecerpdevel.com/auth/login?username=techx&password=${encodeURIComponent(techxPassword)}`;
        if (shouldLog) {
          console.log(`✅ [Devel Button] ${item.name} - Validation successful, showing devel button`);
        }
        return (
          <button
            className="devel-button"
            onClick={() => window.open(customerUrl, '_blank', 'noopener,noreferrer')}
            title="Open Devel Environment"
          >
            Devel ↗
          </button>
        );
      } else if (linkValidationStatus === 'invalid') {
        if (shouldLog) {
          console.log(`❌ [Devel Button] ${item.name} - Validation failed, showing unreachable button`);
        }
        return (
          <button className="devel-button invalid" disabled title="Devel environment unreachable">
            Unreachable
          </button>
        );
      } else if (linkValidationStatus === 'redirected') {
        if (shouldLog) {
          console.log(`🔄 [Devel Button] ${item.name} - Redirected to main site, no button shown`);
        }
        return null; // Don't show any button for redirected domains
      } else if (linkValidationStatus === 'error') {
        if (shouldLog) {
          console.log(`🚨 [Devel Button] ${item.name} - Validation error, showing error button`);
        }
        return (
          <button className="devel-button error" disabled title="Validation error">
            Error
          </button>
        );
      }
    }
    
    // For customers with existing database status (from previous MySQL checks)
    if (item.database_exists === true && !isDevelButtonHidden) {
      const customerUrl = `http://${domain}.cetecerpdevel.com/auth/login?username=techx&password=${encodeURIComponent(techxPassword)}`;
      if (shouldLog) {
        console.log(`✅ [Devel Button] ${item.name} - Database exists, showing devel button`);
      }
      return (
        <button
          className="devel-button"
          onClick={() => window.open(customerUrl, '_blank', 'noopener,noreferrer')}
          title="Open Devel Environment"
        >
          Devel ↗
        </button>
      );
    }
    
    if (shouldLog) {
      console.log(`🚫 [Devel Button] ${item.name} - No conditions met, no button shown`);
    }
    return null;
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
          {renderPrioritySupport()}
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
