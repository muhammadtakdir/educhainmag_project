import { BlockfrostProvider } from '@meshsdk/core';

type Network = 'mainnet' | 'preprod' | 'preview';

const currentNetwork: Network = 'preview'; // Easily switch here

const blockfrostProviders = {
  mainnet: new BlockfrostProvider(process.env.NEXT_PUBLIC_BLOCKFROST_KEY_MAINNET as string),
  preprod: new BlockfrostProvider(process.env.NEXT_PUBLIC_BLOCKFROST_KEY_PREPROD as string),
  preview: new BlockfrostProvider(process.env.NEXT_PUBLIC_BLOCKFROST_KEY_PREVIEW as string),
};

export const blockchainProvider = blockfrostProviders[currentNetwork];
export const network: Network = currentNetwork;
