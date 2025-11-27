"use client";

import { Button, Dropdown } from 'react-bootstrap';
import { useWallet } from "@meshsdk/react";
import { useEffect, useState } from "react";

const ConnectWallet = () => {
  const { connect, disconnect, connecting, connected, wallet } = useWallet();
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [availableWallets, setAvailableWallets] = useState<any[]>([]);

  useEffect(() => {
    if (window.cardano) {
      setAvailableWallets(Object.values(window.cardano));
    }
  }, []);

  useEffect(() => {
    const getAddress = async () => {
      if (connected && wallet) {
        const addresses = await wallet.getUsedAddresses();
        setUserAddress(addresses[0]);
      } else {
        setUserAddress(null);
      }
    };
    getAddress();
  }, [connected, wallet]);

  return (
    <>
      {connected ? (
        <div className="d-flex align-items-center">
          {userAddress && (
            <span className="text-info me-2 fw-bold">
              Welcome, {`${userAddress.substring(0, 6)}...${userAddress.slice(-4)}`}
            </span>
          )}
          <Button variant="danger" size="sm" onClick={() => disconnect()}>
            Disconnect
          </Button>
        </div>
      ) : (
        <Dropdown>
          <Dropdown.Toggle variant="primary" id="dropdown-basic" disabled={connecting}>
            {connecting ? "Connecting..." : "Connect Wallet"}
          </Dropdown.Toggle>

          <Dropdown.Menu variant="dark">
            {availableWallets.length === 0 ? (
              <Dropdown.ItemText>No wallets found. Please install a Cardano wallet.</Dropdown.ItemText>
            ) : (
              availableWallets.map((w) => (
                <Dropdown.Item key={w.name} onClick={() => connect(w.name)}>
                  <img src={w.icon} alt={w.name} style={{ width: '24px', height: '24px', marginRight: '8px' }} />
                  {w.name}
                </Dropdown.Item>
              ))
            )}
          </Dropdown.Menu>
        </Dropdown>
      )}
    </>
  );
};

export default ConnectWallet;
