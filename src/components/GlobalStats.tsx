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

// Cache plus long pour les stats globales
const statsCache = new Map<string, any>()
const CACHE_DURATION = 180000 // 3 minutes

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

  const { data: championInfo, } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getChampionInfo',
  })

  const { data: totalSupply, } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getTotalSupply',
  })

  const { data: contractBalance, } = useBalance({
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

  // Fonction pour traiter les NFTs avec Promise.all optimisé (sans multicall)
  const processNFTsBatch = async (tokenIds: bigint[]) => {
    const cacheKey = `batch-${tokenIds.join('-')}`
    const cachedData = statsCache.get(cacheKey)
    
    if (cachedData && (Date.now() - cachedData.timestamp) < CACHE_DURATION) {
      return cachedData.data
    }

    try {
      console.log(`Processing ${tokenIds.length} NFTs with Promise.all...`)
      
      // Utiliser Promise.all avec délais échelonnés pour éviter 429
      const batchPromises = tokenIds.map(async (tokenId, index) => {
        // Délai échelonné pour répartir la charge
        await sleep(index * 100) // 100ms décalage par NFT
        
        try {
          const data = await readContract(config, {
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'getNFTData',
            args: [tokenId],
          }) as [bigint, bigint, string[], boolean, boolean, bigint]
          
          return { tokenId, nftData: data }
        } catch (err) {
          console.error(`Error fetching NFT #${tokenId}:`, err)
          return { tokenId, nftData: null }
        }
      })
      
      // Exécuter tous les appels en parallèle avec délais
      const results = await Promise.all(batchPromises)

      // Mettre en cache
      statsCache.set(cacheKey, {
        data: results,
        timestamp: Date.now()
      })

      return results

    } catch (error) {
      console.error('Error in Promise.all batch:', error)
      // Fallback séquentiel en dernier recours
      const results = []
      for (const tokenId of tokenIds) {
        try {
          await sleep(80) // Délai plus conservateur
          const data = await readContract(config, {
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'getNFTData',
            args: [tokenId],
          })
          results.push({ tokenId, nftData: data })
        } catch (err) {
          results.push({ tokenId, nftData: null })
        }
      }
      return results
    }
  }

  const calculateGlobalStats = useCallback(async () => {
    if (!totalSupply) return

    const now = Date.now()
    // Éviter les calculs trop fréquents (minimum 1 minute)
    if (now - lastRefresh < 60000) {
      return
    }

    setIsLoading(true)
    const total = Number(totalSupply)
    
    try {
      console.log(`Calculating stats for ${total} NFTs using Promise.all batches...`)
      
      let aliveCount = 0
      let deadCount = 0
      let totalTransferCount = 0
      let longestRealLifetime = 0
      let longestLivingId: bigint | null = null
      const lifetimes: number[] = []

      // Traiter par batches moyens avec Promise.all
      const BATCH_SIZE = 10 // Réduit pour Promise.all sans multicall
      const batches = Math.ceil(total / BATCH_SIZE)

      for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
        const startId = batchIndex * BATCH_SIZE + 1
        const endId = Math.min((batchIndex + 1) * BATCH_SIZE, total)
        
        // Créer le tableau des tokenIds pour ce batch
        const tokenIds: bigint[] = []
        for (let i = startId; i <= endId; i++) {
          tokenIds.push(BigInt(i))
        }

        console.log(`Processing batch ${batchIndex + 1}/${batches} (${tokenIds.length} NFTs)`)

        try {
          const batchResults = await processNFTsBatch(tokenIds)
          
          for (const result of batchResults) {
            if (!result.nftData) {
              deadCount++
              continue
            }

            const { tokenId, nftData } = result
            const [, transferCount, , isAlive, isDead, timeLeft] = nftData
          
            const isNFTAlive = isAlive && !isDead && Number(timeLeft) > 0

            if (isNFTAlive) {
              aliveCount++
              lifetimes.push(Number(timeLeft))
                            
              const estimatedLifetime = (Number(transferCount) + 1) * 86400 - Number(timeLeft)
              if (estimatedLifetime > longestRealLifetime) {
                longestRealLifetime = estimatedLifetime
                longestLivingId = tokenId
              }
            } else {
              deadCount++
              
              const estimatedLifetime = (Number(transferCount) + 1) * 86400
              if (estimatedLifetime > longestRealLifetime) {
                longestRealLifetime = estimatedLifetime
                longestLivingId = tokenId
              }
            }

            totalTransferCount += Number(transferCount)
          }

          // Délai entre batches Promise.all
          if (batchIndex < batches - 1) {
            await sleep(50) // 1s entre batches Promise.all
          }

        } catch (error) {
          console.error(`Error processing batch ${batchIndex}:`, error)
          await sleep(50)
        }
      }

      // Utiliser les infos du champion du contrat si disponible (priorité)
      if (championInfo && championInfo[0] > 0) {
        longestLivingId = championInfo[0]
        longestRealLifetime = Number(championInfo[1])
      }

      const averageLifetime = lifetimes.length > 0 
        ? lifetimes.reduce((a, b) => a + b, 0) / lifetimes.length 
        : 0

      const rewardPoolBalance = contractBalance?.value || 0n
      const formattedBalance = formatEther(rewardPoolBalance)
      
      console.log('Stats calculated with Promise.all batches:', {
        totalMinted: total,
        totalAlive: aliveCount,
        totalDead: deadCount,
        batchesUsed: batches
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

      {/* Reward Pool */}
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

      {/* Barre de progression */}
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

     

      {/* Game over */}
      {gameEnded && (
        <div className="mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-center">
          <div className="text-red-400 font-semibold">🎮 Game Over</div>
          <div className="text-sm text-red-200">All rewards have been distributed</div>
        </div>
      )}

      
    </div>
  )
}