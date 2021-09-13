import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './AlertBox.css';
import { tipBuffer, initListeners } from './utils'
import {
  ALERT_BOX_DELAY,
  ALERT_BOX_INTERVAL,
  CUSTOM_BAD_WORDS,
  ENABLE_BAD_WORDS_FILTER,
  ANIME_GIF_LOCATION
} from './config'
import {
  useLocation
} from "react-router-dom";
import * as Filter from 'bad-words'

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

function AlertBox() {
  const [fadeProp, setFadeProp] = useState({
    fade: 'fade-out'
  });
  const [tipMessage, setTipMessage] = useState({
    author: '',
    amount: '',
    symbol: '',
    message: '',
    senderSignature: undefined,
    slot: undefined,
    priceInUSD: undefined
  })
  const query = useQuery();
  
  const filter = useMemo(() => {
    let filter = new Filter();
    filter.addWords(...CUSTOM_BAD_WORDS);
    return filter;
  }, []);

  useEffect(() => {
    (async () => {
      let address = query.get("address");
      if (!address || !filter) return;
      if (address.length !== 44) return;
      console.log(`Input address (public key): ${address}`);
      await initListeners(address);
      tipBuffer.push({
        author: 'Test',
        message: 'BTC to themoon',
        amount: '0.001',
        symbol: 'TestCoin',
        senderSignature: null,
        slot: null,
        priceInUSD: 0
      });
      setTimeout(displayTipMessage);
    })();
  }, [filter])

  const sleep = (ms) => {
    return new Promise(resolve => setTimeout(() => resolve(undefined), ms));
  }

  const displayTipMessage = useCallback(async () => {
    let _tip = tipBuffer.shift(); // FIFO
    if (_tip) {
      // If bad-words module is active, filter all message.
      let tip = _tip;
      if (ENABLE_BAD_WORDS_FILTER) {
        try {
          tip = {
            ...tip,
            author: filter.clean(tip.author),
            message: filter.clean(tip.message)
          };
        } catch (e) {
          // This's a workaround, cause bad-words cannot handle chinese character
          console.log(e);
          tip = _tip;
        }
      }
      setTipMessage({
        ...tip
      });
      setFadeProp({
        fade: 'fade-in'
      })
      await sleep(ALERT_BOX_DELAY + 2);
      setFadeProp({
        fade: 'fade-out'
      });
      await sleep(2);
    }
    await sleep(ALERT_BOX_INTERVAL);
    setTimeout(displayTipMessage);
  }, [])

  return (
    <div id="box">
      <div id="wrap" className={fadeProp.fade}>
        <div id="image-wrap">
          <div id="image" style={{ backgroundImage: `url(${ANIME_GIF_LOCATION})` }}>
          </div>
        </div>
        <div id="text-wrap">
          <div id="text">
            <div id="message">
              {`${tipMessage.author || 'Someone'} just tipped ${tipMessage.amount} ${tipMessage.symbol} `}
              {!tipMessage.priceInUSD ? '' : `($${Number(tipMessage.priceInUSD).toFixed(2)})`}
            </div>
            <div id="user-message">
              {`${tipMessage.message || ''}`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AlertBox;
