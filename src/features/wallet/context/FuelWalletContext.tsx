'use client';

import { defaultConnectors } from '@fuels/connectors';
import { FuelProvider, NetworkConfig, useNetwork, useWallet } from '@fuels/react';
import { PropsWithChildren, useEffect, useState } from 'react';

import { Provider, TESTNET_NETWORK_URL, Wallet, WalletLocked } from 'fuels';
import { logger } from '../../../utils/logger';
import { reinitializeWarpCore, useStore } from '../../store';

const FUEL_MAINNET_NETWORK = { chainId: 9889, url: 'https://mainnet.fuel.network/v1/graphql' };
const FUEL_TESTNET_NETWORK = { chainId: 0, url: TESTNET_NETWORK_URL };

function FuelWalletTracker() {
  const { wallet } = useWallet();
  const { network } = useNetwork();

  useEffect(() => {
    async function updateWalletInWarpCore() {
      try {
        if (!wallet || !network) return;

        logger.warn('Reinitializing WarpCore with fuelwallet access', { network: network?.url });
        const provider = new Provider(network.url);
        const lockedWallet = Wallet.fromAddress(
          wallet.address,
          provider,
        ) as unknown as WalletLocked;

        await reinitializeWarpCore(lockedWallet);
      } catch (error) {
        logger.error('Error in updateWalletInWarpCore:', error);
      }
    }
    updateWalletInWarpCore();
  }, [wallet, network]);

  return null;
}

export default function FuelWalletContext({ children }: PropsWithChildren<unknown>) {
  const { transferLoading } = useStore();
  const currentState = useStore.getState();
  const [networks, setNetworks] = useState<NetworkConfig[]>([FUEL_MAINNET_NETWORK]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const queryParams = new URLSearchParams(window.location.search);
      const originParam = queryParams.get('origin');
      if (originParam && originParam === 'fueltestnet') {
        setNetworks([FUEL_TESTNET_NETWORK]);
      } else if (originParam && originParam === 'fuelignition') {
        setNetworks([FUEL_MAINNET_NETWORK]);
      }
    }
  }, [transferLoading, currentState]);

  return (
    <FuelProvider
      fuelConfig={{
        connectors: defaultConnectors({ devMode: true }),
      }}
      networks={networks}
      uiConfig={{ suggestBridge: false }}
    >
      <FuelWalletTracker />
      {children}
    </FuelProvider>
  );
}
