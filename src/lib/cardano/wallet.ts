import { MeshWallet } from '@meshsdk/wallet';

export function getWallet(skey: string): MeshWallet {
  // In a real application, you would load the wallet securely
  // For demonstration purposes, we are creating a dummy wallet
  // based on the provided private key. 
  // This is NOT secure for production.
  return new MeshWallet({
    networkId: 0, // 0 for testnet, 1 for mainnet
    key: {
      type: 'cli', // Assuming skey is a CLI payment key
      payment: skey,
    },
  });
}
