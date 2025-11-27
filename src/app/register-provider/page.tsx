"use client";

import { useState, useEffect } from 'react';
import { useWalletState } from '@/context/WalletContext';
import { registerContentProvider, isContentProvider } from '@/lib/firebase/content';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import Link from 'next/link';

export default function RegisterProviderPage() {
  const { userAddress } = useWalletState();
  const userId = userAddress;

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);
  const [isProvider, setIsProvider] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkProviderStatus = async () => {
      if (!userId) {
        setError("Please connect your wallet.");
        return;
      }
      setLoading(true);
      try {
        const providerStatus = await isContentProvider(userId);
        setIsProvider(providerStatus);
        if (providerStatus) {
          setMessage({ type: 'success', text: 'You are already registered as a content provider.' });
        }
      } catch (err) {
        console.error("Error checking provider status:", err);
        setError("Failed to check provider status.");
      } finally {
        setLoading(false);
      }
    };

    checkProviderStatus();
  }, [userId]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      setMessage({ type: 'danger', text: 'Please connect your wallet first.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      await registerContentProvider(userId, displayName, email);
      setMessage({ type: 'success', text: 'Registration successful! You are now a content provider.' });
      setIsProvider(true);
    } catch (err) {
      console.error("Error registering content provider:", err);
      setMessage({ type: 'danger', text: `Registration failed: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mt-5 text-center">
        <Spinner animation="border" /> Loading...
      </div>
    );
  }
  
  if (!userId) {
    return (
      <div className="container mt-5 text-center">
        <Alert variant="warning">Please connect your wallet to register as a content provider.</Alert>
      </div>
    );
  }

  if (isProvider) {
    return (
      <div className="container mt-5 text-center">
        <Alert variant="success">You are already registered as a content provider.</Alert>
        <p>You can now proceed to add content.</p>
        <Link href="/add-content" className="btn btn-primary">Add New Content</Link>
      </div>
    );
  }

  return (
    <div className="container mt-5" style={{ maxWidth: '600px' }}>
      <h1 className="mb-4 text-center">Register as Content Provider</h1>
      {message && <Alert variant={message.type}>{message.text}</Alert>}
      <Form onSubmit={handleRegister}>
        <Form.Group className="mb-3" controlId="formDisplayName">
          <Form.Label>Display Name</Form.Label>
          <Form.Control
            type="text"
            placeholder="Enter your display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
        </Form.Group>

        <Form.Group className="mb-3" controlId="formEmail">
          <Form.Label>Email (Optional)</Form.Label>
          <Form.Control
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Form.Group>

        <Button variant="primary" type="submit" disabled={loading || !userId}>
          {loading ? <Spinner animation="border" size="sm" className="me-2" /> : null}
          Register
        </Button>
      </Form>
    </div>
  );
}
