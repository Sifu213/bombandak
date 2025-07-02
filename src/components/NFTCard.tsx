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
  const [useLocalFallback, setUseLocalFallback] = useState(false)
  const [loadingTimeout, setLoadingTimeout] = useState<number | null>(null)

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

  // Déterminer quelle image locale utiliser selon l'état du NFT
  const getLocalImagePath = () => {
    if (!nftData) return '/bombandak.png'

    const [, , , isAlive, isDead, timeLeft] = nftData

    if (isDead || !isAlive || Number(timeLeft) <= 0) {
      return '/bombandakexploded.png'
    } else {
      return '/bombandak.png'
    }
  }

  useEffect(() => {
    const fetchImageFromIPFS = async () => {
      if (!tokenURI) return

      setIsImageLoading(true)
      setUseLocalFallback(false)

      // Timeout pour basculer sur les images locales après 10 secondes
      const timeout = setTimeout(() => {
        console.log('IPFS timeout, switching to local images')
        setUseLocalFallback(true)
        setIsImageLoading(false)
      }, 5000) // 10 secondes

      setLoadingTimeout(timeout)

      try {
        const metadataUrl = tokenURI.startsWith('ipfs://')
          ? tokenURI.replace('ipfs://', 'https://ipfs.io/ipfs/')
          : tokenURI

        console.log('Fetching metadata from:', metadataUrl)
        const response = await fetch(metadataUrl)

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const metadata = await response.json()

        if (metadata.image) {
          const imageUrl = metadata.image.startsWith('ipfs://')
            ? metadata.image.replace('ipfs://', 'https://ipfs.io/ipfs/')
            : metadata.image

          console.log('IPFS image found:', imageUrl)
          setImageUrl(imageUrl)
          clearTimeout(timeout)
          setIsImageLoading(false)
        } else {
          throw new Error('No image in metadata')
        }
      } catch (error) {
        console.error('Error fetching NFT metadata from IPFS:', error)
        clearTimeout(timeout)
        setUseLocalFallback(true)
        setIsImageLoading(false)
      }
    }

    fetchImageFromIPFS()

    // Cleanup timeout on unmount
    return () => {
      if (loadingTimeout) {
        clearTimeout(loadingTimeout)
      }
    }
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

  const handleIPFSImageError = () => {
    console.log('IPFS image failed to load, switching to local fallback')
    setUseLocalFallback(true)
    setIsImageLoading(false)
  }



  return (
    <>
      <div className={`rounded-xl p-4 border-2 ${getStatusColor()}`}>

        <div className="flex justify-between items-start mb-3">
          <h3 className="text-lg font-bold text-white">
            Bombandak #{tokenId.toString()}
          </h3>
          <span className={`px-2 py-1 rounded text-xs font-semibold ${isAlive && timeLeft > 0n ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
            }`}>
            {isAlive && timeLeft > 0n ? 'TICKING' : 'EXPLODED'}
          </span>
        </div>


        <div className="mb-3 relative">


          {/* Image IPFS (priorité) */}
          {!isImageLoading && !useLocalFallback && imageUrl && (
            <div className="relative">
              <img
                src={imageUrl}
                alt={`Bombandak #${tokenId}`}
                className="w-full h-auto object-cover rounded-lg"
                onError={handleIPFSImageError}
              />

            </div>
          )}

          {/* Image locale (fallback) */}
          {!isImageLoading && useLocalFallback && (
            <div className="relative">
              <img
                src={getLocalImagePath()}
                alt={`Bombandak #${tokenId} - ${isAlive && timeLeft > 0n ? 'Ticking' : 'Exploded'}`}
                className="w-full h-auto object-cover rounded-lg"

              />

            </div>
          )}


        </div>

        <div className="mb-3">
          <div className="text-sm text-gray-400 mb-1">Time Left:</div>
          <div className={`text-xl font-bold ${Number(timeLeft) < 24 * 60 * 60 ? 'text-red-400' : 'text-green-400'
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

        {isAlive && timeLeft > 0n && (
          <button
            onClick={() => setShowTransfer(true)}
            className="w-full py-2 rounded-xl font-semibold text-lg bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white transform hover:scale-105 transition-all duration-200 shadow-lg"
          >
            Transfer
          </button>
        )}

        {(!isAlive || timeLeft <= 0n) && (
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