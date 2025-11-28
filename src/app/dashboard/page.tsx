"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useWallet } from '@meshsdk/react';
import { getModulesByProvider, getModuleById, getLessonsByModule, getContentProvider, deleteModule, updateLesson, deleteLesson } from '@/lib/firebase/content';
import { getAllUserProgress } from '@/lib/firebase/progress';
import { getCertificateByUserAndModule } from '@/lib/firebase/certificates';
import { getUserById, updateUserDisplayName, getUsersWithProgress } from '@/lib/firebase/users';
import { getUserProgress } from '@/lib/firebase/access';
import { Module, UserProgress, Lesson, ContentProvider, Certificate, User } from '@/types';
import { Alert, Spinner, Button, ProgressBar, Accordion, ListGroup, Form, InputGroup, Card, Modal, Table, Badge } from 'react-bootstrap';
import { EduDatum, MESHJS_BUG_INFO } from '@/lib/cardano/escrow';
import { claimFundsCSL } from '@/lib/cardano/escrow-csl';
import { resolvePaymentKeyHash } from '@meshsdk/core';

// API-based escrow addresses
const CORRECT_SCRIPT_ADDRESS = "addr_test1wprmuqd5uef4almr7afqy22leqd0kxuqvd0qk0z46ygwccgjj5d2u";
const OLD_SCRIPT_ADDRESS = "addr_test1wrvqe3g6vnsp27ckv073qz8785rzxl38pyjdyga40l4k5ysj73xxt";

interface ProgressWithModule extends UserProgress {
  module: Module;
  certificate?: Certificate | null;
}

// API response UTxO format
interface ApiUtxo {
  txHash: string;
  outputIndex: number;
  address: string;
  amount: Array<{ unit: string; quantity: string }>;
  datumHash?: string;
  inlineDatumCbor?: string; // CBOR hex from Blockfrost inline_datum
  datumJson?: any;
}

interface EscrowDisplay {
  utxo: ApiUtxo;
  datum: EduDatum;
  studentName?: string;
  moduleTitle?: string;
  progressPercent: number;
  isLocked: boolean; // TRUE if this escrow uses old MeshJS hash (unspendable)
}

