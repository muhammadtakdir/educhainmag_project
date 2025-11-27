"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useWalletState } from '@/context/WalletContext';
import { isContentProvider, addLesson, getModulesByProvider } from '@/lib/firebase/content';
import { Alert, Button, Form, Spinner, Card, ListGroup, Col, Row } from 'react-bootstrap';
import { Module, Lesson, QuizQuestion } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export default function AddLessonPage() {
  const { userAddress } = useWalletState();
  const userId = userAddress;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProvider, setIsProvider] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);
  const [existingModules, setExistingModules] = useState<Module[]>([]);
  const [currentModuleId, setCurrentModuleId] = useState<string>('');

  // Lesson form states
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonContentType, setLessonContentType] = useState<Lesson['contentType']>('text');
  const [lessonContent, setLessonContent] = useState('');
  const [lessonOrder, setLessonOrder] = useState(1);
  const [lessonIsPremium, setLessonIsPremium] = useState(false);
  
  // Quiz form states
  const [quizQuestions, setQuizQuestions] = useState<Omit<QuizQuestion, 'id'>[]>([]);

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
          if (modules.length > 0) {
            setCurrentModuleId(modules[0].id);
          }
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

  const handleAddQuizQuestion = () => {
    setQuizQuestions([...quizQuestions, { question: '', options: ['', '', '', ''], correctAnswer: 0 }]);
  };

  const handleQuizQuestionChange = (index: number, field: string, value: string) => {
    const newQuestions = [...quizQuestions];
    (newQuestions[index] as any)[field] = value;
    setQuizQuestions(newQuestions);
  };

  const handleOptionChange = (qIndex: number, oIndex: number, value: string) => {
    const newQuestions = [...quizQuestions];
    newQuestions[qIndex].options[oIndex] = value;
    setQuizQuestions(newQuestions);
  };

  const handleCorrectAnswerChange = (qIndex: number, oIndex: number) => {
    const newQuestions = [...quizQuestions];
    newQuestions[qIndex].correctAnswer = oIndex;
    setQuizQuestions(newQuestions);
  };

  const handleRemoveQuizQuestion = (index: number) => {
    const newQuestions = quizQuestions.filter((_, i) => i !== index);
    setQuizQuestions(newQuestions);
  };

  const handleAddLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentModuleId) {
        setMessage({ type: 'danger', text: 'Please select a module first.' });
        return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const lessonData: Omit<Lesson, 'id'> = {
        title: lessonTitle,
        contentType: lessonContentType,
        content: lessonContent,
        order: lessonOrder,
        isPremium: lessonIsPremium,
      };

      if (lessonContentType === 'quiz') {
        if (quizQuestions.length === 0) {
          throw new Error("Please add at least one quiz question.");
        }
        // Add unique IDs to quiz questions before saving
        lessonData.quizQuestions = quizQuestions.map(q => ({ ...q, id: uuidv4() }));
        lessonData.content = "This lesson is a quiz. See the questions attached."; // Placeholder content
      }

      await addLesson(currentModuleId, lessonData);
      setMessage({ type: 'success', text: 'Lesson added successfully!' });
      
      // Reset lesson form
      setLessonTitle('');
      setLessonContentType('text');
      setLessonContent('');
      setLessonOrder(prev => prev + 1);
      setLessonIsPremium(false);
      setQuizQuestions([]);

    } catch (err) {
      console.error("Error adding lesson:", err);
      setMessage({ type: 'danger', text: `Failed to add lesson: ${err instanceof Error ? err.message : String(err)}` });
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
        <Alert variant="warning">You must be a registered content provider and have your wallet connected to add lessons.</Alert>
        {!userId && <p>Please connect your wallet.</p>}
        {!isProvider && userId && <p>Please <Link href="/register-provider">register here</Link> to become a content provider.</p>}
      </div>
    );
  }

  return (
    <div className="container mt-5" style={{ maxWidth: '800px' }}>
      <h1 className="mb-4 text-center">Add New Lesson</h1>
      {message && <Alert variant={message.type}>{message.text}</Alert>}

      <Card className="bg-dark text-white shadow">
        <Card.Header>Add a Lesson to a Module</Card.Header>
        <Card.Body>
          <Form onSubmit={handleAddLesson}>
            <Form.Group className="mb-3" controlId="selectModule">
                <Form.Label>Select Module</Form.Label>
                <Form.Select value={currentModuleId} onChange={(e) => setCurrentModuleId(e.target.value)} required>
                    <option value="" disabled>-- Select a Module --</option>
                    {existingModules.map(module => (
                        <option key={module.id} value={module.id}>{module.title}</option>
                    ))}
                </Form.Select>
            </Form.Group>

            <hr className="my-4" />

            <Form.Group className="mb-3" controlId="lessonTitle">
              <Form.Label>Lesson Title</Form.Label>
              <Form.Control type="text" value={lessonTitle} onChange={(e) => setLessonTitle(e.target.value)} required />
            </Form.Group>

            <Form.Group className="mb-3" controlId="lessonOrder">
              <Form.Label>Order</Form.Label>
              <Form.Control type="number" value={lessonOrder} onChange={(e) => setLessonOrder(parseInt(e.target.value))} min="1" />
            </Form.Group>

            <Form.Group className="mb-3" controlId="lessonContentType">
              <Form.Label>Content Type</Form.Label>
              <Form.Select value={lessonContentType} onChange={(e) => setLessonContentType(e.target.value as Lesson['contentType'])}>
                <option value="text">Text</option>
                <option value="video">Video URL</option>
                <option value="quiz">Quiz</option>
                <option value="image">Image URL</option>
                <option value="audio">Audio URL</option>
                <option value="interactive_code">Interactive Code</option>
              </Form.Select>
            </Form.Group>

            {lessonContentType !== 'quiz' && (
              <Form.Group className="mb-3" controlId="lessonContent">
                <Form.Label>Content</Form.Label>
                <Form.Control 
                  as="textarea" 
                  rows={5} 
                  value={lessonContent} 
                  onChange={(e) => setLessonContent(e.target.value)} 
                  placeholder={
                    lessonContentType === 'video' ? 'Enter YouTube or Vimeo video URL' :
                    lessonContentType === 'image' ? 'Enter image URL' :
                    lessonContentType === 'audio' ? 'Enter audio file URL' :
                    'Enter lesson content here...'
                  }
                  required 
                />
              </Form.Group>
            )}

            {lessonContentType === 'quiz' && (
              <Card className="bg-secondary text-white shadow-sm mb-4">
                <Card.Header>Quiz Questions</Card.Header>
                <Card.Body>
                  {quizQuestions.map((q, qIndex) => (
                    <div key={qIndex} className="mb-4 p-3 border rounded">
                      <Form.Group as={Row} className="mb-2">
                        <Form.Label column sm={2}>Question {qIndex + 1}</Form.Label>
                        <Col sm={10}>
                          <Form.Control
                            type="text"
                            placeholder="Enter the quiz question"
                            value={q.question}
                            onChange={(e) => handleQuizQuestionChange(qIndex, 'question', e.target.value)}
                            required
                          />
                        </Col>
                      </Form.Group>
                      {q.options.map((opt, oIndex) => (
                        <Form.Group as={Row} key={oIndex} className="align-items-center mb-1">
                          <Form.Label column sm={2}>Option {oIndex + 1}</Form.Label>
                          <Col sm={8}>
                            <Form.Control
                              type="text"
                              placeholder={`Enter option ${oIndex + 1}`}
                              value={opt}
                              onChange={(e) => handleOptionChange(qIndex, oIndex, e.target.value)}
                              required
                            />
                          </Col>
                          <Col sm={2}>
                            <Form.Check
                              type="radio"
                              label="Correct"
                              name={`correct-answer-${qIndex}`}
                              checked={q.correctAnswer === oIndex}
                              onChange={() => handleCorrectAnswerChange(qIndex, oIndex)}
                            />
                          </Col>
                        </Form.Group>
                      ))}
                      <Button variant="outline-danger" size="sm" onClick={() => handleRemoveQuizQuestion(qIndex)} className="mt-2">
                        Remove Question
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline-primary" onClick={handleAddQuizQuestion}>
                    Add Question
                  </Button>
                </Card.Body>
              </Card>
            )}

            <Form.Group className="mb-3" controlId="lessonIsPremium">
              <Form.Check
                type="checkbox"
                label="Premium Content (requires payment)"
                checked={lessonIsPremium}
                onChange={(e) => setLessonIsPremium(e.target.checked)}
              />
            </Form.Group>

            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? <Spinner animation="border" size="sm" className="me-2" /> : null}
              Add Lesson
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
}
