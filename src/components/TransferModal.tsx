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
  const [isTransferring, setIsTransferring] = useState(false)
  const [txStatus, setTxStatus] = useState<'idle' | 'pending' | 'confirming' | 'confirmed' | 'failed'>('idle')


  const { data: nftData } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getNFTData',
    args: [tokenId],
  })

  const handleTransfer = async () => {
    setError('')
    setSuccess('')
    setTxStatus('idle')

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

    if (nftData) {
      const [, , ownerHistory, , ,] = nftData
      const hasOwnedBefore = ownerHistory.some(
        (addr: string) => addr.toLowerCase() === toAddress.toLowerCase()
      )

      if (hasOwnedBefore) {
        setError('Warning: This address has already owned this NFT. It will explode immediately!')
        
      }
    }

    try {
      setIsTransferring(true)
      setTxStatus('pending')
      
      // Lancer la transaction
      await transfer(toAddress, tokenId)
      
      // Transaction envoyée avec succès
      setTxStatus('confirming')
      
      // Fermer la modal après 3 secondes
      setTimeout(() => {
        onClose()
      }, 5000)
      
    } catch (err: any) {
      setTxStatus('failed')
      console.error('Transfer error:', err)
      
      // Gestion des différents types d'erreurs
      if (err?.message?.includes('User rejected') || 
          err?.message?.includes('user rejected') ||
          err?.message?.includes('User denied') ||
          err?.code === 4001) {
        setError('Transaction cancelled by user')
      } else if (err?.message?.includes('insufficient funds')) {
        setError('Insufficient funds to pay for gas')
      } else if (err?.message?.includes('NFT is dead')) {
        setError('This NFT has already exploded and cannot be transferred')
      } else if (err?.message?.includes('Not the owner')) {
        setError('You are not the owner of this NFT')
      } else if (err?.message?.includes('NFT has expired')) {
        setError('This NFT has expired and cannot be transferred')
      } else {
        setError(`Transfer failed: ${err?.message || 'Unknown error'}`)
      }
    } finally {
      setIsTransferring(false)
    }
  }

  const getStatusMessage = () => {
    switch (txStatus) {
      case 'pending':
        return 'Please confirm the transaction in your wallet...'
      case 'confirming':
        return 'Transaction confirmed, processing...'
      case 'confirmed':
        return 'Transfer completed successfully!'
      case 'failed':
        return 'Transfer failed'
      default:
        return ''
    }
  }

  const ownerHistory = nftData ? nftData[2] : []
  const isProcessing = isTransferring || isLoading

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
            disabled={isProcessing}
            className="text-gray-400 hover:text-white text-xl disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        {/* Status Message */}
        {txStatus !== 'idle' && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${
            txStatus === 'failed' ? 'bg-red-500/20 border border-red-500 text-red-200' :
            txStatus === 'confirmed' ? 'bg-green-500/20 border border-green-500 text-green-200' :
            'bg-blue-500/20 border border-blue-500 text-blue-200'
          }`}>
            {getStatusMessage()}
          </div>
        )}

        {/* Previous Owners */}
        {ownerHistory.length > 0 && (
          <div className="mb-4">
            <h4 className="text-white font-semibold mb-2">⚠️ Previous Owners (Sending here will explode the NFT!):</h4>
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
              disabled={isProcessing}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="flex-1 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleTransfer}
              disabled={isProcessing || !toAddress.trim()}
              className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${
                isProcessing || !toAddress.trim()
                  ? 'bg-gray-500 cursor-not-allowed text-gray-300'
                  : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white transform hover:scale-105 transition-all duration-200 shadow-lg'
              }`}
            >
              {isProcessing ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  {txStatus === 'pending' ? 'Waiting...' : 'Processing...'}
                </div>
              ) : (
                'Transfer'
              )}
            </button>
          </div>

          {/* Messages */}
          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500 rounded text-red-200 text-sm">
              {error}
            </div>
          )}

          {success && txStatus === 'confirming' && (
            <div className="p-3 bg-green-500/20 border border-green-500 rounded text-green-200 text-sm">
              {success}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}