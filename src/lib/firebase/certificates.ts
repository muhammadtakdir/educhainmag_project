import { db } from "./firebase";
import { collection, doc, setDoc, Timestamp, query, where, getDocs, limit } from "firebase/firestore";
import { Certificate } from "@/types";

export const saveCertificate = async (certificate: Omit<Certificate, 'id'>): Promise<void> => {
  const newCertRef = doc(collection(db, "certificates")); // Auto-generate ID
  const certificateWithId: Certificate = {
    ...certificate,
    id: newCertRef.id,
    issuedAt: Timestamp.fromDate(certificate.issuedAt).toDate(), // Ensure Timestamp conversion
  };
  await setDoc(newCertRef, certificateWithId);
};

/**
 * Fetches a certificate for a given user and module.
 * @param userId The user's ID.
 * @param moduleId The module's ID.
 * @returns The certificate object or null if not found.
 */
export const getCertificateByUserAndModule = async (userId: string, moduleId: string): Promise<Certificate | null> => {
  const certificatesRef = collection(db, "certificates");
  const q = query(
    certificatesRef,
    where("userId", "==", userId),
    where("moduleId", "==", moduleId),
    limit(1)
  );

  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    return null;
  }

  const certDoc = querySnapshot.docs[0];
  return { id: certDoc.id, ...certDoc.data() } as Certificate;
};
