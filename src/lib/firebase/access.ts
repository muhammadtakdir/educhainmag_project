import { db } from "./firebase";
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { ContentAccess, UserProgress } from "@/types";

export const grantContentAccess = async (userId: string, moduleId: string, txHash: string): Promise<void> => {
  const accessRef = doc(db, "contentAccess", `${userId}_${moduleId}`);
  const now = Timestamp.now();
  const newAccess: ContentAccess = {
    userId,
    moduleId,
    accessedAt: now.toDate(),
    txHash,
  };
  await setDoc(accessRef, newAccess);
};

export const checkContentAccess = async (userId: string, moduleId: string): Promise<boolean> => {
  const accessRef = doc(db, "contentAccess", `${userId}_${moduleId}`);
  const accessSnap = await getDoc(accessRef);
  return accessSnap.exists();
};

export const getAccessDetails = async (userId: string, moduleId: string): Promise<ContentAccess | null> => {
    const accessRef = doc(db, "contentAccess", `${userId}_${moduleId}`);
    const accessSnap = await getDoc(accessRef);
    if (accessSnap.exists()) {
        return accessSnap.data() as ContentAccess;
    }
    return null;
};

export const getUserProgress = async (userId: string, moduleId: string): Promise<UserProgress | null> => {
  const progressRef = doc(db, "userProgress", `${userId}_${moduleId}`);
  const progressSnap = await getDoc(progressRef);
  if (progressSnap.exists()) {
    const data = progressSnap.data();
    // Ensure Timestamps are converted to Dates
    return {
        ...data,
        startedAt: data.startedAt?.toDate(),
        completedAt: data.completedAt?.toDate(),
    } as UserProgress;
  }
  return null;
};
