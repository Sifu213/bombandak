import { useState, useEffect } from 'react'
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

  // Récupérer le champion directement du contrat
  const { data: championInfo } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getChampionInfo',
  })

  // Récupérer le nombre total de NFTs
  const { data: totalSupply, refetch: refetchTotalSupply } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getTotalSupply',
  })

  // Récupérer le balance du contrat (reward pool)
  const { data: contractBalance, refetch: refetchBalance } = useBalance({
    address: CONTRACT_ADDRESS,
  })

  // Récupérer si le jeu est terminé
  const { data: gameEnded } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'gameEnded',
  })

  // Fonction pour calculer les stats globales
  const calculateGlobalStats = async () => {
    if (!totalSupply) return

    setIsLoading(true)
    const total = Number(totalSupply)
    const currentTime = Math.floor(Date.now() / 1000) // Timestamp actuel en secondes
    
    try {
      let aliveCount = 0
      let deadCount = 0
      let totalTransferCount = 0
      let longestRealLifetime = 0
      let longestLivingId: bigint | null = null
      const lifetimes: number[] = []

      // Analyser chaque NFT
      for (let i = 1; i <= total; i++) {
        const tokenId = BigInt(i)

        try {
          // Récupérer les données du NFT (maintenant avec mintTime en premier)
          const nftData = await readContract(config, {
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'getNFTData',
            args: [tokenId],
          }) as [bigint, bigint, string[], boolean, boolean, bigint]

          const [expiryTime, transferCount, ownerHistory, isAlive, isDead, timeLeft] = nftData

          // Récupérer le mintTime depuis nftData directement
          const nftDataStruct = await readContract(config, {
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'nftData',
            args: [tokenId],
          }) as [bigint, bigint, bigint, boolean, boolean]

          const [mintTime] = nftDataStruct

          // Calculer la vraie durée de vie
          let realLifetime: number
          if (isAlive && !isDead && timeLeft > 0n) {
            // NFT vivant : temps depuis le mint
            realLifetime = currentTime - Number(mintTime)
            aliveCount++
            lifetimes.push(Number(timeLeft))
          } else {
            // NFT mort : utiliser le record du contrat ou calculer
            if (championInfo && championInfo[0] === tokenId) {
              realLifetime = Number(championInfo[1]) // lifetime du champion
            } else {
              // Approximation : temps entre mint et mort (expiryTime car reset à la mort)
              realLifetime = Number(expiryTime) - Number(mintTime)
            }
            deadCount++
          }

          // Vérifier si c'est le champion de longévité
          if (realLifetime > longestRealLifetime) {
            longestRealLifetime = realLifetime
            longestLivingId = tokenId
          }

          // Compter les transferts
          totalTransferCount += Number(transferCount)

        } catch (error) {
          // NFT n'existe pas ou erreur
          deadCount++
        }
      }

      // Utiliser les infos du champion du contrat si disponible
      if (championInfo && championInfo[0] > 0) {
        longestLivingId = championInfo[0]
        longestRealLifetime = Number(championInfo[1])
      }

      // Calculer la durée de vie moyenne
      const averageLifetime = lifetimes.length > 0 
        ? lifetimes.reduce((a, b) => a + b, 0) / lifetimes.length 
        : 0

      // Formater le balance du contrat
      const rewardPoolBalance = contractBalance?.value || 0n
      const formattedBalance = formatEther(rewardPoolBalance)
      
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
          formatted: parseFloat(formattedBalance).toFixed(4)
        }
      })

    } catch (error) {
      console.error('Error calculating global stats:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Calculer les stats au chargement
  useEffect(() => {
    if (totalSupply) {
      calculateGlobalStats()
    }
  }, [totalSupply, championInfo, contractBalance])

  // Auto-refresh toutes les 30 secondes
  useEffect(() => {
    const interval = setInterval(() => {
      refetchTotalSupply()
      refetchBalance()
      calculateGlobalStats()
    }, 30000)

    return () => clearInterval(interval)
  }, [totalSupply])

  // Fonction pour rafraîchir manuellement
  const handleManualRefresh = async () => {
    await Promise.all([
      refetchTotalSupply(),
      refetchBalance(),
      calculateGlobalStats()
    ])
  }

  // Formater le temps en format lisible
  const formatTime = (seconds: number) => {
    if (seconds <= 0) return 'Expired'
    
    const days = Math.floor(seconds / (24 * 60 * 60))
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60))
    const minutes = Math.floor((seconds % (60 * 60)) / 60)
    
    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
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
          <span className="text-xs text-gray-400">Auto-refresh: 30s</span>
        </div>
      </div>

      {/* Reward Pool - Section prominente */}
      <div className="border border-white-20 rounded-lg p-4 mb-4">
        <div className="text-center">
          <div className="text-yellow-400 font-semibold mb-2 flex items-center justify-center gap-2">
            Reward Pool
          </div>
          <div className="text-2xl lg:text-3xl font-bold text-white mb-1">
            {stats.rewardPool.formatted} MON
          </div>
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
          <div className="text-2xl font-bold text-yellow-400">{stats.totalMinted}</div>
          <div className="text-sm text-white">Total Minted</div>
        </div>
        <div className="bg-white/5 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-400">{stats.totalAlive}</div>
          <div className="text-sm text-white">Alive</div>
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
        
        {stats.longestLiving.tokenId && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mt-4">
            <div className="text-center">
              <div className="text-green-400 font-semibold mb-1">Longest Living Bombadak</div>
              <div className="text-white font-bold">
                #{stats.longestLiving.tokenId.toString()}
              </div>
              <div className="text-green-300 text-sm">
                Lived: {formatTime(stats.longestLiving.realLifetime)}
              </div>
            </div>
          </div>
        )}
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
        {isLoading ? 'Updating...' : 'Refresh'}
      </button>
    </div>
  )
}