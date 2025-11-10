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
      
    console.log('🔍 FLOW DETECTION - window.location.search:', window.location.search);
    console.log('🔍 FLOW DETECTION - URL params:', Object.fromEntries(urlSearch.entries()));
    
    // Clear old localStorage entries IMMEDIATELY to prevent cross-session pollution
    const modeFromUrl = urlSearch.get('mode');
    if (modeFromUrl === 'admin' || urlSearch.get('permissions') === 'admin') {
      console.log('🧹 Admin flow - clearing all app params');
      localStorage.removeItem('package-name');
      localStorage.removeItem('package-version');
      localStorage.removeItem('registry-url');
      localStorage.removeItem('application-id');
      localStorage.removeItem('application-path');
      localStorage.removeItem('installed-application-id');
    } else if (urlSearch.has('package-name')) {
      console.log('🧹 Package flow - clearing old application-id params');
      localStorage.removeItem('application-id');
      localStorage.removeItem('application-path');
    } else if (urlSearch.has('application-id')) {
      console.log('🧹 Application-ID flow - clearing old package params');
      localStorage.removeItem('package-name');
      localStorage.removeItem('package-version');
      localStorage.removeItem('registry-url');
    }
    
    // Extract all params - PREFER URL over localStorage
    const callbackUrl = urlSearch.get('callback-url') || getStoredUrlParam('callback-url') || '';
    const appUrl = urlSearch.get('app-url') || getStoredUrlParam('app-url') || '';
    const permissionsParam = urlSearch.get('permissions') || getStoredUrlParam('permissions') || '';
    const permissions = permissionsParam ? permissionsParam.split(',') : [];
    
    // Check both URL and stored params for package info
    const packageName = urlSearch.get('package-name') || getStoredUrlParam('package-name') || undefined;
    const packageVersion = urlSearch.get('package-version') || getStoredUrlParam('package-version') || undefined;
    const registryUrl = urlSearch.get('registry-url') || getStoredUrlParam('registry-url') || undefined;
    
    const applicationId = urlSearch.get('application-id') || getStoredUrlParam('application-id') || undefined;
    const applicationPath = urlSearch.get('application-path') || getStoredUrlParam('application-path') || undefined;
    
    const modeParam = urlSearch.get('mode') || getStoredUrlParam('mode');
    
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
