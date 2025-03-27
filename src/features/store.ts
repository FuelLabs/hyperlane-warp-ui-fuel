import { GithubRegistry, IRegistry } from '@hyperlane-xyz/registry';
import {
  ChainMap,
  ChainMetadata,
  MultiProtocolProvider,
  WarpCore,
  WarpCoreConfig,
} from '@hyperlane-xyz/sdk';
import { objFilter, ProtocolType } from '@hyperlane-xyz/utils';
import { Wallet, WalletUnlocked } from 'fuels';
import { toast } from 'react-toastify';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { config } from '../consts/config';
import { logger } from '../utils/logger';
import { assembleChainMetadata } from './chains/metadata';
import { FinalTransferStatuses, TransferContext, TransferStatus } from './transfer/types';
import { assembleWarpCoreConfig } from './warpCore/warpCoreConfig';

// Increment this when persist state has breaking changes
const PERSIST_STATE_VERSION = 2;

// Keeping everything here for now as state is simple
// Will refactor into slices as necessary
export interface AppState {
  // Chains and providers
  chainMetadata: ChainMap<ChainMetadata>;
  // Overrides to chain metadata set by user via the chain picker
  chainMetadataOverrides: ChainMap<Partial<ChainMetadata>>;
  setChainMetadataOverrides: (overrides?: ChainMap<Partial<ChainMetadata> | undefined>) => void;
  // Overrides to warp core configs added by user
  warpCoreConfigOverrides: WarpCoreConfig[];
  setWarpCoreConfigOverrides: (overrides?: WarpCoreConfig[] | undefined) => void;
  multiProvider: MultiProtocolProvider;
  registry: IRegistry;
  warpCore: WarpCore;
  // Flag to indicate if there is a Fuel chain connected
  hasFuelChain: boolean;
  setWarpContext: (context: {
    registry: IRegistry;
    chainMetadata: ChainMap<ChainMetadata>;
    multiProvider: MultiProtocolProvider;
    warpCore: WarpCore;
    hasFuelChain: boolean;
  }) => void;

  // User history
  transfers: TransferContext[];
  addTransfer: (t: TransferContext) => void;
  resetTransfers: () => void;
  updateTransferStatus: (
    i: number,
    s: TransferStatus,
    options?: { msgId?: string; originTxHash?: string },
  ) => void;
  failUnconfirmedTransfers: () => void;

  // Shared component state
  transferLoading: boolean;
  setTransferLoading: (isLoading: boolean) => void;
  isSideBarOpen: boolean;
  setIsSideBarOpen: (isOpen: boolean) => void;
  showEnvSelectModal: boolean;
  setShowEnvSelectModal: (show: boolean) => void;
}

export const useStore = create<AppState>()(
  persist(
    // Store reducers
    (set, get) => ({
      // Chains and providers
      chainMetadata: {},
      chainMetadataOverrides: {},
      setChainMetadataOverrides: async (
        overrides: ChainMap<Partial<ChainMetadata> | undefined> = {},
      ) => {
        logger.debug('Setting chain overrides in store');
        const { multiProvider, warpCore, hasFuelChain } = await initWarpContext({
          ...get(),
          chainMetadataOverrides: overrides,
        });
        const filtered = objFilter(overrides, (_, metadata) => !!metadata);
        set({ chainMetadataOverrides: filtered, multiProvider, warpCore, hasFuelChain });
      },
      warpCoreConfigOverrides: [],
      setWarpCoreConfigOverrides: async (overrides: WarpCoreConfig[] | undefined = []) => {
        logger.debug('Setting warp core config overrides in store');
        const { multiProvider, warpCore, hasFuelChain } = await initWarpContext({
          ...get(),
          warpCoreConfigOverrides: overrides,
        });
        set({ warpCoreConfigOverrides: overrides, multiProvider, warpCore, hasFuelChain });
      },
      multiProvider: new MultiProtocolProvider({}),
      registry: new GithubRegistry({
        uri: config.registryUrl,
        branch: config.registryBranch,
        proxyUrl: config.registryProxyUrl,
      }),
      warpCore: new WarpCore(new MultiProtocolProvider({}), []),
      hasFuelChain: false,
      setWarpContext: ({ registry, chainMetadata, multiProvider, warpCore, hasFuelChain }) => {
        logger.debug('Setting warp context in store');
        set({ registry, chainMetadata, multiProvider, warpCore, hasFuelChain });
      },

      // User history
      transfers: [],
      addTransfer: (t) => {
        set((state) => ({ transfers: [...state.transfers, t] }));
      },
      resetTransfers: () => {
        set(() => ({ transfers: [] }));
      },
      updateTransferStatus: (i, s, options) => {
        set((state) => {
          if (i >= state.transfers.length) return state;
          const txs = [...state.transfers];
          txs[i].status = s;
          txs[i].msgId ||= options?.msgId;
          txs[i].originTxHash ||= options?.originTxHash;
          return {
            transfers: txs,
          };
        });
      },
      failUnconfirmedTransfers: () => {
        set((state) => ({
          transfers: state.transfers.map((t) =>
            FinalTransferStatuses.includes(t.status) ? t : { ...t, status: TransferStatus.Failed },
          ),
        }));
      },

      // Shared component state
      transferLoading: false,
      setTransferLoading: (isLoading) => {
        set(() => ({ transferLoading: isLoading }));
      },
      isSideBarOpen: false,
      setIsSideBarOpen: (isSideBarOpen) => {
        set(() => ({ isSideBarOpen }));
      },
      showEnvSelectModal: false,
      setShowEnvSelectModal: (showEnvSelectModal) => {
        set(() => ({ showEnvSelectModal }));
      },
    }),

    // Store config
    {
      name: 'app-state', // name in storage
      partialize: (state) => ({
        // fields to persist
        chainMetadataOverrides: state.chainMetadataOverrides,
        transfers: state.transfers,
      }),
      version: PERSIST_STATE_VERSION,
      onRehydrateStorage: () => {
        logger.debug('Rehydrating state');
        return (state, error) => {
          state?.failUnconfirmedTransfers();
          if (error || !state) {
            logger.error('Error during hydration', error);
            return;
          }
          initWarpContext(state).then(
            ({ registry, chainMetadata, multiProvider, warpCore, hasFuelChain = false }) => {
              state.setWarpContext({
                registry,
                chainMetadata,
                multiProvider,
                warpCore,
                hasFuelChain,
              });
              logger.debug('Rehydration complete');
            },
          );
        };
      },
    },
  ),
);

