use aiken/collection/list
use aiken/collection/dict
use aiken/interval.{everything}
use cardano/transaction.{Output, OutputReference, Transaction, NoDatum, InlineDatum}
use cardano/address.{Address, Script, VerificationKey}
use cardano/assets.{from_lovelace, zero}

// Edu Escrow validator with partial claims
// - Student pays into this script with a Datum containing: student PKH, mentor PKH, amount, progress
// - At 50% progress: mentor can claim 30% of funds after signing
// - At 100% progress: mentor can claim remaining 70% after signing
// - Both claims require mentor's signature for security

pub type EduDatum {
  student: ByteArray,
  mentor: ByteArray,
  platform: ByteArray,  // Platform's public key hash for receiving platform fee
  amount: Int,
  progress: Int,
  partial_claimed: Bool,
}

pub type EduAction {
  PartialClaim  // At 50% - claim 30% 
  FinalClaim    // At 100% - claim 60% to mentor, 40% to platform
}

pub type EduRedeemer {
  action: EduAction,
  progress: Int,
}

validator edu_escrow {
  spend(datum: Option<EduDatum>, redeemer: EduRedeemer, _oref: OutputReference, tx: Transaction) {
    expect Some(d) = datum

    when redeemer.action is {
      // Partial claim at 50% progress (get 30% of funds)
      PartialClaim -> {
        let mentor_signed = list.has(tx.extra_signatories, d.mentor)
        let meets_progress = redeemer.progress >= 50
        let not_claimed = !d.partial_claimed
        let mentor_payment = from_lovelace((d.amount * 30) / 100)

        // Verify mentor output exists with correct amount
        expect Some(_mentor_output) =
          list.find(
            tx.outputs,
            fn(output) {
              output.address.payment_credential == VerificationKey(d.mentor) &&
              output.value == mentor_payment
            }
          )

        and {
          mentor_signed,
          meets_progress,
          not_claimed
        }
      }
    
      // Final claim at 100% progress (split remaining: 60% mentor, 40% platform)
      FinalClaim -> {
        let mentor_signed = list.has(tx.extra_signatories, d.mentor)
        let meets_progress = redeemer.progress >= 100
        let remaining = if d.partial_claimed { 70 } else { 100 }
        
        // Calculate final shares
        let mentor_share = (d.amount * remaining * 60) / (100 * 100)  // 60% of remaining
        let platform_share = (d.amount * remaining * 40) / (100 * 100)  // 40% of remaining
        
  let mentor_payment = from_lovelace(mentor_share)
  let platform_payment = from_lovelace(platform_share)        // Verify both outputs exist with correct amounts
        expect Some(_mentor_output) =
          list.find(
            tx.outputs,
            fn(output) {
              output.address.payment_credential == VerificationKey(d.mentor) &&
              output.value == mentor_payment
            }
          )

        expect Some(_platform_output) =
          list.find(
            tx.outputs,
            fn(output) {
              output.address.payment_credential == VerificationKey(d.platform) &&
              output.value == platform_payment
            }
          )

        and {
          mentor_signed,
          meets_progress
        }
      }
    }
  }
}

test partial_claim_at_50() {
  let student = #"0000000000000000000000000000000000000000000000000000000000000000"
  let mentor = #"1111111111111111111111111111111111111111111111111111111111111111"
  let platform = #"2222222222222222222222222222222222222222222222222222222222222222"
  let amount = 100_000_000

  let datum = EduDatum {
    student,
    mentor,
    platform,
    amount,
    progress: 50,
    partial_claimed: False,
  }

  let redeemer = EduRedeemer {
    action: PartialClaim,
    progress: 50,
  }

  let mentor_payment = from_lovelace((amount * 30) / 100)
  let remaining_value = from_lovelace(amount - (amount * 30) / 100)

  let mentor_output = Output {
    address: Address { 
      payment_credential: VerificationKey(mentor), 
      stake_credential: None 
    },
    value: mentor_payment,
    datum: NoDatum,
    reference_script: None,
  }

  let script_output = Output {
    address: Address { 
      payment_credential: Script(#"00"), 
      stake_credential: None 
    },
    value: remaining_value,
    datum: InlineDatum(EduDatum { ..datum, partial_claimed: True }),
    reference_script: None,
  }

  let tx = Transaction {
    inputs: [transaction.Input {
      output_reference: OutputReference { transaction_id: #"00", output_index: 0 },
      output: Output {
        address: Address { payment_credential: Script(#"00"), stake_credential: None },
        value: from_lovelace(amount),
        datum: InlineDatum(datum),
        reference_script: None,
      }
    }],
    reference_inputs: [],
    outputs: [mentor_output, script_output],
    fee: 0,
    mint: zero,
    certificates: [],
    withdrawals: [],
    validity_range: everything,
    extra_signatories: [mentor],
  redeemers: [],
  datums: dict.empty,
  proposal_procedures: [],
  treasury_donation: None,
  current_treasury_amount: None,
    votes: [],
    id: #"00"
  }

  edu_escrow.spend(Some(datum), redeemer, OutputReference { transaction_id: #"00", output_index: 0 }, tx)
}

test final_claim_at_100() {
  let student = #"0000000000000000000000000000000000000000000000000000000000000000"
  let mentor = #"1111111111111111111111111111111111111111111111111111111111111111"
  let platform = #"2222222222222222222222222222222222222222222222222222222222222222"
  let amount = 100_000_000
  let remaining = 70_000_000 // 70% remaining after partial claim

  let datum = EduDatum {
    student,
    mentor,
    platform,
    amount,
    progress: 80,
    partial_claimed: True,
  }

  let redeemer = EduRedeemer {
    action: FinalClaim,
    progress: 100,
  }

  let mentor_share = (remaining * 60) / 100
  let platform_share = (remaining * 40) / 100

  let mentor_output = Output {
    address: Address { 
      payment_credential: VerificationKey(mentor), 
      stake_credential: None 
    },
    value: from_lovelace(mentor_share),
    datum: NoDatum,
    reference_script: None,
  }

  let platform_output = Output {
    address: Address { 
      payment_credential: VerificationKey(platform), 
      stake_credential: None 
    },
    value: from_lovelace(platform_share),
    datum: NoDatum,
    reference_script: None,
  }

  let tx = Transaction {
    inputs: [transaction.Input {
      output_reference: OutputReference { transaction_id: #"00", output_index: 0 },
      output: Output {
        address: Address { payment_credential: Script(#"00"), stake_credential: None },
        value: from_lovelace(remaining),
        datum: InlineDatum(datum),
        reference_script: None,
      }
    }],
    reference_inputs: [],
    outputs: [mentor_output, platform_output],
    fee: 0,
    mint: zero,
    certificates: [],
    withdrawals: [],
    validity_range: everything,
    extra_signatories: [mentor],
  redeemers: [],
  datums: dict.empty,
  proposal_procedures: [],
  treasury_donation: None,
  current_treasury_amount: None,
    votes: [],
    id: #"00"
  }

  edu_escrow.spend(Some(datum), redeemer, OutputReference { transaction_id: #"00", output_index: 0 }, tx)
}