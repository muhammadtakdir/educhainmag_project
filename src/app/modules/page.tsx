"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import { Module } from '@/types';

import { useSearchParams } from 'next/navigation';

export default function ModulesPage() {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('q');

  useEffect(() => {
    const fetchModules = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "modules"));
        const modulesData: Module[] = [];
        querySnapshot.forEach((doc) => {
          modulesData.push({ id: doc.id, ...doc.data() } as Module);
        });
        setModules(modulesData.sort((a, b) => a.order - b.order));
      } catch (err) {
        console.error("Error fetching modules:", err);
        setError("Failed to load modules.");
      } finally {
        setLoading(false);
      }
    };

    fetchModules();
  }, []);

  const filteredModules = searchQuery
    ? modules.filter((module) =>
        module.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : modules;

  if (loading) {
    return <div className="container mt-4 text-center">Loading modules...</div>;
  }

  if (error) {
    return <div className="container mt-4 text-center text-danger">Error: {error}</div>;
  }

  return (
    <div className="container mt-4">
      <h1 className="text-center mb-5">
        {searchQuery ? `Search Results for "${searchQuery}"` : "All Modules"}
      </h1>
      <div className="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4">
        {filteredModules.map((module) => (
          <div key={module.id} className="col">
            <div className="card bg-dark text-white h-100 shadow">
              <img src={module.coverImage} alt={module.title} className="card-img-top" style={{ height: '180px', objectFit: 'cover' }} />
              <div className="card-body d-flex flex-column">
                <h2 className="card-title h5">{module.title}</h2>
                <p className="card-text flex-grow-1">{module.description}</p>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <span className="text-muted small">Duration: {module.estimatedDuration}</span>
                  <span className={`badge ${
                    module.difficulty === 'Basic' ? 'bg-success' :
                    module.difficulty === 'Intermediate' ? 'bg-warning text-dark' :
                    'bg-danger'
                  }`}>{module.difficulty}</span>
                </div>
                <div className="mb-3">
                  {module.topics.map((topic) => (
                    <span key={topic} className="badge bg-secondary me-1">
                      {topic}
                    </span>
                  ))}
                </div>
                <Link href={`/modules/${module.id}`} className="btn btn-primary mt-auto">
                  View Module
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
