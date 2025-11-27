// EduChainMag Escrow Smart Contract
// Smart contract untuk escrow pembayaran kursus online

// --------------------------
// Impor yang diperlukan
// --------------------------
use aiken/list
use aiken/bytearray
use aiken/crypto

// --------------------------
// Datum dan Redeemer
// --------------------------
type EscrowDatum {
  payer: ByteArray,
  mentor: ByteArray,
  platform: ByteArray,
  total_amount: Int,
  progress: Int,
  released50: Bool,
  released100: Bool,
  complaint: Bool,
}

type EscrowRedeemer {
  action: Int, // 0: progress 50, 1: progress 100
}

// --------------------------
// Validator utama
// --------------------------
validator educhain_escrow(datum: EscrowDatum, redeemer: EscrowRedeemer, ctx: ScriptContext) -> Bool {
  let tx = ctx.transaction;
  
  // Hanya siswa (payer) yang boleh menandatangani transaksi
  let valid_signer = tx.signed_by(datum.payer);
  
  // Jika ada keluhan, transaksi tidak boleh dilakukan
  if datum.complaint {
    false
  } else {
    // Logika untuk progress 50%
    if redeemer.action == 0 && datum.progress >= 50 && !datum.released50 {
      let mentor_share = datum.total_amount * 30 / 100;
      let paid_to_mentor = tx.value_paid_to(datum.mentor) >= lovelace(mentor_share);
      let next_datum = EscrowDatum {
        payer: datum.payer,
        mentor: datum.mentor,
        platform: datum.platform,
        total_amount: datum.total_amount,
        progress: datum.progress,
        released50: True,
        released100: datum.released100,
        complaint: datum.complaint,
      };
      let output_datum = data(next_datum);
      let own_output = tx.outputs.contains(ctx.purpose, output_datum);
      valid_signer && paid_to_mentor && own_output
    }
    // Logika untuk progress 100%
    else if redeemer.action == 1 && datum.progress >= 100 && !datum.released100 {
      let mentor_share = datum.total_amount * 50 / 100;
      let platform_share = datum.total_amount * 20 / 100;
      let paid_to_mentor = tx.value_paid_to(datum.mentor) >= lovelace(mentor_share);
      let paid_to_platform = tx.value_paid_to(datum.platform) >= lovelace(platform_share);
      valid_signer && paid_to_mentor && paid_to_platform
    }
    else {
      false
    }
  }
}

// --------------------------
// Fungsi helper
// --------------------------

// Fungsi untuk membuat datum escrow baru
fn create_escrow_datum(
  payer: ByteArray,
  mentor: ByteArray,
  platform: ByteArray,
  total_amount: Int
) -> EscrowDatum {
  EscrowDatum {
    payer: payer,
    mentor: mentor,
    platform: platform,
    total_amount: total_amount,
    progress: 0,
    released50: False,
    released100: False,
    complaint: False,
  }
}

// Fungsi untuk update progress
fn update_progress(datum: EscrowDatum, new_progress: Int) -> EscrowDatum {
  EscrowDatum {
    payer: datum.payer,
    mentor: datum.mentor,
    platform: datum.platform,
    total_amount: datum.total_amount,
    progress: new_progress,
    released50: datum.released50,
    released100: datum.released100,
    complaint: datum.complaint,
  }
}

// Fungsi untuk menandai keluhan
fn file_complaint(datum: EscrowDatum) -> EscrowDatum {
  EscrowDatum {
    payer: datum.payer,
    mentor: datum.mentor,
    platform: datum.platform,
    total_amount: datum.total_amount,
    progress: datum.progress,
    released50: datum.released50,
    released100: datum.released100,
    complaint: True,
  }
}

// Test cases untuk validasi
test create_escrow_datum_test() {
  let payer = #""; // Placeholder
  let mentor = #""; // Placeholder
  let platform = #""; // Placeholder
  let datum = create_escrow_datum(payer, mentor, platform, 1000000);
  
  datum.total_amount == 1000000 &&
  datum.progress == 0 &&
  datum.released50 == False &&
  datum.released100 == False &&
  datum.complaint == False
}

test update_progress_test() {
  let payer = #""; // Placeholder
  let mentor = #""; // Placeholder
  let platform = #""; // Placeholder
  let datum = create_escrow_datum(payer, mentor, platform, 1000000);
  let updated = update_progress(datum, 50);
  
  updated.progress == 50 &&
  updated.total_amount == datum.total_amount
}

test file_complaint_test() {
  let payer = #""; // Placeholder
  let mentor = #""; // Placeholder
  let platform = #""; // Placeholder
  let datum = create_escrow_datum(payer, mentor, platform, 1000000);
  let complained = file_complaint(datum);
  
  complained.complaint == True &&
  complained.total_amount == datum.total_amount
}