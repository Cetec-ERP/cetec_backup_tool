import React, { useState, useEffect } from 'react';

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
    test_domain: '',
    itar_hosting_bc: '',
    database_exists: ''
  });

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
      test_domain: '',
      itar_hosting_bc: '',
      database_exists: ''
    });
  };

  const hasActiveFilters = searchTerm.trim() || Object.values(filters).some(value => value !== '');

  return (
    <div className="search-filter-container">
      <div className="search-section">
        <div className="search-input-group">
          <label htmlFor="search-input" className="search-label">
            🔍 Search Customer Name or Domain:
          </label>
          <input
            id="search-input"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Type to search customer names or domains..."
            className="search-input"
          />
        </div>
      </div>

      <div className="filter-section">
        <div className="filter-row">
          <div className="filter-group">
            <label htmlFor="priority-support-filter" className="filter-label">
              Priority Support:
            </label>
            <select
              id="priority-support-filter"
              value={filters.priority_support}
              onChange={(e) => setFilters(prev => ({ ...prev, priority_support: e.target.value }))}
              className="filter-select"
            >
              <option value="">All</option>
              {getUniqueValues('priority_support').map(value => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="database-exists-filter" className="filter-label">
              Database Exists:
            </label>
            <select
              id="database-exists-filter"
              value={filters.database_exists}
              onChange={(e) => setFilters(prev => ({ ...prev, database_exists: e.target.value }))}
              className="filter-select"
            >
              <option value="">All</option>
              {getUniqueValues('database_exists').map(value => {
                const stringValue = String(value);
                return (
                  <option key={value} value={stringValue}>
                    {stringValue === 'true' ? 'Yes' : 
                     stringValue === 'false' ? 'No' : 
                     stringValue === 'resident_hosting' ? 'Resident Hosting' :
                     stringValue === 'itar_hosting' ? 'ITAR Hosting' :
                     stringValue === 'mysql_disabled' ? 'MySQL Disabled' :
                     stringValue === 'mysql_error' ? 'MySQL Error' :
                     stringValue === 'batch_timeout' ? 'Batch Timeout' :
                     stringValue === 'invalid_domain' ? 'Invalid Domain' :
                     stringValue === 'unavailable' ? 'Unavailable' : stringValue}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="resident-hosting-filter" className="filter-label">
              Resident Hosting:
            </label>
            <select
              id="resident-hosting-filter"
              value={filters.resident_hosting}
              onChange={(e) => setFilters(prev => ({ ...prev, resident_hosting: e.target.value }))}
              className="filter-select"
            >
              <option value="">All</option>
              {getUniqueValues('resident_hosting').map(value => (
                <option key={value} value={value}>{value === 'true' ? 'Yes' : value === 'false' ? 'No' : value}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="filter-row">
          <div className="filter-group">
            <label htmlFor="itar-hosting-filter" className="filter-label">
              ITAR Hosting:
            </label>
            <select
              id="itar-hosting-filter"
              value={filters.itar_hosting_bc}
              onChange={(e) => setFilters(prev => ({ ...prev, itar_hosting_bc: e.target.value }))}
              className="filter-select"
            >
              <option value="">All</option>
              {getUniqueValues('itar_hosting_bc').map(value => (
                <option key={value} value={value}>{value === 'true' ? 'Yes' : value === 'false' ? 'No' : value}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="test-environment-filter" className="filter-label">
              Test Environment:
            </label>
            <select
              id="test-environment-filter"
              value={filters.test_environment}
              onChange={(e) => setFilters(prev => ({ ...prev, test_environment: e.target.value }))}
              className="filter-select"
            >
              <option value="">All</option>
              {getUniqueValues('test_environment').map(value => (
                <option key={value} value={value}>{value === 'true' ? 'Yes' : value === 'false' ? 'No' : value}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="test-domain-filter" className="filter-label">
              Test Domain:
            </label>
            <select
              id="test-domain-filter"
              value={filters.test_domain}
              onChange={(e) => setFilters(prev => ({ ...prev, test_domain: e.target.value }))}
              className="filter-select"
            >
              <option value="">All</option>
              {getUniqueValues('test_domain').map(value => (
                <option key={value} value={value}>{value === 'true' ? 'Yes' : value === 'false' ? 'No' : value}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="filter-row">
          <div className="filter-actions">
            <button
              onClick={clearAllFilters}
              className="clear-filters-btn"
              disabled={!hasActiveFilters}
            >
              🗑️ Clear All Filters
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchAndFilter;