export default function DashboardPage() {
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
  const [isClient, setIsClient] = useState(false);
  const [myModules, setMyModules] = useState<Module[]>([]);
  const [learningProgress, setLearningProgress] = useState<ProgressWithModule[]>([]);
  const [provider, setProvider] = useState<ContentProvider | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const [showNameModal, setShowNameModal] = useState(false);
  const [mintingState, setMintingState] = useState<{[key: string]: boolean}>({});
  
  // Escrow States
  const [escrows, setEscrows] = useState<EscrowDisplay[]>([]);
  const [loadingEscrows, setLoadingEscrows] = useState(false);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const mintCertificate = async (moduleId: string) => {
    if (!userId) {
      setError("User ID is missing.");
      return;
    }

    setMintingState(prev => ({...prev, [moduleId]: true}));
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
        fetchDashboardData(); // Refresh data
      } else {
        throw new Error(data.error || "Failed to mint certificate.");
      }
    } catch (err) {
      console.error("Error minting certificate:", err);
      setError((err as Error).message);
    } finally {
      setMintingState(prev => ({...prev, [moduleId]: false}));
    }
  };

  const fetchDashboardData = async () => {
    if (!userId) {
      setError("Please connect your wallet to view the dashboard.");
      setLoading(false);
      return;
    }

    setError(null);
    try {
      setLoading(true);
      const userData = await getUserById(userId);
      setUserProfile(userData);
      if (userData?.displayName) {
        setDisplayNameInput(userData.displayName);
        setShowNameModal(false);
      } else {
        setShowNameModal(true);
      }

      const providerData = await getContentProvider(userId);
      setProvider(providerData);

      let currentModules: Module[] = [];
      if (providerData) {
        const userModules = await getModulesByProvider(userId);
        for (const module of userModules) {
          module.lessons = await getLessonsByModule(module.id);
          module.lessons.forEach((lesson, index) => {
            if (lesson.order === undefined) {
              lesson.order = index + 1;
              updateLesson(module.id, lesson.id, { order: lesson.order });
            }
          });
        }
        setMyModules(userModules);
        currentModules = userModules;
        
        // Fetch Escrows Logic using API route (avoids CORS issues)
        setLoadingEscrows(true);
        try {
          console.log("[ESCROW] Fetching escrows for mentor via API:", userId);
          
          // Call API route to get escrows (server-side Blockfrost)
          const response = await fetch(`/api/escrow?mentor=${encodeURIComponent(userId)}`);
          if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
          }
          const data = await response.json();
          const allEscrows = data.escrows || [];
          
          console.log("[ESCROW] Old escrows (LOCKED):", data.locked);
          console.log("[ESCROW] New escrows (claimable):", data.claimable);
          console.log("[ESCROW] Total escrows:", data.total);
          
          if (allEscrows.length === 0) {
            console.log("[ESCROW] No escrows found");
            setEscrows([]);
          } else {
            const { usersWithProgress } = await getUsersWithProgress();
            console.log("[ESCROW] Fetched users with progress:", usersWithProgress.length);
            
            // Map PKH to User
            const pkhToUserMap = new Map<string, User>();
            for (const user of usersWithProgress) {
              try {
                const pkh = resolvePaymentKeyHash(user.walletAddress);
                pkhToUserMap.set(pkh, user);
              } catch (e) {
                console.warn("[ESCROW] Invalid address for user:", user.walletAddress);
              }
            }

            const displayEscrows: EscrowDisplay[] = [];
            
            for (const escrow of allEscrows) {
              console.log("[ESCROW] Processing escrow with amount:", escrow.datum.amount);
              const studentUser = pkhToUserMap.get(escrow.datum.student);
              let progressPercent = 0;
              let moduleTitle = "Unknown Module";
              
              if (studentUser) {
                console.log("[ESCROW] Student found:", studentUser.displayName);
                
                // Match module by price
                const escrowAda = escrow.datum.amount / 1_000_000;
                console.log("[ESCROW] Escrow amount in ADA:", escrowAda);
                const candidates = currentModules.filter(m => m.priceAda === escrowAda);
                console.log("[ESCROW] Matching modules by price:", candidates.length);
                
                for (const cand of candidates) {
                  try {
                    const progress = await getUserProgress(studentUser.walletAddress, cand.id);
                    if (progress) {
                      console.log("[ESCROW] Progress found for module:", cand.title, "Completed lessons:", progress.completedLessons.length);
                      moduleTitle = cand.title;
                      const totalLessons = cand.lessons?.length || 1;
                      progressPercent = (progress.completedLessons.length / totalLessons) * 100;
                      
                      if (progress.status === 'completed') {
                        progressPercent = 100;
                      }
                      break;
                    }
                  } catch (e) {
                    console.error("[ESCROW] Error fetching progress:", e);
                  }
                }
              }
              
              console.log("[ESCROW] Final escrow display - Student:", studentUser?.displayName, "Module:", moduleTitle, "Progress:", Math.floor(progressPercent) + "%");
              
              displayEscrows.push({
                utxo: escrow.utxo,
                datum: escrow.datum,
                studentName: studentUser?.displayName || "Unknown Student",
                moduleTitle: moduleTitle,
                progressPercent: Math.floor(progressPercent),
                isLocked: escrow.isLocked
              });
            }
            setEscrows(displayEscrows);
          }

        } catch (err) {
          console.error("[ESCROW] Error fetching escrows:", err);
          setError(`Failed to load escrows: ${err instanceof Error ? err.message : "Unknown error"}`);
        } finally {
          setLoadingEscrows(false);
        }
      }

      const progressList = await getAllUserProgress(userId);
      const progressWithModules: ProgressWithModule[] = [];
      for (const progress of progressList) {
        const module = await getModuleById(progress.moduleId);
        if (module) {
          module.lessons = await getLessonsByModule(module.id);
          const progressItem: ProgressWithModule = { ...progress, module };
          if (progress.status === 'completed') {
            progressItem.certificate = await getCertificateByUserAndModule(userId, progress.moduleId);
          }
          progressWithModules.push(progressItem);
        }
      }
      setLearningProgress(progressWithModules);

    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError("Failed to fetch dashboard data.");
    } finally {
      setLoading(false);
    }
  };
  
  // Helper to actually fetch progress (Need to add import first!)
  // For now I'll leave the logic inside fetchDashboardData slightly incomplete and fix imports in next tool call?
  // No, I should do it in one go.
  // I will add `getUserProgress` to imports.

  useEffect(() => {
    if (isClient && userId) {
      fetchDashboardData();
    }
  }, [userId, isClient]);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !displayNameInput) return;
    try {
      await updateUserDisplayName(userId, displayNameInput);
      setShowNameModal(false);
      fetchDashboardData(); // Refresh data to show the new name
      alert("Nama berhasil disimpan!");
    } catch (err) {
      alert("Gagal menyimpan nama.");
      console.error(err);
    }
  };

  const handleDeleteModule = async (moduleId: string) => {
    if (window.confirm('Are you sure you want to delete this module? This action cannot be undone.')) {
      try {
        await deleteModule(moduleId);
        setMyModules(myModules.filter(module => module.id !== moduleId));
        router.refresh();
      } catch (err) {
        console.error("Error deleting module:", err);
        setError("Failed to delete module.");
      }
    }
  };

  const handleDeleteLesson = async (moduleId: string, lessonId: string) => {
    if (window.confirm('Are you sure you want to delete this lesson?')) {
      try {
        await deleteLesson(moduleId, lessonId);
        fetchDashboardData(); // Refresh data
      } catch (err) {
        console.error("Error deleting lesson:", err);
        setError("Failed to delete lesson.");
      }
    }
  };

  const handleMoveLesson = async (moduleId: string, lessonId: string, direction: 'up' | 'down') => {
    const module = myModules.find(m => m.id === moduleId);
    if (!module || !module.lessons) return;

    const lessons = module.lessons.sort((a, b) => a.order - b.order);
    const lessonIndex = lessons.findIndex(l => l.id === lessonId);

    if (lessonIndex === -1) return;

    let otherLessonIndex;
    if (direction === 'up') {
      if (lessonIndex === 0) return;
      otherLessonIndex = lessonIndex - 1;
    } else {
      if (lessonIndex === lessons.length - 1) return;
      otherLessonIndex = lessonIndex + 1;
    }

    const lesson = lessons[lessonIndex];
    const otherLesson = lessons[otherLessonIndex];

    if (lesson.order === undefined || otherLesson.order === undefined) {
      setError("Cannot move a lesson with an undefined order.");
      return;
    }

    try {
      // Swap orders
      const lessonOrder = lesson.order;
      lesson.order = otherLesson.order;
      otherLesson.order = lessonOrder;

      await Promise.all([
        updateLesson(moduleId, lesson.id, { order: lesson.order }),
        updateLesson(moduleId, otherLesson.id, { order: otherLesson.order })
      ]);

      fetchDashboardData(); // Refresh data
    } catch (err) {
      console.error("Error moving lesson:", err);
      setError("Failed to move lesson.");
    }
  };

  const handleClaim = async (escrow: EscrowDisplay, action: "PartialClaim" | "FinalClaim") => {
    if (!wallet || !connected || !userAddress) {
      alert("Please connect your wallet first");
      return;
    }
    
    // Check if escrow is locked
    if (escrow.isLocked) {
      alert("❌ Cannot claim!\n\nThis escrow is PERMANENTLY LOCKED due to MeshJS PlutusV3 bug.\n\nSee MESHJS_BUG_REPORT.md for details.");
      return;
    }
    
    console.log("[CLAIM] Starting claim process (client-side CSL)");
    console.log("[CLAIM] Action:", action);
    console.log("[CLAIM] Progress:", escrow.progressPercent);
    
    setClaiming(true);
    try {
      // Determine actual progress based on action
      let actualProgress = 0;
      if (action === "PartialClaim") {
        if (escrow.progressPercent < 50) {
          throw new Error("Progress must be at least 50% to claim partial payment");
        }
        actualProgress = 50;
      } else if (action === "FinalClaim") {
        if (escrow.progressPercent < 100) {
          throw new Error("Progress must be 100% to claim final payment");
        }
        actualProgress = 100;
      }
      
      console.log("[CLAIM] Using claimFundsCSL (client-side)...");
      
      // Convert API UTxO format to MeshJS UTxO format
      const meshUtxo = {
        input: {
          txHash: escrow.utxo.txHash,
          outputIndex: escrow.utxo.outputIndex,
        },
        output: {
          address: escrow.utxo.address,
          amount: escrow.utxo.amount,
          plutusData: escrow.utxo.inlineDatumCbor, // CBOR hex from API
        },
      };
      
      console.log("[CLAIM] UTxO prepared:", meshUtxo.input.txHash);
      console.log("[CLAIM] Datum CBOR:", escrow.utxo.inlineDatumCbor?.substring(0, 50) + "...");
      console.log("[CLAIM] Datum parsed:", escrow.datum);
      
      // Call claimFundsCSL directly (client-side)
      const txHash = await claimFundsCSL({
        wallet,
        scriptUtxo: meshUtxo as any,
        datum: escrow.datum,
        action,
        currentProgress: actualProgress,
      });
      
      console.log("[CLAIM] Transaction submitted successfully:", txHash);
      alert(`✓ Claim Successful!\nTransaction: ${txHash}`);
      fetchDashboardData();
    } catch (err) {
      console.error("[CLAIM] Claim failed:", err);
      alert(`✗ Claim Failed!\n${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setClaiming(false);
    }
  };

  if (!isClient || loading) {
    return (
      <div className="container mt-5 text-center">
        <Spinner animation="border" /> Loading dashboard...
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mt-5 text-center">
        <Alert variant="danger">{error}</Alert>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="container mt-5 text-center">
        <Alert variant="warning">Please connect your wallet to view the dashboard.</Alert>
      </div>
    );
  }

  return (
    <div className="container mt-5">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1>Dashboard</h1>
          {provider ? (
            <p className="text-white">
              Selamat datang, {provider.displayName}! ({`${userId?.substring(0, 6)}...${userId?.slice(-4)}`})
            </p>
          ) : userProfile?.displayName ? (
            <p className="text-white">
              Selamat datang, {userProfile.displayName}! ({`${userId?.substring(0, 6)}...${userId?.slice(-4)}`})
            </p>
          ) : null}
        </div>
        <Link href="/certificates" className="btn btn-outline-primary">View My Certificates</Link>
      </div>

      <Modal show={showNameModal} backdrop="static" keyboard={false} centered>
        <Modal.Header>
          <Modal.Title>Welcome!</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>To personalize your certificate, please enter your name.</p>
          <Form onSubmit={handleSaveName}>
            <InputGroup>
              <Form.Control
                placeholder="Enter your name..."
                value={displayNameInput}
                onChange={(e) => setDisplayNameInput(e.target.value)}
              />
              <Button type="submit" variant="primary">Save Name</Button>
            </InputGroup>
          </Form>
        </Modal.Body>
      </Modal>

      <h2 className="mb-3">My Learning Progress</h2>
      {learningProgress.length === 0 ? (
        <Alert variant="info">You are not currently enrolled in any modules. <Link href="/modules">Explore modules now!</Link></Alert>
      ) : (
        <Accordion defaultActiveKey="0">
          {learningProgress.map((progress, index) => (
            <Accordion.Item eventKey={String(index)} key={progress.moduleId}>
              <Accordion.Header>
                {progress.module.title}
                {progress.status === 'completed' && <span className="ms-2 badge bg-success">Completed</span>}
              </Accordion.Header>
              <Accordion.Body>
                <p>Status: {progress.status}</p>
                <ProgressBar 
                  now={(progress.completedLessons.length / (progress.module.lessons?.length || 1)) * 100} 
                  max={100} 
                  label={`${progress.completedLessons.length}/${progress.module.lessons?.length || 1}`}
                  variant={progress.status === 'completed' ? 'success' : 'primary'}
                />
                <div className="mt-3">
                  <Link href={`/modules/${progress.moduleId}`} passHref>
                    <Button variant="primary" size="sm">
                      {progress.status === 'completed' ? 'View Module' : 'Continue Learning'}
                    </Button>
                  </Link>
                  {progress.status === 'completed' && (
                    progress.certificate ? (
                      <Link href={`/certificates?certificateId=${progress.certificate.id}`} passHref>
                        <Button variant="outline-success" size="sm" className="ms-2">View Certificate</Button>
                      </Link>
                    ) : (
                      <Button variant="outline-info" size="sm" className="ms-2" onClick={() => mintCertificate(progress.moduleId)} disabled={mintingState[progress.moduleId]}>
                        {mintingState[progress.moduleId] ? 'Minting...' : 'Mint Certificate'}
                      </Button>
                    )
                  )}
                </div>
              </Accordion.Body>
            </Accordion.Item>
          ))}
        </Accordion>
      )}

      <h2 className="mb-3 mt-5">My Content Dashboard</h2>
      {provider ? (
        <>
          <div className="mb-3">
            <Link href="/add-content" className="btn btn-primary">Add New Content</Link>
          </div>
          
          <h4 className="mt-4">My Earnings / Escrows</h4>
          {loadingEscrows ? (
            <Spinner animation="border" size="sm" />
          ) : escrows.length === 0 ? (
            <Alert variant="secondary">No active escrows found.</Alert>
          ) : (
            <>
              {escrows.some(e => e.isLocked) && (
                <Alert variant="danger" className="mb-3">
                  <strong>⚠️ MeshJS Bug Detected:</strong> Some escrows are locked due to a bug in MeshJS library 
                  that produces incorrect PlutusV3 script hashes. These funds cannot be claimed until the bug is fixed.
                  <br/>
                  <small className="text-muted">
                    Affected hash: {MESHJS_BUG_INFO.oldHash} (should be: {MESHJS_BUG_INFO.correctHash})
                  </small>
                </Alert>
              )}
              <Table striped bordered hover variant="dark">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Module (Est.)</th>
                    <th>Amount (ADA)</th>
                    <th>Progress</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {escrows.map((escrow, i) => (
                    <tr key={i} className={escrow.isLocked ? 'table-danger' : ''}>
                      <td>{escrow.studentName}</td>
                      <td>{escrow.moduleTitle}</td>
                      <td>{escrow.datum.amount / 1000000}</td>
                      <td>{escrow.progressPercent}%</td>
                      <td>
                        {escrow.isLocked ? (
                          <Badge bg="danger">🔒 LOCKED (MeshJS Bug)</Badge>
                        ) : escrow.datum.partial_claimed ? (
                          <Badge bg="warning">Partial Claimed</Badge>
                        ) : (
                          <Badge bg="info">Initial</Badge>
                        )}
                      </td>
                      <td>
                        {escrow.isLocked ? (
                          <span className="text-muted small">Cannot claim - funds locked</span>
                        ) : (
                          <>
                            {/* Partial Claim Button - available at 50%+ progress, if not already claimed */}
                            {!escrow.datum.partial_claimed && (
                              <Button 
                                size="sm" 
                                variant="warning" 
                                onClick={() => handleClaim(escrow, "PartialClaim")}
                                disabled={claiming || escrow.progressPercent < 50}
                                title={escrow.progressPercent < 50 ? `Need 50% progress (currently ${escrow.progressPercent}%)` : "Claim 30% of escrow"}
                              >
                                {escrow.progressPercent < 50 ? `🔒 Claim 30% (need 50%)` : "Claim 30%"}
                              </Button>
                            )}
                            {escrow.datum.partial_claimed && escrow.progressPercent < 100 && (
                              <span className="text-muted small">Partial claimed, waiting for 100%</span>
                            )}
                            {/* Final Claim Button - available at 100% progress */}
                            {escrow.datum.partial_claimed && (
                              <Button 
                                size="sm" 
                                variant="success" 
                                className="ms-2"
                                onClick={() => handleClaim(escrow, "FinalClaim")}
                                disabled={claiming || escrow.progressPercent < 100}
                                title={escrow.progressPercent < 100 ? `Need 100% progress (currently ${escrow.progressPercent}%)` : "Claim remaining funds"}
                              >
                                {escrow.progressPercent < 100 ? `🔒 Claim Final (need 100%)` : "Claim Final"}
                              </Button>
                            )}
                            {/* Show message if both conditions not met yet */}
                            {!escrow.datum.partial_claimed && escrow.progressPercent < 50 && (
                              <span className="text-muted small d-block mt-1">Student progress: {escrow.progressPercent}%</span>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </>
          )}
          
          {myModules.length === 0 ? (
            <Alert variant="info">
              You haven't created any modules yet.
            </Alert>
          ) : (
            <Accordion defaultActiveKey="0" className="mt-3">
              {myModules.map((module, index) => (
                <Accordion.Item eventKey={String(index)} key={module.id}>
                  <Accordion.Header>{module.title}</Accordion.Header>
                  <Accordion.Body>
                    <p><strong>Difficulty:</strong> {module.difficulty}</p>
                    <p><strong>Topics:</strong> {module.topics.join(', ')}</p>
                    <h5>Lessons</h5>
                    <ListGroup>
                      {module.lessons?.sort((a, b) => a.order - b.order).map((lesson, index) => (
                        <ListGroup.Item key={lesson.id} className="d-flex justify-content-between align-items-center">
                          <span>{lesson.title}</span>
                          <div>
                            <Button variant="outline-secondary" size="sm" onClick={() => handleMoveLesson(module.id, lesson.id, 'up')} disabled={index === 0}>Up</Button>
                            <Button variant="outline-secondary" size="sm" className="ms-1" onClick={() => handleMoveLesson(module.id, lesson.id, 'down')} disabled={index === (module.lessons?.length || 0) - 1}>Down</Button>
                            <Link href={`/edit-lesson?moduleId=${module.id}&lessonId=${lesson.id}`} passHref>
                              <Button variant="outline-primary" size="sm" className="ms-3">Edit</Button>
                            </Link>
                            <Button variant="outline-danger" size="sm" className="ms-1" onClick={() => handleDeleteLesson(module.id, lesson.id)}>Delete</Button>
                          </div>
                        </ListGroup.Item>
                      ))}
                    </ListGroup>
                    <div className="mt-3">
                      <Link href={`/edit-module?moduleId=${module.id}`} passHref>
                        <Button variant="outline-success" size="sm" className="me-2">
                          Edit Module
                        </Button>
                      </Link>
                      <Link href="/add-lesson" passHref>
                        <Button variant="outline-primary" size="sm" className="me-2">
                          Add Lesson
                        </Button>
                      </Link>
                      <Button variant="outline-danger" size="sm" onClick={() => handleDeleteModule(module.id)}>
                        Delete Module
                      </Button>
                    </div>
                  </Accordion.Body>
                </Accordion.Item>
              ))}
            </Accordion>
          )}
        </>
      ) : (
        <Alert variant="info">
          You are not registered as a content provider. <Link href="/register-provider">Register here</Link> to start creating content!
        </Alert>
      )}

      {userId && !provider && learningProgress.length === 0 && (
        <Alert variant="info" className="mt-4">
          Welcome to your dashboard! Get started by:
          <ul>
            <li><Link href="/modules">Exploring modules to learn</Link></li>
            <li><Link href="/register-provider">Registering as a content provider</Link> to create your own modules</li>
          </ul>
        </Alert>
      )}
    </div>
  );
}
