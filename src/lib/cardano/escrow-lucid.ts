/**
 * EduChain Escrow - Lucid Implementation
 * 
 * Lucid handles PlutusV3 scripts correctly (unlike MeshJS).
 * This implementation can claim funds from escrows at BOTH addresses.
 */

import { Blockfrost, Lucid, Data, Constr, fromHex, toHex, C, Script, SpendingValidator, UTxO as LucidUTxO } from "lucid-cardano";
import contract from "../../../edu_escrow/plutus.json";

// Script CBOR from Aiken
const SCRIPT_CBOR = (contract as any).validators[0].compiledCode;
const AIKEN_SCRIPT_HASH = (contract as any).validators[0].hash;

// The CORRECT script address (Aiken hash)
export const CORRECT_SCRIPT_ADDRESS = "addr_test1wprmuqd5uef4almr7afqy22leqd0kxuqvd0qk0z46ygwccgjj5d2u";

// OLD script address (MeshJS bug - permanently locked)
export const OLD_SCRIPT_ADDRESS = "addr_test1wrvqe3g6vnsp27ckv073qz8785rzxl38pyjdyga40l4k5ysj73xxt";

// Datum type matching Aiken's EduDatum
export interface EduDatum {
  student: string;   // PKH hex
  mentor: string;    // PKH hex  
  platform: string;  // PKH hex
  amount: number;
  progress: number;
  partial_claimed: boolean;
}

// Redeemer type matching Aiken's EduRedeemer
type EduAction = "PartialClaim" | "FinalClaim";

interface EduRedeemer {
  action: EduAction;
  progress: number;
}

/**
 * Initialize Lucid with Blockfrost - SERVER SIDE ONLY
 * Use initLucidClient for client-side (browser)
 */
export async function initLucid(): Promise<Lucid> {
  const lucid = await Lucid.new(
    new Blockfrost(
      "https://cardano-preview.blockfrost.io/api",
      process.env.NEXT_PUBLIC_BLOCKFROST_KEY_PREVIEW as string
    ),
    "Preview"
  );
  return lucid;
}

/**
 * Initialize Lucid for CLIENT SIDE (browser) using wallet's provider
 * This avoids CORS issues by letting the wallet handle blockchain queries
 */
export async function initLucidClient(meshWallet: any): Promise<Lucid> {
  // Get wallet API first
  const walletApi = await meshWallet.getWalletApi();
  
  // Create Lucid with wallet's network (from CIP-30)
  const networkId = await walletApi.getNetworkId();
  const network = networkId === 0 ? "Preview" : "Mainnet";
  
  // Initialize Lucid with Blockfrost (needed for tx building)
  // The key difference is we'll use it client-side
  const lucid = await Lucid.new(
    new Blockfrost(
      "https://cardano-preview.blockfrost.io/api",
      process.env.NEXT_PUBLIC_BLOCKFROST_KEY_PREVIEW as string
    ),
    network as "Preview" | "Preprod" | "Mainnet"
  );
  
  // Select the wallet
  lucid.selectWallet(walletApi);
  
  return lucid;
}

/**
 * Get the PlutusV3 validator script
 */
function getValidator(): SpendingValidator {
  return {
    type: "PlutusV3",
    script: SCRIPT_CBOR,
  };
}

/**
 * Encode EduDatum to Plutus Data
 */
function encodeDatum(datum: EduDatum): string {
  const plutusDatum = new Constr(0, [
    datum.student,
    datum.mentor,
    datum.platform,
    BigInt(datum.amount),
    BigInt(datum.progress),
    datum.partial_claimed ? new Constr(1, []) : new Constr(0, []),
  ]);
  return Data.to(plutusDatum);
}

/**
 * Encode EduRedeemer to Plutus Data
 */
