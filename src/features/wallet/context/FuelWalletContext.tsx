'use client';

import { FuelProvider, useWallet } from '@fuel-wallet/react';
import { PropsWithChildren, useEffect } from 'react';

import { logger } from '../../../utils/logger';
import { reinitializeWarpCore } from '../../store';

function FuelWalletTracker() {
  const { wallet } = useWallet();

  useEffect(() => {
    async function updateWalletInWarpCore() {
      try {
        if (!wallet) return;
        logger.info('Reinitializing WarpCore with fuelwallet access');
        await reinitializeWarpCore(wallet);
      } catch (error) {
        logger.error('Error in updateWalletInWarpCore:', error);
      }
    }
    updateWalletInWarpCore();
  }, [wallet]);

  return null;
}

export default function FuelWalletContext({ children }: PropsWithChildren<unknown>) {
  return (
    <FuelProvider>
      <FuelWalletTracker />
      {children}
    </FuelProvider>
  );
}
