import React, { useState, useEffect, useRef } from 'react';
import residentDBsConfig from '../config/resident-dbs.json';

interface SearchAndFilterProps {
  data: any[];
  onFilterChange: (filteredData: any[]) => void;
}

const SearchAndFilter: React.FC<SearchAndFilterProps> = ({ data, onFilterChange }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({
    priority_support: '',
    resident_hosting: '',
    test_environment: '',
    itar_hosting_bc: '',
    database_exists: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setShowFilters(false);
      }
    };

    if (showFilters) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFilters]);

  // Position modal within viewport bounds
  useEffect(() => {
    if (showFilters && modalRef.current && buttonRef.current) {
      const modal = modalRef.current;
      const button = buttonRef.current;
      const buttonRect = button.getBoundingClientRect();
      const modalRect = modal.getBoundingClientRect();
      
      // Reset any previous positioning
      modal.style.right = '';
      modal.style.left = '';
      
      // Default: position to the right of the button
      modal.style.left = '0';
      
      // Check if modal extends beyond right edge of viewport
      if (buttonRect.left + modalRect.width > window.innerWidth) {
        // Position to the left of the button if it would go off-screen to the right
        modal.style.left = 'auto';
        modal.style.right = '0';
      }
    }
  }, [showFilters]);

  // Get unique values for each filterable column
  const getUniqueValues = (column: string) => {
    if (column === 'priority_support') {
      // Return priority support values in specific order
      return ['Lite', 'Standard', 'Enterprise'];
    }
    
    const values = new Set<string>();
    data.forEach(item => {
      if (item[column] !== undefined && item[column] !== null && item[column] !== '') {
        let value = String(item[column]);
        
        // Normalize priority_support values
        if (column === 'priority_support') {
          value = normalizePrioritySupport(value);
          // Only add valid priority support values
          if (value !== 'false') {
            values.add(value);
          }
        } else {
          values.add(value);
        }
      }
    });
    return Array.from(values).sort();
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

  // Check if a domain has a resident database mapping
  const hasResidentDatabase = (domain: string): boolean => {
    if (!residentDBsConfig || !domain) {
      return false;
    }
    
    const hasDB = domain.toLowerCase() in residentDBsConfig || 
           Object.keys(residentDBsConfig).some(key => key.toLowerCase() === domain.toLowerCase());
    
    return hasDB;
  };

  // Apply filters and search
  useEffect(() => {
    let filteredData = [...data];

    // Apply text search (customer name and domain)
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filteredData = filteredData.filter(item => {
        const name = String(item.name || '').toLowerCase();
        const domain = String(item.domain || '').toLowerCase();
        return name.includes(searchLower) || domain.includes(searchLower);
      });
    }

    // Apply column filters
    Object.entries(filters).forEach(([column, value]) => {
      if (value && value !== '') {
        filteredData = filteredData.filter(item => {
          if (column === 'priority_support') {
            // Normalize the item's priority support value for comparison
            const normalizedItemValue = normalizePrioritySupport(String(item[column] || ''));
            return normalizedItemValue === value;
          } else if (column === 'resident_hosting') {
            // Handle resident_hosting specifically - convert both values to numbers for comparison
            const filterValue = parseInt(value);
            const itemValue = item[column];
            
            if (filterValue === 1) {
              // Filter for "Yes" - show items with resident_hosting === 1 or === true
              return itemValue === 1 || itemValue === true;
            } else if (filterValue === 0) {
              // Filter for "No" - show items with resident_hosting !== 1 and !== true
              return itemValue !== 1 && itemValue !== true;
            }
            return true;
          } else if (column === 'database_exists') {
            // Handle database_exists specifically - distinguish between different statuses
            const itemValue = item[column];
            
            if (value === 'true') {
              // Filter for "Yes" - show items with database_exists === true
              return itemValue === true;
            } else if (value === 'false') {
              // Filter for "No" - show items with database_exists === false (no backup available)
              return itemValue === false;
            } else if (value === 'unavailable') {
              // Filter for "Unavailable" - show items that are ITAR or resident hosting without database mapping
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
            } else if (value === 'resident_hosting') {
              // Filter for "Resident Hosting" - show items with database_exists === 'resident_hosting'
              return itemValue === 'resident_hosting';
            } else if (value === 'itar_hosting') {
              // Filter for "ITAR Hosting" - show items with database_exists === 'itar_hosting'
              return itemValue === 'itar_hosting';
            }
            return true;
          } else if (column === 'itar_hosting_bc') {
            // Handle itar_hosting_bc specifically
            const itemValue = item[column];
            return itemValue === value;
          } else if (column === 'test_environment') {
            // Handle test_environment specifically
            const itemValue = item[column];
            return itemValue === value;
          } else {
            const itemValue = String(item[column] || '');
            return itemValue === value;
          }
        });
      }
    });

    onFilterChange(filteredData);
  }, [searchTerm, filters, data, onFilterChange]);

  const clearAllFilters = () => {
    setSearchTerm('');
    setFilters({
      priority_support: '',
      resident_hosting: '',
      test_environment: '',
      itar_hosting_bc: '',
      database_exists: ''
    });
  };

  const hasActiveFilters = searchTerm.trim() || Object.values(filters).some(value => value !== '');

  return (
    <div className="search-filter-container">
      {/* Search Section - Always Visible */}
      <div className="search-section">
        <div className="search-input-group">
          <input
            id="search"
            type="text"
            placeholder="Search customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filter-button-container" ref={modalRef}>
          <button 
            type="button"
            className="filter-toggle-btn"
            onClick={() => setShowFilters(!showFilters)}
            ref={buttonRef}
          >
            {showFilters ? 'Hide Filters' : 'Filters'}
          </button>
          
          {/* Floating Filter Modal */}
          {showFilters && (
            <div className="filter-modal">
              <div className="filter-modal-header">
                <h3>Filters</h3>
                <button 
                  className="close-modal-btn"
                  onClick={() => setShowFilters(false)}
                >
                  ×
                </button>
              </div>
              
              <div className="filter-modal-content">
                <div className="filter-row">
                  <div className="filter-group">
                    <label htmlFor="priority-support-filter" className="filter-label">
                      Support Tier
                    </label>
                    <select
                      id="priority-support-filter"
                      value={filters.priority_support}
                      onChange={(e) => setFilters(prev => ({ ...prev, priority_support: e.target.value }))}
                      className="filter-select"
                    >
                      <option value="">All</option>
                      <option value="Lite">Lite</option>
                      <option value="Standard">Standard</option>
                      <option value="Enterprise">Enterprise</option>
                    </select>
                  </div>

                  <div className="filter-group">
                    <label htmlFor="resident-hosting-filter" className="filter-label">
                      Resident
                    </label>
                    <select
                      id="resident-hosting-filter"
                      value={filters.resident_hosting}
                      onChange={(e) => setFilters(prev => ({ ...prev, resident_hosting: e.target.value }))}
                      className="filter-select"
                    >
                      <option value="">All</option>
                      <option value="1">Yes</option>
                      <option value="0">No</option>
                    </select>
                  </div>

                  <div className="filter-group">
                    <label htmlFor="database_exists" className="filter-label">Backup</label>
                    <select
                      id="database_exists"
                      value={filters.database_exists}
                      onChange={(e) => setFilters({ ...filters, database_exists: e.target.value })}
                      className="filter-select"
                    >
                      <option value="">All</option>
                      {getUniqueValues('database_exists').map(value => {
                        let displayValue = value;
                        const stringValue = String(value);
                        if (stringValue === 'true') {
                          displayValue = 'Yes';
                        } else if (stringValue === 'false') {
                          displayValue = 'No';
                        } else if (stringValue === 'resident_hosting') {
                          displayValue = 'Resident Hosting';
                        } else if (stringValue === 'itar_hosting') {
                          displayValue = 'ITAR Hosting';
                        } else if (stringValue === 'mysql_disabled') {
                          displayValue = 'MySQL Disabled';
                        } else if (stringValue === 'mysql_error') {
                          displayValue = 'MySQL Error';
                        } else if (stringValue === 'batch_timeout') {
                          displayValue = 'Batch Timeout';
                        } else if (stringValue === 'invalid_domain') {
                          displayValue = 'Invalid Domain';
                        } else if (stringValue === 'unavailable') {
                          displayValue = 'Unavailable';
                        }
                        return <option key={value} value={value}>{displayValue}</option>;
                      })}
                    </select>
                  </div>

                  <div className="filter-group">
                    <label htmlFor="itar_hosting_bc" className="filter-label">ITAR</label>
                    <select
                      id="itar_hosting_bc"
                      value={filters.itar_hosting_bc}
                      onChange={(e) => setFilters({ ...filters, itar_hosting_bc: e.target.value })}
                      className="filter-select"
                    >
                      <option value="">All</option>
                      {getUniqueValues('itar_hosting_bc').map(value => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </div>

                  <div className="filter-group">
                    <label htmlFor="test_environment" className="filter-label">Test Environment</label>
                    <select
                      id="test_environment"
                      value={filters.test_environment}
                      onChange={(e) => setFilters({ ...filters, test_environment: e.target.value })}
                      className="filter-select"
                    >
                      <option value="">All</option>
                      {getUniqueValues('test_environment').map(value => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="filter-actions">
                  <button onClick={clearAllFilters} className="clear-filters-btn" disabled={!hasActiveFilters}>
                    🗑️ Clear All Filters
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchAndFilter;
