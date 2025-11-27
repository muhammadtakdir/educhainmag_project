import { db } from "./firebase";
import { collection, doc, setDoc } from "firebase/firestore";
import { Module, Lesson } from "@/types";

const modulesData: Module[] = [
  {
    id: 'pengantar-blockchain-web3',
    title: 'Pengantar Blockchain & Web3',
    description: 'Pelajari dasar-dasar blockchain dan konsep Web3.',
    coverImage: 'https://via.placeholder.com/300x200',
    estimatedDuration: '2 Jam',
    difficulty: 'Basic',
    topics: ['Web3 Dasar', 'Blockchain'],
    order: 1,
  },
  {
    id: 'dasar-dasar-aiken',
    title: 'Dasar-dasar Aiken: Smart Contract Cardano',
    description: 'Pahami cara membuat smart contract dengan Aiken di Cardano.',
    coverImage: 'https://via.placeholder.com/300x200',
    estimatedDuration: '4 Jam',
    difficulty: 'Menengah',
    topics: ['Aiken', 'Smart Contract'],
    order: 2,
  },
  {
    id: 'membangun-dapp-dengan-meshjs',
    title: 'Membangun dApp dengan Mesh.js',
    description: 'Integrasikan dApp Anda dengan Cardano menggunakan Mesh.js.',
    coverImage: 'https://via.placeholder.com/300x200',
    estimatedDuration: '6 Jam',
    difficulty: 'Mahir',
    topics: ['Mesh.js', 'dApp Development'],
    order: 3,
  },
];

const lessonsData: { [moduleId: string]: Lesson[] } = {
  'pengantar-blockchain-web3': [
    {
      id: 'apa-itu-blockchain',
      title: 'Apa itu Blockchain?',
      order: 1,
      contentType: 'text',
      content: 'Ini adalah konten pelajaran tentang apa itu blockchain. Blockchain adalah teknologi buku besar terdistribusi yang aman dan transparan.',
    },
    {
      id: 'bagaimana-blockchain-bekerja',
      title: 'Bagaimana Blockchain Bekerja?',
      order: 2,
      contentType: 'text',
      content: 'Ini adalah konten pelajaran tentang bagaimana blockchain bekerja. Ini melibatkan blok, hash, dan konsensus.',
    },
    {
      id: 'apa-itu-web3',
      title: 'Apa itu Web3?',
      order: 3,
      contentType: 'text',
      content: 'Ini adalah konten pelajaran tentang apa itu Web3. Web3 adalah iterasi internet berikutnya yang didukung oleh teknologi blockchain.',
    },
    {
      id: 'ekosistem-cardano',
      title: 'Ekosistem Cardano',
      order: 4,
      contentType: 'text',
      content: 'Ini adalah konten pelajaran tentang ekosistem Cardano. Cardano adalah platform blockchain proof-of-stake.',
    },
    {
      id: 'kuis-akhir-modul',
      title: 'Kuis Akhir Modul',
      order: 5,
      contentType: 'quiz',
      content: 'Jawab pertanyaan-pertanyaan berikut untuk menyelesaikan modul ini.',
      quizQuestions: [
        {
          id: 'q1',
          question: 'Apa kepanjangan dari Web3?',
          options: ['World Wide Web 3', 'Web Tiga', 'Web Terdesentralisasi', 'Web Baru'],
          correctAnswer: 'Web Terdesentralisasi',
        },
        {
          id: 'q2',
          question: 'Apa itu Blockchain?',
          options: ['Database terpusat', 'Buku besar terdistribusi', 'Jaringan sosial', 'Sistem operasi'],
          correctAnswer: 'Buku besar terdistribusi',
        },
        {
          id: 'q3',
          question: 'Apa nama smart contract language di Cardano?',
          options: ['Solidity', 'Vyper', 'Aiken', 'Rust'],
          correctAnswer: 'Aiken',
        },
      ],
    },
  ],
  'dasar-dasar-aiken': [
    {
      id: 'pengenalan-aiken',
      title: 'Pengenalan Aiken',
      order: 1,
      contentType: 'text',
      content: 'Pelajari dasar-dasar bahasa pemrograman Aiken untuk smart contract Cardano.',
    },
    {
      id: 'struktur-program-aiken',
      title: 'Struktur Program Aiken',
      order: 2,
      contentType: 'text',
      content: 'Memahami struktur dasar dan sintaksis program Aiken.',
    },
  ],
  'membangun-dapp-dengan-meshjs': [
    {
      id: 'integrasi-meshjs',
      title: 'Integrasi Mesh.js',
      order: 1,
      contentType: 'text',
      content: 'Cara mengintegrasikan Mesh.js ke dalam proyek Next.js Anda.',
    },
    {
      id: 'interaksi-smart-contract',
      title: 'Interaksi Smart Contract',
      order: 2,
      contentType: 'text',
      content: 'Menggunakan Mesh.js untuk berinteraksi dengan smart contract Cardano.',
    },
  ],
};

export const seedDatabase = async () => {
  console.log("Seeding modules...");
  for (const module of modulesData) {
    const moduleRef = doc(db, "modules", module.id);
    await setDoc(moduleRef, module);
    console.log(`Added module: ${module.title}`);

    if (lessonsData[module.id]) {
      console.log(`Seeding lessons for module: ${module.title}...`);
      for (const lesson of lessonsData[module.id]) {
        const lessonRef = doc(db, `modules/${module.id}/lessons`, lesson.id);
        await setDoc(lessonRef, lesson);
        console.log(`  Added lesson: ${lesson.title}`);
      }
    }
  }
  console.log("Database seeding complete!");
};
