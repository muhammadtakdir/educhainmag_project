/**
 * API Route for Escrow Operations
 * 
 * Server-side Blockfrost calls to avoid CORS issues.
 * Lucid-cardano has CORS issues when used directly in browser.
 */

import { NextRequest, NextResponse } from "next/server";
import contract from "@/lib/cardano/contracts/plutus.json";

// Use env var, fallback to hardcoded for testing
const BLOCKFROST_KEY = process.env.NEXT_PUBLIC_BLOCKFROST_KEY_PREVIEW || "preview3b92mPmpMq2PXOyrtuGKDneghPXBtLBf";
const BLOCKFROST_URL = "https://cardano-preview.blockfrost.io/api/v0";

// Script CBOR and hash from Aiken
const SCRIPT_CBOR = (contract as any).validators[0].compiledCode;
const AIKEN_SCRIPT_HASH = (contract as any).validators[0].hash;

// The CORRECT script address (Aiken hash)
const CORRECT_SCRIPT_ADDRESS = "addr_test1wprmuqd5uef4almr7afqy22leqd0kxuqvd0qk0z46ygwccgjj5d2u";

// OLD script address (MeshJS bug - permanently locked)
const OLD_SCRIPT_ADDRESS = "addr_test1wrvqe3g6vnsp27ckv073qz8785rzxl38pyjdyga40l4k5ysj73xxt";

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
    
    // Fetch from CORRECT address (new escrows - claimable)
    console.log("[API] Fetching from correct address:", CORRECT_SCRIPT_ADDRESS);
    const correctUtxos = await fetchUtxos(CORRECT_SCRIPT_ADDRESS);
    console.log(`[API] Found ${correctUtxos.length} UTXOs at correct address`);
    
    for (const utxo of correctUtxos) {
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
                address: CORRECT_SCRIPT_ADDRESS,
                amount: utxo.amount,
                datumHash: utxo.data_hash,
                inlineDatumCbor: utxo.inline_datum,
              },
              datum,
              isLocked: false,
              address: CORRECT_SCRIPT_ADDRESS,
            });
          }
        }
      }
    }
    
    // Fetch from OLD address (locked escrows - display only)
    console.log("[API] Fetching from old address:", OLD_SCRIPT_ADDRESS);
    const oldUtxos = await fetchUtxos(OLD_SCRIPT_ADDRESS);
    console.log(`[API] Found ${oldUtxos.length} UTXOs at old address (LOCKED)`);
    
    for (const utxo of oldUtxos) {
      // Always fetch datum JSON via data_hash (inline_datum is CBOR hex, not JSON)
      if (utxo.data_hash) {
        console.log("[API] Fetching datum for old:", utxo.tx_hash);
        const datumJson = await fetchDatum(utxo.data_hash);
        if (datumJson) {
          const datum = parseDatumJson(datumJson);
          if (datum) {
            results.push({
              utxo: {
                txHash: utxo.tx_hash,
                outputIndex: utxo.output_index,
                address: OLD_SCRIPT_ADDRESS,
                amount: utxo.amount,
                datumHash: utxo.data_hash,
                inlineDatumCbor: utxo.inline_datum,
              },
              datum,
              isLocked: true,
              address: OLD_SCRIPT_ADDRESS,
            });
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
      correctAddress: CORRECT_SCRIPT_ADDRESS,
      oldAddress: OLD_SCRIPT_ADDRESS,
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
