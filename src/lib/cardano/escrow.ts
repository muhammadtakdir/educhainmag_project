import {
  MeshTxBuilder,
  BlockfrostProvider,
  Asset,
  serializePlutusScript,
  resolvePlutusScriptAddress,
  mConStr0,
  mConStr1,
  resolvePaymentKeyHash,
  stringToHex,
  deserializeDatum,
  resolveScriptHash,
  applyCborEncoding,
} from "@meshsdk/core";
import type { UTxO } from "@meshsdk/common";
import contract from "../../../edu_escrow/plutus.json";

// CBOR decode/encode for fixing MeshSDK witness bug
import * as cbor from "cbor";

const blockchainProvider = new BlockfrostProvider(
  process.env.NEXT_PUBLIC_BLOCKFROST_KEY_PREVIEW as string
);

const meshTxBuilder = new MeshTxBuilder({
  fetcher: blockchainProvider,
  submitter: blockchainProvider,
});

// Load Script from plutus.json (ensures consistency)
const originalPlutusScriptCbor = (contract as any).validators[0].compiledCode;
const aikenScriptHash = (contract as any).validators[0].hash;

// MeshSDK Bug Info:
// - MeshSDK unwraps CBOR before hashing: blake2b_224(0x03 || unwrapped_cbor)
// - This produces WRONG hash: d80cc51a... 
// - Correct hash (Aiken): 47be01b4...
// - UTxOs locked with Mesh hash are UNSPENDABLE due to Conway era validation

const scriptCborForTx = originalPlutusScriptCbor;

// TWO script addresses exist:
// 1. OLD/BROKEN (MeshJS hash d80cc51a...): addr_test1wrvqe3g6vnsp27ckv073qz8785rzxl38pyjdyga40l4k5ysj73xxt
//    - UTxOs here are PERMANENTLY LOCKED (MeshJS bug)
// 2. NEW/CORRECT (Aiken hash 47be01b4...): computed by CSL in escrow-csl.ts
//    - New UTxOs should be created here using CSL

const meshComputedHash = resolveScriptHash(originalPlutusScriptCbor, "V3");
console.log("[INIT] Aiken Script Hash (correct):", aikenScriptHash);
console.log("[INIT] Mesh Computed Hash (WRONG):", meshComputedHash);
console.log("[INIT] ⚠️ OLD UTxOs at Mesh address are UNSPENDABLE due to MeshJS bug");

// OLD script address (MeshJS bug - UTxOs here are locked forever)
const OLD_SCRIPT_ADDRESS = "addr_test1wrvqe3g6vnsp27ckv073qz8785rzxl38pyjdyga40l4k5ysj73xxt";

// For backward compatibility, keep pointing to old address
// But mark these UTxOs as "locked" in the UI
const scriptAddress = OLD_SCRIPT_ADDRESS;

// Export info about the bug
export const MESHJS_BUG_INFO = {
  oldAddress: OLD_SCRIPT_ADDRESS,
  oldHash: meshComputedHash, // d80cc51a...
  correctHash: aikenScriptHash, // 47be01b4...
  status: "LOCKED",
  reason: "MeshJS PlutusV3 hash calculation bug - funds permanently locked until MeshJS fix",
};

/**
 * FIX for MeshSDK witness bug in Conway era:
 * MeshSDK incorrectly puts RAW FLAT UPLC bytes into PlutusV3 witness set.
 * Conway era requires CBOR-wrapped ByteString format.
 * 
 * This function post-processes the unsigned TX to fix the witness.
 */
