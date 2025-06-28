import { useState, useEffect } from 'react'
import { readContract } from '@wagmi/core'
import { config } from '../config/wagmi'
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contract'
import { useReadContract } from 'wagmi'

interface NFTLeaderboardEntry {
  tokenId: bigint
  transferCount: number
  timeLeft: number
  isAlive: boolean
  isDead: boolean
  ownerHistory: string[]
  currentOwner?: string
}

type LeaderboardType = 'transfers' | 'longevity' | 'deaths'

export function Leaderboard() {
  const [activeTab, setActiveTab] = useState<LeaderboardType>('transfers')
  const [leaderboard, setLeaderboard] = useState<NFTLeaderboardEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Récupérer le nombre total de NFTs
  const { data: totalSupply } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getTotalSupply',
  })

  // Fonction pour récupérer toutes les données des NFTs
  const fetchLeaderboardData = async () => {
    if (!totalSupply) return

    setIsLoading(true)
    const nfts: NFTLeaderboardEntry[] = []
    const total = Number(totalSupply)

    try {
      for (let i = 1; i <= total; i++) {
        const tokenId = BigInt(i)

        try {
          // Récupérer les données du NFT
          const nftData = await readContract(config, {
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'getNFTData',
            args: [tokenId],
          }) as [bigint, bigint, string[], boolean, boolean, bigint]

          const [expiryTime, transferCount, ownerHistory, isAlive, isDead, timeLeft] = nftData

          // Récupérer le propriétaire actuel
          let currentOwner = ''
          try {
            currentOwner = await readContract(config, {
              address: CONTRACT_ADDRESS,
              abi: CONTRACT_ABI,
              functionName: 'ownerOf',
              args: [tokenId],
            }) as string
          } catch {
            // NFT brûlé
          }

          nfts.push({
            tokenId,
            transferCount: Number(transferCount),
            timeLeft: Number(timeLeft),
            isAlive,
               isDead,
            ownerHistory,
            currentOwner
          })

        } catch (error) {
          // NFT n'existe pas, on skip
        }
      }

      setLeaderboard(nfts)
    } catch (error) {
      console.error('Error fetching leaderboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchLeaderboardData()
  }, [totalSupply])

  // Filtrer et trier selon l'onglet actif
  const getFilteredData = () => {
    let filtered = [...leaderboard]

    switch (activeTab) {
      case 'transfers':
        return filtered
          .sort((a, b) => b.transferCount - a.transferCount)
          .slice(0, 10)

      case 'longevity':
        return filtered
          .filter(nft => nft.isAlive && nft.timeLeft > 0)
          .sort((a, b) => b.timeLeft - a.timeLeft)
          .slice(0, 10)

      case 'deaths':
        return filtered
          .filter(nft => nft.isDead || !nft.isAlive || nft.timeLeft <= 0)
          .sort((a, b) => b.transferCount - a.transferCount)
          .slice(0, 10)

      default:
        return []
    }
  }

  // Formater le temps
  const formatTime = (seconds: number) => {
    if (seconds <= 0) return 'Expired'

    const days = Math.floor(seconds / (24 * 60 * 60))
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60))
    const minutes = Math.floor((seconds % (60 * 60)) / 60)

    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  // Raccourcir les adresses
  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const filteredData = getFilteredData()

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 lg:p-8 border border-white/20">
      <h3 className="text-xl lg:text-2xl font-semibold text-white mb-6 text-center">
        🏆 Leaderboard
      </h3>

      {/* Tabs */}
      <div className="flex rounded-lg bg-white/5 p-1 mb-6">
        <button
          onClick={() => setActiveTab('transfers')}
          className={`flex-1 py-2 px-3 rounded-md text-sm font-semibold transition-all ${activeTab === 'transfers'
              ? 'bg-blue-500 text-white'
              : 'text-gray-300 hover:text-white'
            }`}
        >
          Most Transfers
        </button>
        <button
          onClick={() => setActiveTab('longevity')}
          className={`flex-1 py-2 px-3 rounded-md text-sm font-semibold transition-all ${activeTab === 'longevity'
              ? 'bg-green-500 text-white'
              : 'text-gray-300 hover:text-white'
            }`}
        >
          Longest Living
        </button>
        <button
          onClick={() => setActiveTab('deaths')}
          className={`flex-1 py-2 px-3 rounded-md text-sm font-semibold transition-all ${activeTab === 'deaths'
              ? 'bg-red-500 text-white'
              : 'text-gray-300 hover:text-white'
            }`}
        >
          Hall of Death
        </button>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="text-center py-8">
          <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading leaderboard...</p>
        </div>
      ) : (
        /* Leaderboard List */
        <div className="space-y-3">
          {filteredData.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">😴</div>
              <p className="text-gray-400">No data yet</p>
            </div>
          ) : (
            filteredData.map((nft, index) => (
              <div
                key={nft.tokenId.toString()}
                className={`flex items-center justify-between p-4 rounded-lg border transition-all hover:scale-105 ${index === 0
                    ? 'bg-yellow-500/20 border-yellow-500/50 shadow-lg'
                    : index === 1
                      ? 'bg-gray-300/20 border-gray-300/50'
                      : index === 2
                        ? 'bg-orange-500/20 border-orange-500/50'
                        : 'bg-white/5 border-white/20'
                  }`}
              >
                {/* Rank & NFT Info */}
                <div className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${index === 0
                      ? 'bg-yellow-500 text-black'
                      : index === 1
                        ? 'bg-gray-300 text-black'
                        : index === 2
                          ? 'bg-orange-500 text-black'
                          : 'bg-white/20 text-white'
                    }`}>
                    {index === 0 ? '👑' : index + 1}
                  </div>

                  <div>
                    <div className="font-semibold text-white">
                      Bombadak #{nft.tokenId.toString()}
                    </div>
                    <div className="text-sm text-gray-400">
                      Owner: {nft.currentOwner ? shortenAddress(nft.currentOwner) : 'Burned'}
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="text-right">
                  {activeTab === 'transfers' && (
                    <>
                      <div className="text-lg font-bold text-blue-400">
                        {nft.transferCount}
                      </div>
                      <div className="text-sm text-gray-400">transfers</div>
                    </>
                  )}

                  {activeTab === 'longevity' && (
                    <>
                      <div className="text-lg font-bold text-green-400">
                        {formatTime(nft.timeLeft)}
                      </div>
                      <div className="text-sm text-gray-400">remaining</div>
                    </>
                  )}

                  {activeTab === 'deaths' && (
                    <>
                      <div className="text-lg font-bold text-red-400">
                        {nft.transferCount}
                      </div>
                      <div className="text-sm text-gray-400">transfers before death</div>
                    </>
                  )}
                </div>

                {/* Status Badge */}
                <div className={`px-2 py-1 rounded text-xs font-semibold ml-4 ${nft.isAlive && nft.timeLeft > 0
                    ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                    : 'bg-red-500/20 text-red-400 border border-red-500/50'
                  }`}>
                  {nft.isAlive && nft.timeLeft > 0 ? 'ALIVE' : 'DEAD'}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Refresh Button */}
      <button
        onClick={fetchLeaderboardData}
        disabled={isLoading}
        className={`w-full mt-4 py-2 rounded-lg text-sm font-semibold transition-colors ${isLoading
            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
            : 'bg-blue-500/20 border border-blue-500 text-blue-400 hover:bg-blue-500/30'
          }`}
      >
        {isLoading ? 'Loading...' : 'Refresh'}
      </button>
    </div>
  )
}