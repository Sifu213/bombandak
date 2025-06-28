import { useState } from 'react'
import { useAccount } from 'wagmi'
import { useBombandak } from '../hooks/useBombandak'

export function MintButton() {
  const { isConnected } = useAccount()
  const { mint, hasMinted, isLoading } = useBombandak()
  const [error, setError] = useState<string>('')

  const handleMint = async () => {
    if (!isConnected) {
      setError('Please connect your wallet first')
      return
    }

    if (hasMinted) {
      setError('You have already minted a Bombandak!')
      return
    }

    try {
      setError('')
      await mint()
    } catch (err: any) {
      setError(err?.message || 'Failed to mint')
    }
  }

  const getButtonText = () => {
    if (!isConnected) return 'Connect Wallet to Mint'
    if (hasMinted) return 'Already Minted'
    if (isLoading) return 'Minting...'
    return 'Mint (1 MON)'
  }

  const isDisabled = !isConnected || hasMinted || isLoading

  return (
    <div>
      <button 
  onClick={handleMint}
  disabled={isDisabled}
  className={
    isDisabled
      ? 'w-full py-4 rounded-xl font-semibold text-lg bg-gray-500 cursor-not-allowed text-gray-300'
      : 'w-full py-4 rounded-xl font-semibold text-lg bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white transform hover:scale-105 transition-all duration-200 shadow-lg'
  }
>
  {getButtonText()}
</button>
      
      {error && (
        <div className="mt-2 p-2 bg-red-500/20 border border-red-500 rounded text-red-200 text-sm">
          {error}
        </div>
      )}
    </div>
  )
}