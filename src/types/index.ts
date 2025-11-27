export interface User {
  walletAddress: string;
  displayName?: string;
  createdAt: Date;
  lastLoginAt: Date;
}

export interface ContentProvider {
  id: string; // Wallet address of the content provider
  displayName: string;
  email?: string;
  registeredAt: Date;
}

export interface Module {
  id: string;
  title: string;
  description: string;
  coverImage: string;
  estimatedDuration: string;
  difficulty: "Basic" | "Menengah" | "Mahir";
  topics: string[];
  order: number;
  contentProviderId: string; // Link to ContentProvider
  priceAda?: number; // Price in ADA for the module
  lessons?: Lesson[];
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number; // Store the index of the correct option
}

export interface Lesson {
  id: string;
  title: string;
  order: number;
  contentType: "text" | "video" | "quiz" | "interactive_code" | "image" | "audio";
  content: string; // This will vary based on contentType
  introduction?: string; // Optional introduction text for the lesson
  quizQuestions?: QuizQuestion[]; // Optional for quiz type lessons
  isPremium: boolean; // Indicates if this lesson is premium content
}

export interface UserProgress {
  userId: string;
  moduleId: string;
  status: "not_started" | "in_progress" | "completed";
  currentLessonId?: string;
  completedLessons: string[];
  quizScore?: number;
  startedAt?: Date;
  completedAt?: Date;
}

export interface OnChainDetails {
  policyId: string;
  assetName: string; // Changed from assetId to assetName for clarity
  txHash: string;
  cardanoscanUrl: string;
}

export interface Certificate {
  id: string;
  userId: string;
  moduleId: string;
  issuedAt: Date;
  onChainDetails: OnChainDetails;
  visualCertificateUrl: string;
  userName?: string;
  moduleTitle?: string;
}

export interface ContentAccess {
  userId: string;
  moduleId: string;
  accessedAt: Date;
  txHash: string;
}