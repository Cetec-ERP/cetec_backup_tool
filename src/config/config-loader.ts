import { AppConfig, getConfigValue } from './app-config.types';

// Default configuration fallback
const defaultConfig: AppConfig = {
  app: {
    name: "CETEC Backup Puller",
    version: "1.0.0",
    description: "Customer data management application with MySQL integration"
  },
  api: {
    baseUrl: "https://internal.cetecerpbeta.com",
    customerViewPath: "/react/customer",
    customerViewQuery: "?newversion=1",
    timeout: 60000
  },
  mysql: {
    enabled: true,
    batchSize: 5,
    timeout: 30000,
    connectionPool: {
      max: 10,
      min: 2
    }
  },
  filters: {
    excludedColumns: ["id", "total_users", "database_exists", "ok_to_bill"],
    searchableColumns: ["name", "domain"],
    filterableColumns: [
      "priority_support",
      "resident_hosting", 
      "test_environment",
      "test_domain",
      "itar_hosting_bc",
      "database_exists"
    ]
  },
  ui: {
    tablePageSize: 50,
    maxSearchResults: 1000,
    refreshInterval: 300000,
    loadingTimeout: 10000
  },
  features: {
    searchEnabled: true,
    filteringEnabled: true,
    exportEnabled: false,
    realTimeUpdates: false,
    offlineMode: false
  },
  display: {
    dateFormat: "YYYY-MM-DD",
    timeFormat: "HH:mm:ss",
    numberFormat: "en-US",
    currency: "USD"
  },
  logging: {
    level: "info",
    enableConsole: true,
    enableFile: false,
    maxLogSize: "10MB"
  },
  security: {
    enableCORS: true,
    enableRateLimiting: false,
    maxRequestsPerMinute: 100,
    sessionTimeout: 3600000
  },
  customFields: {
    customerCategories: ["enterprise", "small_business", "startup", "government", "education"],
    supportTiers: ["basic", "standard", "premium", "enterprise"],
    hostingTypes: ["cloud", "on_premise", "hybrid", "managed"]
  },
  notifications: {
    email: {
      enabled: false,
      smtpServer: "",
      fromAddress: ""
    },
    slack: {
      enabled: false,
      webhookUrl: ""
    }
  },
  export: {
    formats: ["csv", "json", "xlsx"],
    maxRecords: 10000,
    includeMetadata: true
  }
};

// Configuration loader class
export class ConfigLoader {
  private static instance: ConfigLoader;
  private config: AppConfig = defaultConfig;
  private loaded: boolean = false;

  private constructor() {}

  public static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    }
    return ConfigLoader.instance;
  }

  // Load configuration from JSON file
  public async loadConfig(): Promise<AppConfig> {
    if (this.loaded) {
      return this.config;
    }

    try {
      const response = await fetch('/src/config/app-config.json');
      if (!response.ok) {
        throw new Error(`Failed to load config: ${response.statusText}`);
      }
      
      const loadedConfig = await response.json();
      this.config = { ...defaultConfig, ...loadedConfig };
      this.loaded = true;
      
      console.log('Configuration loaded successfully');
      return this.config;
    } catch (error) {
      console.warn('Failed to load configuration file, using defaults:', error);
      this.config = defaultConfig;
      this.loaded = true;
      return this.config;
    }
  }

  // Get configuration object
  public getConfig(): AppConfig {
    if (!this.loaded) {
      console.warn('Configuration not loaded, using defaults. Call loadConfig() first.');
    }
    return this.config;
  }

  // Get a specific configuration value by path
  public getValue<T>(path: string): T {
    try {
      return getConfigValue<T>(this.config, path);
    } catch (error) {
      console.error(`Failed to get config value for path '${path}':`, error);
      throw error;
    }
  }

  // Check if a feature is enabled
  public isFeatureEnabled(feature: keyof AppConfig['features']): boolean {
    return this.getValue<boolean>(`features.${feature}`);
  }

  // Get API configuration
  public getApiConfig() {
    return this.getValue<AppConfig['api']>('api');
  }

  // Get MySQL configuration
  public getMySQLConfig() {
    return this.getValue<AppConfig['mysql']>('mysql');
  }

  // Get filter configuration
  public getFilterConfig() {
    return this.getValue<AppConfig['filters']>('filters');
  }

  // Reload configuration
  public async reloadConfig(): Promise<AppConfig> {
    this.loaded = false;
    return this.loadConfig();
  }
}

// Export singleton instance
export const configLoader = ConfigLoader.getInstance();

// Convenience functions
export const getConfig = () => configLoader.getConfig();
export const getConfigValue = <T>(path: string): T => configLoader.getValue<T>(path);
export const isFeatureEnabled = (feature: keyof AppConfig['features']): boolean => 
  configLoader.isFeatureEnabled(feature);
