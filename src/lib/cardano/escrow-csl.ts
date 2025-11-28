/**
 * EduChain Escrow - CSL Implementation with correct hash calculation
 * 
 * This module provides correct PlutusV3 script hash calculation
 * and transaction building using the CORRECT script address.
 * 
 * SECURITY: V2 validator verifies output amounts on-chain
 * - PartialClaim: 30% to mentor, 70% back to script
 * - FinalClaim: 60% to mentor, 40% to platform
 * 
 * Due to MeshJS bug, escrows created here will be at the CORRECT address
 * and will be claimable (unlike old escrows at MeshJS wrong address).
 */

import { 
  MeshTxBuilder,
  BlockfrostProvider, 
  deserializeDatum, 
  resolvePaymentKeyHash,
  mConStr0,
  mConStr1,
  applyCborEncoding,
} from "@meshsdk/core";
import type { UTxO } from "@meshsdk/common";
import { blake2b } from "blakejs";
import contract from "./contracts/plutus.json";
import { bech32 } from "bech32";

// Validate Blockfrost key exists
const BLOCKFROST_KEY = process.env.NEXT_PUBLIC_BLOCKFROST_KEY_PREVIEW;
if (!BLOCKFROST_KEY) {
  console.warn("[CSL] WARNING: BLOCKFROST_KEY not configured. API calls will fail.");
}

const blockchainProvider = new BlockfrostProvider(BLOCKFROST_KEY || "");

// Load Script from plutus.json (V2 SECURE validator)
const originalPlutusScriptCbor = (contract as any).validators[0].compiledCode;
const aikenScriptHash = (contract as any).validators[0].hash;

// IMPORTANT: MeshJS needs the script PRE-WRAPPED with applyCborEncoding
// Without this, MeshJS will compute wrong script hash!
const wrappedScriptCbor = applyCborEncoding(originalPlutusScriptCbor);

// Script addresses - computed dynamically from hash
// OLD addresses are for display only (locked forever due to MeshJS bug or old validator)

// Compute addresses at module load
const _computedScriptHash = (() => {
  const scriptBytes = Buffer.from(originalPlutusScriptCbor, "hex");
  const prefixed = Buffer.concat([Buffer.from([0x03]), scriptBytes]);
  const hash = blake2b(prefixed, undefined, 28);
  return Buffer.from(hash).toString("hex");
})();

// Export the current script address (computed from new secure validator)
export const CORRECT_SCRIPT_ADDRESS = (() => {
  const headerByte = 0x70; // testnet
  const hashBytes = Buffer.from(_computedScriptHash, "hex");
  const addressBytes = Buffer.concat([Buffer.from([headerByte]), hashBytes]);
  const words = bech32.toWords(addressBytes);
  return bech32.encode("addr_test", words, 108);
})();

// Legacy addresses (LOCKED - cannot claim from these)
export const LEGACY_ADDRESSES = {
  // Old MeshJS bug address (wrong hash computation) - 20 ADA MTKR locked
  MESHJS_BUG: "addr_test1wrvqe3g6vnsp27ckv073qz8785rzxl38pyjdyga40l4k5ysj73xxt",
  // Old insecure validator (no output verification)
  OLD_VALIDATOR: "addr_test1wprmuqd5uef4almr7afqy22leqd0kxuqvd0qk0z46ygwccgjj5d2u",
  // Validator with FinalClaim bug (didn't account for partial_claimed) - 7 ADA locked
  FINALCLAIM_BUG: "addr_test1wpd30rfa8kkdy59dpf7xwvy56tke4rrpn04glzznzt2as5czmhawx",
  // Validator V4 with fee deducted from platform (now mentor pays fee) 
  FEE_FROM_PLATFORM: "addr_test1wps9szv250zk0t6t8gynk4grd3zk64wvseapcq5s3qmgc5c0s02fl",
};

console.log("[CSL] Script hash (Aiken):", aikenScriptHash);
console.log("[CSL] Script hash (computed):", _computedScriptHash);
console.log("[CSL] Current script address:", CORRECT_SCRIPT_ADDRESS);

/**
 * Compute PlutusV3 script hash correctly
 * PlutusV3: blake2b_224(0x03 || script_cbor_bytes)
 */
