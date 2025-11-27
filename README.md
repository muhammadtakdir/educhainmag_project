# EduChain Mag - Decentralized Education Platform

**EduChain Mag** is a decentralized application (dApp) built on the Cardano blockchain that connects learners with content creators (mentors). It ensures secure, milestone-based payments using smart contracts, protecting both students' funds and mentors' earnings. Currently, this dApp is being tested and developed on the **Cardano Preview Testnet**.

## 🛠 Technology Stack

This project leverages a modern full-stack architecture combined with Web3 technologies:

*   **Frontend Framework:** [Next.js 14](https://nextjs.org/) (React) with TypeScript.
*   **Styling:** Bootstrap 5 & Custom CSS.
*   **Blockchain Interaction:** [MeshSDK](https://meshjs.dev/) (for transaction building and wallet integration).
*   **Smart Contract Language:** [Aiken](https://aiken-lang.org/) (Cardano Smart Contracts).
*   **Backend / Database:** Google Firebase (Firestore for user data, progress tracking, and content storage).
*   **Network:** Cardano Preview Testnet.
*   **Infrastructure:** Blockfrost API.

---

## 🚀 Key Features

### ✅ Available & Working Features
1.  **Wallet Connection:** seamless integration with Cardano wallets (Eternl, Nami, etc.) using MeshSDK.
2.  **User Roles:**
    *   **Learners:** Can browse modules, enroll, and track learning progress.
    *   **Content Providers (Mentors):** Can register profiles and create educational content.
3.  **Content Management:**
    *   Create Modules (Courses) with details like difficulty, price, and topics.
    *   Add Lessons (Text, Video, Quizzes) to modules.
    *   Edit/Delete content dynamically.
4.  **Learning System:**
    *   Interactive lesson viewer.
    *   Real-time progress tracking saved to Firebase.
5.  **Certificate Minting:**
    *   Upon 100% completion, students can mint an on-chain NFT certificate verifying their achievement.
6.  **Escrow Initiation:**
    *   When a student "buys" a course, funds are not sent to the mentor immediately. Instead, they are locked into a **Smart Contract (Escrow)** at a Script Address.

### 🚧 Features Under Construction / Known Issues
*   **Escrow Claiming (Mentor Payouts):**
    *   **Current Status:** The logic for mentors to withdraw funds from the smart contract is implemented but currently encountering a **serialization error** (`Malformed builder data` / `CborInvalidOperationException`) when interacting with the Plutus V3 script via MeshSDK.
    *   **Issue Details:** The transaction builder fails to correctly serialize the `Redeemer` and `Script Witness` due to a mismatch between the raw script bytes and the expected CBOR format in the latest Mesh version. We are actively debugging the "Partial Claim" and "Final Claim" transaction construction.

---

## 🔐 How the Escrow System Works

The core of EduChain Mag is its trustless payment system (`escrow.ts` & `edu_escrow.ak`). It ensures mentors get paid only when students make progress.

### 1. Locking Funds (Initiation)
*   **Action:** Student purchases a module.
*   **On-Chain:** `Amount` (ADA) is sent to the **Contract Address**.
*   **Datum Created:** A specific data structure is attached to the UTXO containing:
    *   `Student PKH` (Public Key Hash)
    *   `Mentor PKH`
    *   `Platform PKH` (Address for platform fees)
    *   `Amount` (Total locked)
    *   `Progress` (Starts at 0)
    *   `PartialClaimed` (Boolean: False)

### 2. Partial Claim (Milestone 1)
*   **Trigger:** Student reaches **50% progress** in the course.
*   **Action:** Mentor initiates a "Partial Claim".
*   **Logic:**
    *   The contract validates the progress.
    *   **30% of the total amount** is released to the Mentor's wallet.
    *   The remaining **70%** is sent back to the Script Address.
    *   **Datum Update:** The UTXO datum is updated to reflect `PartialClaimed = True`.

### 3. Final Claim (Completion)
*   **Trigger:** Student reaches **100% progress**.
*   **Action:** Mentor initiates a "Final Claim".
*   **Logic:**
    *   The remaining funds in the UTXO are consumed.
    *   **60%** of the *original* UTXO value goes to the **Mentor**.
    *   **40%** of the *original* UTXO value goes to the **Platform** (Fee/Commission).
    *   The transaction is finalized, and the UTXO is fully spent.

---

## 📦 Installation & Setup (Local)

1.  Clone the repository:
    ```bash
    git clone https://github.com/muhammadtakdir/educhainmag_project.git
    cd educhainmag_project
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Configure Environment Variables:
    Create a `.env.local` file and add your keys (Blockfrost, Firebase, Wallet mnemonics):
    ```env
    NEXT_PUBLIC_BLOCKFROST_KEY_PREVIEW=your_key
    NEXT_PUBLIC_FIREBASE_API_KEY=your_key
    # ... other firebase keys
    ```

4.  Run the development server:
    ```bash
    npm run dev
    ```

5.  Open [http://localhost:3000](http://localhost:3000) with your browser.