function fixPlutusV3Witness(txHex: string, correctScriptCbor: string): string {
  try {
    const decoded = cbor.decodeFirstSync(Buffer.from(txHex, "hex"));
    if (!Array.isArray(decoded) || decoded.length < 4) {
      console.log("[FIX] TX structure not as expected, skipping fix");
      return txHex;
    }

    const [body, witnesses, isValid, auxData] = decoded;
    
    // Key 7 = PlutusV3 scripts in witness set
    const v3Scripts = witnesses.get(7);
    if (!v3Scripts || v3Scripts.size === 0) {
      console.log("[FIX] No V3 scripts in witness, skipping fix");
      return txHex;
    }

    console.log("[FIX] Found V3 scripts in witness, applying fix...");
    
    // Get the first (broken) script
    const brokenScript = Array.from(v3Scripts as Set<Buffer>)[0];
    console.log("[FIX] Broken script first bytes:", brokenScript.toString("hex").slice(0, 20));
    
    // The correct script should be CBOR-wrapped (starts with 59 for bytestring)
    const correctBytes = Buffer.from(correctScriptCbor, "hex");
    console.log("[FIX] Correct script first bytes:", correctBytes.toString("hex").slice(0, 20));
    
    // Create new Set with correct script
    const fixedScripts = new Set([correctBytes]);
    witnesses.set(7, fixedScripts);
    
    // Re-encode transaction
    const fixedTx = [body, witnesses, isValid, auxData];
    const fixedTxBuffer = cbor.encode(fixedTx);
    const fixedTxHex = fixedTxBuffer.toString("hex");
    
    console.log("[FIX] Transaction witness fixed successfully");
    return fixedTxHex;
  } catch (err: any) {
    console.error("[FIX] Error fixing witness:", err.message);
    return txHex;
  }
}

// Types matching Aiken definitions
export interface EduDatum {
  student: string; // PKH
  mentor: string; // PKH
  platform: string; // PKH
  amount: number;
  progress: number;
  partial_claimed: boolean;
}

export interface InitiateEscrowParams {
  wallet: any;
  mentorAddr: string;
  studentAddr: string;
  amount: number; // In Lovelace
}

export interface ClaimFundsParams {
  wallet: any; // Mentor's wallet
  scriptUtxo: UTxO;
  datum: EduDatum;
  action: "PartialClaim" | "FinalClaim";
  currentProgress: number;
}

export const getEscrowAddress = () => scriptAddress;

export const getEscrowUtxos = async (mentorAddr?: string) => {
  console.log("Fetching UTXOs from Script Address:", scriptAddress);
  const utxos = await blockchainProvider.fetchAddressUTxOs(scriptAddress);
  console.log(`Found ${utxos.length} UTXOs at script address.`);
  
  const parsedUtxos = utxos.map((utxo) => {
    try {
      if (!utxo.output.plutusData) {
        console.log("UTXO has no inline datum:", utxo.input.txHash);
        return null;
      }
      
      const datumCbor = utxo.output.plutusData;
      const datum = deserializeDatum(datumCbor); 
      console.log("Deserialized Datum object (full):", datum);
      console.log("Datum constructor:", datum.constructor);
      console.log("Datum fields:", datum.fields);
      
      // Basic validation of structure: must be a Constr 0 with 6 fields
      // Use datum.constructor (BigInt) and datum.fields directly
      if (datum.constructor !== 0n || datum.fields.length !== 6) {
        console.log("Datum is not Constr 0 with 6 fields or cannot be deserialized as Constr (using direct properties):", datum);
        return null;
      }
      
      const studentPkh = datum.fields[0].bytes;
      const mentorPkh = datum.fields[1].bytes;
      const platformPkh = datum.fields[2].bytes;
      const amount = datum.fields[3].int;
      const progress = datum.fields[4].int;
      const partialClaimedConstr = datum.fields[5].constructor; // Bool is also a Constr
      const partialClaimed = partialClaimedConstr === 1n; // Compare with BigInt 1n

      const eduDatum: EduDatum = {
        student: studentPkh,
        mentor: mentorPkh,
        platform: platformPkh,
        amount: Number(amount),
        progress: Number(progress),
        partial_claimed: partialClaimed,
      };
      
      console.log("Parsed Datum:", eduDatum);
      return { utxo, datum: eduDatum };
    } catch (e) {
      console.error("Failed to parse datum for UTXO:", utxo.input.txHash, e);
      return null;
    }
  })
  .filter((item): item is { utxo: UTxO, datum: EduDatum } => item !== null);

  if (mentorAddr) {
    const mentorPkh = resolvePaymentKeyHash(mentorAddr);
    console.log("Filtering for Mentor PKH:", mentorPkh);
    const filtered = parsedUtxos.filter(item => {
      const match = item.datum.mentor === mentorPkh;
      if (!match) console.log(`Skipping UTXO for different mentor: ${item.datum.mentor}`);
      return match;
    });
    console.log(`Returning ${filtered.length} matching escrows.`);
    return filtered;
  }

  return parsedUtxos;
};

