import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { useReadContract } from 'wagmi'
import { readContract } from '@wagmi/core'
import { config } from '../config/wagmi'
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
  const [nftData, setNftData] = useState<NFTData[]>([])
  const [lastRefresh, setLastRefresh] = useState<number | null>(null)
  const [forceRefreshCounter, setForceRefreshCounter] = useState(0)
  const [isLoadingNFTs, setIsLoadingNFTs] = useState(false)

  // Configuration de temporisation
  const CACHE_DURATION = 3 * 60 * 1000 // 3 minutes
  const RPC_DELAY = 100 // 100ms entre chaque appel
  const BATCH_SIZE = 5 // 5 NFTs par batch

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

  // Fonction pour récupérer les données d'un NFT avec temporisation
  const fetchSingleNFTData = useCallback(async (tokenId: number, delay: number = 0): Promise<NFTData | null> => {
    // Attendre le délai spécifié
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay))
    }

    try {
      // Récupérer les données détaillées
      const detailedData = await readContract(config, {
        address: CONTRACT_ADDRESS as Address,
        abi: CONTRACT_ABI,
        functionName: 'getNFTData',
        args: [BigInt(tokenId)],
      }) as [bigint, bigint, string[], boolean, boolean, bigint]

      // Récupérer les données de base
      const basicData = await readContract(config, {
        address: CONTRACT_ADDRESS as Address,
        abi: CONTRACT_ABI,
        functionName: 'nftData',
        args: [BigInt(tokenId)],
      }) as [bigint, bigint, bigint, boolean, boolean]

      const [expiryTime, transferCount, ownerHistory, isAlive, isDead, timeLeft] = detailedData
      const [mintTime] = basicData

      const now = Math.floor(Date.now() / 1000)
      
      // Calculer le temps de vie réel selon vos spécifications
      let realLifetime = 0
      
      // Logique corrigée pour déterminer si le NFT est vraiment vivant
      const isReallyAlive = isAlive && timeLeft > 0
      const isReallyDead = isDead || timeLeft <= 0 || !isAlive
      
      if (isReallyDead) {
        // Si le NFT est mort : délai entre date/heure du mint et date/heure où il a explosé
        // Si timeLeft = 0, alors il a explosé à expiryTime
        realLifetime = Number(expiryTime) - Number(mintTime)
      } else if (isReallyAlive) {
        // Si le NFT est encore en vie : délai entre date/heure du mint et date/heure actuelle
        realLifetime = now - Number(mintTime)
      } else {
        // Cas de fallback
        realLifetime = Number(expiryTime) - Number(mintTime)
      }

     

      return {
        tokenId,
        transferCount: Number(transferCount),
        realLifetime: Math.max(0, realLifetime),
        timeLeft: Number(timeLeft),
        isAlive: isReallyAlive, // Utiliser la logique corrigée
        isDead: isReallyDead,   // Utiliser la logique corrigée
        ownerHistory: ownerHistory || []
      }
    } catch (error) {
      console.error(`Erreur lors de la récupération des données NFT ${tokenId}:`, error)
      return null
    }
  }, [])

  // Fonction pour récupérer toutes les données NFT avec temporisation
  const fetchAllNFTData = useCallback(async () => {
    if (!totalSupply || totalSupply === 0n) {
      setNftData([])
      return
    }

    // Vérifier le cache
    if (lastRefresh && Date.now() - lastRefresh < CACHE_DURATION) {
      return
    }

    setIsLoadingNFTs(true)
    const allNFTData: NFTData[] = []
    const totalSupplyNumber = Number(totalSupply)

    try {
      // Diviser en batches pour éviter de surcharger le RPC
      for (let i = 1; i <= totalSupplyNumber; i += BATCH_SIZE) {
        const endIndex = Math.min(i + BATCH_SIZE - 1, totalSupplyNumber)
        const batchPromises = []

        // Créer les promesses pour ce batch avec temporisation progressive
        for (let j = i; j <= endIndex; j++) {
          const delay = (j - i) * RPC_DELAY
          batchPromises.push(fetchSingleNFTData(j, delay))
        }

        // Attendre que le batch soit terminé
        const batchResults = await Promise.all(batchPromises)
        
        // Ajouter les résultats valides
        batchResults.forEach(result => {
          if (result) {
            allNFTData.push(result)
          }
        })

        // Temporisation entre les batches
        if (i + BATCH_SIZE <= totalSupplyNumber) {
          await new Promise(resolve => setTimeout(resolve, RPC_DELAY * 2))
        }

        // Log de progression
        console.log(`Récupération NFT progress: ${Math.min(endIndex, totalSupplyNumber)}/${totalSupplyNumber}`)
      }

      setNftData(allNFTData)
      setLastRefresh(Date.now())
    } catch (error) {
      console.error('Erreur lors de la récupération des données NFT:', error)
    } finally {
      setIsLoadingNFTs(false)
    }
  }, [totalSupply, fetchSingleNFTData, lastRefresh, forceRefreshCounter])

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
    setLastRefresh(null) // Reset le cache
    
    // Refetch les données de base d'abord
    await Promise.all([
      refetchTotalSupply(),
      refetchRewardPool(),
      refetchGameEnded(),
      refetchMintDeadline(),
    ])
    
    // Puis les données NFT avec temporisation
    await fetchAllNFTData()
  }, [refetchTotalSupply, refetchRewardPool, refetchGameEnded, refetchMintDeadline, fetchAllNFTData])

  // Effet pour récupérer les données NFT quand le totalSupply change
  useEffect(() => {
    if (totalSupply && totalSupply > 0n) {
      fetchAllNFTData()
    }
  }, [totalSupply, fetchAllNFTData])

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