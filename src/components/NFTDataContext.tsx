import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { useReadContract, useReadContracts } from 'wagmi'
import { formatEther } from 'viem'
import type { Address } from 'viem'
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contract'

// Types
interface NFTData {
  tokenId: number
  transferCount: number
  realLifetime: number
  timeLeft: number
  isAlive: boolean
  isDead: boolean
  ownerHistory: string[]
}

interface GlobalStats {
  totalMinted: number
  totalAlive: number
  totalDead: number
  totalTransfers: number
  averageLifetime: number
  rewardPool: {
    formatted: string
    raw: string
  }
}

interface NFTDataContextType {
  nftData: NFTData[]
  globalStats: GlobalStats
  isLoading: boolean
  lastRefresh: number | null
  forceRefresh: () => void
  getLeaderboardData: () => NFTData[]
  getGlobalStatsData: () => GlobalStats
  // Mint deadline functionality
  getMintTimeLeft: () => string
  isMintStillActive: () => boolean
  gameEnded: boolean
}

// Type pour les contrats
type ContractCall = {
  address: Address
  abi: typeof CONTRACT_ABI
  functionName: 'getNFTData' | 'nftData'
  args: [bigint]
}

const defaultGlobalStats: GlobalStats = {
  totalMinted: 0,
  totalAlive: 0,
  totalDead: 0,
  totalTransfers: 0,
  averageLifetime: 0,
  rewardPool: {
    formatted: '0',
    raw: '0'
  }
}

const NFTDataContext = createContext<NFTDataContextType | undefined>(undefined)

