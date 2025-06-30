import { useReadContract, useWriteContract, useAccount } from 'wagmi'
import { parseEther, isAddress } from 'viem'
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contract'

export function useBombandak() {
  const { address } = useAccount()
  const { writeContract, isPending: isWritePending } = useWriteContract()


  const { 
    data: hasMinted, 
    refetch: refetchHasMinted 
  } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'hasMinted',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  })

  const { 
    data: contractOwner, 
    refetch: refetchOwner 
  } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'owner',
  })

  const { 
    data: totalSupply, 
    refetch: refetchTotalSupply 
  } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getTotalSupply',
  })

  const { 
    data: expiredNFTs, 
    refetch: refetchExpiredNFTs 
  } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getExpiredNFTs',
  })

  const refetchAll = async () => {
    await Promise.all([
      refetchHasMinted(),
      refetchOwner(),
      refetchTotalSupply(),
      refetchExpiredNFTs(),
    ])
  }

  const refetchUserData = async () => {
    await refetchHasMinted()
  }

  // Fonctions d'écriture
  const mint = async () => {
    try {
      await writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'mint',
        value: parseEther('1'),
      })
    } catch (error) {
      console.error('Mint error:', error)
      throw error
    }
  }

  const endGameAndDistribute = async () => {
    try {
      await writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'endGameAndDistribute',
      })
    } catch (error) {
      console.error('End game error:', error)
      throw error
    }
  }

  const emergencyWithdraw = async () => {
    try {
      await writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'emergencyWithdraw',
      })
    } catch (error) {
      console.error('Emergency withdraw error:', error)
      throw error
    }
  }

  const addToRewardPool = async (amount: string) => {
    if (!amount || parseFloat(amount) <= 0) {
      throw new Error('Amount must be greater than 0')
    }

    try {
      await writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'addToRewardPool',
        value: parseEther(amount),
      })
    } catch (error) {
      console.error('Add to reward pool error:', error)
      throw error
    }
  }

  const transfer = async (to: string, tokenId: bigint) => {
    if (!isAddress(to)) {
      throw new Error('Invalid address format')
    }

    try {
      await writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'transfer',
        args: [to as `0x${string}`, tokenId], 
      })
    } catch (error) {
      console.error('Transfer error:', error)
      throw error
    }
  }

  const getNFTData = (tokenId: bigint) => {
    return useReadContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: 'getNFTData',
      args: [tokenId],
    })
  }

  return {
    // Data
    hasMinted: hasMinted as boolean,
    totalSupply: totalSupply as bigint,
    expiredNFTs: expiredNFTs as readonly bigint[],
    isOwner: address && contractOwner && address.toLowerCase() === contractOwner.toLowerCase(), 
    // Actions
    mint,
    transfer,
    getNFTData,
    endGameAndDistribute,
    emergencyWithdraw,
    addToRewardPool, 
    // Refetch functions
    refetch: refetchUserData, 
    refetchAll,
    refetchUserData,
    refetchHasMinted,
    refetchOwner,
    refetchTotalSupply,
    refetchExpiredNFTs,
    // States
    isLoading: isWritePending,
  }
}