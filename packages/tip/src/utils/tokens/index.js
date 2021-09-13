import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import { TokenInstructions } from '@project-serum/serum';
import {
  assertOwner,
  TOKEN_PROGRAM_ID,
  transferChecked,
} from './instructions';
import {
  getOwnedAccountsFilters,
} from './data';

export async function getOwnedTokenAccounts(connection, publicKey) {
  let filters = getOwnedAccountsFilters(publicKey);
  let resp = await connection.getProgramAccounts(
    TOKEN_PROGRAM_ID,
    {
      filters,
    },
  );
  return resp
    .map(({ pubkey, account: { data, executable, owner, lamports } }) => ({
      publicKey: new PublicKey(pubkey),
      accountInfo: {
        data,
        executable,
        owner: new PublicKey(owner),
        lamports,
      },
    }))
}


export function nativeTransfer(publicKey, destination, amount) {
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: publicKey,
      toPubkey: destination,
      lamports: amount,
    }),
  );
  return transaction;
}

export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
);

export async function transferTokens({
  connection,
  owner,
  sourcePublicKey,
  destinationPublicKey,
  amount,
  memo,
  mint,
  decimals,
  overrideDestinationCheck,
}) {
  let destinationAccountInfo = await connection.getAccountInfo(
    destinationPublicKey,
  );
  if (
    !!destinationAccountInfo &&
    destinationAccountInfo.owner.equals(TOKEN_PROGRAM_ID)
  ) {
    return await transferBetweenSplTokenAccounts({
      connection,
      owner,
      mint,
      decimals,
      sourcePublicKey,
      destinationPublicKey,
      amount,
      memo,
    });
  }

  const destinationAssociatedTokenAddress = await findAssociatedTokenAddress(
    destinationPublicKey,
    mint,
  );
  destinationAccountInfo = await connection.getAccountInfo(
    destinationAssociatedTokenAddress,
  );
  if (
    !!destinationAccountInfo &&
    destinationAccountInfo.owner.equals(TOKEN_PROGRAM_ID)
  ) {
    return await transferBetweenSplTokenAccounts({
      connection,
      owner,
      mint,
      decimals,
      sourcePublicKey,
      destinationPublicKey: destinationAssociatedTokenAddress,
      amount,
      memo,
    });
  }
  return await createAndTransferToAccount({
    connection,
    owner,
    sourcePublicKey,
    destinationPublicKey,
    amount,
    memo,
    mint,
    decimals,
  });
}

// -------------------------------------------------

export async function findAssociatedTokenAddress(
  walletAddress,
  tokenMintAddress,
) {
  return (
    await PublicKey.findProgramAddress(
      [
        walletAddress.toBuffer(),
        TokenInstructions.TOKEN_PROGRAM_ID.toBuffer(),
        tokenMintAddress.toBuffer(),
      ],
      ASSOCIATED_TOKEN_PROGRAM_ID,
    )
  )[0];
}

function createTransferBetweenSplTokenAccountsInstruction({
  ownerPublicKey,
  mint,
  decimals,
  sourcePublicKey,
  destinationPublicKey,
  amount,
  memo,
}) {
  let transaction = new Transaction().add(
    transferChecked({
      source: sourcePublicKey,
      mint,
      decimals,
      destination: destinationPublicKey,
      owner: ownerPublicKey,
      amount,
    }),
  );
  return transaction;
}

async function transferBetweenSplTokenAccounts({
  connection,
  owner,
  mint,
  decimals,
  sourcePublicKey,
  destinationPublicKey,
  amount,
  memo,
}) {
  const transaction = createTransferBetweenSplTokenAccountsInstruction({
    ownerPublicKey: owner.publicKey,
    mint,
    decimals,
    sourcePublicKey,
    destinationPublicKey,
    amount,
    memo,
  });
  return transaction;
}

async function createAndTransferToAccount({
  connection,
  owner,
  sourcePublicKey,
  destinationPublicKey,
  amount,
  memo,
  mint,
  decimals,
}) {
  const [
    createAccountInstruction,
    newAddress,
  ] = await createAssociatedTokenAccountIx(
    owner.publicKey,
    destinationPublicKey,
    mint,
  );
  let transaction = new Transaction();
  transaction.add(
    assertOwner({
      account: destinationPublicKey,
      owner: SystemProgram.programId,
    }),
  );
  transaction.add(createAccountInstruction);
  const transferBetweenAccountsTxn = createTransferBetweenSplTokenAccountsInstruction(
    {
      ownerPublicKey: owner.publicKey,
      mint,
      decimals,
      sourcePublicKey,
      destinationPublicKey: newAddress,
      amount,
      memo,
    },
  );
  transaction.add(transferBetweenAccountsTxn);
  return transaction;
}

async function createAssociatedTokenAccountIx(
  fundingAddress,
  walletAddress,
  splTokenMintAddress,
) {
  const associatedTokenAddress = await findAssociatedTokenAddress(
    walletAddress,
    splTokenMintAddress,
  );
  const systemProgramId = new PublicKey('11111111111111111111111111111111');
  const keys = [
    {
      pubkey: fundingAddress,
      isSigner: true,
      isWritable: true,
    },
    {
      pubkey: associatedTokenAddress,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: walletAddress,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: splTokenMintAddress,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: systemProgramId,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: TokenInstructions.TOKEN_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: SYSVAR_RENT_PUBKEY,
      isSigner: false,
      isWritable: false,
    },
  ];
  const ix = new TransactionInstruction({
    keys,
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    data: Buffer.from([]),
  });
  return [ix, associatedTokenAddress];
}
