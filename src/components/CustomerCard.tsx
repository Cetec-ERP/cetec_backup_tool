import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

interface CustomerCardProps {
  item: any;
  hiddenDevelButtons: Set<string>;
  isPolling: boolean;
  onActionClick: (item: any) => void;
  onDatabaseStatusUpdate?: (customerId: string, databaseExists: any) => void;
  validationCache?: Map<string, { 
    reachable: boolean | undefined; 
    status?: number; 
    error?: string; 
    finalUrl?: string;
    reason?: string;
  }>;
  addToValidationQueue: (customerId: string) => void;
  isValidationActive: boolean;
  activeValidations?: Set<string>;
}

const CustomerCard: React.FC<CustomerCardProps> = ({ 
  item, 
  hiddenDevelButtons, 
  isPolling, 
  onActionClick,
  onDatabaseStatusUpdate,
  validationCache,
  addToValidationQueue,
  isValidationActive,
  activeValidations
}) => {
  const techxPassword = import.meta.env.VITE_TECHX_PASSWORD;

  // Track if this customer has already been queued for validation
  const [hasQueuedValidation, setHasQueuedValidation] = useState(false);
  
  // Track the last time this customer was validated to prevent rapid re-validations
  const lastValidationTime = useRef<number>(0);

  // Trigger automatic validation when component mounts if needed
  useEffect(() => {
    // Only validate if:
    // 1. Customer needs validation (pending_validation status)
    // 2. Not already being validated
    // 3. Has a valid domain
    // 4. Haven't already queued this validation
    // 5. Status is still pending (not already validated)
    // 6. Not ITAR hosting (which doesn't need validation)
    // 7. Haven't validated this customer recently (within last 5 seconds)
    const now = Date.now();
    if (!hasQueuedValidation && 
        item.database_exists === 'pending_validation' && 
        item.domain && 
        item.domain.trim() !== '' && 
        item.domain !== 'undefined' &&
        !item.itar_hosting_bc &&
        !activeValidations?.has(String(item.id)) &&
        (now - lastValidationTime.current) > 5000) { // 5 second cooldown
      
      // Add a small delay to prevent too many rapid validations
      const timeoutId = setTimeout(() => {
        // Add to validation queue and mark as queued
        addToValidationQueue(String(item.id));
        setHasQueuedValidation(true);
        lastValidationTime.current = now;
      }, 100); // 100ms delay
      
      return () => clearTimeout(timeoutId);
    }
    
    // Reset the flag if the status changes from pending to something else
    if (hasQueuedValidation && item.database_exists !== 'pending_validation') {
      setHasQueuedValidation(false);
    }
  }, [item.id, item.domain, item.database_exists, item.itar_hosting_bc, item.resident_hosting, addToValidationQueue, hasQueuedValidation, activeValidations]);

  // Handle cases where a customer's status changes and they might need re-validation
  useEffect(() => {
    // If a customer's status changes back to pending_validation and we haven't queued them yet
    const now = Date.now();
    if (item.database_exists === 'pending_validation' && 
        !hasQueuedValidation && 
        !activeValidations?.has(String(item.id)) &&
        item.domain && 
        item.domain.trim() !== '' && 
        item.domain !== 'undefined' &&
        !item.itar_hosting_bc &&
        (now - lastValidationTime.current) > 5000) { // 5 second cooldown
      
      // Add a small delay to prevent too many rapid validations
      const timeoutId = setTimeout(() => {
        addToValidationQueue(String(item.id));
        setHasQueuedValidation(true);
        lastValidationTime.current = now;
      }, 200); // 200ms delay for status changes
      
      return () => clearTimeout(timeoutId);
    }
  }, [item.database_exists, hasQueuedValidation, activeValidations, item.id, item.domain, item.itar_hosting_bc, addToValidationQueue]);

  // Get validation status from cache instead of individual validation
  const getValidationStatus = () => {
    if (!validationCache || !item.domain) {
      return 'pending';
    }
    
    const result = validationCache.get(item.domain);
    if (!result) {
      return 'pending';
    }
    
    if (result.reachable) return 'valid';
    if (result.reason === 'redirected_to_main_site') return 'redirected';
    if (result.error || result.reason === 'api_error') return 'error';
    return 'invalid';
  };

  const linkValidationStatus = getValidationStatus();

  const renderDevelButton = () => {
    const domain = item.domain;
    
    if (!domain || domain === 'undefined' || domain.trim() === '') {
      return null;
    }

    const isItarHosting = Boolean(item.itar_hosting_bc);
    const isResidentHosting = Boolean(item.resident_hosting);
    const isDevelButtonHidden = hiddenDevelButtons.has(String(item.id));
    
    // Handle different database status values
    if (isItarHosting) {
      return null;
    }
    
    // Resident hosting customers can have devel buttons if they have an entry in resident-dbs.json
    // Only block them if they don't have a database or if they're marked as unavailable
    if (isResidentHosting) {
      if (item.database_exists === 'unavailable') {
        return null; // Resident hosting with unavailable database
      }
      // If they have any other database status, they can potentially get a devel button
      // (pending_validation, false, error, validation_error, or true)
    }

    // Handle confirmed environment readiness (database_exists === true)
    if (item.database_exists === true && !isDevelButtonHidden) {
      const customerUrl = `http://${domain}.cetecerpdevel.com/auth/login?username=techx&password=${encodeURIComponent(techxPassword)}`;
      return (
        <button
          className="devel-button valid"
          onClick={() => window.open(customerUrl, '_blank')}
          title="Open devel environment"
        >
          Devel
        </button>
      );
    }

    // Handle resident hosting customers with confirmed database
    if (item.database_exists === 'resident_hosting' && !isDevelButtonHidden) {
      const customerUrl = `http://${domain}.cetecerpdevel.com/auth/login?username=techx&password=${encodeURIComponent(techxPassword)}`;
      return (
        <button
          className="devel-button valid"
          onClick={() => window.open(customerUrl, '_blank')}
          title="Open devel environment"
        >
          Devel
        </button>
        );
    }

    // Handle pending validation cases - show pending button with spinner
    if (item.database_exists === 'pending_validation') {
      // Check if this customer is currently being validated
      const isCurrentlyValidating = isValidationActive && activeValidations?.has(String(item.id));
      
      if (isCurrentlyValidating) {
        return (
          <button className="devel-button pending" disabled title="Validating devel environment...">
            <span className="spinner"></span>
            Pending
          </button>
        );
      }
      
      return (
        <button 
          className="devel-button pending" 
          onClick={() => {
            // Manually trigger validation when user clicks
            if (addToValidationQueue) {
              const now = Date.now();
              if ((now - lastValidationTime.current) > 5000) { // 5 second cooldown
                addToValidationQueue(String(item.id));
                setHasQueuedValidation(true);
                lastValidationTime.current = now;
              }
            }
          }}
          title="Click to validate devel environment"
        >
          <span className="spinner"></span>
          Pending
        </button>
      );
    }

    // For all other cases (false, unavailable, error, etc.), don't show any button
    // This includes environments that are not ready, unavailable, or had validation errors
    return null;
  };

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
