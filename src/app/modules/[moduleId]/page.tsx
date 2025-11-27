"use client";

import { useState, useEffect, useRef } from 'react';
import { useWallet } from '@meshsdk/react';
import { getModuleById, getLessonsByModule } from '@/lib/firebase/content';
import { startModule, completeLesson, completeModule } from '@/lib/firebase/progress';
import { getUserProgress, checkContentAccess, grantContentAccess, getAccessDetails } from '@/lib/firebase/access';
import { Spinner, Alert, Container, Row, Col, Card, Button, ListGroup, ProgressBar, Modal } from 'react-bootstrap';
import { Module, Lesson, UserProgress, Certificate } from '@/types';


import { initiateEscrow } from '@/lib/cardano/escrow';
import QuizPlayer from '@/components/course/QuizPlayer'; // Import the QuizPlayer
import { FaCheckCircle, FaLock } from 'react-icons/fa';

import { useRouter } from 'next/navigation';

const PLATFORM_WALLET_ADDRESS = process.env.NEXT_PUBLIC_PLATFORM_WALLET_ADDRESS as string; // IMPORTANT: Replace with your actual platform wallet address for preview testnet

export default function ModulePage({ params }: { params: { moduleId: string } }) {
  const router = useRouter();

  const { moduleId } = params;
  const { wallet, connected } = useWallet();
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const userId = userAddress;

  useEffect(() => {
    const getAddress = async () => {
      if (connected && wallet) {
        const addresses = await wallet.getUsedAddresses();
        setUserAddress(addresses[0]);
      } else {
        setUserAddress(null);
      }
    };
    getAddress();
  }, [connected, wallet]);

  const [module, setModule] = useState<Module | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);


  // Quiz specific state
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [quizPassed, setQuizPassed] = useState<boolean | null>(null);
  const [videoProgress, setVideoProgress] = useState<number>(0);



  const [isClient, setIsClient] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    setIsClient(true);
    // Set the mounted flag to false when the component unmounts
    return () => {
      isMounted.current = false;
    };
  }, []);



  useEffect(() => {

    const fetchModuleData = async () => {

      try {

        setLoading(true);

        const moduleData = await getModuleById(moduleId);

        if (moduleData) {

          setModule(moduleData);

          const lessonData = await getLessonsByModule(moduleId);

                    const sortedLessons = lessonData.sort((a, b) => a.order - b.order);

          

                    setLessons(sortedLessons);

          

                    if (userId) {

          

                      const progress = await getUserProgress(userId, moduleId);

                      setUserProgress(progress);

          



          

                      const access = await checkContentAccess(userId, moduleId);

          

                      setHasAccess(access);

            setHasAccess(access);

            if (progress && progress.currentLessonId) {

              const currentLesson = sortedLessons.find(l => l.id === progress.currentLessonId);

              setSelectedLesson(currentLesson || sortedLessons[0]);

            } else {

              setSelectedLesson(sortedLessons[0]);

            }

          } else {

            setSelectedLesson(sortedLessons[0]);

          }

        } else {

          setError("Module not found.");

        }

      } catch (err) {

        console.error("Error fetching module data:", err);

        setError("Failed to fetch module data.");

      } finally {

        setLoading(false);

      }

    };

        fetchModuleData();

    

      }, [moduleId, userId]);

    



    

      const handleEnroll = async () => {

    if (!userId || !lessons.length) return;

    try {

      await startModule(userId, moduleId, lessons[0].id);

      const progress = await getUserProgress(userId, moduleId);

      setUserProgress(progress);

    } catch (err) {

      console.error("Error enrolling in module:", err);

      setError("Failed to enroll in module.");

    }

  };

  const handleSelectLesson = (lesson: Lesson) => {
    if (isLessonUnlocked(lesson)) {
      setSelectedLesson(lesson);
      // Reset quiz and video state when changing lessons
      setQuizSubmitted(false);
      setQuizScore(null);
      setQuizPassed(null);
      setVideoProgress(0);
    }
  };

  const handleCompleteLesson = async () => {
    if (!userId || !selectedLesson || selectedLesson.contentType === 'quiz') return;

    try {
      await completeLesson(userId, moduleId, selectedLesson.id);
      const progress = await getUserProgress(userId, moduleId);
      setUserProgress(progress);

      const currentIndex = lessons.findIndex(l => l.id === selectedLesson.id);
      const totalLessons = lessons.length;
      const completedLessonsCount = progress ? progress.completedLessons.length : 0;


      if (currentIndex < lessons.length - 1) {
        setSelectedLesson(lessons[currentIndex + 1]);
      } else {
        // Last lesson completed, mark module as complete
        await completeModule(userId, moduleId);
        const updatedProgress = await getUserProgress(userId, moduleId);
        setUserProgress(updatedProgress);
        setShowCompletionModal(true); // Show completion modal

      }
    } catch (err) {
      console.error("Error completing lesson:", err);
      setError("Failed to complete lesson.");
    }
  };



  const handleNext = () => {
    if (!selectedLesson) return;

    // For quizzes, completion is handled in handleQuizComplete.
    // For other types, we mark as complete and then move to the next lesson.
    if (selectedLesson.contentType !== 'quiz') {
        handleCompleteLesson();
    } else {
        // Just move to the next lesson if the quiz is passed
        const currentIndex = lessons.findIndex(l => l.id === selectedLesson.id);
        if (currentIndex < lessons.length - 1) {
            const nextLesson = lessons[currentIndex + 1];
            if (isLessonUnlocked(nextLesson)) {
                setSelectedLesson(nextLesson);
            }
        }
    }
  };

  const handleQuizComplete = async (finalScore: number, totalQuestions: number) => {
    if (!userId || !module || !selectedLesson) return;

    const percentageScore = (finalScore / totalQuestions) * 100;
    setQuizScore(percentageScore);
    setQuizSubmitted(true);

    const passed = percentageScore >= 70;
    setQuizPassed(passed);

    if (passed) {
      await completeLesson(userId, moduleId, selectedLesson.id);
      const isLastLesson = lessons.findIndex(l => l.id === selectedLesson.id) === lessons.length - 1;
      if (isLastLesson) {
        await completeModule(userId, moduleId);
      }
      const progress = await getUserProgress(userId, moduleId);
      setUserProgress(progress);
    }
  };

  const isLessonUnlocked = (lesson: Lesson): boolean => {
    if (!userProgress) return false;
    const lessonIndex = lessons.findIndex(l => l.id === lesson.id);
    if (lessonIndex === 0) return true; // First lesson is always unlocked
    const previousLesson = lessons[lessonIndex - 1];
    return userProgress.completedLessons.includes(previousLesson.id);
  };


  const isLessonCompleted = (lesson: Lesson): boolean => {

    return userProgress?.completedLessons.includes(lesson.id) || false;

  };



  const getEmbedUrl = (url: string): string => {

    if (!url) return '';

    try {

      const urlObj = new URL(url);

      let videoId;



      if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {

        videoId = urlObj.hostname.includes('youtu.be')

          ? urlObj.pathname.substring(1)

          : urlObj.searchParams.get('v');

        if (videoId) return `https://www.youtube.com/embed/${videoId}`;

      } else if (urlObj.hostname.includes('vimeo.com')) {

        videoId = urlObj.pathname.substring(1);

        if (videoId) return `https://player.vimeo.com/video/${videoId}`;

      }

    } catch (error) {

      console.error("Invalid URL for embed:", error);

      return url;

    }

    return url;

  };







  const handlePayment = async () => {
    if (!connected || !module || !module.priceAda || !userId) return;

    setPaymentProcessing(true);
    setError(null);

    try {
      const priceLovelace = module.priceAda * 1_000_000;

      const txHash = await initiateEscrow({
        wallet,
        mentorAddr: module.contentProviderId!,
        studentAddr: userId!,
        amount: priceLovelace,
      });

      // The initiateEscrow function handles the initiation and submission
      // We just need to grant content access based on the successful creation.
      await grantContentAccess(userId!, moduleId, txHash);
      setHasAccess(true);

    } catch (err) {
      console.error("Payment failed:", err);
      setError("Payment failed. Please try again.");
    } finally {
      setPaymentProcessing(false);
    }
  };




  const renderLessonContent = () => {

    if (!selectedLesson) {
      return <p>Select a lesson to begin.</p>;
    }

    if (selectedLesson.isPremium && !hasAccess && userId !== module?.contentProviderId) {
        return (
            <Card className="text-center">
              <Card.Body>
                <Card.Title>This is a premium lesson</Card.Title>
                <Card.Text>
                  To access this lesson and the rest of the module, please make a payment of {module?.priceAda} ADA.
                </Card.Text>
                <Button onClick={handlePayment} disabled={paymentProcessing || !connected}>
                  {paymentProcessing ? <Spinner as="span" animation="border" size="sm" /> : `Pay ${module?.priceAda} ADA`}
                </Button>
                {!connected && <p className="text-danger mt-2">Please connect your wallet to pay.</p>}
              </Card.Body>
            </Card>
        );
    }

    // Handle quiz type
    if (selectedLesson.contentType === 'quiz') {
      if (!quizSubmitted) {
        return <QuizPlayer lesson={selectedLesson} onQuizComplete={handleQuizComplete} />;
      }
      // After quiz is submitted, show results
      const isLastLesson = lessons.findIndex(l => l.id === selectedLesson.id) === lessons.length - 1;

      return (
        <div className="mt-4 p-3 bg-secondary rounded">
          <h3 className="h5 mb-2">Your Quiz Results:</h3>
          <p>Score: {quizScore?.toFixed(2)}%</p>
          {quizPassed ? (
            <p className="text-success fw-bold">Congratulations! You passed this quiz.</p>
          ) : (
            <div>
              <p className="text-danger fw-bold">Sorry, you did not pass this quiz.</p>
              <Button variant="primary" onClick={() => setQuizSubmitted(false)} className="mt-2">
                Try Again
              </Button>
            </div>
          )}
          {isLastLesson && userProgress?.status === 'completed' && (
            <div className="mt-3 text-center">
              <p className="mb-2 fw-bold">You have completed all lessons in this module!</p>

            </div>
          )}
        </div>
      );
    }

    // Handle other content types
    return (
      <>
        {selectedLesson.introduction && <p>{selectedLesson.introduction}</p>}
        {selectedLesson.contentType === 'video' && (
          <div className="ratio ratio-16x9">
            <iframe src={getEmbedUrl(selectedLesson.content)} title={selectedLesson.title} allowFullScreen></iframe>
          </div>
        )}
        {selectedLesson.contentType === 'image' && (
          <img src={selectedLesson.content} alt={selectedLesson.title} className="img-fluid" />
        )}
        {selectedLesson.contentType === 'audio' && (
          <audio controls src={selectedLesson.content} className="w-100" />
        )}
        {selectedLesson.contentType === 'text' && (
          <p>{selectedLesson.content}</p>
        )}
      </>
    );
  };



  if (loading) {

    return <div className="container mt-5 text-center"><Spinner animation="border" /> Loading module...</div>;

  }



  if (error) {

    return <div className="container mt-5 text-center"><Alert variant="danger">{error}</Alert></div>;

  }



  if (!module) {

    return <div className="container mt-5 text-center"><Alert variant="warning">Module not found.</Alert></div>;

  }



  return (

    <Container fluid className="mt-5">

      <Row>

        <Col md={4}>

          <Card className="mb-4">

            <Card.Header>

              <h3>{module.title}</h3>

            </Card.Header>

            <Card.Body>
              <p>{module.description}</p>
              {userProgress && lessons.length > 0 && (
                <div className="mb-3">
                  <p className="mb-1">Progress: {userProgress.completedLessons.length} / {lessons.length}</p>
                  <ProgressBar 
                    now={(userProgress.completedLessons.length / lessons.length) * 100} 
                    variant={userProgress.status === 'completed' ? 'success' : 'primary'}
                  />
                </div>
              )}
              {!userProgress && userId && (

                <Button onClick={handleEnroll} className="w-100">Enroll to Start Learning</Button>

              )}

            </Card.Body>

          </Card>

          <ListGroup>

            {lessons.map((lesson) => (

              <ListGroup.Item

                key={lesson.id}

                onClick={() => handleSelectLesson(lesson)}

                active={selectedLesson?.id === lesson.id}

                disabled={!isLessonUnlocked(lesson)}

                style={{ cursor: isLessonUnlocked(lesson) ? 'pointer' : 'not-allowed' }}

              >

                <div className="d-flex justify-content-between align-items-center">

                  {lesson.title}

                  {isLessonCompleted(lesson) ? <FaCheckCircle color="green" /> : !isLessonUnlocked(lesson) ? <FaLock color="gray" /> : null}

                </div>

              </ListGroup.Item>

            ))}

          </ListGroup>

        </Col>

        <Col md={8}>

          {selectedLesson ? (

            <Card>

              <Card.Header>

                <h4>{selectedLesson.title}</h4>

              </Card.Header>

              <Card.Body>

                {renderLessonContent()}

              </Card.Body>

              <Card.Footer>
                {selectedLesson && userProgress?.status !== 'completed' && (() => {
                  const isCompleted = userProgress?.completedLessons.includes(selectedLesson.id);

                  // For quiz content
                  if (selectedLesson.contentType === 'quiz') {
                    return (
                      <Button onClick={handleNext} disabled={!quizPassed && !isCompleted}>
                        Next
                      </Button>
                    );
                  }

                  // For video content
                  if (selectedLesson.contentType === 'video') {
                    return (
                      <>
                        <Button onClick={() => setVideoProgress(100)} className="me-2">Simulate Watch Video</Button>
                        <Button onClick={handleNext} disabled={videoProgress < 75 && !isCompleted}>
                          Next
                        </Button>
                      </>
                    );
                  }

                  // For text or image content
                  if (selectedLesson.contentType === 'text' || selectedLesson.contentType === 'image') {
                    return (
                      <Button onClick={handleNext}>
                        Next
                      </Button>
                    );
                  }

                  return null; // Or a default button if needed
                })()}
              </Card.Footer>

            </Card>

          ) : (

            <div className="text-center">

              <p>Select a lesson to begin.</p>

            </div>

          )}

        </Col>

      </Row>



      <Modal show={showCompletionModal} onHide={() => router.push('/dashboard')} centered>
        <Modal.Header closeButton>
          <Modal.Title>Congratulations!</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center">
          <p>You have successfully completed this module.</p>
          <p>You will be redirected to the dashboard.</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="primary" onClick={() => router.push('/dashboard')}>
            Back to Dashboard
          </Button>
        </Modal.Footer>
      </Modal>

    </Container>

  );

}