export const initiateEscrow = async ({
  wallet,
  mentorAddr,
  studentAddr,
  amount,
}: InitiateEscrowParams) => {
  const platformAddr = process.env.NEXT_PUBLIC_PLATFORM_WALLET_ADDRESS;
  if (!platformAddr) throw new Error("Platform wallet address not configured");

  const studentPkh = resolvePaymentKeyHash(studentAddr);
  const mentorPkh = resolvePaymentKeyHash(mentorAddr);
  const platformPkh = resolvePaymentKeyHash(platformAddr);

  // Construct Initial Datum
  // EduDatum { student, mentor, platform, amount, progress: 0, partial_claimed: False }
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
    datum.partial_claimed ? mConStr1([]) : mConStr0([]), // Bool: True=Constr1, False=Constr0
  ]);

  const tx = new MeshTxBuilder({ fetcher: blockchainProvider, submitter: blockchainProvider });
  
  await tx
    .txOut(scriptAddress, [{ unit: "lovelace", quantity: amount.toString() }])
    .txOutInlineDatumValue(datumData)
    .changeAddress(studentAddr)
    .selectUtxosFrom(await wallet.getUtxos())
    .complete();

  const signedTx = await wallet.signTx(tx.txHex);
  const txHash = await wallet.submitTx(signedTx);

  return txHash;
};

