import { useState } from 'react'
import { useNFTData } from '../components/NFTDataContext'

type LeaderboardType = 'transfers' | 'longevity' | 'deaths'

export function Leaderboard() {
  const [activeTab, setActiveTab] = useState<LeaderboardType>('transfers')
  const { getLeaderboardData, isLoading } = useNFTData()

  const getFilteredData = () => {
    const leaderboardData = getLeaderboardData()
    let filtered = [...leaderboardData]

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
    const secs = seconds % 60

    if (days > 0) return `${days}d ${hours}h ${minutes}m`
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`
    if (minutes > 0) return `${minutes}m ${secs}s`
    return `${secs}s`
  }

  

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const getLastOwner = (ownerHistory: string[]) => {
    return ownerHistory[ownerHistory.length - 1] || 'Unknown'
  }

  const filteredData = getFilteredData()

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 lg:p-8 border border-white/20">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl lg:text-2xl font-semibold text-white">
          Leaderboard
        </h3>
        <div className="flex items-center gap-2">
          {isLoading && (
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
          )}
          
        </div>
      </div>

      {/* Tabs */}
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

      {/* Loading state */}
      {isLoading ? (
        <div className="text-center py-8">
          <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading leaderboard...</p>
          <p className="text-xs text-gray-500 mt-2">Using shared NFT data</p>
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
                className={`flex items-center justify-between p-4 rounded-lg border ${
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
                    {index + 1}
                  </div>

                  <div>
                    <div className="font-semibold text-white">
                      Bombadak #{nft.tokenId.toString()}
                    </div>
                    <div className="text-xs text-gray-400">
                      {shortenAddress(getLastOwner(nft.ownerHistory))}
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
                        {(nft.isAlive && nft.timeLeft > 0) ? 'ticked so far' : 'total ticked'}
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
                  (nft.isAlive && nft.timeLeft > 0)
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  {(nft.isAlive && nft.timeLeft > 0) ? 'Ticking' : 'Exploded'}
                </div>
              </div>
            ))
          )}
        </div>
      )}

     
    </div>
  )
}