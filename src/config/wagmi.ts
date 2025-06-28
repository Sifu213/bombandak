import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { defineChain } from 'viem'

// Définir le réseau Monad testnet
export const monadTestnet = defineChain({
  id: 10143, // Remplace par le vrai Chain ID de Monad testnet
  name: 'Monad Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'MON',
    symbol: 'MON',
  },
  rpcUrls: {
    default: {
      http: ['https://testnet-rpc.monad.xyz'], // Remplace par la vraie RPC URL
    },
  },
  blockExplorers: {
    default: { name: 'MonadScan', url: 'https://testnet.monadscan.xyz' },
  },
})

export const config = getDefaultConfig({
  appName: 'HotMolandak',
  projectId: '3afda50686b39a0edbb0a266b169d453', // Va sur WalletConnect Cloud pour récupérer un Project ID
  chains: [monadTestnet],
  ssr: false, // Si tu utilises du SSR, met true
})