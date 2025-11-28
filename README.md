# EduChain Mag - Decentralized Education Platform

**EduChain Mag** is a decentralized application (dApp) built on the Cardano blockchain that connects learners with content creators (mentors). It ensures secure, milestone-based payments using smart contracts, protecting both students' funds and mentors' earnings. Currently, this dApp is being tested and developed on the **Cardano Preview Testnet**.

## Technology Stack

This project leverages a modern full-stack architecture combined with Web3 technologies:

* **Frontend Framework:** [Next.js 14](https://nextjs.org/) (React) with TypeScript.
* **Styling:** Bootstrap 5 & Custom CSS.
* **Blockchain Interaction:** [MeshSDK](https://meshjs.dev/) (for transaction building and wallet integration).
* **Smart Contract Language:** [Aiken](https://aiken-lang.org/) (Cardano Smart Contracts - PlutusV3).
* **Backend / Database:** Google Firebase (Firestore for user data, progress tracking, and content storage).
* **Network:** Cardano Preview Testnet.
* **Infrastructure:** Blockfrost API.

---

## Key Features

### All Features Working!
1. **Wallet Connection:** Seamless integration with Cardano wallets (Eternl, Nami, etc.) using MeshSDK.
2. **User Roles:**
   * **Learners:** Can browse modules, enroll, and track learning progress.
   * **Content Providers (Mentors):** Can register profiles and create educational content.
3. **Content Management:**
   * Create Modules (Courses) with details like difficulty, price, and topics.
   * Add Lessons (Text, Video, Quizzes) to modules.
   * Edit/Delete content dynamically.
4. **Learning System:**
   * Interactive lesson viewer.
   * Real-time progress tracking saved to Firebase.
5. **Certificate Minting:**
   * Upon 100% completion, students can mint an on-chain NFT certificate verifying their achievement.
6. **Escrow System (Fully Functional!):**
   * **Initiation:** When a student "buys" a course, funds are locked into a Smart Contract (Escrow) at a Script Address.
   * **Partial Claim:** When student reaches 50% progress, mentor can claim 30% of the locked funds (minus fee).
   * **Final Claim:** When student reaches 100% progress, mentor receives 60% (minus fee) and platform receives full 40%.

---

## How the Escrow System Works

The core of EduChain Mag is its trustless payment system (`escrow-csl.ts` & `edu_escrow.ak`). It ensures mentors get paid only when students make progress.

### 1. Locking Funds (Initiation)
* **Action:** Student purchases a module.
* **On-Chain:** `Amount` (ADA) is sent to the **Contract Address**.
* **Datum Created:** A specific data structure is attached to the UTXO containing:
  * `Student PKH` (Public Key Hash)
  * `Mentor PKH`
  * `Platform PKH` (Address for platform fees)
  * `Amount` (Total locked)
  * `Progress` (Starts at 0)
  * `PartialClaimed` (Boolean: False)

### 2. Partial Claim (Milestone 1)
* **Trigger:** Student reaches **50% progress** in the course.
* **Action:** Mentor initiates a "Partial Claim".
* **Logic:**
  * The contract validates the progress and mentor signature.
  * **30% minus ~1 ADA fee** is released to the Mentor's wallet.
  * The remaining **70% (full)** is sent back to the Script Address.
  * **Datum Update:** The UTXO datum is updated to reflect `PartialClaimed = True`.

### 3. Final Claim (Completion)
* **Trigger:** Student reaches **100% progress**.
* **Action:** Mentor initiates a "Final Claim".
* **Logic:**
  * The remaining funds in the UTXO are consumed.
  * **60% minus ~1 ADA fee** of the remaining amount goes to the **Mentor**.
  * **40% (full)** of the remaining amount goes to the **Platform** (Fee/Commission).
  * The transaction is finalized, and the UTXO is fully spent.

### Fund Distribution Example (10 ADA Escrow)
| Stage | Mentor | Platform | Script | Fee |
|-------|--------|----------|--------|-----|
| Initial | 0 | 0 | 10 ADA | - |
| PartialClaim (50%) | 2 ADA | 0 | 7 ADA | ~1 ADA |
| FinalClaim (100%) | +3.2 ADA | 2.8 ADA | 0 | ~1 ADA |
| **Total** | **5.2 ADA** | **2.8 ADA** | 0 | ~2 ADA |

---

## Technical Notes

### MeshJS PlutusV3 Bug Workaround
MeshJS has a known bug where it computes incorrect script hashes for PlutusV3 scripts. This project uses `applyCborEncoding()` workaround to ensure correct hash calculation:

`typescript
import { applyCborEncoding } from "@meshsdk/core";
const wrappedScriptCbor = applyCborEncoding(originalScriptCbor);
// Use wrappedScriptCbor in txInScript() for correct hash
`

### Current Script Address (V5)
* **Hash:** `4b93b4131548ba0e441ea4a2fb1a4d18b41c27b7c2ea73f4b40376aa`
* **Address:** `addr_test1wp9e8dqnz4yt5rjyr6j297c6f5vtg8p8klpw5ul5ksphd2styjenj`

### Legacy Addresses (Locked/Old)
| Version | Hash | Address | Status |
|---------|------|---------|--------|
| V4 | 6058098a... | addr_test1wps9szv2... | Legacy |
| V3 | 5b178d3d... | addr_test1wpd30rfa... | Locked (bug) |
| V2 | 47be01b4... | addr_test1wprmuqd5... | Old |
| V1 | d80cc51a... | addr_test1wrvqe3g6... | Locked (MeshJS bug) |

---

## Installation & Setup (Local)

1. Clone the repository:
   `bash
   git clone https://github.com/muhammadtakdir/educhainmag_project.git
   cd educhainmag_project
   `

2. Install dependencies:
   `bash
   npm install
   `

3. Configure Environment Variables:
   Create a `.env.local` file and add your keys (Blockfrost, Firebase):
   `env
   NEXT_PUBLIC_BLOCKFROST_KEY_PREVIEW=your_blockfrost_key
   NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_key
   NEXT_PUBLIC_PLATFORM_WALLET_ADDRESS=your_platform_address
   # ... other firebase keys
   `

4. Run the development server:
   `bash
   npm run dev
   `

5. Open [http://localhost:3000](http://localhost:3000) with your browser.

---

## License

This project is for educational and demonstration purposes on the Cardano Preview Testnet.

## Acknowledgments

* [Cardano](https://cardano.org/) - Blockchain platform
* [Aiken](https://aiken-lang.org/) - Smart contract language
* [MeshJS](https://meshjs.dev/) - Cardano SDK
* [Blockfrost](https://blockfrost.io/) - Cardano API
