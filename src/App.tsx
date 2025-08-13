import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { config } from './config';

function App() {
  const [data, setData] = useState<any>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queryParams, setQueryParams] = useState({
    id: '',
    name: '',
    external_key: '',
    columns: '',
  });

  const fetchCustomerData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Build query string with all parameters
      const params = new URLSearchParams();
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value.trim()) {
          params.append(key, value.trim());
        }
      });
      params.append('preshared_token', config.presharedToken);

      const url = `http://localhost:3001/api/cetec/customer?${params.toString()}`;
      console.log('Making API request to backend proxy:', url);
      
      const response = await axios.get(url, {
        timeout: 10000,
      });
      
      setData(response.data);
      setLoading(false);
    } catch (err: any) {
      console.error('Error fetching customer data:', err);
      setError(err.message || 'An error occurred');
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch if at least one parameter is provided
    if (Object.values(queryParams).some(value => value.trim())) {
      fetchCustomerData();
    }
  }, [queryParams]);

  const handleParamChange = (key: string, value: string) => {
    setQueryParams(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    fetchCustomerData();
  };

  return (
    <div className="App">
      <h1>CETEC ERP Customer Data</h1>
      
      <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '10px' }}>
          <div>
            <label htmlFor="id">Customer ID: </label>
            <input
              type="text"
              id="id"
              value={queryParams.id}
              onChange={(e) => handleParamChange('id', e.target.value)}
              placeholder="Enter ID"
            />
          </div>
          <div>
            <label htmlFor="name">Name: </label>
            <input
              type="text"
              id="name"
              value={queryParams.name}
              onChange={(e) => handleParamChange('name', e.target.value)}
              placeholder="Enter name"
            />
          </div>
          <div>
            <label htmlFor="external_key">External Key: </label>
            <input
              type="text"
              id="external_key"
              value={queryParams.external_key}
              onChange={(e) => handleParamChange('external_key', e.target.value)}
              placeholder="Enter external key"
            />
          </div>
          <div>
            <label htmlFor="columns">Columns: </label>
            <input
              type="text"
              id="columns"
              value={queryParams.columns}
              onChange={(e) => handleParamChange('columns', e.target.value)}
              placeholder="Enter columns"
            />
          </div>
        </div>
        <button type="submit">Fetch Customer Data</button>
      </form>

      {loading && <p>Loading...</p>}
      
      {error && (
        <div style={{ color: 'red', marginBottom: '20px' }}>
          Error: {error}
        </div>
      )}

      {!loading && !error && data && (
        <div>
          <h2>Customer Data</h2>
          <p>Query Parameters: {Object.entries(queryParams).filter(([_, value]) => value.trim()).map(([key, value]) => `${key}=${value}`).join(', ')}</p>
          <pre style={{ 
            backgroundColor: '#f5f5f5', 
            padding: '15px', 
            borderRadius: '5px',
            overflow: 'auto',
            maxHeight: '400px'
          }}>
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default App;