export const NFTDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lastRefresh, setLastRefresh] = useState<number | null>(null)
  const [forceRefreshCounter, setForceRefreshCounter] = useState(0)

  // Cache pour éviter les appels trop fréquents
  const CACHE_DURATION = 3 * 60 * 1000 // 3 minutes

  // Hooks pour les données de base du contrat
  const { 
    data: totalSupply, 
    refetch: refetchTotalSupply,
    isLoading: isLoadingTotalSupply 
  } = useReadContract({
    address: CONTRACT_ADDRESS as Address,
    abi: CONTRACT_ABI,
    functionName: 'getTotalSupply',
  })

  const { 
    data: rewardPoolBalance, 
    refetch: refetchRewardPool,
    isLoading: isLoadingRewardPool 
  } = useReadContract({
    address: CONTRACT_ADDRESS as Address,
    abi: CONTRACT_ABI,
    functionName: 'getRewardPoolBalance',
  })

  const { 
    data: gameEndedData, 
    refetch: refetchGameEnded 
  } = useReadContract({
    address: CONTRACT_ADDRESS as Address,
    abi: CONTRACT_ABI,
    functionName: 'gameEnded',
  })

  const { 
    data: mintDeadline, 
    refetch: refetchMintDeadline 
  } = useReadContract({
    address: CONTRACT_ADDRESS as Address,
    abi: CONTRACT_ABI,
    functionName: 'getMintDeadline',
  })

  // Fonction pour calculer le temps restant pour minter
  const getMintTimeLeft = useCallback((): string => {
    if (!mintDeadline) return 'Loading...'
    
    const now = Math.floor(Date.now() / 1000)
    const timeLeft = Number(mintDeadline) - now
    
    if (timeLeft <= 0) return 'Expired'
    
    const days = Math.floor(timeLeft / (24 * 60 * 60))
    const hours = Math.floor((timeLeft % (24 * 60 * 60)) / (60 * 60))
    const minutes = Math.floor((timeLeft % (60 * 60)) / 60)
    
    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }, [mintDeadline])

  // Fonction pour vérifier si le mint est encore actif
  const isMintStillActive = useCallback((): boolean => {
    if (!mintDeadline) return false
    
    const now = Math.floor(Date.now() / 1000)
    return Number(mintDeadline) > now
  }, [mintDeadline])

  // Valeur du gameEnded
  const gameEnded = Boolean(gameEndedData)

  // Créer les contrats pour tous les NFTs basés sur le totalSupply
  const nftContracts = useMemo((): ContractCall[] => {
    if (!totalSupply || totalSupply === 0n) {
      return []
    }

    const contracts: ContractCall[] = []
    const totalSupplyNumber = Number(totalSupply)

    // Récupérer les données détaillées ET les données de base pour chaque NFT
    for (let i = 1; i <= totalSupplyNumber; i++) {
      contracts.push({
        address: CONTRACT_ADDRESS as Address,
        abi: CONTRACT_ABI,
        functionName: 'getNFTData',
        args: [BigInt(i)],
      })
      // Ajouter l'appel pour récupérer les données de base (mintTime, etc.)
      contracts.push({
        address: CONTRACT_ADDRESS as Address,
        abi: CONTRACT_ABI,
        functionName: 'nftData',
        args: [BigInt(i)],
      })
    }

    return contracts
  }, [totalSupply, forceRefreshCounter])

  // Utiliser useReadContracts pour récupérer toutes les données en une seule fois
  const { 
    data: nftContractData, 
    isLoading: isLoadingNFTs,
    refetch: refetchNFTs
  } = useReadContracts({
    contracts: nftContracts,
    query: {
      enabled: nftContracts.length > 0,
      staleTime: CACHE_DURATION,
      gcTime: CACHE_DURATION,
    }
  })

  // Traiter les données des NFTs
  const nftData = useMemo((): NFTData[] => {
    if (!nftContractData || !totalSupply) {
      return []
    }

    const processedData: NFTData[] = []
    const now = Math.floor(Date.now() / 1000)
    const totalSupplyNumber = Number(totalSupply)

    for (let i = 0; i < totalSupplyNumber; i++) {
      const detailedDataIndex = i * 2 // getNFTData
      const basicDataIndex = i * 2 + 1 // nftData

      const detailedResult = nftContractData[detailedDataIndex]
      const basicResult = nftContractData[basicDataIndex]

      if (detailedResult?.status === 'success' && detailedResult.result &&
          basicResult?.status === 'success' && basicResult.result) {
        try {
          // Données détaillées: [expiryTime, transferCount, ownerHistory, isAlive, isDead, timeLeft]
          const detailedData = detailedResult.result as [bigint, bigint, string[], boolean, boolean, bigint]
          const [expiryTime, transferCount, ownerHistory, isAlive, isDead, timeLeft] = detailedData

          // Données de base: [mintTime, expiryTime, transferCount, isAlive, isDead]
          const basicData = basicResult.result as [bigint, bigint, bigint, boolean, boolean]
          const [mintTime] = basicData

          const tokenId = i + 1
          
          // Calculer le temps de vie réel avec mintTime
          let realLifetime = 0
          
          if (isDead) {
            // Si mort, calculer le temps total vécu depuis le mint
            realLifetime = Number(expiryTime) - Number(mintTime)
          } else if (isAlive) {
            // Si vivant, calculer le temps vécu depuis le mint
            realLifetime = now - Number(mintTime)
          } else {
            // NFT expiré mais pas encore marqué comme mort
            realLifetime = Number(expiryTime) - Number(mintTime)
          }

          processedData.push({
            tokenId,
            transferCount: Number(transferCount),
            realLifetime: Math.max(0, realLifetime),
            timeLeft: Number(timeLeft),
            isAlive,
            isDead,
            ownerHistory: ownerHistory || []
          })
        } catch (error) {
          console.error(`Erreur lors du traitement des données NFT ${i + 1}:`, error)
        }
      }
    }

    return processedData
  }, [nftContractData, totalSupply])

  // Calcul des stats globales à partir des données NFT
  const globalStats = useMemo((): GlobalStats => {
    if (!nftData.length) {
      return {
        ...defaultGlobalStats,
        rewardPool: {
          formatted: rewardPoolBalance ? parseFloat(formatEther(rewardPoolBalance)).toFixed(2) : '0.00',
          raw: rewardPoolBalance?.toString() || '0'
        }
      }
    }

    const totalMinted = nftData.length
    const totalAlive = nftData.filter(nft => nft.isAlive && nft.timeLeft > 0).length
    const totalDead = nftData.filter(nft => nft.isDead || nft.timeLeft <= 0).length
    const totalTransfers = nftData.reduce((sum, nft) => sum + nft.transferCount, 0)
    const averageLifetime = totalMinted > 0 
      ? nftData.reduce((sum, nft) => sum + nft.realLifetime, 0) / totalMinted 
      : 0

    return {
      totalMinted,
      totalAlive,
      totalDead,
      totalTransfers,
      averageLifetime,
      rewardPool: {
        formatted: rewardPoolBalance ? parseFloat(formatEther(rewardPoolBalance)).toFixed(2) : '0.00',
        raw: rewardPoolBalance?.toString() || '0'
      }
    }
  }, [nftData, rewardPoolBalance])

  // Fonction pour forcer le refresh
  const forceRefresh = useCallback(async () => {
    setForceRefreshCounter(prev => prev + 1)
    setLastRefresh(Date.now())
    
    // Refetch toutes les données du contrat
    await Promise.all([
      refetchTotalSupply(),
      refetchRewardPool(),
      refetchGameEnded(),
      refetchMintDeadline(),
      refetchNFTs(),
    ])
  }, [refetchTotalSupply, refetchRewardPool, refetchGameEnded, refetchMintDeadline, refetchNFTs])

  // Effet pour mettre à jour le timestamp du dernier refresh
  useEffect(() => {
    if (nftData.length > 0 && !lastRefresh) {
      setLastRefresh(Date.now())
    }
  }, [nftData, lastRefresh])

  // Calculer l'état de chargement global
  const isLoadingGlobal = isLoadingTotalSupply || isLoadingRewardPool || isLoadingNFTs

  // Fonctions utilitaires pour les composants
  const getLeaderboardData = useCallback((): NFTData[] => {
    return nftData
  }, [nftData])

  const getGlobalStatsData = useCallback((): GlobalStats => {
    return globalStats
  }, [globalStats])

  const value: NFTDataContextType = {
    nftData,
    globalStats,
    isLoading: isLoadingGlobal,
    lastRefresh,
    forceRefresh,
    getLeaderboardData,
    getGlobalStatsData,
    // Mint deadline functionality
    getMintTimeLeft,
    isMintStillActive,
    gameEnded
  }

  return (
    <NFTDataContext.Provider value={value}>
      {children}
    </NFTDataContext.Provider>
  )
}

export const useNFTData = () => {
  const context = useContext(NFTDataContext)
  if (context === undefined) {
    throw new Error('useNFTData must be used within a NFTDataProvider')
  }
  return context
}