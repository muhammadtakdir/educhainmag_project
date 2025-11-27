import { db } from "./firebase";
import { doc, setDoc, getDoc, Timestamp } from "firebase/firestore";
import { User } from "@/types";

export const handleUserLogin = async (walletAddress: string): Promise<User> => {
  const userRef = doc(db, "users", walletAddress);
  const userSnap = await getDoc(userRef);

  const now = Timestamp.now();

  if (userSnap.exists()) {
    // User exists, update lastLoginAt
    await setDoc(userRef, { lastLoginAt: now }, { merge: true });
    // Explicitly cast to User before spreading to satisfy TypeScript, and ensure date is correct type
    return { ...(userSnap.data() as User), lastLoginAt: now.toDate() } as User;
  } else {
    // New user, create a new document
    const newUser: User = {
      walletAddress,
      createdAt: now.toDate(),
      lastLoginAt: now.toDate(),
    };
    await setDoc(userRef, newUser);
    return newUser;
  }
};
