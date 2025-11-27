import { NextResponse } from 'next/server';
import { getModuleById } from '@/lib/firebase/content';
import { getUserById } from '@/lib/firebase/users';
import { saveCertificate } from '@/lib/firebase/certificates';
import { BlockfrostProvider, MeshWallet, ForgeScript, resolveScriptHash, Transaction, MeshTxBuilder, deserializeAddress, resolveNativeScriptHash, stringToHex } from '@meshsdk/core';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const { userId, moduleId } = await request.json();

    if (!userId || !moduleId) {
      return NextResponse.json({ error: 'Missing userId or moduleId' }, { status: 400 });
    }

    // Validate environment variables
    const blockfrostUrl = process.env.NEXT_PUBLIC_BLOCKFROST_API_URL;
    const blockfrostProjectId = process.env.NEXT_PUBLIC_BLOCKFROST_PROJECT_ID;
    const backendWalletSkey = process.env.CARDANO_BACKEND_WALLET_SKEY;
    const platformWalletAddress = process.env.CARDANO_BACKEND_WALLET_ADDRESS;

    if (!blockfrostUrl || !blockfrostProjectId || !backendWalletSkey || !platformWalletAddress) {
      console.error('Missing environment variables:', {
        blockfrostUrl: !!blockfrostUrl,
        blockfrostProjectId: !!blockfrostProjectId,
        backendWalletSkey: !!backendWalletSkey,
        platformWalletAddress: !!platformWalletAddress,
      });
      return NextResponse.json({ error: 'Server configuration error: Missing Blockfrost or Wallet SKEY/Address environment variables.' }, { status: 500 });
    }

    const user = await getUserById(userId);
    const module = await getModuleById(moduleId);

    if (!user || !module) {
      return NextResponse.json({ error: 'User or module not found' }, { status: 404 });
    }

    console.log("Initializing Mesh components...");

    const blockfrostProvider = new BlockfrostProvider(blockfrostProjectId);

    // Parse the backendWalletSkey to get the cborHex
    let privateKeyCborHex: string;
    try {
      const backendWalletSkeyJson = JSON.parse(backendWalletSkey);
      privateKeyCborHex = backendWalletSkeyJson.cborHex;
    } catch (parseError) {
      console.error('Error parsing backend wallet SKEY:', parseError);
      return NextResponse.json({
        error: 'Wallet configuration error',
        details: 'Failed to parse backend wallet SKEY: ' + (parseError as Error).message
      }, { status: 500 });
    }

    const wallet = new MeshWallet({
      networkId: 0, // 0 for Preprod, 1 for Mainnet (assuming Preview is Preprod for now)
      fetcher: blockfrostProvider,
      submitter: blockfrostProvider,
      key: {
        type: 'cli',
        payment: privateKeyCborHex,
      },
    });
    await wallet.init(); // Initialize the wallet to fetch addresses and UTXOs
    console.log("MeshWallet initialized successfully.");

    const platformWalletAddressFromEnv = process.env.CARDANO_BACKEND_WALLET_ADDRESS;

    if (!platformWalletAddressFromEnv) {
      console.error('Missing environment variable: CARDANO_BACKEND_WALLET_ADDRESS');
      return NextResponse.json({ error: 'Server configuration error: Missing CARDANO_BACKEND_WALLET_ADDRESS environment variable.' }, { status: 500 });
    }

    const changeAddress = platformWalletAddressFromEnv; // Use the platform wallet address from environment variable as the change address

    // Get the paymentKeyHash from the backend wallet's change address
    const platformWalletChangeAddress = await wallet.getChangeAddress();
    const deserializedChangeAddress = deserializeAddress(platformWalletChangeAddress);
    if (!deserializedChangeAddress.pubKeyHash) {
      throw new Error("Could not extract payment key hash from platform wallet's change address.");
    }
    const platformWalletPaymentKeyHash = deserializedChangeAddress.pubKeyHash;

    console.log("Platform Wallet Change Address:", platformWalletChangeAddress);
    console.log("Platform Wallet Payment Key Hash (from Change Address):", platformWalletPaymentKeyHash);

    // Use this platformWalletPaymentKeyHash to define the forging script
    const forgingScript = ForgeScript.withOneSignature(platformWalletChangeAddress);
    const policyId = resolveScriptHash(forgingScript);
    console.log("ForgeScript policy will use Platform Wallet Payment Key Hash.");
    console.log("Policy ID derived from Platform Wallet Payment Key Hash:", policyId);



    // Shorten assetName using a hash of userId
    const userIdHash = crypto.createHash('sha256').update(userId).digest('hex').substring(0, 10); // Take first 10 chars
    const assetName = `${module.id}-${userIdHash}`; // Unique asset name for the certificate
    const tokenNameHex = stringToHex(assetName);

    const metadata = {
      name: `EduCert: ${module.title.substring(0, 40)}`, // Shorten to fit 64 bytes limit
      description: `Cert. for "${module.title.substring(0, 30)}"`, // Shorten to fit 64 bytes limit 
      student: user.displayName || userId,
      module: module.id,
      issuedAt: new Date().toISOString(),
      image: `ipfs://cert-placeholder`, // Short placeholder
    };

    const asset = {
      assetName: assetName,
      assetQuantity: '1',
      metadata: metadata,
      label: '721', // Standard label for NFTs
      recipient: userId, // Assuming user has a walletAddress field
    };

    let txHash;
    try {
      const txBuilder = new MeshTxBuilder({
        fetcher: blockfrostProvider,
        submitter: blockfrostProvider, // Use blockfrostProvider as submitter
      }).setNetwork('preview'); // Explicitly set the network to 'preview'

      const builderWithChangeAddress = txBuilder.changeAddress(changeAddress);
      console.log("Builder after changeAddress:", builderWithChangeAddress);

      const unsignedTx = await builderWithChangeAddress
        .mint(asset.assetQuantity, policyId, tokenNameHex)
        .mintingScript(forgingScript)
        .metadataValue(721, {
          [policyId]: {
            [asset.assetName]: metadata,
          },
        })
        .changeAddress(changeAddress)
        .selectUtxosFrom(await wallet.getUtxos())
        .complete();      const signedTx = await wallet.signTx(unsignedTx);
      txHash = await wallet.submitTx(signedTx);
      console.log('Transaction submitted:', txHash);
    } catch (txError) {
      console.error('Transaction building or submission failed:', txError);
      return NextResponse.json({
        error: 'Transaction failed',
        details: 'Failed to build or submit transaction: ' + (txError as Error).message
      }, { status: 500 });
    }

    const certificateData = {
      userId,
      moduleId,
      issuedAt: new Date(),
      onChainDetails: {
        txHash,
        assetName,
        policyId,
        cardanoscanUrl: `https://preview.cardanoscan.io/transaction/${txHash}`,
      },
      visualCertificateUrl: `https://placehold.co/1024x768/blue/white?text=Certificate+of+Completion\n${module.title}\n\nIssued+to+:${user.displayName || ''}\nDate:+${new Date().toLocaleDateString()}`, 
    };

    await saveCertificate(certificateData);

    return NextResponse.json({
      success: true,
      txHash,
      certificate: certificateData
    });
  } catch (error) {
    console.error('Error minting certificate:', error);
    return NextResponse.json({
      error: 'Failed to mint certificate',
      details: (error as Error).message
    }, { status: 500 });
  }
}
