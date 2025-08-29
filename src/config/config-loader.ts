// Simple configuration for CETEC Backup Tool
export const config = {
  app: {
    name: "CETEC Backup Puller",
    version: "1.0.0",
    description: "Customer data management application with MySQL integration"
  },
  api: {
    baseUrl: "https://internal.cetecerp.com",
    customerViewPath: "/react/customer",
    customerViewQuery: "?newversion=1",
    timeout: 60000
  },
  mysql: {
    enabled: true,
    batchSize: 5,
    timeout: 30000
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
  }
};

// Simple config loader
export class ConfigLoader {
  private static instance: ConfigLoader;
  private config = config;

  private constructor() {}

  public static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    }
    return ConfigLoader.instance;
  }

  public getConfig() {
    return this.config;
  }

  public getValue<T>(path: string): T | undefined {
    const keys = path.split('.');
    let current: Record<string, unknown> = this.config;
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key] as Record<string, unknown>;
      } else {
        return undefined;
      }
    }
    
    return current as T;
  }

  public isFeatureEnabled(feature: keyof typeof config.features): boolean {
    return this.getValue<boolean>(`features.${feature}`) || false;
  }
}

// Export singleton instance
export const configLoader = ConfigLoader.getInstance();

// Export convenience functions
export const getConfig = () => configLoader.getConfig();
export const getConfigValue = <T>(path: string): T | undefined => configLoader.getValue<T>(path);
export const isFeatureEnabled = (feature: keyof typeof config.features): boolean => configLoader.isFeatureEnabled(feature);
