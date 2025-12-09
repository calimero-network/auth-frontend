/**
 * Registry Client for fetching bundle information
 * Uses V2 Bundle API
 */

// V2 Bundle Manifest Types (matching Rust BundleManifest)
export interface BundleArtifact {
  path: string;
  hash?: string | null;
  size: number;
}

export interface BundleMetadata {
  name: string;
  description?: string | null;
  icon?: string | null;
  tags?: string[];
  license?: string | null;
}

export interface BundleInterfaces {
  exports?: string[];
  uses?: string[];
}

export interface BundleLinks {
  frontend?: string | null;
  github?: string | null;
  docs?: string | null;
}

export interface BundleSignature {
  alg: string;
  sig: string;
  pubkey: string;
  signedAt: string;
}

export interface BundleManifest {
  version: string;
  package: string;
  appVersion: string;
  metadata?: BundleMetadata | null;
  interfaces?: BundleInterfaces | null;
  wasm?: BundleArtifact | null;
  abi?: BundleArtifact | null;
  migrations?: BundleArtifact[];
  links?: BundleLinks | null;
  signature?: BundleSignature | null;
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
   * TODO: Implement V2 endpoint for listing versions
   * For now, this is a placeholder - version should be specified directly
   */
  async getPackageVersions(packageId: string): Promise<string[]> {
    // V2 doesn't have a versions endpoint yet
    // For now, require version to be specified
    throw new Error(
      `Package versions listing not yet implemented in V2 API. ` +
      `Please specify a version when fetching manifests.`
    );
  }

  /**
   * Get V2 Bundle Info
   */
  async getBundleInfo(packageId: string, version: string): Promise<BundleManifest | null> {
    if (!version) {
      throw new Error(`Version is required for package '${packageId}'`);
    }

    const response = await fetch(
      this.buildUrl(`/api/v2/bundles/${packageId}/${version}`)
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to fetch bundle info: ${response.statusText}`);
    }

    return await response.json() as BundleManifest;
  }

  /**
   * Get artifact URL for a bundle
   */
  getArtifactUrl(packageId: string, version: string): string {
    // Convention: /artifacts/:package/:version/:package-:version.mpk
    const bundleFilename = `${packageId}-${version}.mpk`;
    return this.buildUrl(`/artifacts/${packageId}/${version}/${bundleFilename}`);
  }

  /**
   * Construct bundle info URL for a package
   * Uses V2 Bundle API
   * Version is required
   */
  getBundleInfoUrl(packageId: string, version: string): string {
    if (!version) {
      throw new Error('Version is required');
    }
    return this.buildUrl(`/api/v2/bundles/${packageId}/${version}`);
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