export function computeCorrectScriptHash(scriptCborHex: string): string {
  const scriptBytes = Buffer.from(scriptCborHex, "hex");
  // Prepend version byte 0x03 for PlutusV3
  const prefixed = Buffer.concat([Buffer.from([0x03]), scriptBytes]);
  // Blake2b-224 (28 bytes)
  const hash = blake2b(prefixed, undefined, 28);
  return Buffer.from(hash).toString("hex");
}

/**
 * Convert script hash to bech32 address
 */
export function scriptHashToAddress(scriptHash: string, networkId: number = 0): string {
  // Script address has header byte: (network_id << 4) | 0x70 for script enterprise address
  // Actually for testnet: 0x70 (network 0), for mainnet: 0x71 (network 1)
  const headerByte = networkId === 0 ? 0x70 : 0x71;
  const hashBytes = Buffer.from(scriptHash, "hex");
  const addressBytes = Buffer.concat([Buffer.from([headerByte]), hashBytes]);
  
  // Convert to bech32
  const words = bech32.toWords(addressBytes);
  const prefix = networkId === 0 ? "addr_test" : "addr";
  return bech32.encode(prefix, words, 108);
}

/**
 * Get the correct script address (Aiken hash)
 */
export function getCorrectScriptAddress(networkId: number = 0): string {
  const correctHash = computeCorrectScriptHash(originalPlutusScriptCbor);
  return scriptHashToAddress(correctHash, networkId);
}

/**
 * Verify if we computed the hash correctly (should match Aiken's hash)
 */
export function verifyHashCalculation(): {
  aikenHash: string;
  computedHash: string;
  match: boolean;
  aikenAddress: string;
  computedAddress: string;
} {
  const computedHash = computeCorrectScriptHash(originalPlutusScriptCbor);
  const computedAddress = getCorrectScriptAddress(0);
  const aikenAddress = scriptHashToAddress(aikenScriptHash, 0);
  
  return {
    aikenHash: aikenScriptHash,
    computedHash,
    match: aikenScriptHash === computedHash,
    aikenAddress,
    computedAddress,
  };
}

// Types matching Aiken definitions
export interface EduDatum {
  student: string;
  mentor: string;
  platform: string;
  amount: number;
  progress: number;
  partial_claimed: boolean;
}

/**
 * Get escrow UTxOs at the CORRECT address (Aiken hash)
 * This will be empty until new escrows are created with correct hash
 */
export async function getEscrowUtxosCSL(mentorAddr?: string) {
  const scriptAddress = getCorrectScriptAddress(0);
  console.log("[CSL] Fetching UTXOs from correct script address:", scriptAddress);
  
  const utxos = await blockchainProvider.fetchAddressUTxOs(scriptAddress);
  console.log(`[CSL] Found ${utxos.length} UTXOs at script address.`);
  
  const parsedUtxos = utxos.map((utxo) => {
    try {
      if (!utxo.output.plutusData) {
        return null;
      }
      
      const datumCbor = utxo.output.plutusData;
      const datum = deserializeDatum(datumCbor);
      
      if (datum.constructor !== 0n || datum.fields.length !== 6) {
        return null;
      }
      
      const eduDatum: EduDatum = {
        student: datum.fields[0].bytes,
        mentor: datum.fields[1].bytes,
        platform: datum.fields[2].bytes,
        amount: Number(datum.fields[3].int),
        progress: Number(datum.fields[4].int),
        partial_claimed: datum.fields[5].constructor === 1n,
      };
      
      return { utxo, datum: eduDatum };
    } catch (e) {
      return null;
    }
  }).filter((item): item is { utxo: UTxO, datum: EduDatum } => item !== null);

  if (mentorAddr) {
    const mentorPkh = resolvePaymentKeyHash(mentorAddr);
    return parsedUtxos.filter(item => item.datum.mentor === mentorPkh);
  }

  return parsedUtxos;
}

/**
 * Get the NEW correct escrow address (using Aiken hash)
 */
export function getEscrowAddressCSL(): string {
  return getCorrectScriptAddress(0);
}

// Export info about script hashes for debugging
export function getScriptInfo() {
  const verification = verifyHashCalculation();
  
  return {
    ...verification,
    scriptCborLength: originalPlutusScriptCbor.length,
    note: verification.match 
      ? "Hash calculation matches Aiken - ready for use"
      : "WARNING: Hash mismatch - check implementation"
  };
}

// =========================================================================
// TRANSACTION BUILDING FUNCTIONS
// These use MeshJS for TX building but send to CORRECT address (Aiken hash)
// =========================================================================

