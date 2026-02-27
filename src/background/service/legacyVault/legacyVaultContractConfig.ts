import { ChainType } from '@/shared/constant/chainType';

/**
 * Set the deployed P2OP contract address per network after deployment.
 * Example format: bc1p... (P2OP) or the supported contract address string used by opnet getContract().
 */
export const LEGACY_VAULT_STATE_MACHINE_ADDRESSES: Partial<Record<ChainType, string>> = {
    [ChainType.OPNET_TESTNET]: 'opt1sqqdfyk3f4u8ard33kvjau0n8477csrut050g92pc',
    [ChainType.BITCOIN_REGTEST]: ''
};

export function getLegacyVaultStateMachineAddress(chainType: ChainType): string | null {
    const address = LEGACY_VAULT_STATE_MACHINE_ADDRESSES[chainType];
    if (!address) {
        return null;
    }

    const trimmed = address.trim();
    return trimmed.length > 0 ? trimmed : null;
}
