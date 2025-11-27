"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import { useWallet } from '@meshsdk/react';
import { Certificate } from '@/types';
import { useSearchParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import CertificateDisplay from '@/components/certificate/CertificateDisplay';
import { getUserById } from '@/lib/firebase/users';
import { getModuleById } from '@/lib/firebase/content';


export default function CertificatesPage() {
  const { wallet, connected } = useWallet();
  const [userId, setUserId] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const certificateId = searchParams.get('certificateId');
  const moduleId = searchParams.get('moduleId');

  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [minting, setMinting] = useState(false);

  useEffect(() => {
    const fetchUserAddress = async () => {
      if (connected && wallet) {
        setUserId((await wallet.getUsedAddresses())[0]);
      } else {
        setUserId(null);
      }
    };
    fetchUserAddress();
  }, [connected, wallet]);

  useEffect(() => {
    const fetchCertificates = async () => {
      setLoading(true);
      console.log("Fetching certificates. certificateId:", certificateId);
      if (certificateId) {
        try {
          const docRef = doc(db, "certificates", certificateId as string);
          const docSnap = await getDoc(docRef);
          console.log("docSnap exists:", docSnap.exists());
          if (docSnap.exists()) {
            const data = docSnap.data();
            console.log("Fetched certificate data:", data);
            const user = await getUserById(data.userId);
            const module = await getModuleById(data.moduleId);
            setCertificates([{
              id: docSnap.id,
              userId: data.userId,
              moduleId: data.moduleId,
              issuedAt: data.issuedAt.toDate(),
              onChainDetails: data.onChainDetails,
              visualCertificateUrl: data.visualCertificateUrl,
              userName: user?.displayName,
              moduleTitle: module?.title,
            }]);
          } else {
            setError("Certificate not found.");
          }
        } catch (err) {
          console.error("Error fetching certificate:", err);
          setError("Failed to load certificate.");
        } finally {
          setLoading(false);
        }
      } else if (userId) {
        try {
          const q = query(collection(db, "certificates"), where("userId", "==", userId));
          const querySnapshot = await getDocs(q);
          const fetchedCertificates: Certificate[] = [];
          for (const doc of querySnapshot.docs) {
            const data = doc.data();
            const user = await getUserById(data.userId);
            const module = await getModuleById(data.moduleId);
            fetchedCertificates.push({
              id: doc.id,
              userId: data.userId,
              moduleId: data.moduleId,
              issuedAt: data.issuedAt.toDate(),
              onChainDetails: data.onChainDetails,
              visualCertificateUrl: data.visualCertificateUrl,
              userName: user?.displayName,
              moduleTitle: module?.title,
            } as Certificate);
          }
          setCertificates(fetchedCertificates);
        } catch (err) {
          console.error("Error fetching certificates:", err);
          setError("Failed to load certificates.");
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
        setError("Please connect your wallet to view your certificates.");
      }
    };

    fetchCertificates();
  }, [userId, certificateId]);

  const mintCertificate = async () => {
    if (!userId || !moduleId) {
      setError("User ID or Module ID is missing.");
      return;
    }

    setMinting(true);
    setError(null);

    try {
      const response = await fetch('/api/mint-certificate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, moduleId }),
      });

      const data = await response.json();

      if (response.ok) {
        alert('Certificate minted successfully! Transaction Hash: ' + data.txHash);
        // Refresh certificates
        const q = query(collection(db, "certificates"), where("userId", "==", userId));
        const querySnapshot = await getDocs(q);
        const fetchedCertificates: Certificate[] = [];
        for (const doc of querySnapshot.docs) {
          const data = doc.data();
          const user = await getUserById(data.userId);
          const module = await getModuleById(data.moduleId);
          fetchedCertificates.push({
            ...data,
            id: doc.id,
            userName: user?.displayName,
            moduleTitle: module?.title,
          } as Certificate);
        }
        setCertificates(fetchedCertificates);
      } else {
        throw new Error(data.error || "Failed to mint certificate.");
      }
    } catch (err) {
      console.error("Error minting certificate:", err);
      setError((err as Error).message);
    } finally {
      setMinting(false);
    }
  };

  const hasMinted = certificates.some(cert => cert.moduleId === moduleId);

  if (loading) {
    return <div className="container mt-4 text-center">Loading certificates...</div>;
  }

  if (error) {
    return <div className="container mt-4 text-center text-danger">Error: {error}</div>;
  }

  return (
    <div className="container mt-4">
      <h1 className="text-center mb-5">My Certificates</h1>
      {moduleId && (
        <div className="text-center mb-4">
          <button
            className="btn btn-primary btn-lg"
            onClick={mintCertificate}
            disabled={minting || hasMinted}
          >
            {minting ? 'Minting...' : (hasMinted ? 'Certificate Already Minted' : 'Mint Certificate')}
          </button>
        </div>
      )}
      {
        certificates.length === 0 ? (
          <div className="text-center text-muted">
            <p className="lead mb-4">You don't have any certificates yet. Start learning now!</p>
            <Link href="/modules" className="btn btn-primary btn-lg">
              Start Learning
            </Link>
          </div>
        ) : (
          <div className="d-flex justify-content-center">
            {certificates.map((certificate) => (
              <CertificateDisplay key={certificate.id} certificate={certificate} />
            ))}
          </div>
        )
      }
    </div>
  );
}