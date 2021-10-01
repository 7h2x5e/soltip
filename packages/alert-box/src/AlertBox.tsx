import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './AlertBox.css';
import {
  tipBuffer,
  initListeners,
  resolveTwitterHandle,
  resolveDomainName
} from './utils'
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
  const location = useLocation();
  const [imageLocation, setImageLocation] = useState(ANIME_GIF_LOCATION);

  const filter = useMemo(() => {
    let filter = new Filter();
    filter.addWords(...CUSTOM_BAD_WORDS);
    return filter;
  }, []);

  useEffect(() => {
    (async () => {
      let isDomainName = false,
        domainOwner,
        address = (new URLSearchParams(location.search)).get("address"),
        imageLocation = (new URLSearchParams(location.search)).get("imgurl");
      if (imageLocation) setImageLocation(imageLocation);
      if (!address || !filter) return;
      if (address.startsWith('@')) {
        const twitterOwner = await resolveTwitterHandle(address.slice(1));
        if (!twitterOwner) {
          console.log(`This Twitter handle is not registered`);
          return;
        }
        isDomainName = true;
        domainOwner = twitterOwner;
      }
      if (address.endsWith('.sol')) {
        const _domainOwner = await resolveDomainName(address.slice(0, -4));
        if (!_domainOwner) {
          console.log(`This domain name is not registered`);
          return;
        }
        isDomainName = true;
        domainOwner = _domainOwner;
      }
      if ((isDomainName ? domainOwner : address).length !== 44) return;
      console.log(`Input address (public key): ${isDomainName ? domainOwner : address}`);
      await initListeners(isDomainName ? domainOwner : address);
      tipBuffer.push({
        author: 'Gawr Gura',
        message: 'BTC',
        amount: '1',
        symbol: 'BTC',
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
          <div id="image" style={{ backgroundImage: `url(${imageLocation})` }}>
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
