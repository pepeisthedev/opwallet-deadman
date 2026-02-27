import { ChainType } from '@/shared/constant/chainType';

/**
 * Set the deployed RockPaperScissors contract address per network after deployment.
 */
export const ROCK_PAPER_SCISSORS_ADDRESSES: Partial<Record<ChainType, string>> = {
    [ChainType.OPNET_TESTNET]: 'opt1sqrwn059axmhammdzfalkm6wrm6wzkhgv8gy2rapv',
    [ChainType.BITCOIN_REGTEST]: ''
};

export function getRockPaperScissorsAddress(chainType: ChainType): string | null {
    const address = ROCK_PAPER_SCISSORS_ADDRESSES[chainType];
    if (!address) {
        return null;
    }

    const trimmed = address.trim();
    return trimmed.length > 0 ? trimmed : null;
}
