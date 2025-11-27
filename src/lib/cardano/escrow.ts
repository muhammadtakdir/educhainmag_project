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
  serializeData,
  resolveScriptHash,
} from "@meshsdk/core";
import type { UTxO } from "@meshsdk/common";
import contract from "../../../edu_escrow/plutus.json";

const blockchainProvider = new BlockfrostProvider(
  process.env.NEXT_PUBLIC_BLOCKFROST_KEY_PREVIEW as string
);

const meshTxBuilder = new MeshTxBuilder({
  fetcher: blockchainProvider,
  submitter: blockchainProvider,
});

// Helper to unwrap CBOR if needed
const unwrapScript = (cbor: string) => {
  if (cbor.startsWith("59") && cbor.length > 6) {
    return cbor.substring(6);
  }
  return cbor;
};

// Load Script
const originalPlutusScriptCbor = contract.validators[0].compiledCode;
const unwrappedScriptCbor = unwrapScript(originalPlutusScriptCbor);

// Calculate Hash using V3 (Matches on-chain address e5434...)
const calculatedScriptHash = resolveScriptHash(originalPlutusScriptCbor, "V3");
console.log("Calculated Script Hash (V3, original CBOR):", calculatedScriptHash);

// Address MUST be V3 to match where funds are
const scriptAddress = resolvePlutusScriptAddress(
  { code: originalPlutusScriptCbor, version: "V3" },
  0 // 0 for Testnet/Preprod/Preview
);

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
  const mentorAddr = (await wallet.getUsedAddresses())[0];
  const unusedAddresses = await wallet.getUnusedAddresses();
  const changeAddr = unusedAddresses.length > 0 ? unusedAddresses[0] : mentorAddr;

  console.log("Mentor Address:", mentorAddr);
  console.log("Change Address:", changeAddr);

  const mentorPkh = resolvePaymentKeyHash(mentorAddr);

  const walletUtxos = await wallet.getUtxos();
  console.log("Mentor Wallet UTXOs:", walletUtxos);
  
  // Explicitly select a collateral UTXO
  const collateralAmount = 5_000_000; // 5 ADA (in Lovelace)
  const collateralUtxo = walletUtxos.find(
    (utxo: UTxO) => Number(utxo.output.amount[0].quantity) >= collateralAmount && utxo.output.amount.length === 1 // Ensure it's just ADA, no tokens
  );

  if (!collateralUtxo) {
    throw new Error(
      "Wallet has no UTXO large enough to be used as collateral (min 5 ADA). Please consolidate funds or send more ADA to this wallet."
    );
  }

  // Filter out the chosen collateral UTXO from the list for selectUtxosFrom
  const nonCollateralUtxos = walletUtxos.filter(
    (utxo: UTxO) => utxo !== collateralUtxo
  );
  
  console.log("Claiming funds as mentor:", mentorAddr);
  console.log("Mentor PKH:", mentorPkh);
  console.log("Action:", action);
  console.log("Current Progress:", currentProgress);
  console.log("Datum Amount:", datum.amount);
  console.log("Datum Progress:", datum.progress);

  // Verify Mentor is the caller
  if (mentorPkh !== datum.mentor) {
    throw new Error("Only the mentor can claim funds");
  }

  const tx = new MeshTxBuilder({ fetcher: blockchainProvider, submitter: blockchainProvider });

  // Construct Redeemer
  if (currentProgress === undefined) throw new Error("currentProgress is undefined");
  if (datum.amount === undefined) throw new Error("datum.amount is undefined");
  if (datum.progress === undefined) throw new Error("datum.progress is undefined");

  const actionConstructor = action === "PartialClaim" ? 0 : 1;
  
  console.log("Script CBOR (used):", unwrappedScriptCbor);

  // Spending Input
  const datumCbor = scriptUtxo.output.plutusData;
  if (!datumCbor) throw new Error("Script UTXO missing inline datum");

  console.log("--- ClaimFunds V14-BigInt START ---");

  const actionData = action === "PartialClaim" ? mConStr0([]) : mConStr1([]);

  // Use BigInt for progress to be safe
  const redeemerDataSafe = mConStr0([
      actionData,
      BigInt(currentProgress)
  ]);
  
  console.log("Redeemer Data:", JSON.stringify(redeemerDataSafe, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));
  console.log("Script CBOR (Unwrapped used):", unwrappedScriptCbor.substring(0, 50) + "...");
  console.log("--- ClaimFunds V20-UnwrappedV3 START ---");

  tx.spendingPlutusScriptV3() 
    .txIn(scriptUtxo.input.txHash, scriptUtxo.input.outputIndex)
    .txInScript(originalPlutusScriptCbor) 
    .txInRedeemerValue(redeemerDataSafe) 
    .txInInlineDatumPresent(); 

  // Remove explicit collateral (Mesh handles it)
  /*
  tx.txInCollateral(
    collateralUtxo.input.txHash,
    collateralUtxo.input.outputIndex,
    collateralUtxo.output.amount,
    collateralUtxo.output.address
  );
  */

  // Logic for Outputs
  if (action === "PartialClaim") {
    const claimAmount = Math.floor(datum.amount * 0.30);
    const remainingAmount = datum.amount - claimAmount;
    console.log("Claim Amount:", claimAmount);
    console.log("Remaining Amount:", remainingAmount);

    tx.txOut(mentorAddr, [{ unit: "lovelace", quantity: claimAmount.toString() }]);
    
    const newDatumData = mConStr0([
      datum.student,
      datum.mentor,
      datum.platform,
      BigInt(remainingAmount), // Use BigInt
      BigInt(currentProgress), // Use BigInt
      mConStr1([]) // partial_claimed = True
    ]);
    console.log("New Datum Data:", JSON.stringify(newDatumData, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
    ));

    tx.txOut(scriptAddress, [{ unit: "lovelace", quantity: remainingAmount.toString() }])
      .txOutInlineDatumValue(newDatumData); 

  } else if (action === "FinalClaim") {
    const utxoValue = Number(scriptUtxo.output.amount[0].quantity);
    const mentorShare = Math.floor(utxoValue * 0.60);
    const platformShare = Math.floor(utxoValue * 0.40);
    
    tx.txOut(mentorAddr, [{ unit: "lovelace", quantity: mentorShare.toString() }]);
    
    const platformAddr = process.env.NEXT_PUBLIC_PLATFORM_WALLET_ADDRESS as string;
    tx.txOut(platformAddr, [{ unit: "lovelace", quantity: platformShare.toString() }]);
  }

  // Signatories
  tx.requiredSignerHash(mentorPkh);
  
  tx.changeAddress(changeAddr)
    .selectUtxosFrom(nonCollateralUtxos); // Use non-collateral UTXOs

  console.log("--- ClaimFunds: Before tx.complete() ---");


  const unsignedTx = await tx.complete();
  console.log("--- ClaimFunds: Unsigned Transaction Hex (after complete) ---");
  console.log(unsignedTx);
  
  const signedTx = await wallet.signTx(unsignedTx, true); // Enable partial signing
  console.log("--- ClaimFunds: Signed Transaction Hex ---");
  console.log(signedTx);
  
  const txHash = await wallet.submitTx(signedTx);

  return txHash;
};