'use client';

import { FuelProvider, useFuel, useWallet } from '@fuel-wallet/react';
import { WalletUnlocked } from 'fuels';
import { PropsWithChildren, useEffect, useRef } from 'react';
import { logger } from '../../../utils/logger';
import { reinitializeWarpCore } from '../../store';

// Component to track the Fuel wallet state
function FuelWalletTracker() {
  const { wallet } = useWallet();
  const { fuel } = useFuel();
  const previousWalletRef = useRef(null);

  useEffect(() => {
    async function setupFuelWallet() {
      try {
        let walletUnlocked = null;
        const fuelChain = 'fueltestnet';

        if (wallet?.address) {
          logger.warn('Fuel wallet connected, address:', wallet.address);

          // Try to get the wallet using fuel.currentAccount() and fuel.getWallet()
          try {
            const account = await fuel.currentAccount();
            if (account) {
              walletUnlocked = await fuel.getWallet(account);
            }
          } catch (error) {
            logger.error('Error getting wallet from fuel:', error);
          }
        }

        // Check if the wallet state has changed
        const walletStateChanged =
          (previousWalletRef.current === null && walletUnlocked !== null) ||
          (previousWalletRef.current !== null && walletUnlocked === null);

        // Update the reference
        previousWalletRef.current = walletUnlocked;

        // If the wallet state has changed, reinitialize the WarpCore
        if (walletStateChanged) {
          logger.warn('Fuel wallet state changed, reinitializing WarpCore');
          try {
            await reinitializeWarpCore(walletUnlocked as unknown as WalletUnlocked, fuelChain);
          } catch (error) {
            logger.error('Error reinitializing WarpCore:', error);
          }
        }
      } catch (error) {
        logger.error('Error in setupFuelWallet:', error);
      }
    }

    setupFuelWallet();
  }, [wallet, fuel]);

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
