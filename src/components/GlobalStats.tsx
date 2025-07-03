import { useNFTData } from '../components/NFTDataContext'

export function GlobalStats() {
  const { 
    globalStats, 
    isLoading,  
    getMintTimeLeft,
    isMintStillActive,
    gameEnded
  } = useNFTData()

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
          
        </div>
      </div>

      {/* Mint Deadline Countdown */}
      {isMintStillActive() && (
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
      {!isMintStillActive() && !gameEnded && (
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
            {globalStats.rewardPool.formatted} MON
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
          <div className="text-1xl font-bold text-yellow-400">{globalStats.totalMinted}/500</div>
          <div className="text-sm text-white">Total Minted</div>
        </div>
        <div className="bg-white/5 rounded-lg p-3 text-center">
          <div className="text-1xl font-bold text-green-400">{globalStats.totalAlive}</div>
          <div className="text-sm text-white">Ticking</div>
        </div>
        <div className="bg-white/5 rounded-lg p-3 text-center">
          <div className="text-1xl font-bold text-red-400">{globalStats.totalDead}</div>
          <div className="text-sm text-white">Exploded</div>
        </div>
      </div>

      {/* Stats détaillées */}
      <div className="space-y-3 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-white">Total Transfers:</span>
          <span className="text-blue-400 font-semibold">{globalStats.totalTransfers}</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-white">Avg Remaining:</span>
          <span className="text-purple-400 font-semibold">{formatTime(globalStats.averageLifetime)}</span>
        </div>
      </div>

      {/* Barre de progression */}
      {globalStats.totalMinted > 0 && (
        <div className="mt-4">
          <div className="flex justify-between text-xs text-white mb-1">
            <span>Survival Rate</span>
            <span>{Math.round((globalStats.totalAlive / globalStats.totalMinted) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${(globalStats.totalAlive / globalStats.totalMinted) * 100}%` }}
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