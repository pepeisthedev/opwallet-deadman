import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { LegacyVaultCreateInput } from '@/shared/types/LegacyVault';

export interface LegacyVaultUiState {
    selectedVaultId: string | null;
    draft: LegacyVaultCreateInput | null;
}

const initialState: LegacyVaultUiState = {
    selectedVaultId: null,
    draft: null
};

const slice = createSlice({
    name: 'legacyVault',
    initialState,
    reducers: {
        setSelectedVaultId(state, action: PayloadAction<string | null>) {
            state.selectedVaultId = action.payload;
        },
        setDraft(state, action: PayloadAction<LegacyVaultCreateInput | null>) {
            state.draft = action.payload;
        },
        reset(state) {
            state.selectedVaultId = null;
            state.draft = null;
        }
    }
});

export const legacyVaultActions = slice.actions;
export default slice.reducer;
