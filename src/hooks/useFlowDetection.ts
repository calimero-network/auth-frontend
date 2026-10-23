import { useMemo } from 'react';
import { FlowDetectionResult, UrlParams, AppMode, FlowSource } from '../types/flows';
import { getStoredUrlParam } from '../utils/urlParams';

/**
 * Detects which auth flow to use based on URL parameters
 * 
 * Flow detection priority:
 * 1. Package-based: Has package-name param
 * 2. Admin: Has permissions=admin OR mode=admin
 * 3. Application-ID: Has application-id param
 */
export function useFlowDetection(): FlowDetectionResult & UrlParams {
  const search = window.location.search;

  return useMemo(() => {
    const urlSearch = new URLSearchParams(search);
    // A repeated param resolves to its last value, as handleUrlParams stores it.
    const lastParam = (key: string) => urlSearch.getAll(key).at(-1);
      
    // Extract all params - PREFER URL over localStorage
    const callbackUrl = lastParam('callback-url') || getStoredUrlParam('callback-url') || '';
    const appUrl = lastParam('app-url') || getStoredUrlParam('app-url') || '';
    const permissionsParam = lastParam('permissions') || getStoredUrlParam('permissions') || '';
    const permissions = permissionsParam ? permissionsParam.split(',') : [];
    
    // Check both URL and stored params for package info
    const packageName = lastParam('package-name') || getStoredUrlParam('package-name') || undefined;
    const packageVersion = lastParam('package-version') || getStoredUrlParam('package-version') || undefined;
    const registryUrl = lastParam('registry-url') || getStoredUrlParam('registry-url') || undefined;
    
    const applicationId = lastParam('application-id') || getStoredUrlParam('application-id') || undefined;
    const applicationPath = lastParam('application-path') || getStoredUrlParam('application-path') || undefined;
    
    const modeParam = lastParam('mode') || getStoredUrlParam('mode');
    
    console.log('🔍 FLOW DETECTION - Extracted values:', {
      packageName,
      packageVersion,
      registryUrl,
      applicationId,
      applicationPath,
      modeParam,
      permissions
    });
    
    // Detect source
    let source: FlowSource;
    if (packageName) {
      source = 'package';
      console.log('✅ FLOW DETECTION - Source: package (packageName found)');
    } else if (permissions.includes('admin') || modeParam === 'admin') {
      source = 'admin';
      console.log('✅ FLOW DETECTION - Source: admin');
    } else if (applicationId) {
      source = 'application-id';
      console.log('✅ FLOW DETECTION - Source: application-id (applicationId found)');
    } else {
      // Default to admin if no clear indicators
      source = 'admin';
      console.log('✅ FLOW DETECTION - Source: admin (default)');
    }
    
    // Detect mode
    let mode: AppMode;
    if (source === 'admin') {
      mode = 'admin';
    } else if (modeParam === 'multi-context') {
      mode = 'multi-context';
    } else if (modeParam === 'single-context') {
      mode = 'single-context';
    } else {
      // Infer from permissions for legacy flows
      if (permissions.some(p => p === 'application')) {
        mode = 'multi-context';
      } else {
        mode = 'single-context';
      }
    }
    
    return {
      source,
      mode,
      callbackUrl,
      appUrl,
      permissions,
      packageName,
      packageVersion,
      registryUrl,
      applicationId,
      applicationPath,
    };
  }, [search]);
}
