
import { TokenListProvider } from '@solana/spl-token-registry';
import React, { useContext, useEffect, useState } from 'react';
import { clusterForEndpoint } from '../cluster'
import { MAINNET_BACKUP_URL, MAINNET_URL } from '../connection'

export const TokenListContext = React.createContext({});

export function useTokenInfos() {
  const { tokenInfos } = useContext(TokenListContext);
  return tokenInfos;
}

export function TokenRegistryProvider(props) {
  // const { endpoint } = useConnectionConfig();
  const endpoint = MAINNET_URL;
  const [tokenInfos, setTokenInfos] = useState();

  useEffect(() => {
    if (endpoint !== MAINNET_BACKUP_URL && endpoint !== MAINNET_URL) return;
    const tokenListProvider = new TokenListProvider();
    tokenListProvider.resolve().then((tokenListContainer) => {
      const cluster = clusterForEndpoint(endpoint);
      const filteredTokenListContainer =
        tokenListContainer?.filterByClusterSlug(
          cluster?.clusterSlug,
        );
      const tokenInfos = tokenListContainer !== filteredTokenListContainer ?
        filteredTokenListContainer?.getList() :
        null;  // Workaround for filter return all on unknown slug
      setTokenInfos(tokenInfos);
    });
  }, [endpoint]);

  return (
    <TokenListContext.Provider value={{ tokenInfos }}>
      {props.children}
    </TokenListContext.Provider>
  );
}