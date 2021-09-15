import Button from '@material-ui/core/Button';
import Grid from '@material-ui/core/Grid';
import InputAdornment from '@material-ui/core/InputAdornment';
import MenuItem from '@material-ui/core/MenuItem';
import TextField from '@material-ui/core/TextField';
import LinearProgress from '@material-ui/core/LinearProgress';
import Tooltip from '@material-ui/core/Tooltip';
import Box from '@material-ui/core/Box';
import { WalletNotConnectedError } from '@solana/wallet-adapter-base';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useCallback, useEffect, useState } from 'react';
import { getOwnedTokenAccounts, transferTokens, nativeTransfer, findAssociatedTokenAddress } from './utils/tokens'
import { parseMintData, parseTokenAccountData } from './utils/tokens/data'
import {
    memoInstruction,
    TOKEN_PROGRAM_ID,
    WRAPPED_SOL_MINT
} from './utils/tokens/instructions';
import { useTokenInfos } from './utils/tokens/names';
import { useSnackbar } from 'notistack';
import { ViewTransactionOnExplorerButton } from './utils/notifications'
import { resolveDomainName, resolveTwitterHandle } from './utils/name-service';
import {
    useLocation
} from "react-router-dom";

function balanceAmountToUserAmount(balanceAmount, decimals) {
    return (balanceAmount / Math.pow(10, decimals)).toFixed(decimals);
}