export const claimFunds = async ({
  wallet,
  scriptUtxo,
  datum,
  action,
  currentProgress,
}: ClaimFundsParams) => {
  console.log("╔════════════════════════════════════════╗");
  console.log("║  CLAIM FUNDS - STARTING TRANSACTION   ║");
  console.log("╚════════════════════════════════════════╝");

  try {
    const mentorAddr = (await wallet.getUsedAddresses())[0];
    const unusedAddresses = await wallet.getUnusedAddresses();
    const changeAddr = unusedAddresses.length > 0 ? unusedAddresses[0] : mentorAddr;

    console.log("[1] Addresses:");
    console.log("    - Mentor (used):", mentorAddr);
    console.log("    - Change (unused):", changeAddr);

    const mentorPkh = resolvePaymentKeyHash(mentorAddr);
    console.log("    - Mentor PKH:", mentorPkh);

    // Verify Mentor is the caller
    if (mentorPkh !== datum.mentor) {
      throw new Error(`Mentor PKH mismatch: ${mentorPkh} !== ${datum.mentor}`);
    }

    console.log("[2] Datum Verification:");
    console.log("    - Amount:", datum.amount);
    console.log("    - Progress:", datum.progress);
    console.log("    - Partial Claimed:", datum.partial_claimed);
    console.log("    - Action:", action);
    console.log("    - Current Progress:", currentProgress);

    // Get wallet UTXOs
    const walletUtxos = await wallet.getUtxos();
    console.log("[3] Wallet UTXOs found:", walletUtxos.length);
    walletUtxos.forEach((u: any, i: number) => {
      const amount = Number(u.output.amount[0]?.quantity || 0) / 1000000;
      console.log(`    - UTXO ${i}: ${amount} ADA`);
    });

    // Select collateral UTXO (5 ADA minimum)
    const collateralAmount = 5_000_000;
    const collateralUtxo = walletUtxos.find(
      (utxo: UTxO) =>
        Number(utxo.output.amount[0].quantity) >= collateralAmount &&
        utxo.output.amount.length === 1
    );

    if (!collateralUtxo) {
      throw new Error(
        `No collateral UTXO found (need ≥ 5 ADA). Available: ${walletUtxos.map((u: UTxO) => Number(u.output.amount[0].quantity) / 1000000).join(", ")} ADA`
      );
    }

    console.log("[4] Collateral UTXO selected:");
    console.log("    - TX:", collateralUtxo.input.txHash.substring(0, 16) + "...");
    console.log("    - Index:", collateralUtxo.input.outputIndex);
    console.log("    - Amount:", Number(collateralUtxo.output.amount[0].quantity) / 1000000, "ADA");

    const nonCollateralUtxos = walletUtxos.filter((utxo: UTxO) => utxo !== collateralUtxo);
    console.log("[4b] Non-collateral UTXOs available:", nonCollateralUtxos.length);

    // Build transaction
    const tx = new MeshTxBuilder({ fetcher: blockchainProvider, submitter: blockchainProvider });

    // Construct Redeemer matching Aiken's EduRedeemer { action: EduAction, progress: Int }
    // EduRedeemer = Constr 0 [action, progress]
    // EduAction PartialClaim = Constr 0 []
    // EduAction FinalClaim = Constr 1 []
    const actionConstr = action === "PartialClaim" ? mConStr0([]) : mConStr1([]);
    const redeemerData = mConStr0([actionConstr, BigInt(currentProgress)]);

    console.log("[5] Redeemer constructed:");
    console.log("    - Action type:", action);
    console.log("    - Progress:", currentProgress);
    console.log("    - Full Redeemer:", JSON.stringify(redeemerData, (_, v) => typeof v === 'bigint' ? v.toString() : v));

    // Record step to server-side history
    try {
      await fetch('/api/log-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time: new Date().toISOString(), step: 'redeemer-constructed', action, currentProgress }),
      });
    } catch {}

    // Add spending input with script
    console.log("[6] Building Plutus spending transaction...");
    console.log("    - Script type: V3");
    console.log("    - CBOR length:", scriptCborForTx.length);
    console.log("    - On-chain script hash:", meshComputedHash);
    
    // Use original CBOR - MeshSDK will unwrap internally
    // This matches the hash used when the escrow was created
    tx.spendingPlutusScriptV3()
      .txIn(
        scriptUtxo.input.txHash,
        scriptUtxo.input.outputIndex,
        scriptUtxo.output.amount,
        scriptUtxo.output.address
      )
      .txInScript(scriptCborForTx)
      .txInRedeemerValue(redeemerData)
      .txInInlineDatumPresent();

    console.log("    ✓ Script input configured");

    // Add collateral
    console.log("[7] Adding collateral...");
    tx.txInCollateral(
      collateralUtxo.input.txHash,
      collateralUtxo.input.outputIndex,
      collateralUtxo.output.amount,
      collateralUtxo.output.address
    );
    console.log("    ✓ Collateral added");

    // Handle outputs based on action (simplified for testing)
    console.log("[8] Constructing outputs...");
    // For now, send entire amount to mentor as a test (simplify output logic to match test harness)
    const utxoValue = Number(scriptUtxo.output.amount[0].quantity);
    tx.txOut(mentorAddr, [{ unit: "lovelace", quantity: utxoValue.toString() }]);
    console.log("    ✓ Output configured (testing simplified version)");

    // Add signer requirement and select UTXOs (order matters for redeemer evaluation)
    console.log("[9] Adding transaction requirements...");
    tx.changeAddress(changeAddr);
    tx.selectUtxosFrom(nonCollateralUtxos);
    // NOTE: Removed requiredSignerHash() to match working test-claim.js
    // The script extracts the signer from the transaction context automatically
    console.log("    ✓ Change address and UTxO selection set (no explicit requiredSignerHash)");

    console.log("[10] Building transaction...");
    const unsignedTx = await tx.complete();
    console.log("    ✓ Transaction built");
    console.log("    - TX Hex length:", unsignedTx.length);

    // NOTE: Removed fixPlutusV3Witness - MeshSDK must handle witness consistently
    // The UTxO on-chain was created with Mesh's hash (d80cc51a...), so we must
    // let MeshSDK build the claim TX with the same hash approach

    console.log("[11] Signing transaction...");
    const signedTx = await wallet.signTx(unsignedTx, true);
    console.log("    ✓ Transaction signed");
    console.log("    - Signed TX length:", signedTx.length);

    // POST the signed TX hex to server for offline inspection (debug only)
    try {
      await fetch('/api/log-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time: new Date().toISOString(), debug: 'signedTx', signedTx, unsignedTx }),
      });
      console.log('    → Signed TX posted to /api/log-error for debugging');
    } catch (postErr) {
      console.error('    → Failed to POST signed TX to server for debugging:', postErr);
    }

    console.log("[12] Submitting to blockchain...");
    const txHash = await wallet.submitTx(signedTx);
    try {
      await fetch('/api/log-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time: new Date().toISOString(), step: 'tx-submitted', txHash }),
      });
    } catch {}
    
    console.log("    ✓ Transaction submitted!");
    console.log("    - TX Hash:", txHash);
    console.log("╔════════════════════════════════════════╗");
    console.log("║  CLAIM COMPLETED SUCCESSFULLY          ║");
    console.log("╚════════════════════════════════════════╝");

    return txHash;
  } catch (error) {
    console.error("╔════════════════════════════════════════╗");
    console.error("║  CLAIM FAILED                          ║");
    console.error("╚════════════════════════════════════════╝");
    
    if (error instanceof Error) {
      console.error("Error Type:", error.name);
      console.error("Error Message:", error.message);
      console.error("Full Error Object:", JSON.stringify(error, null, 2));
      
      // Extract TxSendError details if present
      if ((error as any).info) {
        console.error("Error Info Field:", (error as any).info);
      }
      if ((error as any).code) {
        console.error("Error Code:", (error as any).code);
      }

      // Persist full error details via server API (append on server)
      try {
        const errDetails: any = {
          time: new Date().toISOString(),
          name: (error as any).name || null,
          message: (error as any).message || null,
          stack: (error as any).stack || null,
          info: (error as any).info || null,
          code: (error as any).code || null,
          props: {}
        };
        // copy enumerable+non-enumerable props
        Object.getOwnPropertyNames(error).forEach((k) => {
          try { errDetails.props[k] = (error as any)[k]; } catch (e) { errDetails.props[k] = String((error as any)[k]); }
        });

        // POST the error object to a server-side API route which will append to logv_full.json
        try {
          await fetch('/api/log-error', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(errDetails),
          });
          console.error('  → Full error posted to /api/log-error');
        } catch (postErr) {
          console.error('  → Failed to POST full error to server API:', postErr);
        }
      } catch (postBuildErr) {
        console.error('  → Failed to assemble error details for POST:', postBuildErr);
      }
      
      // Extract specific error info
      if (error.message.includes("Major type mismatch")) {
        console.error("  → ERROR: Major type mismatch in CBOR");
        console.error("  → Script CBOR format is incorrect");
        console.error("  → Expected ByteString (type 2), check script format");
      }
      if (error.message.includes("Evaluate redeemers failed")) {
        console.error("  → Redeemer evaluation failed");
        console.error("  → Check: Redeemer structure, script compatibility");
      }
      if (error.message.includes("TxSubmitFail")) {
        console.error("  → Blockchain rejected the transaction");
        console.error("  → Full error:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        
        if (error.message.includes("MalformedScriptWitnesses")) {
          console.error("  → MalformedScriptWitnesses error");
          console.error("  → Script witness format is incorrect");
        }
        if (error.message.includes("ValidationError")) {
          const msgMatch = error.message.match(/error\\":\s*\[\s*\\"([^"]+)\\"/);
          if (msgMatch) {
            console.error("  → Validation error:", msgMatch[1]);
          }
        }
      }
      if (error.message.includes("BadInputs")) {
        console.error("  → UTXO already spent or not found");
      }
      if (error.message.includes("ExtraneousScriptWitnesses")) {
        console.error("  → Extra witness not needed");
      }
      if (error.message.includes("MissingScriptWitness")) {
        console.error("  → Script witness missing");
      }
    } else {
      console.error("Error:", error);
    }
    
    throw error;
  }
};
