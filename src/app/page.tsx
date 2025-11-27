"use client";

import Link from 'next/link';
import { useWallet } from '@meshsdk/react';
import { isContentProvider } from '@/lib/firebase/content';
import { useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';

export default function Home() {
  const { wallet, connected } = useWallet();
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const userId = userAddress;
  const [isProvider, setIsProvider] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/modules?q=${searchQuery.trim()}`);
    }
  };

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
    <div className="container mt-4">
      {/* Hero Section */}
      <section className="text-center py-5 bg-dark text-white rounded-3 mb-5">
        <div className="container mb-4">
          <div className="alert alert-warning" role="alert">
            <h4 className="alert-heading">WARNING: Educational & Testing Purpose Only</h4>
            <p>
              Please ensure you are using the <strong>Cardano PREVIEW TESTNET</strong> network. 
              Do not use Mainnet funds. 
            </p>
            <hr />
            <p className="mb-0">
              For source code and contribution, visit: <a href="https://github.com/muhammadtakdir/educhainmag_project" target="_blank" rel="noopener noreferrer" className="alert-link">https://github.com/muhammadtakdir/educhainmag_project</a>
            </p>
          </div>
        </div>
        <h1 className="display-4 fw-bold mb-3">Explore the World of Web3 on Cardano!</h1>
        <p className="fs-5 mb-4">
          An interactive educational platform to learn about blockchain, Aiken smart contracts, and the Cardano ecosystem.
        </p>
        <div className="mb-4">
          <form onSubmit={handleSearch} className="d-flex justify-content-center">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Type to search for modules..."
              className="form-control form-control-lg w-50 me-2"
              aria-label="Search Modules"
            />
            <button type="submit" className="btn btn-success btn-lg">Search</button>
          </form>
        </div>

        <div>
          <Link href="/modules" className="btn btn-primary btn-lg me-2">
            Start Learning Now!
          </Link>
          {userId && !isProvider && (
            <Link href="/register-provider" className="btn btn-outline-light btn-lg">
              Register as a Writer
            </Link>
          )}
        </div>
      </section>

      {/* Why EduChainMag Section */}
      <section className="py-5">
        <h2 className="text-center mb-5">Why EduChainMag?</h2>
        <div className="row row-cols-1 row-cols-md-3 g-4">
          <div className="col">
            <div className="card bg-dark text-white h-100">
              <div className="card-body">
                <h3 className="card-title h5">Interactive Learning</h3>
                <p className="card-text">Modules are equipped with quizzes and practical exercises.</p>
              </div>
            </div>
          </div>
          <div className="col">
            <div className="card bg-dark text-white h-100">
              <div className="card-body">
                <h3 className="card-title h5">On-chain Certificates</h3>
                <p className="card-text">Get irrefutable digital proof (NFT/SBT) of your achievements.</p>
              </div>
            </div>
          </div>
          <div className="col">
            <div className="card bg-dark text-white h-100">
              <div className="card-body">
                <h3 className="card-title h5">English Content</h3>
                <p className="card-text">Understand difficult concepts without language barriers.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Newest Modules Section */}
      <section className="py-5">
        <h2 className="text-center mb-5">Newest Modules</h2>
        <div className="row row-cols-1 row-cols-md-3 g-4">
          {/* Module Card Placeholder */}
          <div className="col">
            <div className="card bg-dark text-white h-100">
              <div className="card-img-top bg-secondary" style={{ height: '180px' }}></div>
              <div className="card-body">
                <h3 className="card-title h5">Introduction to Blockchain & Web3</h3>
                <p className="card-text">Estimated Duration: 2 Hours</p>
                <Link href="/modules/introduction-to-blockchain-web3" className="btn btn-outline-primary">
                  View Module
                </Link>
              </div>
            </div>
          </div>
          {/* Module Card Placeholder */}
          <div className="col">
            <div className="card bg-dark text-white h-100">
              <div className="card-body">
                <h3 className="card-title h5">Aiken Fundamentals</h3>
                <p className="card-text">Estimated Duration: 4 Hours</p>
                <Link href="/modules/aiken-fundamentals" className="btn btn-outline-primary">
                  View Module
                </Link>
              </div>
            </div>
          </div>
          {/* Module Card Placeholder */}
          <div className="col">
            <div className="card bg-dark text-white h-100">
              <div className="card-img-top bg-secondary" style={{ height: '180px' }}></div>
              <div className="card-body">
                <h3 className="card-title h5">Building a dApp with Mesh.js</h3>
                <p className="card-text">Estimated Duration: 6 Hours</p>
                <Link href="/modules/building-a-dapp-with-meshjs" className="btn btn-outline-primary">
                  View Module
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
