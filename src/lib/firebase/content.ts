import { db } from "./firebase";
import { doc, setDoc, getDoc, collection, addDoc, Timestamp, query, where, getDocs, deleteDoc, updateDoc } from "firebase/firestore";
import { ContentProvider, Module, Lesson } from "@/types";

export const registerContentProvider = async (walletAddress: string, displayName: string, email?: string): Promise<void> => {
  const providerRef = doc(db, "contentProviders", walletAddress);
  const now = Timestamp.now();
  const newProvider: ContentProvider = {
    id: walletAddress,
    displayName,
    email,
    registeredAt: now.toDate(),
  };
  await setDoc(providerRef, newProvider);
};

export const isContentProvider = async (walletAddress: string): Promise<boolean> => {
  const providerRef = doc(db, "contentProviders", walletAddress);
  const providerSnap = await getDoc(providerRef);
  return providerSnap.exists();
};

export const addModule = async (moduleData: Omit<Module, 'id'>): Promise<string> => {
  const modulesCollectionRef = collection(db, "modules");
  const newModuleRef = await addDoc(modulesCollectionRef, {
    ...moduleData,
    priceAda: moduleData.priceAda || 0, // Default to 0 if not provided
  });
  return newModuleRef.id;
};

export const addLesson = async (moduleId: string, lessonData: Omit<Lesson, 'id'>): Promise<string> => {
  const lessonsCollectionRef = collection(db, `modules/${moduleId}/lessons`);
  const newLessonRef = await addDoc(lessonsCollectionRef, lessonData);
  return newLessonRef.id;
};

export const getModulesByProvider = async (providerId: string): Promise<Module[]> => {
  const modulesCollectionRef = collection(db, "modules");
  const q = query(modulesCollectionRef, where("contentProviderId", "==", providerId));
  const querySnapshot = await getDocs(q);
  const modules: Module[] = [];
  querySnapshot.forEach((doc) => {
    modules.push({ id: doc.id, ...doc.data() } as Module);
  });
  return modules;
};

export const getLessonsByModule = async (moduleId: string): Promise<Lesson[]> => {
  const lessonsCollectionRef = collection(db, `modules/${moduleId}/lessons`);
  const querySnapshot = await getDocs(lessonsCollectionRef);
  const lessons: Lesson[] = [];
  querySnapshot.forEach((doc) => {
    lessons.push({ id: doc.id, ...doc.data() } as Lesson);
  });
  return lessons;
};

export const getModuleById = async (moduleId: string): Promise<Module | null> => {
  const moduleRef = doc(db, "modules", moduleId);
  const moduleSnap = await getDoc(moduleRef);
  if (moduleSnap.exists()) {
    return { id: moduleSnap.id, ...moduleSnap.data() } as Module;
  }
  return null;
};

export const getContentProvider = async (providerId: string): Promise<ContentProvider | null> => {
  const providerRef = doc(db, "contentProviders", providerId);
  const providerSnap = await getDoc(providerRef);
  if (providerSnap.exists()) {
    return providerSnap.data() as ContentProvider;
  }
  return null;
};

export const deleteModule = async (moduleId: string): Promise<void> => {
  // First, delete all lessons in the module's subcollection
  const lessons = await getLessonsByModule(moduleId);
  for (const lesson of lessons) {
    const lessonRef = doc(db, `modules/${moduleId}/lessons`, lesson.id);
    await deleteDoc(lessonRef);
  }

  // Then, delete the module itself
  const moduleRef = doc(db, "modules", moduleId);
  await deleteDoc(moduleRef);
};

export const getLessonById = async (moduleId: string, lessonId: string): Promise<Lesson | null> => {
  const lessonRef = doc(db, `modules/${moduleId}/lessons`, lessonId);
  const lessonSnap = await getDoc(lessonRef);
  if (lessonSnap.exists()) {
    return { id: lessonSnap.id, ...lessonSnap.data() } as Lesson;
  }
  return null;
};

export const updateLesson = async (moduleId: string, lessonId: string, lessonData: Partial<Lesson>): Promise<void> => {
  const lessonRef = doc(db, `modules/${moduleId}/lessons`, lessonId);
  await updateDoc(lessonRef, lessonData);
};

export const deleteLesson = async (moduleId: string, lessonId: string): Promise<void> => {
  const lessonRef = doc(db, `modules/${moduleId}/lessons`, lessonId);
  await deleteDoc(lessonRef);
};

export const updateModule = async (moduleId: string, moduleData: Partial<Module>): Promise<void> => {
  const moduleRef = doc(db, "modules", moduleId);
  await updateDoc(moduleRef, moduleData);
};