async function initWarpContext({
  registry,
  chainMetadataOverrides,
  warpCoreConfigOverrides,
  fuelWalletUnlocked,
  fuelChain = 'fueltestnet',
}: {
  registry: IRegistry;
  chainMetadataOverrides: ChainMap<Partial<ChainMetadata> | undefined>;
  warpCoreConfigOverrides: WarpCoreConfig[];
  fuelWalletUnlocked?: WalletUnlocked;
  fuelChain?: string;
}) {
  try {
    const coreConfig = await assembleWarpCoreConfig(warpCoreConfigOverrides);
    const chainsInTokens = Array.from(new Set(coreConfig.tokens.map((t) => t.chainName)));
    // Pre-load registry content to avoid repeated requests
    await registry.listRegistryContent();
    const { chainMetadata, chainMetadataWithOverrides } = await assembleChainMetadata(
      chainsInTokens,
      registry,
      chainMetadataOverrides,
    );
    const multiProvider = new MultiProtocolProvider(chainMetadataWithOverrides);
    const hasFuelChain = Object.values(chainMetadataWithOverrides).some(
      (chain) => chain.protocol === ProtocolType.Fuel,
    );

    let warpCore: WarpCore;

    if (hasFuelChain && fuelWalletUnlocked) {
      const fuelProvider = await multiProvider.getFuelProvider('fueltestnet');
      if (fuelProvider) {
        const testWallet = Wallet.generate({ provider: fuelProvider });
        multiProvider.setFuelSigner(fuelChain, testWallet);
        warpCore = await WarpCore.FromConfigWithFuel(
          multiProvider,
          coreConfig,
          testWallet,
          fuelChain,
        );
      } else {
        warpCore = WarpCore.FromConfig(multiProvider, coreConfig);
      }
    } else {
      warpCore = WarpCore.FromConfig(multiProvider, coreConfig);
    }

    return { registry, chainMetadata, multiProvider, warpCore, hasFuelChain };
  } catch (error) {
    toast.error('Error initializing warp context. Please check connection status and configs.');
    logger.error('Error initializing warp context', error);
    return {
      registry,
      chainMetadata: {},
      multiProvider: new MultiProtocolProvider({}),
      warpCore: new WarpCore(new MultiProtocolProvider({}), []),
      hasFuelChain: false,
    };
  }
}

// Export a function to reinitialize the WarpCore when the Fuel wallet state changes
export async function reinitializeWarpCore(
  fuelWalletUnlocked: WalletUnlocked,
  fuelChain: string = 'fueltestnet',
) {
  const store = useStore.getState();

  const { multiProvider, warpCore, hasFuelChain } = await initWarpContext({
    registry: store.registry,
    chainMetadataOverrides: store.chainMetadataOverrides,
    warpCoreConfigOverrides: store.warpCoreConfigOverrides,
    fuelWalletUnlocked,
    fuelChain,
  });

  store.setWarpContext({
    registry: store.registry,
    chainMetadata: store.chainMetadata,
    multiProvider,
    warpCore,
    hasFuelChain,
  });

  return { multiProvider, warpCore, hasFuelChain };
}
