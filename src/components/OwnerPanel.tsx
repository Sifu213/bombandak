import { useState } from 'react'
import { useBombandak } from '../hooks/useBombandak'

export function OwnerPanel() {
  const { isOwner, endGameAndDistribute, emergencyWithdraw, addToRewardPool, isLoading } = useBombandak()
  const [isEmergencyWithdrawLoading, setIsEmergencyWithdrawLoading] = useState(false)
  const [isAddingToPool, setIsAddingToPool] = useState(false)
  const [rewardAmount, setRewardAmount] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  if (!isOwner) return null 

  const handleEmergencyWithdraw = async () => {
    try {
      setIsEmergencyWithdrawLoading(true)
      setError('')
      
      await emergencyWithdraw()
      setSuccess('Emergency withdraw completed!')
      console.log('Emergency withdraw triggered')
    } catch (error: any) {
      console.error('Emergency withdraw error:', error)
      setError(error?.message || 'Emergency withdraw failed')
    } finally {
      setIsEmergencyWithdrawLoading(false)
    }
  }

  const handleAddToRewardPool = async () => {
    if (!rewardAmount || parseFloat(rewardAmount) <= 0) {
      setError('Please enter a valid amount greater than 0')
      return
    }

    try {
      setIsAddingToPool(true)
      setError('')
      setSuccess('')
      
      await addToRewardPool(rewardAmount)
      setSuccess(`Successfully added ${rewardAmount} MON to reward pool!`)
      setRewardAmount('') 
      console.log('Added to reward pool:', rewardAmount)
    } catch (error: any) {
      console.error('Add to reward pool error:', error)
      if (error?.message?.includes('User rejected') || error?.code === 4001) {
        setError('Transaction cancelled by user')
      } else if (error?.message?.includes('insufficient funds')) {
        setError('Insufficient funds')
      } else {
        setError(error?.message || 'Failed to add to reward pool')
      }
    } finally {
      setIsAddingToPool(false)
    }
  }

  const clearMessages = () => {
    setError('')
    setSuccess('')
  }

  return (
    <div className="bg-red-500/20 border border-red-500 rounded-xl p-4 mb-6">
      <h4 className="text-lg font-semibold text-red-400 mb-4">Owner Panel</h4>
      
      <div className="space-y-4">

        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <h5 className="text-yellow-400 font-semibold mb-3">Add to Reward Pool</h5>
          
          <div className="flex gap-2 mb-2">
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Amount in MON"
              value={rewardAmount}
              onChange={(e) => {
                setRewardAmount(e.target.value)
                clearMessages()
              }}
              className="flex-1 px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-white placeholder:text-gray-400 focus:border-yellow-500 focus:outline-none"
              disabled={isAddingToPool || isLoading}
            />
            <button
              onClick={handleAddToRewardPool}
              disabled={isAddingToPool || isLoading || !rewardAmount}
              className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isAddingToPool ? 'Adding...' : 'Add'}
            </button>
          </div>
          

        
        </div>

        {error && (
          <div className="p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-200 text-sm">
            {error}
          </div>
        )}
        
        {success && (
          <div className="p-3 bg-green-500/20 border border-green-500 rounded-lg text-green-200 text-sm">
            {success}
          </div>
        )}

        <div className="space-y-3 pt-4 border-t border-red-500/30">
          <button
            onClick={endGameAndDistribute}
            disabled={isLoading}
            className="w-full py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold disabled:opacity-50 transition-colors"
          >
            {isLoading ? 'Processing...' : 'End Game & Distribute Rewards'}
          </button>

          <button
            onClick={handleEmergencyWithdraw}
            disabled={isEmergencyWithdrawLoading || isLoading}
            className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold disabled:opacity-50 transition-colors"
          >
            {isEmergencyWithdrawLoading ? 'Withdrawing...' : 'Emergency Withdraw'}
          </button>
        </div>
      </div>
    </div>
  )
}