function useForm(publicKeys, lastTxTimestamp) {
    const { connection } = useConnection();
    const [destinationAddress, setDestinationAddress] = useState('');
    const [recipientAddress, setRecipientAddress] = useState('');
    const [transferAmountString, setTransferAmountString] = useState('');
    const [author, setAuthor] = useState('');
    const [memo, setMemo] = useState('');
    const [balanceInfos, setBalanceInfos] = useState();
    const tokenInfos = useTokenInfos();
    const [tokenList, setTokenList] = useState([]);
    const [balanceInfo, setBalanceInfo] = useState();
    const [selectValue, setSelectValue] = useState();
    const { enqueueSnackbar } = useSnackbar();

    const defaultAddressHelperText =
        !balanceInfo?.mint || balanceInfo?.mint.equals(WRAPPED_SOL_MINT) ?
            'Enter Solana Address' :
            'Enter SPL token or Solana address';
    const [addressHelperText, setAddressHelperText] =
        useState(defaultAddressHelperText);
    const [passAddressValidation, setPassValidation] = useState();

    const getTokenInfo = useCallback(
        (mint) => {
            let info = null;

            if (!mint) {
                return { name: null, symbol: null };
            }

            let match = tokenInfos?.find(
                (tokenInfo) => tokenInfo.address === mint.toBase58(),
            );

            if (match) {
                info = { ...match, logoUri: match.logoURI };
            }
            return { ...info };
        }, [tokenInfos])

    const updateBalanceInfos = async () => {
        if (!publicKeys) return;
        enqueueSnackbar('Retrieving account data...', {
            variant: 'info',
            autoHideDuration: 1500
        });
        let balanceInfos = await Promise.all(publicKeys.map(async (publicKey) => {
            if (!publicKey) return;
            let accountInfo = await connection.getAccountInfo(publicKey);
            let { mint, owner, amount } = accountInfo?.owner.equals(TOKEN_PROGRAM_ID) ?
                parseTokenAccountData(accountInfo.data) :
                {};
            let mintInfo = mint ? await connection.getAccountInfo(mint) : null;
            let { name, symbol, logoUri } = getTokenInfo(mint);

            if (mint) {
                try {
                    let { decimals } = parseMintData(mintInfo.data);
                    return {
                        amount,
                        decimals,
                        mint,
                        owner,
                        tokenName: name,
                        tokenSymbol: symbol,
                        tokenLogoUri: logoUri,
                        valid: true,
                        publicKey,
                    };
                } catch (e) {
                    return {
                        amount,
                        decimals: 0,
                        mint,
                        owner,
                        tokenName: 'Invalid',
                        tokenSymbol: 'INVALID',
                        tokenLogoUri: null,
                        valid: false,
                        publicKey
                    };
                }
            }

            if (!mint) {
                return {
                    amount: accountInfo?.lamports ?? 0,
                    decimals: 9,
                    mint: null,
                    owner: publicKey,
                    tokenName: 'SOL',
                    tokenSymbol: 'SOL',
                    valid: true,
                    publicKey,
                };
            }

            return null;
        }));
        setBalanceInfos(balanceInfos);
    }

    useEffect(() => {
        updateBalanceInfos();
    }, [connection, getTokenInfo, publicKeys, tokenInfos, lastTxTimestamp])

    useEffect(() => {
        if (!balanceInfos) return;
        let tokenList = balanceInfos.map((item) => {
            return {
                value: item.tokenName,
                label: `${item.tokenSymbol} (${balanceAmountToUserAmount(item.amount, item.decimals)})`
            };
        });
        setTokenList(tokenList);
        setSelectValue(tokenList?.[0].value);  // select first token

        setBalanceInfo({
            balanceAmount: balanceInfos?.[0].amount,
            decimals: balanceInfos?.[0].decimals,
            mint: balanceInfos?.[0].mint,
            tokenSymbol: balanceInfos?.[0].tokenSymbol,
            publicKey: balanceInfos?.[0].publicKey
        });

    }, [balanceInfos])

    const handleSelectToken =
        (e) => {
            let match =
                balanceInfos?.find((item) => item.tokenName === e.target.value);
            if (match) {
                setBalanceInfo({
                    balanceAmount: match.amount,
                    decimals: match.decimals,
                    mint: match.mint,
                    tokenSymbol: match.tokenSymbol,
                    publicKey: match.publicKey
                })
                setSelectValue(e.target.value);
            }
        }

    useEffect(() => {
        (async () => {
            const mintString = balanceInfo?.mint && balanceInfo?.mint.toBase58();
            let isDomainName = false, domainOwner;
            if (recipientAddress.startsWith('@')) {
                const twitterOwner = await resolveTwitterHandle(
                    connection,
                    recipientAddress.slice(1),
                );
                if (!twitterOwner) {
                    setAddressHelperText(`This Twitter handle is not registered`);
                    setPassValidation(undefined);
                    return;
                }
                isDomainName = true;
                domainOwner = twitterOwner;
            }
            if (recipientAddress.endsWith('.sol')) {
                const _domainOwner = await resolveDomainName(
                    connection,
                    recipientAddress.slice(0, -4),
                );
                if (!_domainOwner) {
                    setAddressHelperText(`This domain name is not registered`);
                    setPassValidation(undefined);
                    return;
                }
                isDomainName = true;
                domainOwner = _domainOwner;
            }
            if (!recipientAddress) {
                setAddressHelperText(defaultAddressHelperText);
                setPassValidation(undefined);
                return;
            }
            try {
                const destinationAccountInfo = await connection.getAccountInfo(
                    new PublicKey(isDomainName ? domainOwner : recipientAddress),
                );

                if (!!destinationAccountInfo && destinationAccountInfo.owner.equals(TOKEN_PROGRAM_ID)) {
                    const accountInfo = parseTokenAccountData(
                        destinationAccountInfo.data,
                    );
                    if (accountInfo.mint.toBase58() === mintString) {
                        setPassValidation(true);
                        setAddressHelperText('Address is a valid SPL token address');
                        setDestinationAddress(isDomainName ? domainOwner : recipientAddress);
                    } else {
                        setPassValidation(false);
                        setAddressHelperText('Destination address mint does not match');
                    }
                } else {
                    setPassValidation(true);
                    setAddressHelperText(
                        `Destination is a Solana address: ${isDomainName ? domainOwner : recipientAddress}`,
                    );
                    setDestinationAddress(isDomainName ? domainOwner : recipientAddress);
                }
            } catch (e) {
                console.log(`Received error validating address ${e}`);
                setAddressHelperText(defaultAddressHelperText);
                setPassValidation(undefined);
            }
        })();
    }, [recipientAddress]);

    const fields = (
        <>
            <TextField
                label='Token'
                fullWidth
                variant='outlined'
                margin='normal'
                select
                value={selectValue ?? ''} onChange={handleSelectToken} helperText=
                'Please select your token' > {tokenList.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                        {option.label}
                    </MenuItem>
                ))}
            </TextField>
            <TextField
                label='Recipient Address'
                fullWidth
                variant='outlined'
                margin='normal'
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value.trim())}
                helperText={addressHelperText}
                error={!passAddressValidation && passAddressValidation !== undefined}
            />
            <TextField
                label="Amount"
                fullWidth
                variant="outlined"
                margin="normal"
                type="number"
                InputProps={{
                    endAdornment: (
                        <InputAdornment position="end">
                            <Button
                                style={{ justifyContent: "center" }}
                                onClick={() => {
                                    let blanceAmount = balanceInfo?.balanceAmount,
                                        decimals = balanceInfo?.decimals;
                                    if (balanceInfo?.tokenSymbol === 'SOL') {
                                        blanceAmount = blanceAmount > 5000 ? blanceAmount -= 5000 : 0;
                                    }
                                    setTransferAmountString(
                                        balanceAmountToUserAmount(blanceAmount, decimals)
                                    )
                                }
                                }
                            >
                                MAX
                            </Button>
                            {balanceInfo?.tokenSymbol}
                        </InputAdornment>
                    ),
                    inputProps: {
                        step: Math.pow(10, -balanceInfo?.decimals),
                    },
                }}
                value={transferAmountString}
                onChange={(e) => setTransferAmountString(e.target.value.trim())}
                helperText={`Max: ${balanceAmountToUserAmount(balanceInfo?.balanceAmount, balanceInfo?.decimals)}`}
            />
            <TextField
                label='Name'
                fullWidth
                variant='outlined'
                margin='normal'
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder='Input your name or leave it blank'
            />
            <TextField
                label='Message'
                fullWidth
                variant='outlined'
                margin='normal'
                multiline
                rows={8}
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder='Input your message or leave it blank'
            />
        </>
    );

    return {
        fields,
        destinationAddress,
        transferAmountString,
        author,
        memo,
        mint: balanceInfo?.mint,
        decimals: balanceInfo?.decimals,
        tokenPublicKey: balanceInfo?.publicKey,
        passAddressValidation,
        setRecipientAddress
    };
}

