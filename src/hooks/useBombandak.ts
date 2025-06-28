import { useReadContract, useWriteContract, useAccount } from 'wagmi'
import { parseEther, isAddress } from 'viem'
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contract'

export function useBombandak() {
  const { address } = useAccount()
  const { writeContract, isPending: isWritePending } = useWriteContract()

  // Fonctions de lecture
  const { data: hasMinted } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'hasMinted',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  })

  const { data: contractOwner } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'owner',
  })

  const { data: totalSupply } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getTotalSupply',
  })

  const { data: expiredNFTs } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getExpiredNFTs',
  })

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

  const transfer = async (to: string, tokenId: bigint) => {

    if (!isAddress(to)) {
      throw new Error('Invalid address format')
    }

    try {
      await writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'transfer',
        args: [to as `0x${string}`, tokenId], // Cast explicite
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
    // States
    isLoading: isWritePending,
  }
}