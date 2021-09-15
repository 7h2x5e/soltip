import * as web3 from '@solana/web3.js';
import { TokenInstructions } from '@project-serum/serum';
import {
    WATCH_LIST, POLLING_INTERVAL,
    PRICE_POLLING_INTERVAL,
    MINIMAL_ACCEPTED_PRICE_IN_USD,
    SOL_PRICE_ACCOUNT_KEY
} from './config.js';
import { ASSOCIATED_TOKEN_PROGRAM_ID, POPULAR_TOKENS } from './tokens'
import { parsePriceData } from '@pythnetwork/client'
import {
    getTwitterRegistry,
    getHashedName,
    getNameAccountKey,
    NameRegistryState,
} from '@bonfida/spl-name-service';

// Address of the SOL TLD
export const SOL_TLD_AUTHORITY = new web3.PublicKey(
    '58PwtjSDuFHuUkYjH9BYnnQKHfwo9reZhC2zMJv9JPkx',
  );

export const tipBuffer = [];
export const priceBuffer = {};

function balanceAmountToUserAmount(balanceAmount, decimals) {
    return (balanceAmount / Math.pow(10, decimals)).toFixed(decimals);
}
function merge2arrayAsPair(arr1, arr2) {
    if (arr1.length !== arr2.length) {
        throw Error('Size not match');
    }
    return arr2.reduce(function (result, field, index) {
        result[arr1[index]] = field;
        return result;
    }, {})
}

function merge2arrayAsPair2(accounts, tokenBalances) {
    if (!tokenBalances.length) return;
    let ret = {};
    tokenBalances.forEach((tokenBalance) => {
        ret[accounts[tokenBalance.accountIndex]] = {
            mint: tokenBalance.mint,
            amount: tokenBalance.uiTokenAmount.amount,
            decimals: tokenBalance.uiTokenAmount.decimals,
            uiAmount: tokenBalance.uiTokenAmount.uiAmount,
            uiAmountString: tokenBalance.uiTokenAmount.uiAmountString
        }
    })
    return ret;
}

async function findAssociatedTokenAddress(
    walletAddress,
    tokenMintAddress,
) {
    return (
        await web3.PublicKey.findProgramAddress(
            [
                walletAddress.toBuffer(),
                TokenInstructions.TOKEN_PROGRAM_ID.toBuffer(),
                tokenMintAddress.toBuffer(),
            ],
            ASSOCIATED_TOKEN_PROGRAM_ID,
        )
    )[0];
}

async function addListenerForAddress(connection, publickey, symbol, mintAddress, tipBuffer, priceBuffer) {
    let until, result = await connection.getConfirmedSignaturesForAddress2(publickey, { limit: 1 }, 'confirmed');
    if (result && !!result.length) {
        until = result[result.length - 1].signature;
    }

    // Rate Limits: 100 requests per 10 seconds per IP
    // Number of requests per second = (number of tokens in the watch list) * 2 / POLLING_INTERVAL
    // We can get minimal POLLING_INTERVAL=800 ms when #token=4 (SOL + USDC + RAY + FIDA)
    let intervalID = setInterval(async () => {
        try {
            result = await connection.getConfirmedSignaturesForAddress2(publickey, { until }, 'confirmed');
            if (result && !!result.length) {
                until = result[result.length - 1].signature; // update
                let signatures = result.map((confirmedSignatureInfo) => {
                    return confirmedSignatureInfo.signature;
                });
                (await connection.getParsedConfirmedTransactions(signatures, 'confirmed'))
                    .forEach((transactionMeta) => {
                        if (transactionMeta.meta.err) return;
                        let accounts = transactionMeta
                            .transaction
                            .message
                            .accountKeys
                            .map((parsedMessageAccount) => parsedMessageAccount.pubkey.toBase58());
                        let preBalances = merge2arrayAsPair(accounts, transactionMeta.meta.preBalances),
                            postBalances = merge2arrayAsPair(accounts, transactionMeta.meta.postBalances),
                            preTokenBalances = merge2arrayAsPair2(accounts, transactionMeta.meta.preTokenBalances),
                            postTokenBalances = merge2arrayAsPair2(accounts, transactionMeta.meta.postTokenBalances),
                            senderSignature = transactionMeta.transaction.signatures[0],
                            slot = transactionMeta.slot;
                        let balanceChange = postBalances[publickey] - preBalances[publickey],
                            tokenBalanceChange = null,
                            memo = transactionMeta.transaction.message.instructions.find((parsedInstruction, index) => parsedInstruction.program === 'spl-memo'),
                            author = null,
                            message = null;
                        let balanceChangeString = balanceAmountToUserAmount(balanceChange, 9),
                            tokenBalanceChangeString = '';

                        if (postTokenBalances) {
                            tokenBalanceChange = parseInt(postTokenBalances[publickey].amount) - parseInt(preTokenBalances[publickey].amount);
                            tokenBalanceChangeString = balanceAmountToUserAmount(tokenBalanceChange, postTokenBalances[publickey].decimals);
                        }

                        if (memo) {
                            let parsedMemo = JSON.parse(memo.parsed);
                            author = parsedMemo.author || '';
                            message = parsedMemo.message || '';
                        }

                        // Excluding withdrawals
                        if (balanceChange < 0 || (postTokenBalances && tokenBalanceChange < 0)) return;

                        // If price is available, filter all transaction that contain tip below a threshold.
                        let evaluated;
                        if (!mintAddress) mintAddress = "SOL_MINT_ADDRESS";
                        if (priceBuffer[mintAddress] && MINIMAL_ACCEPTED_PRICE_IN_USD !== 0) {
                            let _i;
                            if (symbol === "SOL") {
                                _i = (balanceChange / Math.pow(10, 9));
                            } else {
                                _i = (tokenBalanceChange / Math.pow(10, postTokenBalances[publickey].decimals));
                            }
                            evaluated = _i * priceBuffer[mintAddress];
                            if (MINIMAL_ACCEPTED_PRICE_IN_USD > evaluated) {
                                console.log(`Price too low. Signature: ${senderSignature} ${(100 * evaluated / MINIMAL_ACCEPTED_PRICE_IN_USD).toFixed(3)} %`);
                                return;
                            }
                        }

                        // Push into buffer
                        console.log(`Tip signature: ${senderSignature}`);
                        if (symbol === "SOL") {
                            tipBuffer.push({
                                author,
                                message,
                                amount: balanceChangeString,
                                symbol,
                                senderSignature,
                                slot,
                                priceInUSD: evaluated
                            })
                        } else {
                            tipBuffer.push({
                                author,
                                message,
                                amount: tokenBalanceChangeString,
                                symbol,
                                senderSignature,
                                slot,
                                priceInUSD: evaluated
                            })
                        }
                    })
            }
        } catch (e) {
            console.log(e);
        }
    }, POLLING_INTERVAL);

    console.log(`Monitoring ${publickey.toBase58()} (${symbol})`);
    return intervalID;
}