const Form = () => {
    const { connection } = useConnection();
    const { publicKey, sendTransaction } = useWallet();
    const [publicKeys, loaded] = useWalletPublicKeys(publicKey);
    const [status, setStatus] = useState('idle');
    const [lastTxTimestamp, setLastTxTimestamp] = useState(Date.now());
    const {
        fields,
        destinationAddress,
        transferAmountString,
        author,
        memo,
        mint,
        decimals,
        tokenPublicKey, // Address or Associated Token Address
        passAddressValidation,
        setRecipientAddress
    } = useForm(publicKeys, lastTxTimestamp);
    const { enqueueSnackbar, closeSnackbar } = useSnackbar();
    const [transactionBaseSize, setTransactionBaseSize] = useState(276);
    const [transactionSize, setTransactionSize] = useState(0);
    const [transactionFees, setTransactionFees] = useState('');
    const [count, setCount] = useState(0);
    const TRANSACTION_SIZE_MAX = 1232;
    const location = useLocation();

    useEffect(() => {
        let address = (new URLSearchParams(location.search)).get("address");
        if (address) {
            setRecipientAddress(address);
        }
    }, [location, setRecipientAddress])

    const transferToken = useCallback(async (
        source,
        destination,
        amount,
        mint,
        decimals,
        memo,
    ) => {
        setStatus('pending');
        let id = enqueueSnackbar('Sending transaction...', {
            variant: 'info',
            persist: true,
        });
        try {
            if (!publicKey) throw new WalletNotConnectedError();
            const transaction = source.equals(publicKey) ?
                nativeTransfer(publicKey, destination, amount) :
                await transferTokens({
                    connection,
                    owner: { publicKey },
                    sourcePublicKey: source,
                    destinationPublicKey: destination,
                    amount,
                    mint,
                    decimals
                });
            transaction.add(memoInstruction(memo));
            const signature = await sendTransaction(transaction, connection);
            closeSnackbar(id);
            id = enqueueSnackbar('Confirming transaction...', {
                variant: 'info',
                persist: true,
                action: <ViewTransactionOnExplorerButton signature={signature} />,
            });
            await connection.confirmTransaction(signature, 'processed');
            closeSnackbar(id);
            enqueueSnackbar('Transaction confirmed', {
                variant: 'success',
                autoHideDuration: 15000,
                action: <ViewTransactionOnExplorerButton signature={signature} />,
            });
            setLastTxTimestamp(Date.now());
        } catch (e) {
            closeSnackbar(id);
            console.log(`Received error sending transaction ${e.message}`);
            // enqueueSnackbar(e.message, { variant: 'error' });
        } finally {
            setStatus('idle');
        }
    }, [publicKey, connection, closeSnackbar, enqueueSnackbar, sendTransaction]);

    const makeTransaction = async () => {
        let amount = Math.round(parseFloat(transferAmountString) * 10 ** decimals);
        try {
            if (!amount || amount <= 0) {
                throw new Error('Invalid amount');
            }
            if (!destinationAddress) {
                throw new Error('No Recipient Address');
            }
        } catch (e) {
            console.log(e.message);
            enqueueSnackbar(e.message, { variant: 'error' });
            return;
        }
        transferToken(
            tokenPublicKey,
            new PublicKey(destinationAddress),
            amount,
            mint,
            decimals,
            JSON.stringify({
                author,
                message: memo
            }),
        );
    }

    // Estimte transaction size
    useEffect(() => {
        if (!passAddressValidation) return;
        const text = `${author}${memo}`;
        setCount(text.length);
        setTransactionSize(transactionBaseSize + Buffer.from(text, 'utf-8').length);
    }, [passAddressValidation, transactionBaseSize, author, memo])

    // Estimate transaction fees and rent
    useEffect(async () => {
        if (!passAddressValidation) return;
        try {
            if (tokenPublicKey.equals(publicKey)) {
                // Each signature costs 5000 lamports.
                // We only have 1 sigers. :)
                setTransactionFees('0.000005000 SOL ($0.001)');
                setTransactionBaseSize(276);
            } else {
                let destinationPublicKey = new PublicKey(destinationAddress);
                let destinationAccountInfo = await connection.getAccountInfo(
                    destinationPublicKey,
                );
                if (
                    !!destinationAccountInfo &&
                    destinationAccountInfo.owner.equals(TOKEN_PROGRAM_ID)
                ) {
                    setTransactionFees('0.000005000 SOL ($0.001)');
                    setTransactionBaseSize(344);
                } else {
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
                        setTransactionFees('0.000005000 SOL ($0.001)');
                        setTransactionBaseSize(344);
                    } else {
                        // Rent-exempt minimum = 
                        //  19.055441478439427 (fee rate) * 
                        //  (128 + 165)(account size including metadata) *
                        //  ((365.25/2) * 2)(epochs in 2 years) = 2039280 lamports
                        // 1 Signature + 1 Rent = 2044280 lamports
                        setTransactionFees('0.002044280 ($0.38)');
                        setTransactionBaseSize(485);
                    }
                }
            }
        } catch (e) {
            console.log(`Received error estimating fees ${e.message}`);
        }
    }, [connection, passAddressValidation, publicKey, tokenPublicKey, destinationAddress, mint])

    return (
        <Grid container>
            <Grid item xs={2} />
            <Grid item xs={8}>
                <form onSubmit={(e) => {
                    e.preventDefault();
                    makeTransaction();
                }}>
                    {fields}
                    <LinearProgress
                        variant="determinate"
                        color={TRANSACTION_SIZE_MAX * 0.95 > transactionSize ? "primary" : "secondary"}
                        value={transactionSize > TRANSACTION_SIZE_MAX ? 100 : 100 * transactionSize / TRANSACTION_SIZE_MAX}
                    />
                    <Box display="flex" justifyContent="flex-end" style={{ marginTop: 20 }}>
                        <Button
                            color="inherit"
                            variant="text"
                            size="medium"
                            style={{ justifyContent: "left" }}
                        >
                            {`Input Characters: ${count}`}
                        </Button>
                        <Tooltip title="User have to pay the blockchain fees.">
                            <Button
                                color="inherit"
                                style={{ justifyContent: "left" }}
                            >
                                {`Estimated Fees: ${transactionFees}`}
                            </Button>
                        </Tooltip>
                        <Button
                            type="submit"
                            color="primary"
                            variant="text"
                            size="medium"
                            style={{ justifyContent: "center" }}
                            disabled={!publicKey || !passAddressValidation || status === 'pending'}
                        >
                            Send
                        </Button>
                    </Box>
                </form>
            </Grid>
            <Grid item xs={2} />
        </Grid>
    );
};

export default Form;

async function getTokenAccountInfo(connection, publicKey) {
    let accounts = await getOwnedTokenAccounts(connection, publicKey);
    return accounts
        .map(({ publicKey, accountInfo }) => {
            return {
                publicKey,
                parsed: parseTokenAccountData(accountInfo.data)
            };
        })
        .sort((account1, account2) =>
            account1.parsed.mint
                .toBase58()
                .localeCompare(account2.parsed.mint.toBase58()),
        );
};

function useWalletPublicKeys(publicKey) {
    const { connection } = useConnection();
    const [loaded, setLoaded] = useState(false);
    const [publicKeys, setPublicKeys] = useState();

    useEffect(() => {
        if (connection && publicKey) {
            setLoaded(false);
            (async () => {
                let tokenAccountInfo = await getTokenAccountInfo(connection, publicKey);
                let publicKeys = [
                    publicKey,
                    ...(tokenAccountInfo
                        ? tokenAccountInfo.map(({ publicKey }) => publicKey)
                        : []),
                ];
                setPublicKeys(publicKeys);
                setLoaded(true);
            })();
        }
    }, [connection, publicKey]);

    return [publicKeys, loaded];
}