export const plutus = {
  "preamble": {
    "title": "gemini/educhainmag",
    "description": "Aiken contracts for project 'gemini/educhainmag'",
    "version": "0.0.0",
    "plutusVersion": "v3",
    "compiler": {
      "name": "Aiken",
      "version": "v1.1.19+e525483"
    },
    "license": "Apache-2.0"
  },
  "validators": [
    {
      "title": "nft.nft_policy.mint",
      "redeemer": {
        "title": "_redeemer",
        "schema": {
          "$ref": "#/definitions/Data"
        }
      },
      "compiledCode": "585401010029800aba2aba1aab9eaab9dab9a4888896600264653001300600198031803800cc0180092225980099b8748000c01cdd500144c9289bae30093008375400516401830060013003375400d149a26cac8009",
      "hash": "def68337867cb4f1f95b6b811fedbfcdd7780d10a95cc072077088ea"
    },
    {
      "title": "nft.nft_policy.else",
      "redeemer": {
        "schema": {}
      },
      "compiledCode": "585401010029800aba2aba1aab9eaab9dab9a4888896600264653001300600198031803800cc0180092225980099b8748000c01cdd500144c9289bae30093008375400516401830060013003375400d149a26cac8009",
      "hash": "def68337867cb4f1f95b6b811fedbfcdd7780d10a95cc072077088ea"
    }
  ],
  "definitions": {
    "Data": {
      "title": "Data",
      "description": "Any Plutus data."
    }
  }
}
