import { useState, useEffect } from 'react'
import { readContract } from '@wagmi/core'
import { config } from '../config/wagmi'
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contract'
import { useReadContract } from 'wagmi'

interface NFTLeaderboardEntry {
  tokenId: bigint
  transferCount: number
  timeLeft: number
  realLifetime: number // ← Nouveau : vraie longévité
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
    const currentTime = Math.floor(Date.now() / 1000) // Timestamp actuel

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

          // Récupérer le mintTime
          const nftDataStruct = await readContract(config, {
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'nftData',
            args: [tokenId],
          }) as [bigint, bigint, bigint, boolean, boolean]

          const [mintTime] = nftDataStruct

          let realLifetime: number
          if (isAlive && !isDead && timeLeft > 0n) {
          
            realLifetime = currentTime - Number(mintTime)
          } else {
            
            realLifetime = Number(expiryTime) - Number(mintTime)
          }

        
          let currentOwner = ''
          try {
            currentOwner = await readContract(config, {
              address: CONTRACT_ADDRESS,
              abi: CONTRACT_ABI,
              functionName: 'ownerOf',
              args: [tokenId],
            }) as string
          } catch {
            
          }

          nfts.push({
            tokenId,
            transferCount: Number(transferCount),
            timeLeft: Number(timeLeft),
            realLifetime, 
            isAlive,
            isDead,
            ownerHistory,
            currentOwner
          })

        } catch (error) {
          
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


  const getFilteredData = () => {
    let filtered = [...leaderboard]

    switch (activeTab) {
      case 'transfers':
        return filtered
          .sort((a, b) => b.transferCount - a.transferCount)
          .slice(0, 5)

      case 'longevity':
        
        return filtered
          .sort((a, b) => b.realLifetime - a.realLifetime)
          .slice(0, 5)

      case 'deaths':
        return filtered
          .filter(nft => nft.isDead || !nft.isAlive || nft.timeLeft <= 0)
          .sort((a, b) => b.realLifetime - a.realLifetime) 
          .slice(0, 5)

      default:
        return []
    }
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

  
  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const filteredData = getFilteredData()

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 lg:p-8 border border-white/20">
      <h3 className="text-xl lg:text-2xl font-semibold text-white mb-6">
        Leaderboard
      </h3>

   
      <div className="flex rounded-lg bg-white/5 p-1 mb-6">
        <button
          onClick={() => setActiveTab('transfers')}
          className={`flex-1 py-2 px-3 rounded-md text-xs font-semibold transition-all ${
            activeTab === 'transfers'
              ? 'border border-white text-white'
              : 'text-gray-300 hover:text-white'
          }`}
        >
          Most Transfers
        </button>
        <button
          onClick={() => setActiveTab('longevity')}
          className={`flex-1 py-2 px-3 rounded-md text-xs font-semibold transition-all ${
            activeTab === 'longevity'
              ? 'border border-white text-white'
              : 'text-gray-300 hover:text-white'
          }`}
        >
          Longest Ticked
        </button>
        <button
          onClick={() => setActiveTab('deaths')}
          className={`flex-1 py-2 px-3 rounded-md text-xs font-semibold transition-all ${
            activeTab === 'deaths'
              ? 'border border-white text-white'
              : 'text-gray-300 hover:text-white'
          }`}
        >
          Hall of Death
        </button>
      </div>


      {isLoading ? (
        <div className="text-center py-8">
          <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading leaderboard...</p>
        </div>
      ) : (
      
        <div className="space-y-3">
          {filteredData.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400">No data yet</p>
            </div>
          ) : (
            filteredData.map((nft, index) => (
              <div
                key={nft.tokenId.toString()}
                className={`flex items-center justify-between p-4 rounded-lg border  ${
                  index === 0
                    ? 'bg-yellow-500/20 border-yellow-500/50 shadow-lg'
                    : index === 1
                    ? 'bg-gray-300/20 border-gray-300/50'
                    : index === 2
                    ? 'bg-orange-500/20 border-orange-500/50'
                    : 'bg-white/5 border-white/20'
                }`}
              >
                
                <div className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                    index === 0
                      ? 'bg-yellow-500 text-black'
                      : index === 1
                      ? 'bg-gray-300 text-black'
                      : index === 2
                      ? 'bg-orange-500 text-black'
                      : 'bg-white/20 text-white'
                  }`}>
                    {index === 0 ? '1' : index + 1}
                  </div>

                  <div>
                    <div className="font-semibold text-white">
                      Bombadak #{nft.tokenId.toString()}
                    </div>
                    <div className="text-xs text-gray-400">
                      {nft.currentOwner ? shortenAddress(nft.currentOwner) : 'Exploded'}
                    </div>
                  </div>
                </div>

                
                <div className="text-right">
                  {activeTab === 'transfers' && (
                    <>
                      <div className="text-sm font-bold text-blue-400">
                        {nft.transferCount}
                      </div>
                      <div className="text-xs text-gray-400">transfers</div>
                    </>
                  )}

                  {activeTab === 'longevity' && (
                    <>
                      <div className="text-sm font-bold text-green-400">
                        {formatTime(nft.realLifetime)}
                      </div>
                      <div className="text-xs text-gray-400">
                        {nft.isAlive && nft.timeLeft > 0 ? 'ticked so far' : 'total ticked'}
                      </div>
                    </>
                  )}

                  {activeTab === 'deaths' && (
                    <>
                      <div className="text-sm font-bold text-red-400">
                        {formatTime(nft.realLifetime)}
                      </div>
                      <div className="text-xs text-gray-400">Total Ticked</div>
                    </>
                  )}
                </div>

                
                <div className={`px-2 py-1 rounded text-xs font-semibold ml-4 ${
                  nft.isAlive && !nft.isDead && nft.timeLeft > 0
                    ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                    : 'bg-red-500/20 text-red-400 border border-red-500/50'
                }`}>
                  {nft.isAlive && !nft.isDead && nft.timeLeft > 0 ? 'ALIVE' : 'EXPLODED'}
                </div>
              </div>
            ))
          )}
        </div>
      )}

    
      <button
        onClick={fetchLeaderboardData}
        disabled={isLoading}
        className={`w-full mt-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
          isLoading
            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
            : 'bg-blue-500/20 border border-blue-500 text-blue-400 hover:bg-blue-500/30'
        }`}
      >
        {isLoading ? 'Loading...' : 'Refresh Rankings'}
      </button>
    </div>
  )
}