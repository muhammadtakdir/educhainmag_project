"use client";

import { createContext, useContext, useEffect, useReducer, ReactNode, useState } from 'react';
import { useWallet } from '@meshsdk/react';

type WalletState = {
  isConnected: boolean;
  walletName: string | null;
  userAddress: string | null;
};

type WalletAction = 
  | { type: 'CONNECT'; payload: { walletName: string; userAddress: string; } } 
  | { type: 'DISCONNECT' };

const WalletStateContext = createContext<WalletState | undefined>(undefined);
const WalletDispatchContext = createContext<React.Dispatch<WalletAction> | undefined>(undefined);

const walletReducer = (state: WalletState, action: WalletAction): WalletState => {
  switch (action.type) {
    case 'CONNECT':
      return { ...state, isConnected: true, walletName: action.payload.walletName, userAddress: action.payload.userAddress };
    case 'DISCONNECT':
      return { ...state, isConnected: false, walletName: null, userAddress: null };
    default:
      throw new Error('Unknown action type');
  }
};

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(walletReducer, {
    isConnected: false,
    walletName: null,
    userAddress: null,
  });
  const { connected, name, wallet } = useWallet();

  useEffect(() => {
    const syncWalletState = async () => {
      if (connected && wallet) {
        const addresses = await wallet.getUsedAddresses();
        const address = addresses[0];
        dispatch({ type: 'CONNECT', payload: { walletName: name, userAddress: address || '' } });
      } else {
        dispatch({ type: 'DISCONNECT' });
      }
    };
    syncWalletState();
  }, [connected, name, wallet]);

  return (
    <WalletStateContext.Provider value={state}>
      <WalletDispatchContext.Provider value={dispatch}>
        {children}
      </WalletDispatchContext.Provider>
    </WalletStateContext.Provider>
  );
};

export const useWalletState = () => {
  const context = useContext(WalletStateContext);
  if (context === undefined) {
    throw new Error('useWalletState must be used within a WalletProvider');
  }
  return context;
};

export const useWalletDispatch = () => {
  const context = useContext(WalletDispatchContext);
  if (context === undefined) {
    throw new Error('useWalletDispatch must be used within a WalletProvider');
  }
  return context;
};