export interface InitiateEscrowCSLParams {
  wallet: any;
  mentorAddr: string;
  studentAddr: string;
  amount: number; // In Lovelace
}

export interface ClaimFundsCSLParams {
  wallet: any;
  scriptUtxo: UTxO;
  datum: EduDatum;
  action: "PartialClaim" | "FinalClaim";
  currentProgress: number;
}

/**
 * Create new escrow at CORRECT address (Aiken hash)
 * This escrow will be claimable (unlike old MeshJS escrows)
 */
export const initiateEscrowCSL = async ({
  wallet,
  mentorAddr,
  studentAddr,
  amount,
}: InitiateEscrowCSLParams) => {
  const platformAddr = process.env.NEXT_PUBLIC_PLATFORM_WALLET_ADDRESS;
  if (!platformAddr) throw new Error("Platform wallet address not configured");

  const studentPkh = resolvePaymentKeyHash(studentAddr);
  const mentorPkh = resolvePaymentKeyHash(mentorAddr);
  const platformPkh = resolvePaymentKeyHash(platformAddr);

  // Construct Initial Datum
  const datum: EduDatum = {
    student: studentPkh,
    mentor: mentorPkh,
    platform: platformPkh,
    amount: amount,
    progress: 0,
    partial_claimed: false,
  };

  const datumData = mConStr0([
    datum.student,
    datum.mentor,
    datum.platform,
    datum.amount,
    datum.progress,
    datum.partial_claimed ? mConStr1([]) : mConStr0([]),
  ]);

  // Use CORRECT script address (Aiken hash)
  const correctAddress = getCorrectScriptAddress(0);
  console.log("[CSL] Creating escrow at CORRECT address:", correctAddress);

  const tx = new MeshTxBuilder({ fetcher: blockchainProvider, submitter: blockchainProvider });
  
  await tx
    .txOut(correctAddress, [{ unit: "lovelace", quantity: amount.toString() }])
    .txOutInlineDatumValue(datumData)
    .changeAddress(studentAddr)
    .selectUtxosFrom(await wallet.getUtxos())
    .complete();

  const signedTx = await wallet.signTx(tx.txHex);
  const txHash = await wallet.submitTx(signedTx);

  console.log("[CSL] Escrow created successfully!");
  console.log("[CSL] TX Hash:", txHash);
  console.log("[CSL] This escrow WILL be claimable (correct address)");

  return txHash;
};

/**
 * Claim funds from escrow at CORRECT address
 * 
 * NOTE: This function claims from NEW escrows (correct address).
 * OLD escrows (MeshJS wrong address) are PERMANENTLY LOCKED.
 */
