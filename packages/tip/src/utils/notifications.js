import Button from '@material-ui/core/Button';

export function ViewTransactionOnExplorerButton({ signature }) {
    const urlSuffix = '';
    return (
        <Button
            color="inherit"
            component="a"
            target="_blank"
            rel="noopener"
            href={`https://solscan.io/tx/${signature}` + urlSuffix}
        >
            View on Solscan
        </Button>
    );
}