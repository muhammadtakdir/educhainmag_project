"use client";

import { Module, Lesson, UserProgress, Certificate } from '@/types';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import { useWallet } from '@meshsdk/react';
import { getUserProgress } from '@/lib/firebase/access';
import { startModule, completeLesson, updateQuizScore, completeModule } from '@/lib/firebase/progress';
import { mintCertificateNft } from '@/lib/cardano/transactions';
import { saveCertificate } from '@/lib/firebase/certificates';
import QuizPlayer from '@/components/course/QuizPlayer';
import { Button, Spinner, Alert } from 'react-bootstrap';

export default function LessonDetailPage({ params }: { params: { moduleId: string; lessonId: string } }) {
  const { moduleId, lessonId } = params;
  const { wallet, connected } = useWallet();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const getAddress = async () => {
      if (connected && wallet) {
        const addresses = await wallet.getUsedAddresses();
        setUserId(addresses[0]);
      } else {
        setUserId(null);
      }
    };
    getAddress();
  }, [connected, wallet]);

  const [module, setModule] = useState<Module | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [allLessons, setAllLessons] = useState<Lesson[]>([]);
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for post-quiz UI
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [quizPassed, setQuizPassed] = useState<boolean | null>(null);
  const [isMinting, setIsMinting] = useState(false);
  const [mintingError, setMintingError] = useState<string | null>(null);
  const [mintingSuccess, setMintingSuccess] = useState<boolean>(false);

  useEffect(() => {
    const fetchLessonData = async () => {
      if (!userId) {
        setLoading(false);
        setError("Please connect your wallet to view lesson progress.");
        return;
      }

      try {
        const moduleRef = doc(db, "modules", moduleId);
        const moduleSnap = await getDoc(moduleRef);
        if (moduleSnap.exists()) {
          setModule({ id: moduleSnap.id, ...moduleSnap.data() } as Module);
        } else {
          setError("Module not found.");
          setLoading(false);
          return;
        }

        const lessonsCollectionRef = collection(db, `modules/${moduleId}/lessons`);
        const lessonsSnapshot = await getDocs(lessonsCollectionRef);
        const fetchedLessons: Lesson[] = [];
        lessonsSnapshot.forEach((lessonDoc) => {
          fetchedLessons.push({ id: lessonDoc.id, ...lessonDoc.data() } as Lesson);
        });
        fetchedLessons.sort((a, b) => a.order - b.order);
        setAllLessons(fetchedLessons);

        const currentLesson = fetchedLessons.find((l) => l.id === lessonId);
        if (currentLesson) {
          setLesson(currentLesson);
        } else {
          setError("Lesson not found.");
          setLoading(false);
          return;
        }

        const progress = await getUserProgress(userId, moduleId);
        setUserProgress(progress);

        if (!progress && fetchedLessons.length > 0) {
          await startModule(userId, moduleId, fetchedLessons[0].id);
          const updatedProgress = await getUserProgress(userId, moduleId);
          setUserProgress(updatedProgress);
        }

      } catch (err) {
        console.error("Error fetching lesson data:", err);
        setError("Failed to load lesson data.");
      } finally {
        setLoading(false);
      }
    };

    if (userId && moduleId && lessonId) {
      fetchLessonData();
    }
  }, [userId, moduleId, lessonId]);

  const handleCompleteLesson = async () => {
    if (userId && module && lesson) {
      await completeLesson(userId, module.id, lesson.id);
      const updatedProgress = await getUserProgress(userId, module.id);
      setUserProgress(updatedProgress);
    }
  };

  const handleQuizComplete = async (finalScore: number, totalQuestions: number) => {
    if (!userId || !module) return;

    const percentageScore = (finalScore / totalQuestions) * 100;
    setQuizScore(percentageScore);
    setQuizSubmitted(true);

    await updateQuizScore(userId, module.id, percentageScore);

    const passed = percentageScore >= 70;
    setQuizPassed(passed);

    if (passed) {
      await completeModule(userId, module.id);
      const updatedProgress = await getUserProgress(userId, module.id);
      setUserProgress(updatedProgress);
    }
  };
  
  const handleClaimCertificate = async () => {
    if (!userId || !module || !wallet) {
      setMintingError("Wallet not connected or module data missing.");
      return;
    }

    setIsMinting(true);
    setMintingError(null);
    setMintingSuccess(false);

    try {
      // Temporarily disabled due to library mismatch (Mesh vs Lucid)
      console.log("Minting certificate for:", module.title);
      // const onChainDetails = await mintCertificateNft(wallet, userId, module.id, module.title);
      
      const newCertificate: Omit<Certificate, 'id'> = {
        userId,
        moduleId: module.id,
        issuedAt: new Date(),
        onChainDetails: {
            policyId: "mock-policy-id",
            assetName: "mock-asset-name",
            txHash: "mock-tx-hash",
            cardanoscanUrl: "#"
        },
        visualCertificateUrl: `#`,
      };
      await saveCertificate(newCertificate);

      setMintingSuccess(true);
      alert("Sertifikat berhasil disimpan (Minting on-chain dinonaktifkan sementara)!");
    } catch (err) {
      console.error("Error minting or saving certificate:", err);
      setMintingError("Gagal mengklaim sertifikat NFT. Silakan coba lagi.");
    } finally {
      setIsMinting(false);
    }
  };

  if (loading) {
    return <div className="container mt-4 text-center">Loading lesson...</div>;
  }

  if (error) {
    return <div className="container mt-4 text-center text-danger">Error: {error}</div>;
  }

  if (!module || !lesson) {
    return <div className="container mt-4 text-center">Pelajaran atau Modul tidak ditemukan.</div>;
  }

  const currentLessonIndex = allLessons.findIndex((l) => l.id === lessonId);
  const previousLesson = currentLessonIndex > 0 ? allLessons[currentLessonIndex - 1] : null;
  const nextLesson = currentLessonIndex < allLessons.length - 1 ? allLessons[currentLessonIndex + 1] : null;

  const isLessonCompleted = userProgress?.completedLessons.includes(lesson.id);
  const isModuleCompleted = userProgress?.status === "completed";

  return (
    <div className="container mt-4">
      <h1 className="mb-4">{module.title}</h1>
      <h2 className="h4 mb-4">{lesson.title}</h2>

      <div className="row">
        <div className="col-md-3">
          <div className="card bg-dark text-white shadow">
            <div className="card-header">
              <h2 className="h5 mb-0">Pelajaran</h2>
            </div>
            <ul className="list-group list-group-flush">
              {allLessons.map((l) => (
                <li key={l.id} className="list-group-item bg-dark text-white">
                  <Link href={`/modules/${moduleId}/${l.id}`} className={`d-block p-2 rounded text-decoration-none ${lesson.id === l.id ? 'bg-primary text-white' : 'text-white hover:bg-secondary'}`}>
                    {l.order}. {l.title}
                    {userProgress?.completedLessons.includes(l.id) && (
                      <span className="ms-2 text-success">✓</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="col-md-9">
          <div className="card bg-dark text-white shadow">
            <div className="card-body">
              <h2 className="card-title h4 mb-3">{lesson.title}</h2>
              <div className="card-text">
                {lesson.contentType === 'text' && (
                  <p>{lesson.content}</p>
                )}
                {lesson.contentType === 'quiz' && (
                  <div>
                    {!quizSubmitted ? (
                       <QuizPlayer lesson={lesson} onQuizComplete={handleQuizComplete} />
                    ) : (
                      <div className="mt-4 p-3 bg-secondary rounded">
                        <h3 className="h5 mb-2">Hasil Kuis Anda:</h3>
                        <p>Skor: {quizScore?.toFixed(2)}%</p>
                        {quizPassed ? (
                          <p className="text-success fw-bold">Selamat! Anda lulus kuis ini.</p>
                        ) : (
                          <div>
                            <p className="text-danger fw-bold">Maaf, Anda belum lulus kuis ini. Silakan coba lagi.</p>
                            <Button variant="primary" onClick={() => setQuizSubmitted(false)} className="mt-2">
                              Coba Lagi
                            </Button>
                          </div>
                        )}
                        {quizPassed && !mintingSuccess && (
                          <div className="mt-3">
                            <p className="mb-2">Anda telah menyelesaikan modul ini!</p>
                            <button
                              onClick={handleClaimCertificate}
                              className="btn btn-info"
                              disabled={isMinting}
                            >
                              {isMinting ? "Mengklaim..." : "Klaim Sertifikat NFT Anda!"}
                            </button>
                            {mintingError && <p className="text-danger mt-2">Error: {mintingError}</p>}
                            {mintingSuccess && <p className="text-success mt-2">Sertifikat berhasil diklaim!</p>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {/* Add more content types as needed */}
              </div>

              {/* Navigation Buttons */}
              <div className="d-flex justify-content-between mt-4">
                {previousLesson ? (
                  <Link href={`/modules/${moduleId}/${previousLesson.id}`} className="btn btn-secondary">
                    &larr; {previousLesson.title}
                  </Link>
                ) : (
                  <button className="btn btn-secondary" disabled>
                    Sebelumnya
                  </button>
                )}

                {!isLessonCompleted && lesson.contentType !== 'quiz' && (
                  <button
                    onClick={handleCompleteLesson}
                    className="btn btn-success"
                  >
                    Tandai Selesai
                  </button>
                )}

                {nextLesson ? (
                  <Link 
                    href={`/modules/${moduleId}/${nextLesson.id}`} 
                    className={`btn btn-primary ${lesson.contentType === 'quiz' && !quizPassed ? 'disabled' : ''}`}
                    onClick={(e) => { if (lesson.contentType === 'quiz' && !quizPassed) e.preventDefault(); }}
                  >
                    {nextLesson.title} &rarr;
                  </Link>
                ) : (
                  <button className="btn btn-primary" disabled={lesson.contentType === 'quiz' && !quizPassed}>
                    Selesai Modul
                  </button>
                )}
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}