export const claimFundsCSL = async ({
  wallet,
  scriptUtxo,
  datum: passedDatum,
  action,
  currentProgress,
}: ClaimFundsCSLParams) => {
  console.log("╔════════════════════════════════════════╗");
  console.log("║  CSL CLAIM - CORRECT ADDRESS           ║");
  console.log("╚════════════════════════════════════════╝");

  try {
    const mentorAddr = (await wallet.getUsedAddresses())[0];
    const changeAddr = mentorAddr;
    const mentorPkh = resolvePaymentKeyHash(mentorAddr);

    console.log("[CSL] Mentor address:", mentorAddr);
    console.log("[CSL] Mentor PKH:", mentorPkh);

    // Parse datum from inline datum CBOR (fresh from UTxO, not cached)
    let datum = passedDatum;
    if (scriptUtxo.output.plutusData) {
      try {
        const parsedDatum = deserializeDatum(scriptUtxo.output.plutusData);
        if (parsedDatum.constructor === 0n && parsedDatum.fields.length === 6) {
          datum = {
            student: parsedDatum.fields[0].bytes,
            mentor: parsedDatum.fields[1].bytes,
            platform: parsedDatum.fields[2].bytes,
            amount: Number(parsedDatum.fields[3].int),
            progress: Number(parsedDatum.fields[4].int),
            partial_claimed: parsedDatum.fields[5].constructor === 1n,
          };
          console.log("[CSL] Parsed fresh datum from UTxO inline datum");
          console.log("[CSL] Fresh datum:", JSON.stringify(datum));
        }
      } catch (e) {
        console.warn("[CSL] Could not parse inline datum, using passed datum");
      }
    }

    // Verify Mentor is the caller
    if (mentorPkh !== datum.mentor) {
      throw new Error(`Mentor PKH mismatch: ${mentorPkh} !== ${datum.mentor}`);
    }

    console.log("[CSL] Action:", action);
    console.log("[CSL] Progress:", currentProgress);

    // Get wallet UTXOs
    const walletUtxos = await wallet.getUtxos();
    console.log("[CSL] Wallet UTXOs:", walletUtxos.length);

    // Select collateral UTXO (5 ADA minimum)
    const collateralAmount = 5_000_000;
    const collateralUtxo = walletUtxos.find(
      (utxo: UTxO) =>
        Number(utxo.output.amount[0].quantity) >= collateralAmount &&
        utxo.output.amount.length === 1
    );

    if (!collateralUtxo) {
      throw new Error("No collateral UTXO found (need ≥ 5 ADA)");
    }

    const nonCollateralUtxos = walletUtxos.filter((utxo: UTxO) => utxo !== collateralUtxo);

    // Build transaction
    const tx = new MeshTxBuilder({ fetcher: blockchainProvider, submitter: blockchainProvider });

    // Construct Redeemer
    const actionConstr = action === "PartialClaim" ? mConStr0([]) : mConStr1([]);
    const redeemerData = mConStr0([actionConstr, BigInt(currentProgress)]);

    console.log("[CSL] Building spending transaction...");
    console.log("[CSL] Wrapped Script CBOR (first 50):", wrappedScriptCbor.substring(0, 50) + "...");
    console.log("[CSL] UTxO plutusData:", scriptUtxo.output.plutusData?.substring(0, 50) + "...");
    console.log("[CSL] Redeemer: action=" + action + ", progress=" + currentProgress);
    
    // Add spending input with script
    tx.spendingPlutusScriptV3()
      .txIn(
        scriptUtxo.input.txHash,
        scriptUtxo.input.outputIndex,
        scriptUtxo.output.amount,
        scriptUtxo.output.address
      )
      .txInScript(wrappedScriptCbor) // Use wrapped CBOR for correct hash!
      .txInRedeemerValue(redeemerData)
      .txInInlineDatumPresent();

    // Add collateral
    tx.txInCollateral(
      collateralUtxo.input.txHash,
      collateralUtxo.input.outputIndex,
      collateralUtxo.output.amount,
      collateralUtxo.output.address
    );

    // IMPORTANT: Add required signer for mentor (validator checks tx.extra_signatories)
    tx.requiredSignerHash(mentorPkh);
    console.log("[CSL] Added required signer:", mentorPkh);

    // Calculate outputs based on action type
    const utxoValue = Number(scriptUtxo.output.amount[0].quantity);
    const minUtxo = 2_000_000; // Minimum UTxO for Cardano
    const feeBuffer = 1_000_000; // 1 ADA fee buffer (deducted from mentor)
    
    if (action === "PartialClaim") {
      // PartialClaim: 30% to mentor (minus fee), 70% back to script (full)
      const mentorAmountRaw = Math.floor(utxoValue * 0.3);
      const mentorAmount = mentorAmountRaw - feeBuffer; // Mentor pays fee
      const remainingAmount = utxoValue - mentorAmountRaw; // Full 70% back to script
      
      console.log("[CSL] PartialClaim distribution (mentor pays fee):");
      console.log("[CSL]   Mentor gets (30% - fee):", mentorAmount / 1_000_000, "ADA");
      console.log("[CSL]   Remaining 70% (full):", remainingAmount / 1_000_000, "ADA");
      
      // Output to mentor (30% - fee)
      tx.txOut(mentorAddr, [{ unit: "lovelace", quantity: mentorAmount.toString() }]);
      
      // Output remaining back to script with updated datum
      // IMPORTANT: Return to SAME address as input (for validator to verify)
      const returnAddress = scriptUtxo.output.address;
      console.log("[CSL] Returning to original address:", returnAddress);
      
      const updatedDatum: EduDatum = {
        ...datum,
        partial_claimed: true, // Mark as partial claimed
      };
      const updatedDatumData = mConStr0([
        updatedDatum.student,
        updatedDatum.mentor,
        updatedDatum.platform,
        updatedDatum.amount,
        updatedDatum.progress,
        updatedDatum.partial_claimed ? mConStr1([]) : mConStr0([]),
      ]);
      
      tx.txOut(returnAddress, [{ unit: "lovelace", quantity: remainingAmount.toString() }])
        .txOutInlineDatumValue(updatedDatumData);
      
      console.log("[CSL] Output datum updated with partial_claimed = true");
      
    } else {
      // FinalClaim: 60% of remaining to mentor (minus fee), 40% to platform (full)
      // IMPORTANT: Calculate same way as validator to match expected outputs
      const remaining = datum.partial_claimed ? 70 : 100;
      const mentorAmountRaw = Math.floor((datum.amount * remaining * 60) / 10000);
      const mentorAmount = mentorAmountRaw - feeBuffer; // Mentor pays fee
      const platformAmount = Math.floor((datum.amount * remaining * 40) / 10000); // Platform gets full 40%
      
      console.log("[CSL] FinalClaim calculation (mentor pays fee):");
      console.log("[CSL]   Original amount:", datum.amount / 1_000_000, "ADA");
      console.log("[CSL]   Partial claimed:", datum.partial_claimed);
      console.log("[CSL]   Remaining %:", remaining);
      
      // Get platform address
      const platformAddr = process.env.NEXT_PUBLIC_PLATFORM_WALLET_ADDRESS;
      if (!platformAddr) {
        throw new Error("Platform wallet address not configured");
      }
      
      console.log("[CSL] FinalClaim distribution:");
      console.log("[CSL]   Mentor gets (60% - fee):", mentorAmount / 1_000_000, "ADA");
      console.log("[CSL]   Platform gets (full 40%):", platformAmount / 1_000_000, "ADA");
      
      // Output to mentor
      tx.txOut(mentorAddr, [{ unit: "lovelace", quantity: mentorAmount.toString() }]);
      
      // Output to platform
      tx.txOut(platformAddr, [{ unit: "lovelace", quantity: platformAmount.toString() }]);
    }

    // Finalize
    tx.changeAddress(changeAddr);
    tx.selectUtxosFrom(nonCollateralUtxos);

    const unsignedTx = await tx.complete();
    console.log("[CSL] Transaction built, signing...");
    console.log("[CSL] Unsigned TX CBOR (first 100):", unsignedTx.substring(0, 100) + "...");

    const signedTx = await wallet.signTx(unsignedTx, true);
    console.log("[CSL] Signed TX CBOR (first 100):", signedTx.substring(0, 100) + "...");
    
    // Try to evaluate first before submitting
    console.log("[CSL] Evaluating transaction...");
    try {
      const evalResponse = await fetch("https://cardano-preview.blockfrost.io/api/v0/utils/txs/evaluate", {
        method: 'POST',
        headers: {
          'project_id': process.env.NEXT_PUBLIC_BLOCKFROST_KEY_PREVIEW || '',
          'Content-Type': 'application/cbor',
        },
        body: Buffer.from(signedTx, 'hex'),
      });
      const evalResult = await evalResponse.json();
      console.log("[CSL] Evaluation result:", JSON.stringify(evalResult, null, 2));
    } catch (evalErr) {
      console.error("[CSL] Evaluation error:", evalErr);
    }
    
    console.log("[CSL] Submitting to blockchain...");

    try {
      const txHash = await wallet.submitTx(signedTx);
      
      console.log("╔════════════════════════════════════════╗");
      console.log("║  CSL CLAIM SUCCESSFUL                  ║");
      console.log("╚════════════════════════════════════════╝");
      console.log("[CSL] TX Hash:", txHash);

      return txHash;
    } catch (submitError: any) {
      // Try to decode the error message for more details
      console.error("[CSL] Submit error details:", JSON.stringify(submitError, null, 2));
      
      // Try to extract the actual error from Blockfrost
      if (submitError.info) {
        try {
          // Parse nested JSON error
          const parsed = JSON.parse(submitError.info.replace('BAD_REQUEST (', '').replace(/\)$/, ''));
          console.error("[CSL] Blockfrost error:", JSON.stringify(parsed, null, 2));
          
          // Try to parse the inner message
          if (parsed.message) {
            const innerMessage = JSON.parse(parsed.message);
            console.error("[CSL] Inner error:", JSON.stringify(innerMessage, null, 2));
          }
        } catch (parseErr) {
          console.error("[CSL] Could not parse error details");
        }
      }
      
      throw submitError;
    }
  } catch (error) {
    console.error("╔════════════════════════════════════════╗");
    console.error("║  CSL CLAIM FAILED                      ║");
    console.error("╚════════════════════════════════════════╝");
    console.error("[CSL] Error:", error);
    throw error;
  }
};
