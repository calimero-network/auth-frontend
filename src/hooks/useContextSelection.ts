import { useState, useCallback } from 'react';
import { getMero, getAccessToken, getRefreshToken } from '../lib/mero';

interface Context {
    id: string;
    applicationId: string;
    [key: string]: unknown;
}

export function useContextSelection() {
    const [contexts, setContexts] = useState<Context[]>([]);
    const [selectedContext, setSelectedContext] = useState<string | null>(null);
    const [identities, setIdentities] = useState<string[]>([]);
    const [selectedIdentity, setSelectedIdentity] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchContexts = useCallback(async () => {
        if (!getAccessToken() && !getRefreshToken()) {
            setError('No valid root token available');
            return;
        }

        try {
            setLoading(true);
            setError(null);
            const mero = getMero();
            const response = await mero.admin.getContexts();
            const contextsRaw = (response as any)?.data?.contexts ?? (response as any)?.contexts ?? [];
            setContexts(Array.isArray(contextsRaw) ? contextsRaw : []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch contexts');
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchIdentities = useCallback(async (contextId: string) => {
        if (!getAccessToken() && !getRefreshToken()) {
            setError('No valid root token available');
            return;
        }

        try {
            setLoading(true);
            setError(null);
            const mero = getMero();
            const response = await mero.admin.getContextIdentitiesOwned(contextId);
            const ids = (response as any)?.data?.identities ?? (response as any)?.identities ?? [];
            setIdentities(ids);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch identities');
        } finally {
            setLoading(false);
        }
    }, []);

    // Handle context selection
    const handleContextSelect = useCallback(async (contextId: string | null) => {
        setSelectedContext(contextId);
        setSelectedIdentity(null);
        if (contextId) {
            await fetchIdentities(contextId);
        }
    }, [fetchIdentities]);

    // Handle identity selection
    const handleIdentitySelect = useCallback((contextId: string | null, identity: string) => {
        setSelectedIdentity(identity);
    }, []);

    // Reset selections
    const reset = useCallback(() => {
        setSelectedContext(null);
        setSelectedIdentity(null);
        setIdentities([]);
        setError(null);
    }, []);

    return {
        contexts,
        selectedContext,
        identities,
        selectedIdentity,
        loading,
        error,
        fetchContexts,
        handleContextSelect,
        handleIdentitySelect,
        reset,
    };
} 