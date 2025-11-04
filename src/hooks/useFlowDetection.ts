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
  return useMemo(() => {
    const urlSearch = new URLSearchParams(window.location.search);
    
    // Extract all params
    const callbackUrl = getStoredUrlParam('callback-url') || '';
    const appUrl = getStoredUrlParam('app-url') || '';
    const permissionsParam = getStoredUrlParam('permissions') || '';
    const permissions = permissionsParam ? permissionsParam.split(',') : [];
    
    const packageName = urlSearch.get('package-name') || undefined;
    const packageVersion = urlSearch.get('package-version') || undefined;
    const registryUrl = urlSearch.get('registry-url') || undefined;
    
    const applicationId = getStoredUrlParam('application-id') || undefined;
    const applicationPath = getStoredUrlParam('application-path') || undefined;
    
    const modeParam = getStoredUrlParam('mode');
    
    // Detect source
    let source: FlowSource;
    if (packageName) {
      source = 'package';
    } else if (permissions.includes('admin') || modeParam === 'admin') {
      source = 'admin';
    } else if (applicationId) {
      source = 'application-id';
    } else {
      // Default to admin if no clear indicators
      source = 'admin';
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
      if (permissions.some(p => p.startsWith('context:'))) {
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
  }, []);
}

