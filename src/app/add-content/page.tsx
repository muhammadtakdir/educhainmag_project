"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useWalletState } from '@/context/WalletContext';
import { isContentProvider, addModule, getModulesByProvider } from '@/lib/firebase/content';
import { Alert, Button, Form, Spinner, Card, ListGroup } from 'react-bootstrap';
import { Module } from '@/types';

export default function AddContentPage() {
  const { userAddress } = useWalletState();
  const userId = userAddress;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProvider, setIsProvider] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);
  const [existingModules, setExistingModules] = useState<Module[]>([]);
  const [newlyAddedModuleId, setNewlyAddedModuleId] = useState<string | null>(null);

  // Module form states
  const [moduleTitle, setModuleTitle] = useState('');
  const [moduleDescription, setModuleDescription] = useState('');
  const [moduleCoverImage, setModuleCoverImage] = useState('');
  const [moduleDuration, setModuleDuration] = useState('');
  const [moduleDifficulty, setModuleDifficulty] = useState<Module['difficulty']>('Basic');
  const [moduleTopics, setModuleTopics] = useState('');
  const [modulePriceAda, setModulePriceAda] = useState<number>(0);

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
          const modules = await getModulesByProvider(userId);
          setExistingModules(modules);
        } else {
          setError("You are not registered as a content provider. Please register first.");
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

  const handleAddModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    setLoading(true);
    setMessage(null);
    setNewlyAddedModuleId(null);

    try {
      const newModule: Omit<Module, 'id'> = {
        title: moduleTitle,
        description: moduleDescription,
        coverImage: moduleCoverImage,
        estimatedDuration: moduleDuration,
        difficulty: moduleDifficulty,
        topics: moduleTopics.split(',').map(t => t.trim()).filter(t => t.length > 0),
        order: 0, // Will be set by Firebase or managed later
        contentProviderId: userId,
        priceAda: modulePriceAda,
      };
      const newModuleId = await addModule(newModule);
      setNewlyAddedModuleId(newModuleId);
      setMessage({ type: 'success', text: 'Module added successfully! Now you can add lessons to it.' });
      
      // Refresh module list
      const modules = await getModulesByProvider(userId);
      setExistingModules(modules);

      // Reset module form
      setModuleTitle('');
      setModuleDescription('');
      setModuleCoverImage('');
      setModuleDuration('');
      setModuleDifficulty('Basic');
      setModuleTopics('');
      setModulePriceAda(0);
    } catch (err) {
      console.error("Error adding module:", err);
      setMessage({ type: 'danger', text: `Failed to add module: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setLoading(false);
    }
  };

  if (loading && !existingModules.length) {
    return <div className="container mt-5 text-center"><Spinner animation="border" /> Loading...</div>;
  }

  if (error) {
    return (
      <div className="container mt-5 text-center">
        <Alert variant="danger">{error}</Alert>
        {!isProvider && userId && (
          <p>Please <Link href="/register-provider">register here</Link> to become a content provider.</p>
        )}
      </div>
    );
  }

  if (!userId || !isProvider) {
    return (
      <div className="container mt-5 text-center">
        <Alert variant="warning">You must be a registered content provider and have your wallet connected to add content.</Alert>
        {!userId && <p>Please connect your wallet.</p>}
        {!isProvider && userId && <p>Please <Link href="/register-provider">register here</Link> to become a content provider.</p>}
      </div>
    );
  }

  return (
    <div className="container mt-5" style={{ maxWidth: '800px' }}>
      <h1 className="mb-4 text-center">Content Management</h1>
      {message && (
        <Alert variant={message.type}>
          {message.text}
          {message.type === 'success' && newlyAddedModuleId && (
            <div className="mt-2">
              <Link href="/add-lesson" passHref>
                <Button variant="primary">Add Lessons Now</Button>
              </Link>
            </div>
          )}
        </Alert>
      )}

      <Card className="bg-dark text-white shadow mb-4">
        <Card.Header>Add New Module</Card.Header>
        <Card.Body>
          <Form onSubmit={handleAddModule}>
            <Form.Group className="mb-3" controlId="moduleTitle">
              <Form.Label>Module Title</Form.Label>
              <Form.Control type="text" value={moduleTitle} onChange={(e) => setModuleTitle(e.target.value)} required />
            </Form.Group>
            <Form.Group className="mb-3" controlId="moduleDescription">
              <Form.Label>Description</Form.Label>
              <Form.Control as="textarea" rows={3} value={moduleDescription} onChange={(e) => setModuleDescription(e.target.value)} required />
            </Form.Group>
            <Form.Group className="mb-3" controlId="moduleCoverImage">
              <Form.Label>Cover Image URL</Form.Label>
              <Form.Control type="url" value={moduleCoverImage} onChange={(e) => setModuleCoverImage(e.target.value)} />
            </Form.Group>
            <Form.Group className="mb-3" controlId="moduleDuration">
              <Form.Label>Estimated Duration</Form.Label>
              <Form.Control type="text" value={moduleDuration} onChange={(e) => setModuleDuration(e.target.value)} />
            </Form.Group>
            <Form.Group className="mb-3" controlId="moduleDifficulty">
              <Form.Label>Difficulty</Form.Label>
              <Form.Select value={moduleDifficulty} onChange={(e) => setModuleDifficulty(e.target.value as Module['difficulty'])}>
                <option value="Basic">Basic</option>
                <option value="Menengah">Menengah</option>
                <option value="Mahir">Mahir</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3" controlId="moduleTopics">
              <Form.Label>Topics (comma-separated)</Form.Label>
              <Form.Control type="text" value={moduleTopics} onChange={(e) => setModuleTopics(e.target.value)} />
            </Form.Group>
            <Form.Group className="mb-3" controlId="modulePriceAda">
              <Form.Label>Price (ADA)</Form.Label>
              <Form.Control type="number" value={modulePriceAda} onChange={(e) => setModulePriceAda(parseFloat(e.target.value))} min="0" step="0.000001" />
            </Form.Group>
            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? <Spinner animation="border" size="sm" className="me-2" /> : null}
              Add Module
            </Button>
          </Form>
        </Card.Body>
      </Card>

      {existingModules.length > 0 && (
        <Card className="bg-dark text-white shadow mt-4">
          <Card.Header>Existing Modules</Card.Header>
          <ListGroup variant="flush">
            {existingModules.map((module) => (
              <ListGroup.Item key={module.id} className="bg-dark text-white d-flex justify-content-between align-items-center">
                {module.title}
                <Link href="/add-lesson" passHref>
                   <Button variant="outline-primary" size="sm">
                     Add Lessons
                   </Button>
                </Link>
              </ListGroup.Item>
            ))}
          </ListGroup>
        </Card>
      )}
    </div>
  )
}
