"use client";

import { MeshProvider } from "@meshsdk/react";
import { WalletProvider } from "@/context/WalletContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MeshProvider>
      <WalletProvider>
        {children}
      </WalletProvider>
    </MeshProvider>
  );
}
