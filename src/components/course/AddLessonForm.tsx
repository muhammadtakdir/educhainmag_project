"use client";

import { useState } from 'react';
import { useWalletState } from '@/context/WalletContext';
import { addLesson } from '@/lib/firebase/content';
import { Lesson } from '@/types';
import { Form, Button, Alert, Spinner } from 'react-bootstrap';

interface AddLessonFormProps {
  moduleId: string;
  onLessonAdded: () => void;
  onCancel: () => void;
}

export default function AddLessonForm({ moduleId, onLessonAdded, onCancel }: AddLessonFormProps) {
  const { userAddress } = useWalletState();
  const [title, setTitle] = useState('');
  const [contentType, setContentType] = useState<Lesson['contentType']>('text');
  const [content, setContent] = useState('');
  const [introduction, setIntroduction] = useState('');
  const [order, setOrder] = useState(1);
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!userAddress) {
      setError("You must be logged in to add a lesson.");
      return;
    }

    setLoading(true);
    try {
      const lessonData: Omit<Lesson, 'id'> = {
        title,
        contentType,
        content,
        introduction,
        order,
        isPremium,
      };
      await addLesson(moduleId, lessonData);
      setSuccess("Lesson added successfully!");
      onLessonAdded();
      setTimeout(() => {
        onCancel();
      }, 2000);
    } catch (err) {
      console.error("Error adding lesson:", err);
      setError("Failed to add lesson. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const renderContentInput = () => {
    switch (contentType) {
      case 'video':
        return (
          <Form.Group className="mb-3" controlId="formLessonContent">
            <Form.Label>Video URL</Form.Label>
            <Form.Control
              type="url"
              placeholder="https://example.com/video"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            />
          </Form.Group>
        );
      case 'image':
        return (
          <Form.Group className="mb-3" controlId="formLessonContent">
            <Form.Label>Image URL</Form.Label>
            <Form.Control
              type="url"
              placeholder="https://example.com/image.jpg"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            />
          </Form.Group>
        );
      case 'audio':
        return (
          <Form.Group className="mb-3" controlId="formLessonContent">
            <Form.Label>Audio URL</Form.Label>
            <Form.Control
              type="url"
              placeholder="https://example.com/audio.mp3"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            />
          </Form.Group>
        );
      case 'text':
      default:
        return (
          <Form.Group className="mb-3" controlId="formLessonContent">
            <Form.Label>Content</Form.Label>
            <Form.Control
              as="textarea"
              rows={5}
              placeholder="Enter lesson content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            />
          </Form.Group>
        );
    }
  };

  return (
    <div className="mt-4">
      <h5>Add New Lesson</h5>
      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}
      <Form onSubmit={handleSubmit}>
        <Form.Group className="mb-3" controlId="formLessonTitle">
          <Form.Label>Lesson Title</Form.Label>
          <Form.Control
            type="text"
            placeholder="Enter lesson title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </Form.Group>

        <Form.Group className="mb-3" controlId="formLessonIntroduction">
          <Form.Label>Introduction</Form.Label>
          <Form.Control
            as="textarea"
            rows={3}
            placeholder="Enter a brief introduction for the lesson"
            value={introduction}
            onChange={(e) => setIntroduction(e.target.value)}
          />
        </Form.Group>

        <Form.Group className="mb-3" controlId="formLessonContentType">
          <Form.Label>Content Type</Form.Label>
          <Form.Select
            value={contentType}
            onChange={(e) => setContentType(e.target.value as Lesson['contentType'])}            required
          >
            <option value="text">Text</option>
            <option value="video">Video</option>
            <option value="image">Image</option>
            <option value="audio">Audio</option>
            <option value="quiz">Quiz</option>
            <option value="interactive_code">Interactive Code</option>
          </Form.Select>
        </Form.Group>

        {renderContentInput()}

        <Form.Group className="mb-3" controlId="lessonOrder">
          <Form.Label>Order</Form.Label>
          <Form.Control type="number" value={order} onChange={(e) => setOrder(parseInt(e.target.value))} min="1" />
        </Form.Group>

        <Form.Group className="mb-3" controlId="lessonIsPremium">
          <Form.Check
            type="checkbox"
            label="Premium Content (requires payment)"
            checked={isPremium}
            onChange={(e) => setIsPremium(e.target.checked)}
          />
        </Form.Group>

        <Button variant="primary" type="submit" disabled={loading} className="me-2">
          {loading ? <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> : 'Add Lesson'}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </Form>
    </div>
  );
}
