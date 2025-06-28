import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAccount, useReadContract } from 'wagmi'
import { readContract } from '@wagmi/core'
import { config } from '../config/wagmi'
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contract'
import { NFTCard } from './NFTCard'

export function ViewMyNFTs() {
  const { address, isConnected } = useAccount()
  const [isOpen, setIsOpen] = useState(false)
  const [userNFTs, setUserNFTs] = useState<bigint[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Récupérer le nombre total de NFTs
  const { data: totalSupply } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getTotalSupply',
  })

  // Fonction pour vérifier quels NFTs appartiennent à l'utilisateur
  const checkUserNFTs = async () => {
    if (!isConnected || !address || !totalSupply) {
      setUserNFTs([])
      return
    }

    setIsLoading(true)
    const nfts: bigint[] = []
    const total = Number(totalSupply)

    try {
      // Vérifier chaque NFT de 1 à totalSupply
      for (let i = 1; i <= total; i++) {
        const tokenId = BigInt(i)
        
        try {
          // Vérifier qui possède ce NFT
          const owner = await readContract(config, {
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'ownerOf',
            args: [tokenId],
          }) as string

          // Si l'utilisateur connecté possède ce NFT, l'ajouter à la liste
          if (owner.toLowerCase() === address.toLowerCase()) {
            nfts.push(tokenId)
          }
        } catch (error) {
          // NFT n'existe pas ou a été brûlé, on continue
          console.log(`NFT ${tokenId} doesn't exist or is burned`)
        }
      }

      setUserNFTs(nfts)
    } catch (error) {
      console.error('Error checking user NFTs:', error)
      setUserNFTs([])
    } finally {
      setIsLoading(false)
    }
  }

  // Lancer la vérification quand la modal s'ouvre
  useEffect(() => {
    if (isOpen) {
      checkUserNFTs()
    }
  }, [isConnected, address, totalSupply, isOpen])

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

  const handleRefresh = () => {
    checkUserNFTs()
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
              <h3 className="text-2xl font-bold text-white mb-4">Loading Your NFTs...</h3>
            </div>
          ) : userNFTs.length === 0 ? (
            <div className="text-center py-16">
              <h3 className="text-2xl font-bold text-white mb-4">No NFTs Found</h3>
              <p className="text-gray-400 text-lg mb-6">You don't own any Bombandak NFTs yet</p>
              <button 
                onClick={handleClose}
                className="px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 font-semibold transition-all duration-200 transform hover:scale-105"
              >
                Mint Your First NFT
              </button>
            </div>
          ) : (
            <>
              

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
                onClick={handleRefresh}
                disabled={isLoading}
                className={`px-6 py-2 border rounded-lg font-semibold transition-colors ${
                  isLoading 
                    ? 'bg-gray-500/20 border-gray-500 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-500/20 border-blue-500 text-blue-400 hover:bg-blue-500/30'
                }`}
              >
                {isLoading ? 'Loading...' : 'Refresh'}
              </button>
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

      {/* Modal rendue dans le body via portal */}
      {isOpen && createPortal(<Modal />, document.body)}
    </>
  )
}