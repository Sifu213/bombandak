import { useState, useEffect, useCallback } from 'react'
import { useReadContract, useBalance } from 'wagmi'
import { readContract } from '@wagmi/core'
import { config } from '../config/wagmi'
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contract'
import { formatEther } from 'viem'

interface NFTStats {
  totalMinted: number
  totalAlive: number
  totalDead: number
  totalTransfers: number
  averageLifetime: number
  longestLiving: {
    tokenId: bigint | null
    realLifetime: number
  }
  rewardPool: {
    balance: string
    formatted: string
  }
}

// Cache pour éviter de refetch les NFTs qui ne changent pas
const nftDataCache = new Map<string, any>()
const CACHE_DURATION = 60000 // 1 minute en millisecondes

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function GlobalStats() {
  const [stats, setStats] = useState<NFTStats>({
    totalMinted: 0,
    totalAlive: 0,
    totalDead: 0,
    totalTransfers: 0,
    averageLifetime: 0,
    longestLiving: { tokenId: null, realLifetime: 0 },
    rewardPool: { balance: '0', formatted: '0.00' }
  })
  const [isLoading, setIsLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(0)

  const { data: championInfo, refetch: refetchChampion } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getChampionInfo',
  })

  const { data: totalSupply, refetch: refetchTotalSupply } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getTotalSupply',
  })

  const { data: contractBalance, refetch: refetchBalance } = useBalance({
    address: CONTRACT_ADDRESS,
  })

  const { data: gameEnded } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'gameEnded',
  })

  const { data: mintDeadline } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getMintDeadline',
  })

  // Fonction pour traiter les NFTs par batch avec limitation de débit
  const processNFTBatch = async (startId: number, endId: number) => {
    const results = []
    
    // Traiter UN par UN avec délai pour éviter 429
    for (let i = startId; i <= endId; i++) {
      const tokenId = BigInt(i)
      const cacheKey = `nft-${tokenId}`
      const cachedData = nftDataCache.get(cacheKey)
      
      // Utiliser le cache si les données sont récentes (< 1 minute)
      if (cachedData && (Date.now() - cachedData.timestamp) < CACHE_DURATION) {
        results.push(cachedData.data)
        continue
      }

      try {
        // Délai avant chaque appel pour éviter 429
        await sleep(500) // 500ms entre chaque appel
        
        const data = await readContract(config, {
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: 'getNFTData',
          args: [tokenId],
        })
        
        const result = { tokenId, nftData: data }
        
        // Mettre en cache
        nftDataCache.set(cacheKey, {
          data: result,
          timestamp: Date.now()
        })
        
        results.push(result)
        
      } catch (error) {
        console.error(`Error fetching NFT #${tokenId}:`, error)
        results.push({ tokenId, nftData: null })
        
        // Délai plus long en cas d'erreur
        await sleep(1000)
      }
    }

    return results
  }

  const calculateGlobalStats = useCallback(async () => {
    if (!totalSupply) return

    const now = Date.now()
    // Éviter les calculs trop fréquents (minimum 30 secondes entre les calculs)
    if (now - lastRefresh < 30000) {
      return
    }

    setIsLoading(true)
    const total = Number(totalSupply)
    const currentTime = Math.floor(Date.now() / 1000)
    
    try {
      let aliveCount = 0
      let deadCount = 0
      let totalTransferCount = 0
      let longestRealLifetime = 0
      let longestLivingId: bigint | null = null
      const lifetimes: number[] = []

      const BATCH_SIZE = 5
      const batches = Math.ceil(total / BATCH_SIZE)

      for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
        const startId = batchIndex * BATCH_SIZE + 1
        const endId = Math.min((batchIndex + 1) * BATCH_SIZE, total)

        console.log(`Processing batch ${batchIndex + 1}/${batches} (NFTs ${startId}-${endId})`)

        try {
          const batchResults = await processNFTBatch(startId, endId)
          
          for (const result of batchResults) {
            if (!result.nftData) {
              deadCount++
              continue
            }

            const { tokenId, nftData } = result
            const [expiryTime, transferCount, , isAlive, isDead, timeLeft] = nftData as [bigint, bigint, string[], boolean, boolean, bigint]

            let realLifetime: number
            const isNFTAlive = isAlive && !isDead && Number(timeLeft) > 0

            if (isNFTAlive) {
              // Estimation de la durée de vie pour les NFTs vivants
              realLifetime = currentTime - (Number(expiryTime) - Number(timeLeft))
              aliveCount++
              lifetimes.push(Number(timeLeft))
            } else {
              if (championInfo && championInfo[0] === tokenId) {
                realLifetime = Number(championInfo[1])
              } else {
                // Estimation basée sur les transferts
                realLifetime = Number(transferCount) * 86400 + 86400 // 1 jour par transfer + 1 jour initial
              }
              deadCount++
            }

            if (realLifetime > longestRealLifetime) {
              longestRealLifetime = realLifetime
              longestLivingId = tokenId
            }

            totalTransferCount += Number(transferCount)
          }

          if (batchIndex < batches - 1) {
            console.log(`Waiting 1s before next batch...`)
            await sleep(600) // 
          }

        } catch (error) {
          console.error(`Error processing batch ${batchIndex}:`, error)
          // En cas d'erreur sur un batch, attendre plus longtemps
          await sleep(600)
        }
      }

      // Utiliser les infos du champion du contrat si disponible
      if (championInfo && championInfo[0] > 0) {
        longestLivingId = championInfo[0]
        longestRealLifetime = Number(championInfo[1])
      }

      const averageLifetime = lifetimes.length > 0 
        ? lifetimes.reduce((a, b) => a + b, 0) / lifetimes.length 
        : 0

      const rewardPoolBalance = contractBalance?.value || 0n
      const formattedBalance = formatEther(rewardPoolBalance)
      
      console.log('Stats calculated:', {
        totalMinted: total,
        totalAlive: aliveCount,
        totalDead: deadCount,
        cacheEntries: nftDataCache.size
      })
      
      setStats({
        totalMinted: total,
        totalAlive: aliveCount,
        totalDead: deadCount,
        totalTransfers: totalTransferCount,
        averageLifetime: Math.round(averageLifetime),
        longestLiving: {
          tokenId: longestLivingId,
          realLifetime: longestRealLifetime
        },
        rewardPool: {
          balance: rewardPoolBalance.toString(),
          formatted: parseFloat(formattedBalance).toFixed(1)
        }
      })

      setLastRefresh(now)

    } catch (error) {
      console.error('Error calculating global stats:', error)
    } finally {
      setIsLoading(false)
    }
  }, [totalSupply, championInfo, contractBalance, lastRefresh])

  // Calculer les stats au chargement
  useEffect(() => {
    if (totalSupply) {
      calculateGlobalStats()
    }
  }, [totalSupply, calculateGlobalStats])

  const handleManualRefresh = async () => {
    // Vider le cache pour forcer le refresh
    nftDataCache.clear()
    setLastRefresh(0)
    
    await Promise.all([
      refetchTotalSupply(),
      refetchBalance(),
      refetchChampion(),
    ])
    
    await calculateGlobalStats()
  }

  const formatTime = (seconds: number) => {
    if (seconds <= 0) return 'Expired'
    
    const days = Math.floor(seconds / (24 * 60 * 60))
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60))
    const minutes = Math.floor((seconds % (60 * 60)) / 60)
    
    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const getMintTimeLeft = () => {
    if (!mintDeadline) return null
    
    const currentTime = Math.floor(Date.now() / 1000)
    const deadline = Number(mintDeadline)
    const timeLeft = deadline - currentTime
    
    if (timeLeft <= 0) return 'Mint period ended'
    
    const days = Math.floor(timeLeft / (24 * 60 * 60))
    const hours = Math.floor((timeLeft % (24 * 60 * 60)) / (60 * 60))
    const minutes = Math.floor((timeLeft % (60 * 60)) / 60)
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const isMintStillActive = () => {
    if (!mintDeadline) return false
    const currentTime = Math.floor(Date.now() / 1000)
    const deadline = Number(mintDeadline)
    return currentTime <= deadline && !gameEnded
  }

  const calculateRewardPerSurvivor = () => {
    if (stats.totalAlive === 0) return '0.00'
    const rewardPerSurvivor = parseFloat(stats.rewardPool.formatted) / stats.totalAlive
    return rewardPerSurvivor.toFixed(1)
  }

  return (
    <div className="border-white/20">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-xl lg:text-2xl font-semibold text-white mb-4 text-center xl:text-left">
          Global Stats
        </h3>
        <div className="flex items-center gap-2">
          {isLoading && (
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
          )}
          
        </div>
      </div>

      {/* Mint Deadline Countdown */}
      {mintDeadline && isMintStillActive() && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-2 mb-4">
          <div className="text-center">
            <div className="text-blue-400 font-semibold mb-2 flex items-center justify-center gap-2">
              Mint Deadline
            </div>
            <div className="text-lg font-bold text-white mb-1">
              {getMintTimeLeft()}
            </div>
            <div className="text-xs text-blue-200">
              Mint closes July 16, 2025 at 23:59 UTC
            </div>
          </div>
        </div>
      )}

      {/* Mint Ended Notice */}
      {mintDeadline && !isMintStillActive() && !gameEnded && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 mb-6">
          <div className="text-center">
            <div className="text-orange-400 font-semibold mb-2">
              Mint Period Ended
            </div>
            <div className="text-sm text-orange-200">
              Mint deadline passed on July 16, 2025
            </div>
            <div className="text-xs text-orange-300 mt-1">
              No more Bombadaks can be minted
            </div>
          </div>
        </div>
      )}

      {/* Reward Pool - Section prominente */}
      <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/50 rounded-lg p-2 mb-4">
        <div className="text-center">
          <div className="text-yellow-400 font-semibold mb-2 flex items-center justify-center gap-2">
            Total Reward Pool
          </div>
          <div className="text-2xl lg:text-3xl font-bold text-white mb-1">
            {stats.rewardPool.formatted} MON
          </div>
          {stats.totalAlive > 0 && (
            <div className="text-sm text-yellow-200">
              ~{calculateRewardPerSurvivor()} MON per survivor
            </div>
          )}
          {gameEnded && (
            <div className="text-xs text-green-400 mt-1">
              Game Ended - Rewards Distributed
            </div>
          )}
        </div>
      </div>

      {/* Stats principales */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white/5 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-yellow-400">{stats.totalMinted}/500</div>
          <div className="text-sm text-white">Total Minted</div>
        </div>
        <div className="bg-white/5 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-400">{stats.totalAlive}</div>
          <div className="text-sm text-white">Ticking</div>
        </div>
        <div className="bg-white/5 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-red-400">{stats.totalDead}</div>
          <div className="text-sm text-white">Exploded</div>
        </div>
      </div>

      {/* Stats détaillées */}
      <div className="space-y-3 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-white">Total Transfers:</span>
          <span className="text-blue-400 font-semibold">{stats.totalTransfers}</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-white">Avg Remaining:</span>
          <span className="text-purple-400 font-semibold">{formatTime(stats.averageLifetime)}</span>
        </div>
      </div>

      {/* Barre de progression survivants vs morts */}
      {stats.totalMinted > 0 && (
        <div className="mt-4">
          <div className="flex justify-between text-xs text-white mb-1">
            <span>Survival Rate</span>
            <span>{Math.round((stats.totalAlive / stats.totalMinted) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${(stats.totalAlive / stats.totalMinted) * 100}%` }}
            ></div>
          </div>
        </div>
      )}

      

      {/* Indicateur de fin de jeu */}
      {gameEnded && (
        <div className="mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-center">
          <div className="text-red-400 font-semibold">🎮 Game Over</div>
          <div className="text-sm text-red-200">All rewards have been distributed</div>
        </div>
      )}

      {/* Bouton refresh manuel */}
      <button
        onClick={handleManualRefresh}
        disabled={isLoading}
        className={`w-full mt-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
          isLoading
            ? 'bg-gray-600 text-white cursor-not-allowed'
            : 'bg-blue-500/20 border border-blue-500 text-blue-400 hover:bg-blue-500/30'
        }`}
      >
        {isLoading ? 'Updating...' : 'Force Refresh'}
      </button>
    </div>
  )
}