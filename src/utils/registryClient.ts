/**
 * Registry Client for fetching application manifests
 * Uses V2 Bundle API: /api/v2/bundles
 */

// V2 Bundle Manifest format (from registry)
export interface BundleManifest {
  version: string;           // Bundle format version (e.g., "1.0")
  package: string;           // Package name (e.g., "com.calimero.kvstore")
  appVersion: string;        // App version (semver)
  metadata?: {
    name?: string;
    description?: string;
    author?: string;
  };
  wasm: {
    path?: string;
    hash?: string;           // "sha256:..."
    size?: number;
  };
  links?: {
    frontend?: string;
    github?: string;
    docs?: string;
  };
  signature?: {
    pubkey?: string;
    signature?: string;
    signed_at?: string;
  };
}

// Transformed manifest format (for compatibility with existing code)
export interface RegistryManifest {
  manifest_version: string;
  id: string;              // Package name (e.g., "com.calimero.kvstore")
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
  // Bundle metadata preserved from registry (for installation metadata)
  _bundleMetadata?: {
    name?: string;
    description?: string;
    author?: string;
  };
  _bundleLinks?: {
    frontend?: string;
    github?: string;
    docs?: string;
  };
}

export class RegistryClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    // Priority: 1. Passed URL, 2. Environment variable, 3. Default production
    this.baseUrl = baseUrl || 
                   import.meta.env.VITE_REGISTRY_URL || 
                   'https://apps.calimero.network';
    
    // Ensure baseUrl doesn't end with /api (v2 API is at /api/v2/bundles)
    this.baseUrl = this.baseUrl.replace(/\/api$/, '');
  }

  /**
   * Get all available versions for a package using V2 API
   */
  async getPackageVersions(packageId: string): Promise<string[]> {
    // V2 API: GET /api/v2/bundles?package={packageId}
    const url = new URL('/api/v2/bundles', this.baseUrl);
    url.searchParams.set('package', packageId);
    
    try {
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`Package '${packageId}' not found in registry`);
      }
      
      const bundles: BundleManifest[] = await response.json();
      
      // Validate response is an array
      if (!Array.isArray(bundles)) {
        console.warn('getPackageVersions: API returned non-array response:', bundles);
        return [];
      }
      
      // Extract versions from bundles
      const versions = bundles.map(bundle => bundle.appVersion);
      
      // Sort versions (newest first) using semver-like comparison
      versions.sort((a, b) => {
        // Simple version comparison - for proper semver, use a library
        const aParts = a.split('.').map(Number);
        const bParts = b.split('.').map(Number);
        for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
          const aPart = aParts[i] || 0;
          const bPart = bParts[i] || 0;
          if (aPart !== bPart) {
            return bPart - aPart; // Descending order
          }
        }
        return 0;
      });
      
      return versions;
    } catch (error) {
      console.error(`Failed to fetch versions for ${packageId}:`, error);
      throw error;
    }
  }

  /**
   * Get manifest for a specific package version using V2 API
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

    // V2 API: GET /api/v2/bundles?package={packageId}&version={version}
    // Returns array with single bundle
    const url = new URL('/api/v2/bundles', this.baseUrl);
    url.searchParams.set('package', packageId);
    url.searchParams.set('version', actualVersion);
    
    try {
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`Manifest not found: ${packageId}@${actualVersion}`);
      }
      
      const bundles: BundleManifest[] = await response.json();
      
      if (!bundles || bundles.length === 0) {
        throw new Error(`Manifest not found: ${packageId}@${actualVersion}`);
      }
      
      // V2 API returns array, get first bundle
      const bundle = bundles[0];
      
      // Transform V2 bundle format to RegistryManifest format
      return this.transformBundleToManifest(bundle);
    } catch (error) {
      console.error(`Failed to fetch manifest for ${packageId}@${actualVersion}:`, error);
      throw error;
    }
  }

  /**
   * Transform V2 BundleManifest to RegistryManifest format
   */
  private transformBundleToManifest(bundle: BundleManifest): RegistryManifest {
    // Construct artifact URI
    // V2 API serves artifacts at: /artifacts/{package}/{version}/{filename}
    // For bundles, we should use MPK (Mero Package Kit) files, not the WASM path
    // The wasm.path in the bundle manifest is the path INSIDE the MPK, not the artifact URL
    
    // V2 bundles should always use MPK format for installation
    // MPK files contain the WASM, ABI, and other artifacts bundled together
    const filename = `${bundle.package}-${bundle.appVersion}.mpk`;
    
    // Construct artifact URI
    const artifactUri = `/artifacts/${bundle.package}/${bundle.appVersion}/${filename}`;
    
    // Make it absolute if needed
    const artifactUrl = artifactUri.startsWith('http') 
      ? artifactUri 
      : `${this.baseUrl}${artifactUri}`;

    // Bundles use MPK format
    const artifactType = 'mpk';

    return {
      manifest_version: bundle.version || '2.0',
      id: bundle.package,
      name: bundle.metadata?.name || bundle.package,
      version: bundle.appVersion,
      chains: [], // V2 bundles don't specify chains
      artifact: {
        type: artifactType,
        target: 'wasm32-unknown-unknown',
        digest: bundle.wasm?.hash || '',
        uri: artifactUrl,
      },
      provides: [],
      requires: [],
      dependencies: [],
      // Preserve bundle metadata for use in installation
      // Store the full bundle metadata object for reference
      _bundleMetadata: bundle.metadata,
      _bundleLinks: bundle.links,
    };
  }

  /**
   * Construct manifest URL for a package
   * Useful for passing to auth service
   */
  getManifestUrl(packageId: string, version?: string): string {
    const url = new URL('/api/v2/bundles', this.baseUrl);
    url.searchParams.set('package', packageId);
    if (version) {
      url.searchParams.set('version', version);
    }
    return url.toString();
  }
}

// Export singleton instance with default configuration
export const registryClient = new RegistryClient();

// Export factory function for custom configuration
export function createRegistryClient(baseUrl: string): RegistryClient {
  return new RegistryClient(baseUrl);
}

