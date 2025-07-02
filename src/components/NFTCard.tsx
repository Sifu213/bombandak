import { useState, useEffect } from 'react'
import { useReadContract } from 'wagmi'
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contract'
import { TransferModal } from './TransferModal'

interface NFTCardProps {
  tokenId: bigint
}

export function NFTCard({ tokenId }: NFTCardProps) {
  const [showTransfer, setShowTransfer] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [isImageLoading, setIsImageLoading] = useState(true)
  const [imageError, setImageError] = useState(false)

  const { data: nftData } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getNFTData',
    args: [tokenId],
  })

  const { data: tokenURI } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'tokenURI',
    args: [tokenId],
  })

  useEffect(() => {
    const fetchImageFromMetadata = async () => {
      if (!tokenURI) return
      
      setIsImageLoading(true)
      setImageError(false)
      
      try {
        const metadataUrl = tokenURI.startsWith('ipfs://') 
          ? tokenURI.replace('ipfs://', 'https://ipfs.io/ipfs/')
          : tokenURI
        
        const response = await fetch(metadataUrl)
        const metadata = await response.json()
        
        if (metadata.image) {
          const imageUrl = metadata.image.startsWith('ipfs://') 
            ? metadata.image.replace('ipfs://', 'https://ipfs.io/ipfs/')
            : metadata.image
          setImageUrl(imageUrl)
        } else {
          setImageError(true)
        }
      } catch (error) {
        console.error('Error fetching NFT metadata:', error)
        setImageUrl(null)
        setImageError(true)
      } finally {
        setIsImageLoading(false)
      }
    }

    fetchImageFromMetadata()
  }, [tokenURI])

  if (!nftData) {
    return (
      <div className="bg-gray-800 rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-gray-700 rounded mb-2"></div>
        <div className="h-4 bg-gray-700 rounded mb-2"></div>
        <div className="h-8 bg-gray-700 rounded"></div>
      </div>
    )
  }

  const [, transferCount, ownerHistory, isAlive, isDead, timeLeft] = nftData

  const formatTimeLeft = (seconds: bigint) => {
    const totalSeconds = Number(seconds)
    if (totalSeconds <= 0) return 'EXPLODED'

    const days = Math.floor(totalSeconds / (24 * 60 * 60))
    const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60))
    const minutes = Math.floor((totalSeconds % (60 * 60)) / 60)

    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const getStatusColor = () => {
    if (isDead || !isAlive) return 'border-red-500 bg-red-500/10'
    if (Number(timeLeft) < 24 * 60 * 60) return 'border-orange-500 bg-orange-500/10' // < 1 day
    if (Number(timeLeft) < 3 * 24 * 60 * 60) return 'border-yellow-500 bg-yellow-500/10' // < 3 days
    return 'border-green-500 bg-green-500/10' // Safe
  }

  const handleImageLoad = () => {
    setIsImageLoading(false)
    setImageError(false)
  }

  const handleImageError = () => {
    setIsImageLoading(false)
    setImageError(true)
  }

  return (
    <>
      <div className={`rounded-xl p-4 border-2 ${getStatusColor()}`}>
        
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-lg font-bold text-white">
            Bombandak #{tokenId.toString()}
          </h3>
          <span className={`px-2 py-1 rounded text-xs font-semibold ${
            isAlive && timeLeft > 0n ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
          }`}>
            {isAlive ? 'ALIVE' : 'EXPLODED'}
          </span>
        </div>

        {/* Section Image avec gestion du loading */}
        {tokenURI && (
          <div className="mb-3 relative">
            {/* Skeleton loader pendant le chargement */}
            {isImageLoading && (
              <div className="w-full h-48 bg-gray-600 rounded-lg animate-pulse flex items-center justify-center">
                <div className="text-gray-400 text-sm">Loading image...</div>
              </div>
            )}
            
            {/* Image réelle */}
            {imageUrl && !imageError && (
              <img
                src={imageUrl}
                alt={`Bombandak #${tokenId}`}
                className={`w-full h-auto object-cover rounded-lg transition-opacity duration-300 ${
                  isImageLoading ? 'opacity-0 absolute inset-0' : 'opacity-100'
                }`}
                onLoad={handleImageLoad}
                onError={handleImageError}
              />
            )}
            
            {/* Fallback en cas d'erreur */}
            {(imageError || (!imageUrl && !isImageLoading)) && (
              <div className="w-full h-auto bg-gray-700 rounded-lg flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <div className="text-4xl mb-2">💣</div>
                  <div className="text-sm">Image not available</div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mb-3">
          <div className="text-sm text-gray-400 mb-1">Time Left:</div>
          <div className={`text-xl font-bold ${
            Number(timeLeft) < 24 * 60 * 60 ? 'text-red-400' : 'text-green-400'
          }`}>
            {formatTimeLeft(timeLeft)}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
          <div>
            <div className="text-gray-400">Transfers:</div>
            <div className="text-white font-semibold">{transferCount.toString()}</div>
          </div>
          <div>
            <div className="text-gray-400">Owners:</div>
            <div className="text-white font-semibold">{ownerHistory.length}</div>
          </div>
        </div>

        {isAlive && (
          <button
            onClick={() => setShowTransfer(true)}
            className="w-full py-2 rounded-xl font-semibold text-lg bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white transform hover:scale-105 transition-all duration-200 shadow-lg"
          >
            Transfer
          </button>
        )}

        {!isAlive && (
          <div className="w-full py-2 bg-red-500/20 text-red-400 text-center rounded-lg font-semibold">
            NFT exploded
          </div>
        )}
      </div>

      {showTransfer && (
        <TransferModal
          tokenId={tokenId}
          onClose={() => setShowTransfer(false)}
        />
      )}
    </>
  )
}