import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useAccount } from 'wagmi'
import { readContract } from '@wagmi/core'
import { config } from '../config/wagmi'
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contract'
import { NFTCard } from './NFTCard'
import { useNFTData } from '../components/NFTDataContext'

export function ViewMyNFTs() {
  const { address, isConnected } = useAccount()
  const [isOpen, setIsOpen] = useState(false)
  const [userNFTs, setUserNFTs] = useState<bigint[]>([])
  const [isLoadingOwnership, setIsLoadingOwnership] = useState(false)
  const [lastOwnershipCheck, setLastOwnershipCheck] = useState<number | null>(null)
  
  // Utiliser le contexte NFT pour éviter les appels redondants
  const { nftData, globalStats, isLoading: isLoadingNFTData } = useNFTData()

  // Cache pour éviter les vérifications de propriété trop fréquentes
  const OWNERSHIP_CACHE_DURATION = 30 * 1000 // 30 secondes

  // Récupérer le nombre total de NFTs depuis le contexte
  const totalSupply = useMemo(() => {
    return globalStats.totalMinted
  }, [globalStats.totalMinted])

  // Fonction optimisée pour vérifier quels NFTs appartiennent à l'utilisateur
  const checkUserNFTs = async () => {
    if (!isConnected || !address || totalSupply === 0) {
      setUserNFTs([])
      return
    }

    // Vérifier le cache
    if (lastOwnershipCheck && Date.now() - lastOwnershipCheck < OWNERSHIP_CACHE_DURATION) {
      return
    }

    setIsLoadingOwnership(true)
    

    try {
      // Utiliser les données du contexte pour savoir quels NFTs existent
      const existingTokenIds = nftData.map(nft => nft.tokenId)
      
      // Vérifier seulement les NFTs qui existent réellement
      const ownershipPromises = existingTokenIds.map(async (tokenId) => {
        try {
          const owner = await readContract(config, {
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'ownerOf',
            args: [BigInt(tokenId)],
          }) as string

          if (owner.toLowerCase() === address.toLowerCase()) {
            return BigInt(tokenId)
          }
          return null
        } catch (error) {
          console.log(`NFT ${tokenId} doesn't exist or is burned`)
          return null
        }
      })

      // Attendre tous les appels en parallèle
      const results = await Promise.all(ownershipPromises)
      const validNFTs = results.filter(tokenId => tokenId !== null) as bigint[]
      
      setUserNFTs(validNFTs)
      setLastOwnershipCheck(Date.now())
    } catch (error) {
      console.error('Error checking user NFTs:', error)
      setUserNFTs([])
    } finally {
      setIsLoadingOwnership(false)
    }
  }

  // Version alternative si on veut éviter complètement les appels ownerOf
  const checkUserNFTsFromContext = () => {
    if (!isConnected || !address || !nftData.length) {
      setUserNFTs([])
      return
    }

    // Filtrer les NFTs basés sur l'historique des propriétaires
    const userOwnedNFTs = nftData
      .filter(nft => {
        // Vérifier si l'utilisateur actuel est le dernier propriétaire
        const lastOwner = nft.ownerHistory[nft.ownerHistory.length - 1]
        return lastOwner && lastOwner.toLowerCase() === address.toLowerCase()
      })
      .map(nft => BigInt(nft.tokenId))

    setUserNFTs(userOwnedNFTs)
    setLastOwnershipCheck(Date.now())
  }

  // Lancer la vérification quand la modal s'ouvre
  useEffect(() => {
    if (isOpen && nftData.length > 0) {
      // Utiliser la version optimisée avec les données du contexte
      if (nftData.some(nft => nft.ownerHistory.length > 0)) {
        // Si on a l'historique des propriétaires, l'utiliser
        checkUserNFTsFromContext()
      } else {
        // Sinon, faire les appels ownerOf mais de manière optimisée
        checkUserNFTs()
      }
    }
  }, [isConnected, address, nftData, isOpen])

  const handleOpen = () => {
    if (!isConnected) {
      alert('Please connect your wallet first')
      return
    }
    setIsOpen(true)
  }

  const handleClose = () => {
    setIsOpen(false)
  }

  

  // Empêcher le scroll du body quand la modal est ouverte
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  // Calculer l'état de chargement combiné
  const isLoading = isLoadingNFTData || isLoadingOwnership

  // Données enrichies des NFTs utilisateur
  const enrichedUserNFTs = useMemo(() => {
    return userNFTs.map(tokenId => {
      const nftInfo = nftData.find(nft => nft.tokenId === Number(tokenId))
      return {
        tokenId,
        ...nftInfo
      }
    })
  }, [userNFTs, nftData])

  // Composant Modal séparé
  const Modal = () => (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={handleClose}
      />
      
      {/* Modal Content */}
      <div className="relative bg-gray-900 rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden shadow-2xl border border-white/20">
        {/* Header */}
        <div className="bg-[#200052] p-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-1xl font-bold text-white mb-2">My Collection</h2>
              <p className="text-blue-100">
                {isLoading ? 'Loading your NFTs...' : `Connected: ${address?.slice(0, 6)}...${address?.slice(-4)}`}
              </p>
              {/* Informations supplémentaires */}
              {!isLoading && isConnected && (
                <div className="flex gap-4 mt-2 text-sm text-blue-200">
                  <span>Owned: {userNFTs.length}</span>
                  <span>Total Supply: {totalSupply}</span>
                  {lastOwnershipCheck && (
                    <span>Last check: {new Date(lastOwnershipCheck).toLocaleTimeString()}</span>
                  )}
                </div>
              )}
            </div>
            <button 
              onClick={handleClose}
              className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-3 transition-all duration-200 transform hover:scale-110"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          {!isConnected ? (
            <div className="text-center py-16">
              <div className="text-8xl mb-6">🔌</div>
              <h3 className="text-2xl font-bold text-white mb-4">Connect Your Wallet</h3>
              <p className="text-gray-400 text-lg">Connect your wallet to view your NFT collection</p>
            </div>
          ) : isLoading ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <h3 className="text-2xl font-bold text-white mb-4">Loading Your NFTs...</h3>
              <p className="text-gray-400">
                {isLoadingNFTData ? 'Fetching NFT data...' : 'Checking ownership...'}
              </p>
            </div>
          ) : userNFTs.length === 0 ? (
            <div className="text-center py-16">
              <h3 className="text-2xl font-bold text-white mb-4">No NFTs Found</h3>
              <p className="text-gray-400 text-lg mb-6">You don't own any Bombandak NFTs yet</p>
              {totalSupply > 0 && (
                <div className="text-sm text-blue-400">
                  Total supply: {totalSupply} NFTs minted
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Stats rapides */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-yellow-400">{userNFTs.length}</div>
                  <div className="text-xs text-white">Owned</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-green-400">
                    {enrichedUserNFTs.filter(nft => nft.isAlive && nft.timeLeft && nft.timeLeft > 0).length}
                  </div>
                  <div className="text-xs text-white">Alive</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-red-400">
                    {enrichedUserNFTs.filter(nft => nft.isDead || (nft.timeLeft && nft.timeLeft <= 0)).length}
                  </div>
                  <div className="text-xs text-white">Dead</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-blue-400">
                    {enrichedUserNFTs.reduce((sum, nft) => sum + (nft.transferCount || 0), 0)}
                  </div>
                  <div className="text-xs text-white">Transfers</div>
                </div>
              </div>

              {/* NFTs Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-6">
                {userNFTs.map((tokenId) => (
                  <div key={tokenId.toString()} >
                    <NFTCard tokenId={tokenId} />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {isConnected && (
          <div className="border-t border-white/20 bg-gray-800/50 p-4">
            <div className="flex justify-center gap-4">
              
              <button 
                onClick={handleClose}
                className="px-6 py-2 bg-purple-500/20 border border-purple-500 text-purple-400 rounded-lg hover:bg-purple-500/30 font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <>
      <button 
        onClick={handleOpen}
        className="w-full py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 font-semibold text-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
      >
        View & Manage my NFTs
      </button>

      {isOpen && createPortal(<Modal />, document.body)}
    </>
  )
}