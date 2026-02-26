import { Blockchain } from '@btc-vision/btc-runtime/runtime';
import { revertOnError } from '@btc-vision/btc-runtime/runtime/abort/abort';

import { LegacyVaultStateMachine } from './LegacyVaultStateMachine';

// OP_NET contract factory entrypoint.
// Keep this minimal; runtime instantiates the contract from here.
Blockchain.contract = () => {
    return new LegacyVaultStateMachine();
};

// Required runtime exports.
export * from '@btc-vision/btc-runtime/runtime/exports';

// Required abort hook for clean contract reverts.
export function abort(message: string, fileName: string, line: u32, column: u32): void {
    revertOnError(message, fileName, line, column);
}
