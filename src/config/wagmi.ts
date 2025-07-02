import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { defineChain } from 'viem'


export const monadTestnet = defineChain({
  id: 10143, 
  name: 'Monad Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'MON',
    symbol: 'MON',
  },
  rpcUrls: {
    default: {
      http: ['https://monad-testnet.g.alchemy.com/v2/N8FOvudhyXRlr3yAQzoFY'], 
    },
  },
  blockExplorers: {
    default: { name: 'MonadScan', url: 'https://testnet.monadscan.xyz' },
  },
})

export const config = getDefaultConfig({
  appName: 'HotMolandak',
  projectId: '3afda50686b39a0edbb0a266b169d453', 
  chains: [monadTestnet],
  ssr: false, 
})