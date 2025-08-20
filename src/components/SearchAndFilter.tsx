import React, { useState, useEffect, useRef } from 'react';

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
      
      // Check if modal extends beyond right edge
      if (buttonRect.right + modalRect.width > window.innerWidth) {
        // Position to the left of the button
        modal.style.right = 'auto';
        modal.style.left = '0';
      }
      
      // Check if modal extends beyond left edge
      if (buttonRect.left - modalRect.width < 0) {
        // Position to the right of the button
        modal.style.left = 'auto';
        modal.style.right = '0';
      }
    }
  }, [showFilters]);

  // Get unique values for each filterable column
  const getUniqueValues = (column: string) => {
    const values = new Set<string>();
    data.forEach(item => {
      if (item[column] !== undefined && item[column] !== null && item[column] !== '') {
        values.add(String(item[column]));
      }
    });
    return Array.from(values).sort();
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
          const itemValue = String(item[column] || '');
          return itemValue === value;
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
            placeholder="Search by Customer Name or Domain..."
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
            {showFilters ? 'Hide Filters' : 'Show Filters'}
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
                    <label htmlFor="priority_support" className="filter-label">Priority Support</label>
                    <select
                      id="priority_support"
                      value={filters.priority_support}
                      onChange={(e) => setFilters({ ...filters, priority_support: e.target.value })}
                      className="filter-select"
                    >
                      <option value="">All</option>
                      {getUniqueValues('priority_support').map(value => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </div>

                  <div className="filter-group">
                    <label htmlFor="resident_hosting" className="filter-label">Resident Hosting</label>
                    <select
                      id="resident_hosting"
                      value={filters.resident_hosting}
                      onChange={(e) => setFilters({ ...filters, resident_hosting: e.target.value })}
                      className="filter-select"
                    >
                      <option value="">All</option>
                      {getUniqueValues('resident_hosting').map(value => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </div>

                  <div className="filter-group">
                    <label htmlFor="database_exists" className="filter-label">Database Exists</label>
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
                    <label htmlFor="itar_hosting_bc" className="filter-label">ITAR Hosting</label>
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
