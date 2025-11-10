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
    const response = await fetch(this.buildUrl(`/v1/apps/${packageId}`));

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

    const response = await fetch(
      this.buildUrl(`/v1/apps/${packageId}/${actualVersion}`)
    );

    if (!response.ok) {
      throw new Error(`Manifest not found: ${packageId}@${actualVersion}`);
    }

    const rawManifest = await response.json();
    return this.normalizeManifest(rawManifest);
  }

  private normalizeManifest(raw: any): RegistryManifest {
    if (raw?.artifact?.uri) {
      return raw as RegistryManifest;
    }

    const legacyArtifact = raw?.artifacts?.[0] || {};

    let uri = legacyArtifact.uri || legacyArtifact.mirrors?.[0] || legacyArtifact.path || '';
    if (uri.startsWith('/')) {
      uri = `${this.baseUrl}${uri}`;
    }

    const digest = legacyArtifact.digest || legacyArtifact.cid || (legacyArtifact.sha256 ? `sha256:${legacyArtifact.sha256}` : '');

    return {
      manifest_version: raw?.manifest_version || '1.0',
      id: raw?.id || raw?.app?.app_id || raw?.app?.id || 'unknown-app',
      name: raw?.name || raw?.app?.name || 'Unknown Application',
      version: raw?.version?.semver || raw?.version || '0.0.0',
      chains: raw?.chains || raw?.supported_chains || [],
      artifact: {
        type: legacyArtifact.type || 'wasm',
        target: legacyArtifact.target || 'node',
        digest,
        uri,
      },
      provides: raw?.provides || undefined,
      requires: raw?.requires || undefined,
      dependencies: raw?.dependencies || undefined,
    };
  }

  /**
   * Construct manifest URL for a package
   * Useful for passing to auth service
   */
  getManifestUrl(packageId: string, version?: string): string {
    if (version) {
      return this.buildUrl(`/v1/apps/${packageId}/${version}`);
    }
    return this.buildUrl(`/v1/apps/${packageId}`);
  }

  private buildUrl(path: string): string {
    const normalizedBase = this.baseUrl.replace(/\/$/, '');
    return `${normalizedBase}${path}`;
  }
}

// Export singleton instance with default configuration
export const registryClient = new RegistryClient();

// Export factory function for custom configuration
export function createRegistryClient(baseUrl: string): RegistryClient {
  return new RegistryClient(baseUrl);
}