async function addListenerForPrice(connection, priceAccountKey, mintAddress, priceBuffer) {
    if (!mintAddress) mintAddress = "SOL_MINT_ADDRESS";
    try {
        const { data } = await connection.getAccountInfo(priceAccountKey);
        const { price } = parsePriceData(data);
        priceBuffer[mintAddress] = price;
    } catch (e) {
        console.log(`Failed to get price. mintAddress=${mintAddress}`);
        return;
    }
    let intervalID = setInterval(async () => {
        try {
            const { data } = await connection.getAccountInfo(priceAccountKey);
            const { price } = parsePriceData(data);
            priceBuffer[mintAddress] = price;
        } catch (e) {
            console.log(e);
        }
    }, PRICE_POLLING_INTERVAL);
    return intervalID;
}

export async function initListeners(_publickey) {
    const PUBLICKEY = new web3.PublicKey(_publickey);

    // Connect to cluster
    const connection = new web3.Connection(
        web3.clusterApiUrl('mainnet-beta'),
    );

    // Get associated token address
    let atas = await Promise.all(WATCH_LIST.map(async ([mintAddress, priceAccountKey]) => {
        return {
            tokenSymbol: POPULAR_TOKENS.find(i => i.mintAddress === mintAddress).tokenSymbol,
            publickey: await findAssociatedTokenAddress(PUBLICKEY, new web3.PublicKey(mintAddress)),
            mintAddress,
            priceAccountKey: new web3.PublicKey(priceAccountKey)
        };
    }));
    let publickeysMeta = [
        {
            tokenSymbol: 'SOL',
            publickey: PUBLICKEY,
            mintAddress: null,
            priceAccountKey: new web3.PublicKey(SOL_PRICE_ACCOUNT_KEY)
        },
        ...atas];
    let intervalIDs = await Promise.all(publickeysMeta.map(async (publickeyMeta) => {
        await addListenerForPrice(
            connection,
            publickeyMeta.priceAccountKey,
            publickeyMeta.mintAddress,
            priceBuffer,
        );
        return await addListenerForAddress(
            connection,
            publickeyMeta.publickey,
            publickeyMeta.tokenSymbol,
            publickeyMeta.mintAddress,
            tipBuffer,
            priceBuffer
        );
    }));
    return intervalIDs;
}

export const resolveTwitterHandle = async (twitterHandle) => {
    const connection = new web3.Connection(
        web3.clusterApiUrl('mainnet-beta'),
    );
    try {
        const registry = await getTwitterRegistry(connection, twitterHandle);
        return registry.owner.toBase58();
    } catch (err) {
        console.warn(`err`);
        return undefined;
    }
};

export const resolveDomainName = async (domainName) => {
    const connection = new web3.Connection(
        web3.clusterApiUrl('mainnet-beta'),
    );
    let hashedDomainName = await getHashedName(domainName);
    let inputDomainKey = await getNameAccountKey(
        hashedDomainName,
        undefined,
        SOL_TLD_AUTHORITY,
    );
    try {
        const registry = await NameRegistryState.retrieve(
            connection,
            inputDomainKey,
        );
        return registry.owner.toBase58();
    } catch (err) {
        console.warn(err);
        return undefined;
    }
};