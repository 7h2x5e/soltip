# 使用教學
## 1. 創建 solana 錢包
參考 [EP.1 如何創建solana錢包和進行Dex交易](https://www.youtube.com/watch?v=y83IjZ-3eNs)

## 2. 在 obs 顯示斗內
### 斗內地址
![](https://i.imgur.com/XK0zWkZ.png)
從 phantom 複製下來的地址即可用做收款地址
```
GwiX2WjGpj1fockk6H4nkmP3nBw
```
又或是提供連結方便使用者操作，同時附帶訊息
```
https://soltip.tw/tip/?address=GwiX2WjGpj1fockk6H4nkmP3nBw
```
### 使用 soltip 顯示入帳資訊
我想要用鯊鯊作為捐款動畫
```
https://i.imgur.com/tsvPcg8.gif
```
![](https://i.imgur.com/tsvPcg8.gif)

第一步，在 obs 內新增瀏覽器 (`+` -> `瀏覽器`)
![](https://i.imgur.com/SHQt2EO.png)

再來輸入網址
```!
https://soltip.tw/alertbox/?address=GwiX2WjGpj1fockk6H4nkmP3nBw&imgurl=https://i.imgur.com/tsvPcg8.gif
```
![](https://i.imgur.com/q3xpu4e.png)

最後調整大小即可，每次有資金入帳均顯示動畫
![](https://i.imgur.com/syBqE60.png)

## 3. 將 SOL 鏈上代幣換回新台幣

由於台灣交易所 [MAX](https://max.maicoin.com/)、[BITOPRO](https://www.bitopro.com/) 不支援 SOL 鏈，且只有 USDT/TWD 交易對深度較佳，只得將代幣在國外交易所換成 USDT 傳回台灣進行兌換。

[Coingecko Solana Market](https://www.coingecko.com/en/coins/solana#markets) 明列出支援 SOL/USD、SOL/USDT 的交易所
![](https://i.imgur.com/jJZq5aN.png)

基於 [FTX](https://ftx.com/) 提領免手續費，如果沒有特別要求是不錯的選擇。整體兌換路徑如下，在最後一步 MAX 提出台幣至自己的戶頭時需收 15 元手續費。
```
SOL or Any token on SOL
          │
          │
          │
  ┌───────▼────────┐
  │  FTX Exchange  ├───────────────────USDT
  └────────────────┘                     │
                                         ▼
                             ┌──────────────────────┐
         TWD ◄───────────────┤ Taiwan, Max Exchange │
                             └──────────────────────┘
```
