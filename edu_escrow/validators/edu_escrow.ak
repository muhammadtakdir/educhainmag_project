use aiken/collection/list
use cardano/transaction.{Transaction, OutputReference, Output, InlineDatum}
use cardano/address.{Address, Credential, Script}
use cardano/assets

// Edu Escrow validator - SECURE version with output verification
// 
// SECURITY FEATURES:
// 1. Verifies mentor signature
// 2. Verifies output amounts (30%/70% for partial, 60%/40% for final)
// 3. Verifies continuing output for partial claim
// 4. Prevents double partial claim
// 5. Verifies datum update for continuing output

pub type EduDatum {
  student: ByteArray,
  mentor: ByteArray,
  platform: ByteArray,
  amount: Int,
  progress: Int,
  partial_claimed: Bool,
}

pub type EduAction {
  PartialClaim  // At 50% - mentor gets 30%, 70% returns to script
  FinalClaim    // At 100% - mentor gets 60%, platform gets 40%
}

pub type EduRedeemer {
  action: EduAction,
  progress: Int,
}

// Helper: Check if an output pays at least `min_amount` lovelace to a PKH
fn output_pays_to_pkh(output: Output, pkh: ByteArray, min_amount: Int) -> Bool {
  let has_correct_pkh = when output.address.payment_credential is {
    Credential.VerificationKey(vkh) -> vkh == pkh
    _ -> False
  }
  let has_enough_value = assets.lovelace_of(output.value) >= min_amount
  has_correct_pkh && has_enough_value
}

// Helper: Check if an output is to a script address with correct datum
fn output_continues_to_script(
  output: Output, 
  script_hash: ByteArray,
  expected_datum: EduDatum,
  min_amount: Int
) -> Bool {
  // Check it's going to our script
  let is_script_address = when output.address.payment_credential is {
    Credential.Script(sh) -> sh == script_hash
    _ -> False
  }
  
  // Check has enough value
  let has_enough_value = assets.lovelace_of(output.value) >= min_amount
  
  // Check datum is correct (inline datum with partial_claimed = True)
  let has_correct_datum = when output.datum is {
    InlineDatum(data) -> {
      expect d: EduDatum = data
      d.student == expected_datum.student &&
      d.mentor == expected_datum.mentor &&
      d.platform == expected_datum.platform &&
      d.amount == expected_datum.amount &&
      d.partial_claimed == True  // Must be marked as claimed
    }
    _ -> False
  }
  
  is_script_address && has_enough_value && has_correct_datum
}

// Helper: Find output that pays to PKH
fn find_output_to_pkh(outputs: List<Output>, pkh: ByteArray, min_amount: Int) -> Bool {
  list.any(outputs, fn(o) { output_pays_to_pkh(o, pkh, min_amount) })
}

// Helper: Find continuing output to script
fn find_continuing_output(
  outputs: List<Output>, 
  script_hash: ByteArray,
  expected_datum: EduDatum,
  min_amount: Int
) -> Bool {
  list.any(outputs, fn(o) { output_continues_to_script(o, script_hash, expected_datum, min_amount) })
}

validator edu_escrow {
  spend(datum: Option<EduDatum>, redeemer: EduRedeemer, oref: OutputReference, tx: Transaction) {
    expect Some(d) = datum
    
    // Get our own script hash from the input being spent
    let own_input = list.find(tx.inputs, fn(i) { i.output_reference == oref })
    expect Some(input) = own_input
    let own_script_hash = when input.output.address.payment_credential is {
      Credential.Script(sh) -> sh
      _ -> fail @"Not a script input"
    }

    when redeemer.action is {
      // Partial claim at 50% progress
      // Mentor gets 30% (minus fee), 70% returns to script
      PartialClaim -> {
        // 1. Mentor must sign
        let mentor_signed = list.has(tx.extra_signatories, d.mentor)
        
        // 2. Progress must be at least 50%
        let meets_progress = redeemer.progress >= 50
        
        // 3. Must not have been partially claimed before
        let not_claimed = !d.partial_claimed
        
        // 4. Calculate expected amounts
        // Mentor gets 30% minus ~1 ADA for tx fee (mentor pays fee)
        // Remaining 70% goes back to script FULL
        let mentor_amount = d.amount * 30 / 100 - 1000000  // Mentor pays fee
        let remaining_amount = d.amount * 70 / 100         // Full 70% back to script
        
        // 5. Check mentor receives at least (30% - fee)
        let mentor_paid = find_output_to_pkh(tx.outputs, d.mentor, mentor_amount)
        
        // 6. Check remaining goes back to script with updated datum
        let expected_continuing_datum = EduDatum {
          student: d.student,
          mentor: d.mentor,
          platform: d.platform,
          amount: d.amount,
          progress: d.progress,
          partial_claimed: True,
        }
        let has_continuing = find_continuing_output(
          tx.outputs, 
          own_script_hash, 
          expected_continuing_datum,
          remaining_amount
        )

        and {
          mentor_signed?,
          meets_progress?,
          not_claimed?,
          mentor_paid?,
          has_continuing?,
        }
      }
    
      // Final claim at 100% progress
      // Mentor gets 60% (minus fee), Platform gets 40%
      FinalClaim -> {
        // 1. Mentor must sign
        let mentor_signed = list.has(tx.extra_signatories, d.mentor)
        
        // 2. Progress must be 100%
        let meets_progress = redeemer.progress >= 100
        
        // 3. Calculate expected amounts based on whether partial was claimed
        // If partial was claimed, we're working with 70% of original amount
        let base_amount = if d.partial_claimed { d.amount * 70 / 100 } else { d.amount }
        let mentor_amount = base_amount * 60 / 100 - 1000000  // Mentor pays fee
        let platform_amount = base_amount * 40 / 100         // Platform gets full 40%
        
        // 4. Check mentor receives at least (60% - fee) of remaining
        let mentor_paid = find_output_to_pkh(tx.outputs, d.mentor, mentor_amount)
        
        // 5. Check platform receives full 40% of remaining
        let platform_paid = find_output_to_pkh(tx.outputs, d.platform, platform_amount)

        and {
          mentor_signed?,
          meets_progress?,
          mentor_paid?,
          platform_paid?,
        }
      }
    }
  }
}
