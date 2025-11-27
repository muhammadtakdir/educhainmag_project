
import { db } from "./firebase";
import { collection, doc, getDoc, setDoc, getDocs, updateDoc, query, where } from "firebase/firestore";
import { User } from "@/types";

export const getUserById = async (userId: string): Promise<User | null> => {
  const docRef = doc(db, "users", userId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as User;
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
  return usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
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
  const users = await Promise.all(Array.from(userIds).map(id => getUserById(id)));
  return { usersWithProgress: users.filter(user => user !== null) as User[], completedUsers };
};

export const blockUser = async (userId: string): Promise<void> => {
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, { isBlocked: true });
};