
import { db } from "./firebase";
import { collection, doc, getDoc, setDoc, getDocs, updateDoc, query, where } from "firebase/firestore";
import { User } from "@/types";

const mapFirestoreDocToUser = (docSnap: any): User => {
  const data = docSnap.data();
  return {
    walletAddress: docSnap.id,
    displayName: data.displayName,
    createdAt: data.createdAt?.toDate(),
    lastLoginAt: data.lastLoginAt?.toDate(),
    // Add any other properties of User interface that might be stored
    // For example, if you have 'isBlocked' field: isBlocked: data.isBlocked || false,
  } as User;
};

export const getUserById = async (userId: string): Promise<User | null> => {
  const docRef = doc(db, "users", userId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return mapFirestoreDocToUser(docSnap);
  }
  return null;
};

export const updateUserDisplayName = async (userId: string, displayName: string): Promise<void> => {
  const userRef = doc(db, "users", userId);
  await setDoc(userRef, { displayName }, { merge: true });
};

export const getAllUsers = async (): Promise<User[]> => {
  const usersCollection = collection(db, "users");
  const usersSnapshot = await getDocs(usersCollection);
  return usersSnapshot.docs.map(mapFirestoreDocToUser);
};

export const getContentProviders = async (): Promise<User[]> => {
  const providersCollection = collection(db, "contentProviders");
  const providersSnapshot = await getDocs(providersCollection);
  const providerIds = providersSnapshot.docs.map(doc => doc.id);
  const users = await Promise.all(providerIds.map(id => getUserById(id)));
  return users.filter(user => user !== null) as User[];
};

export const getUsersWithProgress = async (): Promise<{ usersWithProgress: User[], completedUsers: Set<string> }> => {
  const progressCollection = collection(db, "userProgress");
  const progressSnapshot = await getDocs(progressCollection);
  const userIds = new Set<string>();
  const completedUsers = new Set<string>();
  progressSnapshot.forEach(doc => {
    const data = doc.data();
    userIds.add(data.userId);
    if (data.status === 'completed') {
      completedUsers.add(data.userId);
    }
  });
  // Use mapFirestoreDocToUser for consistency
  const users = await Promise.all(Array.from(userIds).map(id => getUserById(id)));
  return { usersWithProgress: users.filter(user => user !== null) as User[], completedUsers };
};