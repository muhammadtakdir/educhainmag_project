/**
 * API Route for Escrow Operations
 * 
 * Server-side Blockfrost calls to avoid CORS issues.
 * Lucid-cardano has CORS issues when used directly in browser.
 * 
 * SECURITY: No hardcoded API keys - uses environment variables only
 */

import { NextRequest, NextResponse } from "next/server";
import contract from "@/lib/cardano/contracts/plutus.json";
import { blake2b } from "blakejs";
import { bech32 } from "bech32";

// SECURITY: Only use environment variable, no fallback
const BLOCKFROST_KEY = process.env.NEXT_PUBLIC_BLOCKFROST_KEY_PREVIEW;
const BLOCKFROST_URL = "https://cardano-preview.blockfrost.io/api/v0";

if (!BLOCKFROST_KEY) {
  console.error("[API] CRITICAL: BLOCKFROST_KEY not configured!");
}

// Script CBOR and hash from Aiken (current secure validator)
const SCRIPT_CBOR = (contract as any).validators[0].compiledCode;
const AIKEN_SCRIPT_HASH = (contract as any).validators[0].hash;

// Compute current script address from hash
function computeScriptAddress(scriptCbor: string): string {
  const scriptBytes = Buffer.from(scriptCbor, "hex");
  const prefixed = Buffer.concat([Buffer.from([0x03]), scriptBytes]);
  const hash = blake2b(prefixed, undefined, 28);
  const hashHex = Buffer.from(hash).toString("hex");
  
  const headerByte = 0x70; // testnet
  const hashBytes = Buffer.from(hashHex, "hex");
  const addressBytes = Buffer.concat([Buffer.from([headerByte]), hashBytes]);
  const words = bech32.toWords(addressBytes);
  return bech32.encode("addr_test", words, 108);
}

// Current secure validator address
const CURRENT_SCRIPT_ADDRESS = computeScriptAddress(SCRIPT_CBOR);

// Legacy addresses (LOCKED - display only)
const LEGACY_ADDRESSES = [
  // Old MeshJS bug address (wrong hash computation) - 20 ADA MTKR locked
  "addr_test1wrvqe3g6vnsp27ckv073qz8785rzxl38pyjdyga40l4k5ysj73xxt",
  // Old insecure validator (no output verification)
  "addr_test1wprmuqd5uef4almr7afqy22leqd0kxuqvd0qk0z46ygwccgjj5d2u",
  // Validator with FinalClaim bug (didn't account for partial_claimed) - 7 ADA locked
  "addr_test1wpd30rfa8kkdy59dpf7xwvy56tke4rrpn04glzznzt2as5czmhawx",
  // Validator V4 with fee deducted from platform (now mentor pays fee)
  "addr_test1wps9szv250zk0t6t8gynk4grd3zk64wvseapcq5s3qmgc5c0s02fl",
];

console.log("[API] Current script address:", CURRENT_SCRIPT_ADDRESS);
console.log("[API] Legacy addresses:", LEGACY_ADDRESSES.length);

interface EduDatum {
  student: string;
  mentor: string;
  platform: string;
  amount: number;
  progress: number;
  partial_claimed: boolean;
}

/**
 * Decode Plutus Data CBOR to EduDatum
 * Simplified decoder for our specific datum structure
 */
function decodeDatum(datumCbor: string): EduDatum | null {
  try {
    // Use simple CBOR parsing for our known structure
    // The datum is: Constr(0, [student_pkh, mentor_pkh, platform_pkh, amount, progress, partial_claimed])
    const hex = datumCbor;
    
    // This is a simplified decoder - we'll use the JSON datum from Blockfrost instead
    return null;
  } catch (e) {
    console.error("[API] Failed to decode datum:", e);
    return null;
  }
}

/**
 * Fetch UTxOs from Blockfrost
 */
async function fetchUtxos(address: string): Promise<any[]> {
  try {
    const url = `${BLOCKFROST_URL}/addresses/${address}/utxos`;
    console.log("[API] Fetching UTxOs from:", url);
    console.log("[API] Using key:", BLOCKFROST_KEY ? BLOCKFROST_KEY.substring(0, 10) + "..." : "MISSING!");
    
    const response = await fetch(url, {
      headers: {
        'project_id': BLOCKFROST_KEY || '',
      },
    });
    
    console.log("[API] UTxO response status:", response.status);
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log("[API] No UTxOs at this address (404)");
        return [];
      }
      const text = await response.text();
      console.error("[API] UTxO fetch error:", text);
      throw new Error(`Blockfrost error: ${response.status}`);
    }
    
    const utxos = await response.json();
    console.log(`[API] Got ${utxos.length} UTxOs, first:`, utxos.length > 0 ? JSON.stringify(utxos[0]).substring(0, 200) : "none");
    return utxos;
  } catch (e) {
    console.error(`[API] Error fetching UTxOs from ${address}:`, e);
    return [];
  }
}

/**
 * Fetch datum from Blockfrost
 */
async function fetchDatum(datumHash: string): Promise<any | null> {
  try {
    const url = `${BLOCKFROST_URL}/scripts/datum/${datumHash}`;
    console.log("[API] Fetching datum from:", url);
    console.log("[API] Using key:", BLOCKFROST_KEY ? BLOCKFROST_KEY.substring(0, 10) + "..." : "MISSING!");
    
    const response = await fetch(url, {
      headers: {
        'project_id': BLOCKFROST_KEY || '',
      },
    });
    
    if (!response.ok) {
      const text = await response.text();
      console.error(`[API] Datum fetch failed: ${response.status}`, text);
      return null;
    }
    
    const data = await response.json();
    console.log("[API] Datum response:", JSON.stringify(data).substring(0, 200));
    return data.json_value;
  } catch (e) {
    console.error("[API] Error fetching datum:", e);
    return null;
  }
}

