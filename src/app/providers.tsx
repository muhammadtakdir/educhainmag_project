"use client";

import { MeshProvider } from "@meshsdk/react";
import { blockchainProvider } from "@/config/network";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MeshProvider>
      {children}
    </MeshProvider>
  );
}
