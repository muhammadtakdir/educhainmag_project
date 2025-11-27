
import { Lucid, Tx, Assets, fromText, MintingPolicy, PolicyId, Data } from 'lucid-cardano';
import { Module, User } from '@/types';
import { plutus } from './plutus';

export async function mintCertificateNft(
  lucid: Lucid,
  module: Module,
  user: User,
  metadata: any
): Promise<{ txHash: string; assetName: string; policyId: string }> { // 1. Change return type
  const assetName = fromText(`${module.id}-${user.id}`);

  const assets: Assets = {
    [assetName]: 1n,
  };

  const mintingPolicy: MintingPolicy = {
    type: 'PlutusV2',
    script: plutus.validators.find((v) => v.title === 'nft.nft_policy.mint')!.compiledCode,
  };

  const policyId = lucid.utils.mintingPolicyToId(mintingPolicy); // 2. This is the correct policyId

  const redeemer = Data.void();

  const tx = await lucid
    .newTx()
    .mintAssets(assets, mintingPolicy)
    .attachMetadata(721, { [policyId]: { [assetName]: metadata } })
    .complete();

  const signedTx = await tx.sign().complete();
  const txHash = await signedTx.submit();

  return { txHash, assetName, policyId }; // 3. Return the policyId
}
