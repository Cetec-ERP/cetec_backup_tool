// CETEC ERP API Configuration
export const config = {
  // These values can be set in a .env file or .env.local file
  // For Vite, environment variables must be prefixed with VITE_
  cetecDomain: import.meta.env.VITE_CETEC_DOMAIN || 'YOURDOMAIN.cetecerp.com',
  presharedToken: import.meta.env.VITE_PRESHARED_TOKEN || 'SOME_STRING_VALUE',
  protocol: import.meta.env.VITE_API_PROTOCOL || 'http', // 'http' or 'https'
  
  // Helper function to build customer API URL with query parameters
  getCustomerUrl: (params: { id?: string, name?: string, external_key?: string, columns?: string }) => {
    const domain = config.cetecDomain;
    const token = config.presharedToken;
    const protocol = config.protocol;
    
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value && value.trim()) {
        queryParams.append(key, value.trim());
      }
    });
    queryParams.append('preshared_token', token);
    
    return `${protocol}://${domain}/api/customer?${queryParams.toString()}`;
  }
};

// Log configuration for debugging (remove in production)
