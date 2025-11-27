"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useWalletState } from '@/context/WalletContext';
import { getLessonById, updateLesson } from '@/lib/firebase/content';
import { Lesson, QuizQuestion } from '@/types';
import { Form, Button, Container, Alert, Spinner, Card, Row, Col } from 'react-bootstrap';
import { v4 as uuidv4 } from 'uuid';

export default function EditLessonPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const moduleId = searchParams.get('moduleId');
  const lessonId = searchParams.get('lessonId');
  const { userAddress } = useWalletState();

  const [title, setTitle] = useState('');
  const [contentType, setContentType] = useState<Lesson['contentType']>('text');
  const [content, setContent] = useState('');
  const [introduction, setIntroduction] = useState('');
  const [order, setOrder] = useState(1);
  const [isPremium, setIsPremium] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const fetchLesson = async () => {
      if (!moduleId || !lessonId) {
        setError("Module ID or Lesson ID is missing.");
        setLoading(false);
        return;
      }
      try {
        const lessonData = await getLessonById(moduleId, lessonId);
        if (lessonData) {
          setTitle(lessonData.title);
          setContentType(lessonData.contentType);
          setContent(lessonData.content);
          setIntroduction(lessonData.introduction || '');
          setOrder(lessonData.order);
          setIsPremium(lessonData.isPremium);
          setQuizQuestions(lessonData.quizQuestions || []);
        } else {
          setError("Lesson not found.");
        }
      } catch (err) {
        console.error("Error fetching lesson:", err);
        setError("Failed to fetch lesson data.");
      } finally {
        setLoading(false);
      }
    };

    fetchLesson();
  }, [moduleId, lessonId]);

  const handleAddQuizQuestion = () => {
    setQuizQuestions([...quizQuestions, { id: uuidv4(), question: '', options: ['', '', '', ''], correctAnswer: 0 }]);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!moduleId || !lessonId) {
      setError("Module ID or Lesson ID is missing.");
      return;
    }

    if (!userAddress) {
      setError("You must be logged in to edit a lesson.");
      return;
    }

    setLoading(true);
    try {
      const updatedData: Partial<Lesson> = {
        title,
        contentType,
        content,
        introduction,
        order,
        isPremium,
      };

      if (contentType === 'quiz') {
        if (quizQuestions.length === 0) {
          throw new Error("A quiz must have at least one question.");
        }
        updatedData.quizQuestions = quizQuestions;
        updatedData.content = "This lesson is a quiz. See the questions attached.";
      }

      await updateLesson(moduleId, lessonId, updatedData);
      setSuccess("Lesson updated successfully!");
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (err) {
      console.error("Error updating lesson:", err);
      setError(`Failed to update lesson: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Container className="mt-5 text-center">
        <Spinner animation="border" /> Loading lesson...
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

  return (
    <Container className="mt-5">
      <h2>Edit Lesson</h2>
      {success && <Alert variant="success">{success}</Alert>}
      <Form onSubmit={handleSubmit}>
        <Form.Group className="mb-3" controlId="formLessonTitle">
          <Form.Label>Lesson Title</Form.Label>
          <Form.Control
            type="text"
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

        {contentType !== 'quiz' ? (
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
        ) : (
          <Card className="bg-secondary text-white shadow-sm mb-4">
            <Card.Header>Quiz Questions</Card.Header>
            <Card.Body>
              {quizQuestions.map((q, qIndex) => (
                <div key={q.id || qIndex} className="mb-4 p-3 border rounded">
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

        <Button variant="primary" type="submit" disabled={loading}>
          {loading ? <Spinner as="span" animation="border" size="sm" /> : 'Update Lesson'}
        </Button>
      </Form>
    </Container>
  );
}