/**
 * Parse Blockfrost datum JSON to our EduDatum type
 */
function parseDatumJson(jsonValue: any): EduDatum | null {
  try {
    // Blockfrost returns datum in JSON format
    // Our datum structure: constructor 0, fields: [student, mentor, platform, amount, progress, partial_claimed]
    
    if (!jsonValue || jsonValue.constructor !== 0) {
      return null;
    }
    
    const fields = jsonValue.fields;
    if (!fields || fields.length !== 6) {
      return null;
    }
    
    // Fields are: student_pkh, mentor_pkh, platform_pkh, amount, progress, partial_claimed
    return {
      student: fields[0].bytes || "",
      mentor: fields[1].bytes || "",
      platform: fields[2].bytes || "",
      amount: parseInt(fields[3].int || "0"),
      progress: parseInt(fields[4].int || "0"),
      partial_claimed: fields[5].constructor === 1, // True constructor is 1
    };
  } catch (e) {
    console.error("[API] Error parsing datum JSON:", e);
    return null;
  }
}

/**
 * GET /api/escrow?mentor=<address>
 * 
 * Fetches all escrows from both addresses (old and new)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mentorAddr = searchParams.get('mentor');
  
  console.log("[API] GET /api/escrow called");
  console.log("[API] BLOCKFROST_KEY present:", !!BLOCKFROST_KEY, BLOCKFROST_KEY ? BLOCKFROST_KEY.substring(0, 10) + "..." : "MISSING");
  
  if (!BLOCKFROST_KEY) {
    return NextResponse.json({ error: "Blockfrost API key not configured" }, { status: 500 });
  }
  
  try {
    const results: Array<{
      utxo: any;
      datum: EduDatum;
      isLocked: boolean;
      address: string;
    }> = [];
    
    // Fetch from CURRENT address (new secure escrows - claimable)
    console.log("[API] Fetching from current address:", CURRENT_SCRIPT_ADDRESS);
    const currentUtxos = await fetchUtxos(CURRENT_SCRIPT_ADDRESS);
    console.log(`[API] Found ${currentUtxos.length} UTXOs at current address`);
    
    for (const utxo of currentUtxos) {
      // Always fetch datum JSON via data_hash (inline_datum is CBOR hex, not JSON)
      if (utxo.data_hash) {
        console.log("[API] Fetching datum for:", utxo.tx_hash, "hash:", utxo.data_hash);
        const datumJson = await fetchDatum(utxo.data_hash);
        console.log("[API] Datum JSON:", datumJson ? "found" : "not found");
        if (datumJson) {
          const datum = parseDatumJson(datumJson);
          console.log("[API] Parsed datum:", datum ? "success" : "failed");
          if (datum) {
            results.push({
              utxo: {
                txHash: utxo.tx_hash,
                outputIndex: utxo.output_index,
                address: CURRENT_SCRIPT_ADDRESS,
                amount: utxo.amount,
                datumHash: utxo.data_hash,
                inlineDatumCbor: utxo.inline_datum,
              },
              datum,
              isLocked: false,
              address: CURRENT_SCRIPT_ADDRESS,
            });
          }
        }
      }
    }
    
    // Fetch from ALL legacy addresses (locked escrows - display only)
    for (const legacyAddr of LEGACY_ADDRESSES) {
      console.log("[API] Fetching from legacy address:", legacyAddr);
      const legacyUtxos = await fetchUtxos(legacyAddr);
      console.log(`[API] Found ${legacyUtxos.length} UTXOs at legacy address (LOCKED)`);
      
      for (const utxo of legacyUtxos) {
        // Always fetch datum JSON via data_hash (inline_datum is CBOR hex, not JSON)
        if (utxo.data_hash) {
          console.log("[API] Fetching datum for legacy:", utxo.tx_hash);
          const datumJson = await fetchDatum(utxo.data_hash);
          if (datumJson) {
            const datum = parseDatumJson(datumJson);
            if (datum) {
              results.push({
                utxo: {
                  txHash: utxo.tx_hash,
                  outputIndex: utxo.output_index,
                  address: legacyAddr,
                  amount: utxo.amount,
                  datumHash: utxo.data_hash,
                  inlineDatumCbor: utxo.inline_datum,
                },
                datum,
                isLocked: true,
                address: legacyAddr,
              });
            }
          }
        }
      }
    }
    
    // Filter by mentor if specified
    let filteredResults = results;
    if (mentorAddr) {
      // Extract PKH from address
      // Cardano address format: header + PKH (28 bytes)
      // For bech32 addresses, we need to decode
      try {
        const { resolvePaymentKeyHash } = await import("@meshsdk/core");
        const mentorPkh = resolvePaymentKeyHash(mentorAddr);
        filteredResults = results.filter(item => item.datum.mentor === mentorPkh);
        console.log(`[API] Filtered by mentor PKH ${mentorPkh}: ${filteredResults.length} escrows`);
      } catch (e) {
        console.error("[API] Error filtering by mentor:", e);
      }
    }
    
    return NextResponse.json({
      escrows: filteredResults,
      currentAddress: CURRENT_SCRIPT_ADDRESS,
      legacyAddresses: LEGACY_ADDRESSES,
      scriptHash: AIKEN_SCRIPT_HASH,
      total: filteredResults.length,
      locked: filteredResults.filter(e => e.isLocked).length,
      claimable: filteredResults.filter(e => !e.isLocked).length,
    });
    
  } catch (error) {
    console.error("[API] Error in escrow route:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
