import { useState } from 'react'
import { useBombandak } from '../hooks/useBombandak'

export function OwnerPanel() {
  const { isOwner, endGameAndDistribute, emergencyWithdraw, isLoading } = useBombandak()
  const [isEmergencyWithdrawLoading, setIsEmergencyWithdrawLoading] = useState(false)
  
  if (!isOwner) return null 

  const handleEmergencyWithdraw = async () => {
    try {
      setIsEmergencyWithdrawLoading(true)
      
      await emergencyWithdraw()
      console.log('Emergency withdraw triggered')
    } catch (error) {
      console.error('Emergency withdraw error:', error)
    } finally {
      setIsEmergencyWithdrawLoading(false)
    }
  }

  return (
    <div className="bg-red-500/20 border border-red-500 rounded-xl p-4 mb-6">
      <h4 className="text-lg font-semibold text-red-400 mb-4">🔧 Owner Panel</h4>
      
      <div className="space-y-3">
        <button
          onClick={endGameAndDistribute}
          disabled={isLoading}
          className="w-full py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold disabled:opacity-50 transition-colors"
        >
          {isLoading ? 'Processing...' : 'End Game & Distribute Rewards'}
        </button>

        <button
          onClick={handleEmergencyWithdraw}
          disabled={isEmergencyWithdrawLoading}
          className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold disabled:opacity-50 transition-colors"
        >
          {isEmergencyWithdrawLoading ? 'Withdrawing...' : 'Emergency Withdraw'}
        </button>

        
      </div>
    </div>
  )
}