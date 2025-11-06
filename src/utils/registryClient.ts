/**
 * Registry Client for fetching application manifests
 * Supports both local development registry and official registry
 */

export interface RegistryManifest {
  manifest_version: string;
  id: string;              // Package name (e.g., "network.calimero.meropass")
  name: string;            // Display name
  version: string;         // Semver
  chains: string[];
  artifact: {
    type: string;
    target: string;
    digest: string;        // "sha256:..."
    uri: string;           // Download URL
  };
  provides?: string[];
  requires?: string[];
  dependencies?: Array<{ id: string; range: string }>;
}

export interface RegistryVersionsResponse {
  id: string;
  versions: string[];
}

export class RegistryClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    // Priority: 1. Passed URL, 2. Environment variable, 3. Default production
    this.baseUrl = baseUrl || 
                   import.meta.env.VITE_REGISTRY_URL || 
                   'https://apps.calimero.network/api';
  }

  /**
   * Get all available versions for a package
   */
  async getPackageVersions(packageId: string): Promise<string[]> {
    const url = `${this.baseUrl}/apps/${packageId}`;
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Package '${packageId}' not found in registry`);
      }
      
      const data: RegistryVersionsResponse = await response.json();
      
      // Handle both formats:
      // - Production Vercel: versions is string[] 
      // - Local CLI: versions is Array<{semver: string, cid: string, yanked: boolean}>
      if (data.versions && data.versions.length > 0) {
        const firstVersion = data.versions[0];
        if (typeof firstVersion === 'string') {
          return data.versions as string[];
        } else if (typeof firstVersion === 'object' && 'semver' in firstVersion) {
          return data.versions.map((v: any) => v.semver);
        }
      }
      
      return [];
    } catch (error) {
      console.error(`Failed to fetch versions for ${packageId}:`, error);
      throw error;
    }
  }

  /**
   * Get manifest for a specific package version
   * If version is not specified, fetches the latest version
   */
  async getManifest(packageId: string, version?: string): Promise<RegistryManifest> {
    // If no version specified, get the latest
    let actualVersion = version;
    
    if (!actualVersion) {
      const versions = await this.getPackageVersions(packageId);
      
      if (versions.length === 0) {
        throw new Error(`No versions found for package '${packageId}'`);
      }
      
      // Versions are sorted newest first
      actualVersion = versions[0];
    }

    const url = `${this.baseUrl}/apps/${packageId}/${actualVersion}`;
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Manifest not found: ${packageId}@${actualVersion}`);
      }
      
      const manifest: RegistryManifest = await response.json();
      return manifest;
    } catch (error) {
      console.error(`Failed to fetch manifest for ${packageId}@${actualVersion}:`, error);
      throw error;
    }
  }

  /**
   * Construct manifest URL for a package
   * Useful for passing to auth service
   */
  getManifestUrl(packageId: string, version?: string): string {
    if (version) {
      return `${this.baseUrl}/apps/${packageId}/${version}`;
    }
    // For latest, we'll need to fetch versions first
    // but we can't do async here, so just return the base
    // The auth service will handle fetching latest
    return `${this.baseUrl}/apps/${packageId}`;
  }
}

// Export singleton instance with default configuration
export const registryClient = new RegistryClient();

// Export factory function for custom configuration
export function createRegistryClient(baseUrl: string): RegistryClient {
  return new RegistryClient(baseUrl);
}

