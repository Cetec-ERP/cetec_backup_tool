# App Configuration System

This directory contains the configuration system for the CETEC Backup Puller application.

## Files

- **`app-config.json`** - Main configuration file with all key/value pairs
- **`app-config.types.ts`** - TypeScript interfaces for type safety
- **`config-loader.ts`** - Utility class for loading and managing configuration
- **`README.md`** - This documentation file

## Usage

### Basic Configuration Access

```typescript
import { configLoader, getConfig, getConfigValue, isFeatureEnabled } from './config/config-loader';

// Load configuration (call this early in your app)
await configLoader.loadConfig();

// Get entire config object
const config = getConfig();

// Get specific values by path
const apiTimeout = getConfigValue<number>('api.timeout');
const searchEnabled = getConfigValue<boolean>('features.searchEnabled');

// Check if features are enabled
if (isFeatureEnabled('exportEnabled')) {
  // Show export functionality
}
```

### Configuration Structure

The configuration is organized into logical sections:

#### App Information
```json
{
  "app": {
    "name": "CETEC Backup Puller",
    "version": "1.0.0",
    "description": "Customer data management application with MySQL integration"
  }
}
```

#### API Configuration
```json
{
  "api": {
    "baseUrl": "https://internal.cetecerpbeta.com",
    "customerViewPath": "/react/customer",
    "customerViewQuery": "?newversion=1",
    "timeout": 60000
  }
}
```

#### MySQL Settings
```json
{
  "mysql": {
    "enabled": true,
    "batchSize": 5,
    "timeout": 30000,
    "connectionPool": {
      "max": 10,
      "min": 2
    }
  }
}
```

#### Filter Configuration
```json
{
  "filters": {
    "excludedColumns": ["id", "total_users", "database_exists", "ok_to_bill"],
    "searchableColumns": ["name", "domain"],
    "filterableColumns": ["priority_support", "resident_hosting", "test_environment", "test_domain", "itar_hosting_bc", "database_exists"]
  }
}
```

#### UI Settings
```json
{
  "ui": {
    "tablePageSize": 50,
    "maxSearchResults": 1000,
    "refreshInterval": 300000,
    "loadingTimeout": 10000
  }
}
```

#### Feature Flags
```json
{
  "features": {
    "searchEnabled": true,
    "filteringEnabled": true,
    "exportEnabled": false,
    "realTimeUpdates": false,
    "offlineMode": false
  }
}
```

### Adding New Configuration

1. **Update the JSON file** (`app-config.json`)
2. **Update the TypeScript interface** (`app-config.types.ts`)
3. **Add default values** in `config-loader.ts` if needed
4. **Use the new config** in your components

### Example: Adding a New Feature Flag

```typescript
// In app-config.json
{
  "features": {
    "newFeature": true
  }
}

// In app-config.types.ts
features: {
  newFeature: boolean;
  // ... other features
}

// In your component
if (isFeatureEnabled('newFeature')) {
  // Show new feature
}
```

### Error Handling

The configuration system includes built-in error handling:

- **Fallback to defaults** if the JSON file can't be loaded
- **Type-safe access** with TypeScript interfaces
- **Path validation** to prevent accessing non-existent config values
- **Console warnings** for debugging configuration issues

### Best Practices

1. **Always call `loadConfig()` early** in your application lifecycle
2. **Use the convenience functions** (`getConfigValue`, `isFeatureEnabled`) for type safety
3. **Keep configuration organized** by logical sections
4. **Document new configuration options** in this README
5. **Use feature flags** to enable/disable functionality dynamically

### Environment-Specific Configuration

You can create different configuration files for different environments:

- `app-config.dev.json` - Development settings
- `app-config.prod.json` - Production settings
- `app-config.test.json` - Test settings

Then modify the loader to use the appropriate file based on `NODE_ENV` or other environment variables.