function encodeRedeemer(redeemer: EduRedeemer): string {
  const actionConstr = redeemer.action === "PartialClaim" 
    ? new Constr(0, []) 
    : new Constr(1, []);
  
  const plutusRedeemer = new Constr(0, [
    actionConstr,
    BigInt(redeemer.progress),
  ]);
  return Data.to(plutusRedeemer);
}

/**
 * Decode Plutus Data to EduDatum
 */
function decodeDatum(datumCbor: string): EduDatum | null {
  try {
    const datum = Data.from(datumCbor) as Constr<any>;
    
    if (datum.index !== 0n && datum.index !== 0) return null;
    if (datum.fields.length !== 6) return null;
    
    return {
      student: datum.fields[0] as string,
      mentor: datum.fields[1] as string,
      platform: datum.fields[2] as string,
      amount: Number(datum.fields[3]),
      progress: Number(datum.fields[4]),
      partial_claimed: (datum.fields[5] as Constr<any>).index === 1n || (datum.fields[5] as Constr<any>).index === 1,
    };
  } catch (e) {
    console.error("[LUCID] Failed to decode datum:", e);
    return null;
  }
}

/**
 * Get payment key hash from address
 */
export function getPaymentKeyHash(lucid: Lucid, address: string): string {
  const details = lucid.utils.getAddressDetails(address);
  return details.paymentCredential?.hash || "";
}

/**
 * Get escrow UTxOs from the CORRECT address using Lucid
 */
export async function getEscrowUtxosLucid(
  lucid: Lucid, 
  mentorAddr?: string
): Promise<Array<{ utxo: LucidUTxO; datum: EduDatum; isLocked: boolean }>> {
  const results: Array<{ utxo: LucidUTxO; datum: EduDatum; isLocked: boolean }> = [];
  
  // Fetch from CORRECT address (new escrows - claimable)
  try {
    const correctUtxos = await lucid.utxosAt(CORRECT_SCRIPT_ADDRESS);
    console.log(`[LUCID] Found ${correctUtxos.length} UTXOs at correct address`);
    
    for (const utxo of correctUtxos) {
      if (utxo.datum) {
        const datum = decodeDatum(utxo.datum);
        if (datum) {
          results.push({ utxo, datum, isLocked: false });
        }
      }
    }
  } catch (e) {
    console.error("[LUCID] Error fetching from correct address:", e);
  }
  
  // Fetch from OLD address (locked escrows - display only)
  try {
    const oldUtxos = await lucid.utxosAt(OLD_SCRIPT_ADDRESS);
    console.log(`[LUCID] Found ${oldUtxos.length} UTXOs at old address (LOCKED)`);
    
    for (const utxo of oldUtxos) {
      if (utxo.datum) {
        const datum = decodeDatum(utxo.datum);
        if (datum) {
          results.push({ utxo, datum, isLocked: true });
        }
      }
    }
  } catch (e) {
    console.error("[LUCID] Error fetching from old address:", e);
  }
  
  // Filter by mentor if specified
  if (mentorAddr) {
    const mentorPkh = getPaymentKeyHash(lucid, mentorAddr);
    return results.filter(item => item.datum.mentor === mentorPkh);
  }
  
  return results;
}

/**
 * Create new escrow at CORRECT address using Lucid
 */
export async function initiateEscrowLucid(
  lucid: Lucid,
  params: {
    mentorAddr: string;
    studentAddr: string;
    amount: number; // lovelace
  }
): Promise<string> {
  const platformAddr = process.env.NEXT_PUBLIC_PLATFORM_WALLET_ADDRESS;
  if (!platformAddr) throw new Error("Platform wallet address not configured");
  
  const studentPkh = getPaymentKeyHash(lucid, params.studentAddr);
  const mentorPkh = getPaymentKeyHash(lucid, params.mentorAddr);
  const platformPkh = getPaymentKeyHash(lucid, platformAddr);
  
  const datum: EduDatum = {
    student: studentPkh,
    mentor: mentorPkh,
    platform: platformPkh,
    amount: params.amount,
    progress: 0,
    partial_claimed: false,
  };
  
  const datumCbor = encodeDatum(datum);
  
  console.log("[LUCID] Creating escrow at correct address:", CORRECT_SCRIPT_ADDRESS);
  console.log("[LUCID] Datum:", datum);
  
  const tx = await lucid
    .newTx()
    .payToContract(
      CORRECT_SCRIPT_ADDRESS,
      { inline: datumCbor },
      { lovelace: BigInt(params.amount) }
    )
    .complete();
  
  const signedTx = await tx.sign().complete();
  const txHash = await signedTx.submit();
  
  console.log("[LUCID] Escrow created! TX:", txHash);
  return txHash;
}

