import { db } from "./firebase";
import { doc, getDoc, setDoc, updateDoc, Timestamp, collection, query, where, getDocs } from "firebase/firestore";
import { UserProgress } from "@/types";
import { getUserProgress } from "./access";

export const getAllUserProgress = async (userId: string): Promise<UserProgress[]> => {
  const progressCollectionRef = collection(db, "userProgress");
  const q = query(progressCollectionRef, where("userId", "==", userId));
  const querySnapshot = await getDocs(q);
  const progressList: UserProgress[] = [];
  querySnapshot.forEach((doc) => {
    progressList.push({ ...doc.data(), startedAt: doc.data().startedAt?.toDate(), completedAt: doc.data().completedAt?.toDate() } as UserProgress);
  });
  return progressList;
};



export const startModule = async (userId: string, moduleId: string, firstLessonId: string): Promise<void> => {
  const progressRef = doc(db, "userProgress", `${userId}_${moduleId}`);
  const now = Timestamp.now();
  const newProgress: UserProgress = {
    userId,
    moduleId,
    status: "in_progress",
    currentLessonId: firstLessonId,
    completedLessons: [],
    startedAt: now.toDate(),
  };
  await setDoc(progressRef, newProgress, { merge: true });
};

export const completeLesson = async (userId: string, moduleId: string, lessonId: string): Promise<void> => {
  const progressRef = doc(db, "userProgress", `${userId}_${moduleId}`);
  const progressSnap = await getDoc(progressRef);

  if (progressSnap.exists()) {
    const currentProgress = progressSnap.data() as UserProgress;
    const updatedCompletedLessons = [...new Set([...currentProgress.completedLessons, lessonId])];
    await updateDoc(progressRef, {
      completedLessons: updatedCompletedLessons,
      currentLessonId: lessonId, // Update current lesson to the one just completed
    });
  }
};

export const updateQuizScore = async (userId: string, moduleId: string, score: number): Promise<void> => {
  const progressRef = doc(db, "userProgress", `${userId}_${moduleId}`);
  await updateDoc(progressRef, {
    quizScore: score,
  });
};

export const completeModule = async (userId: string, moduleId: string): Promise<void> => {
  const progressRef = doc(db, "userProgress", `${userId}_${moduleId}`);
  const now = Timestamp.now();
  await updateDoc(progressRef, {
    status: "completed",
    completedAt: now.toDate(),
  });
};

export const checkModuleCompletion = async (userId: string, moduleId: string): Promise<boolean> => {
  const progress = await getUserProgress(userId, moduleId);
  return progress?.status === 'completed';
};
