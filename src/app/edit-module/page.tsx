"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useWalletState } from '@/context/WalletContext';
import { getModuleById, updateModule } from '@/lib/firebase/content';
import { Module } from '@/types';
import { Form, Button, Container, Alert, Spinner } from 'react-bootstrap';

export default function EditModulePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const moduleId = searchParams.get('moduleId');
  const { userAddress } = useWalletState();
  
  const [module, setModule] = useState<Module | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState<'Beginner' | 'Intermediate' | 'Advanced'>('Beginner');
  const [topics, setTopics] = useState('');
  const [priceAda, setPriceAda] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const fetchModule = async () => {
      if (!moduleId) {
        setError("Module ID is missing.");
        setLoading(false);
        return;
      }
      try {
        const moduleData = await getModuleById(moduleId as string);
        if (moduleData) {
          setModule(moduleData);
          setTitle(moduleData.title);
          setDescription(moduleData.description);
          // Map Indonesian difficulty terms to English for the state
          const mappedDifficulty = (diff: "Basic" | "Menengah" | "Mahir"): 'Beginner' | 'Intermediate' | 'Advanced' => {
            switch (diff) {
              case "Basic": return "Beginner";
              case "Menengah": return "Intermediate";
              case "Mahir": return "Advanced";
              default: return "Beginner"; // Default to Beginner if unknown
            }
          };
          setDifficulty(mappedDifficulty(moduleData.difficulty));
          setTopics(moduleData.topics.join(', '));
          setPriceAda(moduleData.priceAda || 0);
        } else {
          setError("Module not found.");
        }
      } catch (err) {
        console.error("Error fetching module:", err);
        setError("Failed to fetch module data.");
      } finally {
        setLoading(false);
      }
    };

    fetchModule();
  }, [moduleId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!moduleId) {
      setError("Module ID is missing.");
      return;
    }

    if (!userAddress) {
      setError("You must be logged in to edit a module.");
      return;
    }

    setLoading(true);
    try {
      const updatedData: Partial<Module> = {
        title,
        description,
        difficulty,
        topics: topics.split(',').map(topic => topic.trim()),
        priceAda,
      };
      await updateModule(moduleId as string, updatedData);
      setSuccess("Module updated successfully!");
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (err) {
      console.error("Error updating module:", err);
      setError("Failed to update module. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Container className="mt-5 text-center">
        <Spinner animation="border" /> Loading module...
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="mt-5 text-center">
        <Alert variant="danger">{error}</Alert>
      </Container>
    );
  }

  if (!module) {
    return (
      <Container className="mt-5 text-center">
        <Alert variant="warning">Module not found.</Alert>
      </Container>
    );
  }

  return (
    <Container className="mt-5">
      <h2>Edit Module</h2>
      {success && <Alert variant="success">{success}</Alert>}
      <Form onSubmit={handleSubmit}>
        <Form.Group className="mb-3" controlId="formModuleTitle">
          <Form.Label>Title</Form.Label>
          <Form.Control
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </Form.Group>

        <Form.Group className="mb-3" controlId="formModuleDescription">
          <Form.Label>Description</Form.Label>
          <Form.Control
            as="textarea"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </Form.Group>

        <Form.Group className="mb-3" controlId="formModuleDifficulty">
          <Form.Label>Difficulty</Form.Label>
          <Form.Select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as 'Beginner' | 'Intermediate' | 'Advanced')}
            required
          >
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
          </Form.Select>
        </Form.Group>

        <Form.Group className="mb-3" controlId="formModuleTopics">
          <Form.Label>Topics (comma-separated)</Form.Label>
          <Form.Control
            type="text"
            value={topics}
            onChange={(e) => setTopics(e.target.value)}
            required
          />
        </Form.Group>

        <Form.Group className="mb-3" controlId="formModulePrice">
          <Form.Label>Price (in ADA)</Form.Label>
          <Form.Control
            type="number"
            value={priceAda}
            onChange={(e) => setPriceAda(Number(e.target.value))}
            required
          />
        </Form.Group>

        <Button variant="primary" type="submit" disabled={loading}>
          {loading ? <Spinner as="span" animation="border" size="sm" /> : 'Update Module'}
        </Button>
      </Form>
    </Container>
  );
}
