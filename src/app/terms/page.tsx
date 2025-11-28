"use client";

import { Container, Card, Alert, Row, Col, Badge } from "react-bootstrap";
import Link from "next/link";

export default function TermsPage() {
  return (
    <Container className="py-5">
      <h1 className="text-center mb-4">Terms & Conditions</h1>
      <p className="text-center text-muted mb-5">
        Please read these terms carefully before using EduChainMag
      </p>

      {/* Important Notice */}
      <Alert variant="warning" className="mb-4">
        <Alert.Heading>
          <i className="bi bi-exclamation-triangle me-2"></i>
          Testnet Environment Notice
        </Alert.Heading>
        <p className="mb-0">
          EduChainMag is currently running on the <strong>Cardano Preview Testnet</strong>. 
          All transactions use test ADA (tADA) which has no real monetary value. 
          This platform is for <strong>educational and demonstration purposes only</strong>.
        </p>
      </Alert>

      {/* Network Requirements */}
      <Card className="mb-4">
        <Card.Header className="bg-primary text-white">
          <h4 className="mb-0">
            <i className="bi bi-hdd-network me-2"></i>
            Network Requirements
          </h4>
        </Card.Header>
        <Card.Body>
          <ul className="list-unstyled">
            <li className="mb-3">
              <strong>Network:</strong> Cardano Preview Testnet
            </li>
            <li className="mb-3">
              <strong>Supported Wallets:</strong> Eternl, Nami, Flint, or any CIP-30 compatible wallet
            </li>
            <li className="mb-3">
              <strong>Wallet Configuration:</strong> Make sure your wallet is set to <Badge bg="info">Preview Testnet</Badge> network
            </li>
          </ul>
        </Card.Body>
      </Card>

      {/* How to Get Test ADA */}
      <Card className="mb-4">
        <Card.Header className="bg-success text-white">
          <h4 className="mb-0">
            <i className="bi bi-coin me-2"></i>
            How to Get Test ADA (tADA)
          </h4>
        </Card.Header>
        <Card.Body>
          <p>To use EduChainMag, you need test ADA. You can claim free tADA from these faucets:</p>
          
          <Row className="g-3">
            <Col md={6}>
              <Card className="h-100 border-success">
                <Card.Body>
                  <h5>Cardano Faucet (Official)</h5>
                  <p className="text-muted small">
                    The official Cardano testnet faucet. Select "Preview Testnet" and enter your wallet address.
                  </p>
                  <a 
                    href="https://docs.cardano.org/cardano-testnets/tools/faucet/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="btn btn-outline-success btn-sm"
                  >
                    Visit Faucet <i className="bi bi-box-arrow-up-right ms-1"></i>
                  </a>
                </Card.Body>
              </Card>
            </Col>
            <Col md={6}>
              <Card className="h-100 border-info">
                <Card.Body>
                  <h5>Testnets Faucet</h5>
                  <p className="text-muted small">
                    Alternative faucet for Cardano testnets. Make sure to select Preview network.
                  </p>
                  <a 
                    href="https://testnets.cardano.org/en/testnets/cardano/tools/faucet/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="btn btn-outline-info btn-sm"
                  >
                    Visit Faucet <i className="bi bi-box-arrow-up-right ms-1"></i>
                  </a>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          <Alert variant="info" className="mt-3 mb-0">
            <small>
              <strong>Tip:</strong> Each faucet request typically provides 10,000 tADA. 
              You may need to wait 24 hours between requests from the same address.
            </small>
          </Alert>
        </Card.Body>
      </Card>

      {/* How to Test the Platform */}
      <Card className="mb-4">
        <Card.Header className="bg-info text-white">
          <h4 className="mb-0">
            <i className="bi bi-play-circle me-2"></i>
            How to Test the Platform
          </h4>
        </Card.Header>
        <Card.Body>
          <h5>Testing as a Mentor (Content Creator)</h5>
          <ol className="mb-4">
            <li>Connect your wallet and register as a Content Provider</li>
            <li>Create a new module (course) with lessons and quizzes</li>
            <li>Set a price in ADA for your module</li>
            <li>Wait for students to enroll and track their progress</li>
            <li>Claim payments when students reach milestones (50% and 100%)</li>
          </ol>

          <h5>Testing as a Student</h5>
          <ol className="mb-4">
            <li>
              <strong>Create a new wallet</strong> (or use a different account in your wallet) to simulate a student
            </li>
            <li>Claim test ADA from the faucet for your student wallet</li>
            <li>Connect with your student wallet and browse available modules</li>
            <li>Purchase a module - funds will be locked in the escrow smart contract</li>
            <li>Complete lessons and quizzes to increase your progress</li>
            <li>At 50% progress, the mentor can claim 30% of the funds</li>
            <li>At 100% progress, the mentor claims 60% and platform receives 40%</li>
          </ol>

          <Alert variant="secondary">
            <strong> Pro Tip:</strong> To fully test the escrow system, you can:
            <ul className="mb-0 mt-2">
              <li>Use <strong>Wallet A</strong> as a Mentor - create a module</li>
              <li>Use <strong>Wallet B</strong> as a Student - purchase and complete the module</li>
              <li>Switch back to <strong>Wallet A</strong> to claim the escrow payments</li>
            </ul>
          </Alert>
        </Card.Body>
      </Card>

      {/* Escrow System */}
      <Card className="mb-4">
        <Card.Header className="bg-warning text-dark">
          <h4 className="mb-0">
            <i className="bi bi-shield-lock me-2"></i>
            Escrow Smart Contract
          </h4>
        </Card.Header>
        <Card.Body>
          <p>
            EduChainMag uses an on-chain Plutus V3 smart contract to secure payments between 
            students and mentors. Here is how the payment distribution works:
          </p>
          
          <div className="table-responsive">
            <table className="table table-bordered">
              <thead className="table-light">
                <tr>
                  <th>Milestone</th>
                  <th>Student Progress</th>
                  <th>Mentor Receives</th>
                  <th>Platform Receives</th>
                  <th>Remaining in Escrow</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Initial Purchase</td>
                  <td>0%</td>
                  <td>0 ADA</td>
                  <td>0 ADA</td>
                  <td>100%</td>
                </tr>
                <tr>
                  <td>Partial Claim</td>
                  <td>50%</td>
                  <td>30% (minus fee)</td>
                  <td>0 ADA</td>
                  <td>70%</td>
                </tr>
                <tr>
                  <td>Final Claim</td>
                  <td>100%</td>
                  <td>60% of remaining (minus fee)</td>
                  <td>40% of remaining</td>
                  <td>0%</td>
                </tr>
              </tbody>
            </table>
          </div>

          <Alert variant="light" className="border">
            <strong>Current Contract Address (Preview Testnet):</strong>
            <code className="d-block mt-2 p-2 bg-dark text-light rounded" style={{fontSize: "0.8rem", wordBreak: "break-all"}}>
              addr_test1wp9e8dqnz4yt5rjyr6j297c6f5vtg8p8klpw5ul5ksphd2styjenj
            </code>
          </Alert>
        </Card.Body>
      </Card>

      {/* Disclaimer */}
      <Card className="mb-4 border-danger">
        <Card.Header className="bg-danger text-white">
          <h4 className="mb-0">
            <i className="bi bi-exclamation-octagon me-2"></i>
            Disclaimer
          </h4>
        </Card.Header>
        <Card.Body>
          <ul>
            <li>
              This platform is a <strong>proof-of-concept</strong> running on a testnet. 
              Do not use real ADA or send mainnet transactions.
            </li>
            <li>
              Test ADA (tADA) has <strong>no monetary value</strong> and cannot be exchanged 
              for real cryptocurrency or fiat currency.
            </li>
            <li>
              The smart contract code is provided for educational purposes. While security 
              measures have been implemented, it has not undergone a formal security audit.
            </li>
            <li>
              User data stored in Firebase is for demonstration purposes. Do not enter 
              sensitive personal information.
            </li>
            <li>
              The developers are not responsible for any loss of test funds due to bugs, 
              network issues, or user error.
            </li>
          </ul>
        </Card.Body>
      </Card>

      {/* Contact */}
      <Card className="mb-4">
        <Card.Header className="bg-secondary text-white">
          <h4 className="mb-0">
            <i className="bi bi-envelope me-2"></i>
            Contact & Support
          </h4>
        </Card.Header>
        <Card.Body>
          <p>
            If you encounter any issues or have questions about using EduChainMag:
          </p>
          <ul>
            <li>
              <strong>GitHub Repository:</strong>{" "}
              <a href="https://github.com/muhammadtakdir/educhainmag_project" target="_blank" rel="noopener noreferrer">
                github.com/muhammadtakdir/educhainmag_project
              </a>
            </li>
            <li>
              <strong>Report Issues:</strong> Create an issue on GitHub
            </li>
          </ul>
        </Card.Body>
      </Card>

      <div className="text-center mt-5">
        <Link href="/" className="btn btn-primary">
          <i className="bi bi-house me-2"></i>
          Back to Home
        </Link>
      </div>
    </Container>
  );
}
