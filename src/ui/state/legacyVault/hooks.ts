import { useCallback } from 'react';

import { LegacyVaultCreateInput } from '@/shared/types/LegacyVault';
import { AppState } from '..';
import { useAppDispatch, useAppSelector } from '../hooks';
import { legacyVaultActions } from './reducer';

export function useLegacyVaultState(): AppState['legacyVault'] {
    return useAppSelector((state) => state.legacyVault);
}

export function useSelectedLegacyVaultId(): string | null {
    return useLegacyVaultState().selectedVaultId;
}

export function useSetSelectedLegacyVaultId() {
    const dispatch = useAppDispatch();
    return useCallback(
        (vaultId: string | null) => {
            dispatch(legacyVaultActions.setSelectedVaultId(vaultId));
        },
        [dispatch]
    );
}

export function useSetLegacyVaultDraft() {
    const dispatch = useAppDispatch();
    return useCallback(
        (draft: LegacyVaultCreateInput | null) => {
            dispatch(legacyVaultActions.setDraft(draft));
        },
        [dispatch]
    );
}
