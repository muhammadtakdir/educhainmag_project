'use client';

import { useState, useEffect } from 'react';
import { Lesson, QuizQuestion } from '@/types';
import { Button, Card, Alert, ProgressBar } from 'react-bootstrap';

interface QuizPlayerProps {
  lesson: Lesson;
  onQuizComplete: (score: number, totalQuestions: number) => void;
}

// Helper function to shuffle an array
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function QuizPlayer({ lesson, onQuizComplete }: QuizPlayerProps) {
  const [shuffledQuestions, setShuffledQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  const startQuiz = () => {
    if (lesson.quizQuestions) {
      setShuffledQuestions(shuffleArray(lesson.quizQuestions));
    }
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setIsAnswerSubmitted(false);
    setScore(0);
    setQuizFinished(false);
  };

  useEffect(() => {
    startQuiz();
  }, [lesson]);

  const handleAnswerSelect = (optionIndex: number) => {
    if (!isAnswerSubmitted) {
      setSelectedAnswer(optionIndex);
    }
  };

  const handleSubmitAnswer = () => {
    if (selectedAnswer === null) return;

    setIsAnswerSubmitted(true);
    const currentQuestion = shuffledQuestions[currentQuestionIndex];
    if (selectedAnswer === currentQuestion.correctAnswer) {
      setScore(score + 1);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < shuffledQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedAnswer(null);
      setIsAnswerSubmitted(false);
    } else {
      setQuizFinished(true);
      // Call the callback with the final score
      onQuizComplete(score, shuffledQuestions.length);
    }
  };

  if (!lesson.quizQuestions || lesson.quizQuestions.length === 0) {
    return <Alert variant="info">This lesson is a quiz, but no questions have been added yet.</Alert>;
  }

  if (quizFinished) {
    const percentage = (score / shuffledQuestions.length) * 100;
    const passed = percentage >= 70;

    return (
      <Card className="bg-dark text-white shadow">
        <Card.Body className="text-center">
          <Card.Title>Quiz Completed!</Card.Title>
          <Card.Text>
            Your final score is: {score} out of {shuffledQuestions.length}
          </Card.Text>
          <ProgressBar 
            now={percentage} 
            label={`${Math.round(percentage)}%`} 
            variant={passed ? 'success' : 'danger'} 
          />
          {!passed && (
            <Button variant="primary" onClick={startQuiz} className="mt-3">
              Retry Quiz
            </Button>
          )}
        </Card.Body>
      </Card>
    );
  }

  const currentQuestion = shuffledQuestions[currentQuestionIndex];

  // Guard against undefined question, though the check above should prevent this.
  if (!currentQuestion) {
    return <Alert variant="warning">Error: Could not load quiz question.</Alert>;
  }

  const progress = ((currentQuestionIndex + 1) / shuffledQuestions.length) * 100;

  return (
    <Card className="bg-dark text-white shadow">
      <Card.Header>
        <Card.Title>Quiz: {lesson.title}</Card.Title>
        <ProgressBar now={progress} label={`Question ${currentQuestionIndex + 1} of ${shuffledQuestions.length}`} />
      </Card.Header>
      <Card.Body>
        <p className="lead">{currentQuestion.question}</p>
        <div className="d-grid gap-2">
          {currentQuestion.options.map((option, index) => {
            const isCorrect = index === currentQuestion.correctAnswer;
            let variant = 'outline-light';
            if (isAnswerSubmitted) {
              if (isCorrect) {
                variant = 'success';
              } else if (selectedAnswer === index) {
                variant = 'danger';
              }
            }

            return (
              <Button
                key={index}
                variant={variant}
                onClick={() => handleAnswerSelect(index)}
                active={selectedAnswer === index}
                disabled={isAnswerSubmitted}
              >
                {option}
              </Button>
            );
          })}
        </div>
        {isAnswerSubmitted && (
          <Alert variant={selectedAnswer === currentQuestion.correctAnswer ? 'success' : 'danger'} className="mt-3">
            {selectedAnswer === currentQuestion.correctAnswer ? 'Correct!' : 'Jawaban salah.'}
          </Alert>
        )}
      </Card.Body>
      <Card.Footer className="text-end">
        {!isAnswerSubmitted ? (
          <Button onClick={handleSubmitAnswer} disabled={selectedAnswer === null}>Submit</Button>
        ) : (
          <Button onClick={handleNextQuestion}>Next</Button>
        )}
      </Card.Footer>
    </Card>
  );
}
