import { useState } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { isAddress } from 'viem'
import { useBombandak } from '../hooks/useBombandak'
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contract'

interface TransferModalProps {
  tokenId: bigint
  onClose: () => void
}

export function TransferModal({ tokenId, onClose }: TransferModalProps) {
  const { address } = useAccount()
  const { transfer, isLoading } = useBombandak()
  const [toAddress, setToAddress] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Récupérer l'historique des propriétaires
  const { data: nftData } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getNFTData',
    args: [tokenId],
  })

  const handleTransfer = async () => {
    setError('')
    setSuccess('')

    // Validations
    if (!toAddress.trim()) {
      setError('Please enter a recipient address')
      return
    }

    if (!isAddress(toAddress)) {
      setError('Invalid address format')
      return
    }

    if (toAddress.toLowerCase() === address?.toLowerCase()) {
      setError('Cannot transfer to yourself')
      return
    }

    // Vérifier si l'adresse a déjà possédé le NFT
    if (nftData) {
      const [, , ownerHistory, , ,] = nftData
      const hasOwnedBefore = ownerHistory.some(
        (addr: string) => addr.toLowerCase() === toAddress.toLowerCase()
      )

      if (hasOwnedBefore) {
        setError('Warning: This address has already owned this NFT. It will burn immediately!')
        // On peut laisser l'utilisateur continuer quand même
      }
    }

    try {
      await transfer(toAddress, tokenId)
      setSuccess('Transfer successful! 🎉')
      setTimeout(() => {
        onClose()
      }, 2000)
    } catch (err: any) {
      setError(err?.message || 'Transfer failed')
    }
  }

  const ownerHistory = nftData ? nftData[2] : []

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl max-w-md w-full p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">
            Transfer Bombadak #{tokenId.toString()}
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl"
          >
            ✕
          </button>
        </div>


        {/* Previous Owners */}
        {ownerHistory.length > 0 && (
          <div className="mb-4">
            <h4 className="text-white font-semibold mb-2">Previous Owners (Don't send here!):</h4>
            <div className="bg-gray-800 rounded-lg p-3 max-h-32 overflow-y-auto">
              {ownerHistory.map((addr: string, index) => (
                <div key={index} className="text-red-400 text-sm font-mono break-all">
                  {addr}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Transfer Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-white font-semibold mb-2">
              Recipient Address:
            </label>
            <input
              type="text"
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
              placeholder="0x..."
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleTransfer}
              disabled={isLoading}
              className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${
                isLoading
                  ? 'rounded-xl font-semibold text-lg bg-gray-500 cursor-not-allowed text-gray-300'
                  : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white transform hover:scale-105 transition-all duration-200 shadow-lg'
                    
              }`}
            >
              {isLoading ? 'Transferring...' : 'Transfer'}
            </button>
          </div>

          {/* Messages */}
          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500 rounded text-red-200 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-500/20 border border-green-500 rounded text-green-200 text-sm">
              {success}
            </div>
          )}
        </div>

       
      </div>
    </div>
  )
}