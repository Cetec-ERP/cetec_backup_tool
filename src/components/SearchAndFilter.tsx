import React, { useState, useEffect, useRef } from 'react';

interface Customer {
  id: string | number;
  name: string;
  domain: string;
  database_exists: boolean | string | null;
  itar_hosting_bc?: boolean;
  resident_hosting?: boolean;
  priority_support?: string;
  test_environment?: boolean | string;
}

interface SearchAndFilterProps {
  data: Customer[];
  onFilterChange: (filteredData: Customer[]) => void;
  onRefresh: () => void;
  loading: boolean;
}

const SearchAndFilter: React.FC<SearchAndFilterProps> = ({ data, onFilterChange, onRefresh, loading }) => {
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

  useEffect(() => {
    if (showFilters && modalRef.current && buttonRef.current) {
      const modal = modalRef.current;
      const button = buttonRef.current;
      const buttonRect = button.getBoundingClientRect();
      const modalRect = modal.getBoundingClientRect();
      
      modal.style.right = '';
      modal.style.left = '';
      
      modal.style.left = '0';
      
      if (buttonRect.left + modalRect.width > window.innerWidth) {
        modal.style.left = 'auto';
        modal.style.right = '0';
      }
    }
  }, [showFilters]);

  const getUniqueValues = (column: string) => {
    if (column === 'priority_support') {
      return ['Lite', 'Standard', 'Enterprise'];
    }
    
    const values = new Set<string>();
    data.forEach(item => {
      const itemValue = item[column as keyof Customer];
      if (itemValue !== undefined && itemValue !== null && itemValue !== '') {
        let value = String(itemValue);
        
        if (column === 'priority_support') {
          value = normalizePrioritySupport(value);
          if (value !== 'false') {
            values.add(value);
          }
        } else if (column === 'test_environment') {
          if (value && value !== '0' && value !== 'false') {
            values.add(value);
          }
        } else {
          values.add(value);
        }
      }
    });
    return Array.from(values).sort();
  };

  const normalizePrioritySupport = (value: string): string => {
    const normalizedValue = value.toLowerCase().trim();
    
    if (normalizedValue === 'lite' || normalizedValue === 'l') {
      return 'Lite';
    } else if (normalizedValue === 'standard' || normalizedValue === 'std' || normalizedValue === 's') {
      return 'Standard';
    } else if (normalizedValue === 'enterprise' || normalizedValue === 'ent' || normalizedValue === 'e') {
      return 'Enterprise';
    }
    
    return 'false';
  };

  const applyFilters = () => {
    let filtered = data.filter(item => {
      // Search term filter
      if (searchTerm.trim()) {
        const searchLower = searchTerm.toLowerCase();
        const nameMatch = item.name.toLowerCase().includes(searchLower);
        const domainMatch = item.domain.toLowerCase().includes(searchLower);
        if (!nameMatch && !domainMatch) {
          return false;
        }
      }

      // Priority support filter
      if (filters.priority_support) {
        const itemPriority = normalizePrioritySupport(String(item.priority_support || ''));
        if (itemPriority !== filters.priority_support) {
          return false;
        }
      }

      // Resident hosting filter
      if (filters.resident_hosting) {
        const itemValue = item.resident_hosting;
        if (filters.resident_hosting === '1') {
          return Boolean(itemValue);
        } else if (filters.resident_hosting === '0') {
          return !Boolean(itemValue);
        }
      }

      // Test environment filter
      if (filters.test_environment) {
        const itemValue = item.test_environment;
        if (filters.test_environment === 'true') {
          return Boolean(itemValue);
        } else if (filters.test_environment === 'false') {
          return !itemValue || itemValue === '0' || itemValue === null || itemValue === undefined || itemValue === '';
        }
      }

      // Database exists filter
      if (filters.database_exists) {
        const itemValue = String(item.database_exists || '');
        if (itemValue !== filters.database_exists) {
          return false;
        }
      }

      // ITAR hosting filter
      if (filters.itar_hosting_bc) {
        const itemValue = String(item.itar_hosting_bc || '');
        if (itemValue !== filters.itar_hosting_bc) {
          return false;
        }
      }

      return true;
    });

    onFilterChange(filtered);
  };

  useEffect(() => {
    applyFilters();
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
          
          <button 
            className="refresh-button"
            onClick={onRefresh}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Refresh Data'}
          </button>
          
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
                      onChange={(e) => setFilters(prev => ({ ...prev, itar_hosting_bc: e.target.value }))}
                      className="filter-select"
                    >
                      <option value="">All</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </div>

                  <div className="filter-group">
                    <label htmlFor="test_environment" className="filter-label">Test Environment</label>
                    <select
                      id="test_environment"
                      value={filters.test_environment}
                      onChange={(e) => setFilters(prev => ({ ...prev, test_environment: e.target.value }))}
                      className="filter-select"
                    >
                      <option value="">All</option>
                      {getUniqueValues('test_environment').map(value => {
                        let displayValue = value;
                        const stringValue = String(value);
                        if (stringValue === 'true') {
                          displayValue = 'Yes';
                        } else if (stringValue === 'false') {
                          displayValue = 'No';
                        }
                        return <option key={value} value={value}>{displayValue}</option>;
                      })}
                      <option value="false">No</option>
                    </select>
                  </div>
                </div>

                <div className="filter-actions">
                  <button onClick={clearAllFilters} className="clear-filters-btn" disabled={!hasActiveFilters}>
                    Clear Filters
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