/**
 * Claim funds from escrow using Lucid
 * This works for escrows at the CORRECT address only!
 */
export async function claimFundsLucid(
  lucid: Lucid,
  params: {
    utxo: LucidUTxO;
    datum: EduDatum;
    action: EduAction;
    currentProgress: number;
  }
): Promise<string> {
  console.log("╔════════════════════════════════════════╗");
  console.log("║  LUCID CLAIM - STARTING                ║");
  console.log("╚════════════════════════════════════════╝");
  
  const { utxo, datum, action, currentProgress } = params;
  
  // Check if this is from old address (locked)
  if (utxo.address === OLD_SCRIPT_ADDRESS) {
    throw new Error("Cannot claim from old address - funds are PERMANENTLY LOCKED due to MeshJS bug");
  }
  
  const mentorAddr = await lucid.wallet.address();
  const mentorPkh = getPaymentKeyHash(lucid, mentorAddr);
  
  console.log("[LUCID] Mentor address:", mentorAddr);
  console.log("[LUCID] Mentor PKH:", mentorPkh);
  console.log("[LUCID] Action:", action);
  console.log("[LUCID] Progress:", currentProgress);
  
  // Verify caller is mentor
  if (mentorPkh !== datum.mentor) {
    throw new Error(`Not authorized: ${mentorPkh} !== ${datum.mentor}`);
  }
  
  // Build redeemer
  const redeemer: EduRedeemer = {
    action,
    progress: currentProgress,
  };
  const redeemerCbor = encodeRedeemer(redeemer);
  
  // Get validator
  const validator = getValidator();
  
  // Calculate payout
  const utxoValue = utxo.assets["lovelace"] || BigInt(0);
  
  console.log("[LUCID] UTxO value:", utxoValue.toString());
  console.log("[LUCID] Building transaction...");
  
  try {
    const tx = await lucid
      .newTx()
      .collectFrom([utxo], redeemerCbor)
      .attachSpendingValidator(validator)
      .addSigner(mentorAddr)
      .complete();
    
    console.log("[LUCID] Transaction built, signing...");
    
    const signedTx = await tx.sign().complete();
    
    console.log("[LUCID] Submitting to blockchain...");
    
    const txHash = await signedTx.submit();
    
    console.log("╔════════════════════════════════════════╗");
    console.log("║  LUCID CLAIM SUCCESSFUL                ║");
    console.log("╚════════════════════════════════════════╝");
    console.log("[LUCID] TX Hash:", txHash);
    
    return txHash;
  } catch (error) {
    console.error("╔════════════════════════════════════════╗");
    console.error("║  LUCID CLAIM FAILED                    ║");
    console.error("╚════════════════════════════════════════╝");
    console.error("[LUCID] Error:", error);
    throw error;
  }
}

/**
 * Verify script hash calculation
 */
export function verifyScriptHash(lucid: Lucid): {
  aikenHash: string;
  lucidHash: string;
  match: boolean;
} {
  const validator = getValidator();
  const lucidHash = lucid.utils.validatorToScriptHash(validator);
  
  return {
    aikenHash: AIKEN_SCRIPT_HASH,
    lucidHash,
    match: AIKEN_SCRIPT_HASH === lucidHash,
  };
}
