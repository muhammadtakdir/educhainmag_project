"use client";

import Link from 'next/link';
import ConnectWallet from '../wallet/ConnectWallet';
import { Navbar, Nav, Container, Form, Button } from 'react-bootstrap';
import { useWallet } from '@meshsdk/react';
import { isContentProvider } from '@/lib/firebase/content';
import { useEffect, useState } from 'react';

const Header = () => {
  const { wallet, connected } = useWallet();
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const userId = userAddress;
  const [isProvider, setIsProvider] = useState(false);

  useEffect(() => {
    const getAddress = async () => {
      if (connected && wallet) {
        const addresses = await wallet.getUsedAddresses();
        setUserAddress(addresses[0]);
      }
    };
    getAddress();
  }, [connected, wallet]);

  useEffect(() => {
    const checkProvider = async () => {
      if (userId) {
        const providerStatus = await isContentProvider(userId);
        setIsProvider(providerStatus);
      } else {
        setIsProvider(false);
      }
    };
    checkProvider();
  }, [userId]);

  return (
    <Navbar bg="dark" variant="dark" expand="lg">
      <Container fluid>
        <Link href="/" className="navbar-brand">
          EduChainMag
        </Link>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
                    <Nav className="me-auto">
                      <Link href="/" className="nav-link">
                        Home
                      </Link>
                      <Link href="/modules" className="nav-link">
                        Modules
                      </Link>
                      {userAddress && (
                        <Link href="/dashboard" className="nav-link">
                          Dashboard
                        </Link>
                      )}
                    </Nav>
                            </Navbar.Collapse>
        <Nav className="d-flex">
          <ConnectWallet />
        </Nav>
      </Container>
    </Navbar>
  );
};

export default Header;
