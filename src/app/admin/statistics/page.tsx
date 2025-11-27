
"use client";

import { useState, useEffect } from 'react';
import { useWalletState } from '@/context/WalletContext';
import { getAllUsers, getContentProviders, getUsersWithProgress, blockUser } from '@/lib/firebase/users';
import { User } from '@/types';
import { Container, Row, Col, Card, Spinner, Alert, Table, Button } from 'react-bootstrap';

const PLATFORM_WALLET_ADDRESS = process.env.NEXT_PUBLIC_PLATFORM_WALLET_ADDRESS as string;

export default function AdminStatisticsPage() {
  const { userAddress } = useWalletState();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [showWriters, setShowWriters] = useState(false);
  const [showStudents, setShowStudents] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      if (userAddress !== PLATFORM_WALLET_ADDRESS) {
        setError("You are not authorized to view this page.");
        setLoading(false);
        return;
      }

      try {
        const allUsers = await getAllUsers();
        const writers = await getContentProviders();
        const { usersWithProgress, completedUsers } = await getUsersWithProgress();

        setStats({
          visitors: allUsers.length,
          writers: writers,
          students: usersWithProgress,
          completed: completedUsers.size,
        });
      } catch (err) {
        console.error("Error fetching statistics:", err);
        setError("Failed to load statistics.");
      } finally {
        setLoading(false);
      }
    };

    if (userAddress) {
      fetchStats();
    }
  }, [userAddress]);

  const handleBlockUser = async (userId: string) => {
    if (window.confirm('Are you sure you want to block this user?')) {
      try {
        await blockUser(userId);
        alert(`User ${userId} blocked!`);
        // Optionally, refresh the data
      } catch (err) {
        console.error("Error blocking user:", err);
        alert("Failed to block user.");
      }
    }
  };

  if (loading) {
    return <div className="container mt-4 text-center">Loading statistics...</div>;
  }

  if (error) {
    return <div className="container mt-4 text-center text-danger">Error: {error}</div>;
  }

  if (userAddress !== PLATFORM_WALLET_ADDRESS) {
    return <div className="container mt-4 text-center text-danger">Unauthorized</div>;
  }

  return (
    <Container className="mt-4">
      <h1 className="text-center mb-5">Platform Statistics</h1>
      <Row>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <Card.Title>Total Visitors</Card.Title>
              <Card.Text>{stats?.visitors}</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <Card.Title>Total Writers</Card.Title>
              <Card.Text>{stats?.writers.length}</Card.Text>
              <Button variant="link" onClick={() => setShowWriters(!showWriters)}>
                {showWriters ? 'Hide' : 'Show'} Details
              </Button>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <Card.Title>Total Students</Card.Title>
              <Card.Text>{stats?.students.length}</Card.Text>
              <Button variant="link" onClick={() => setShowStudents(!showStudents)}>
                {showStudents ? 'Hide' : 'Show'} Details
              </Button>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <Card.Title>Total Completed</Card.Title>
              <Card.Text>{stats?.completed}</Card.Text>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {showWriters && (
        <div className="mt-5">
          <h2>Writers</h2>
          <Table striped bordered hover responsive>
            <thead>
              <tr>
                <th>Name</th>
                <th>Wallet Address</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {stats?.writers.map((user: User) => (
                <tr key={user.walletAddress}>
                  <td>{user.displayName}</td>
                  <td>{user.walletAddress}</td>
                  <td>
                    <Button variant="danger" onClick={() => handleBlockUser(user.walletAddress)}>Block</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      {showStudents && (
        <div className="mt-5">
          <h2>Students</h2>
          <Table striped bordered hover responsive>
            <thead>
              <tr>
                <th>Name</th>
                <th>Wallet Address</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {stats?.students.map((user: User) => (
                <tr key={user.walletAddress}>
                  <td>{user.displayName}</td>
                  <td>{user.walletAddress}</td>
                  <td>
                    <Button variant="danger" onClick={() => handleBlockUser(user.walletAddress)}>Block</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </Container>
  );
}
