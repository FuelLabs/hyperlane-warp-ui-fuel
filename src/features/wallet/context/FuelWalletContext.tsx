'use client';

import { defaultConnectors } from '@fuels/connectors';
import { FuelProvider, NetworkConfig, useNetwork, useWallet } from '@fuels/react';
import { PropsWithChildren, useCallback, useEffect, useState } from 'react';

import { TESTNET_NETWORK_URL, Wallet, WalletLocked } from 'fuels';
import { logger } from '../../../utils/logger';
import { reinitializeWarpCore } from '../../store';

export enum FUEL_NETWORK {
  'fuelignition' = 9889,
  'fueltestnet' = 0,
}

// Network URL constants for cleaner code
const NETWORK_URLS = {
  [FUEL_NETWORK.fuelignition]: 'https://mainnet.fuel.network/v1/graphql',
  [FUEL_NETWORK.fueltestnet]: TESTNET_NETWORK_URL,
};

function FuelWalletTracker() {
  const { wallet } = useWallet();
  const { network } = useNetwork();

  useEffect(() => {
    async function updateWalletInWarpCore() {
      try {
        if (!wallet || !network) return;

        logger.info('Reinitializing WarpCore with fuelwallet access');
        const lockedWallet = Wallet.fromAddress(
          wallet.address,
          wallet.provider,
        ) as unknown as WalletLocked;
        await reinitializeWarpCore(
          lockedWallet,
          network.chainId === FUEL_NETWORK.fueltestnet ? 'fueltestnet' : 'fuelignition',
        );
      } catch (error) {
        logger.error('Error in updateWalletInWarpCore:', error);
      }
    }
    updateWalletInWarpCore();
  }, [wallet, network]);

  return null;
}

export default function FuelWalletContext({ children }: PropsWithChildren<unknown>) {
  const [networks, setNetworks] = useState<NetworkConfig[]>([]);

  const updateNetworksFromUrl = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const originChain = params.get('origin');

    if (originChain === 'fueltestnet') {
      setNetworks([
        { chainId: FUEL_NETWORK.fueltestnet, url: NETWORK_URLS[FUEL_NETWORK.fueltestnet] },
      ]);
    } else {
      setNetworks([
        { chainId: FUEL_NETWORK.fuelignition, url: NETWORK_URLS[FUEL_NETWORK.fuelignition] },
      ]);
    }
  }, []);

  useEffect(() => {
    updateNetworksFromUrl();

    const handleUrlChange = () => {
      updateNetworksFromUrl();
    };

    window.addEventListener('popstate', handleUrlChange);
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
      originalPushState.apply(this, args);
      handleUrlChange();
    };

    history.replaceState = function (...args) {
      originalReplaceState.apply(this, args);
      handleUrlChange();
    };

    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    };
  }, [updateNetworksFromUrl]);

  return (
    <FuelProvider
      fuelConfig={{
        connectors: defaultConnectors({ devMode: true }),
      }}
      networks={networks}
    >
      <FuelWalletTracker />
      {children}
    </FuelProvider>
  );
}
