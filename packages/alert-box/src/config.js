export const POLLING_INTERVAL = 10000;
export const PRICE_POLLING_INTERVAL = 30000;
export const ALERT_BOX_DELAY = 8000;
export const ALERT_BOX_INTERVAL = 1000;
export const MINIMAL_ACCEPTED_PRICE_IN_USD = 0.03; // 0 = unlimited
export const ORACLE_MAPPING_PUBLIC_KEY = 'AHtgzX45WTKfkPG53L6WYhGEXwQkN1BVknET3sVsLL8J'; // For mainnet-beta
export const ANIME_GIF_LOCATION = './gura.gif'
export const ENABLE_BAD_WORDS_FILTER = true;

// [ token mint address, price account key ]
// Token mint address can be retrieved from https://github.com/project-serum/spl-token-wallet/blob/f30c9eeb689de0a2cb7b76089f5d5d53f8263a5b/src/utils/tokens/names.js
// Price account key can be retrieved from https://pyth.network/developers/accounts/
export const SOL_PRICE_ACCOUNT_KEY = "H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG";
export const WATCH_LIST = [
    // USDC 
    ["EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "Gnt27xtC473ZT2Mw5u8wZ68Z3gULkSTb5DuxJy7eJotD"],
    // RAY
    ["4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R", "AnLf8tVYCM816gmBjiy8n53eXKKEDydT5piYjjQDPgTB"]
]

export const CUSTOM_BAD_WORDS = [
    "BTC"
]
