"use client";

import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { parseEther } from 'viem';

interface NFTMintButtonProps {
  onMintSuccess?: (txHash: string) => void;
  onMintError?: (error: string) => void;
}

// Configuration du contrat NFT (à adapter selon votre contrat)
const NFT_CONTRACT_ADDRESS = '0x1234567890123456789012345678901234567890' as `0x${string}`; // Adresse temporaire pour test
const NFT_MINT_PRICE = '0.001'; // Prix en ETH/MON

// ABI minimal pour la fonction mint
const NFT_ABI = [
  {
    name: 'mint',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'to', type: 'address' },
    ],
    outputs: [
      { name: 'tokenId', type: 'uint256' },
    ],
  },
] as const;

export default function NFTMintButton({ onMintSuccess, onMintError }: NFTMintButtonProps) {
  const { address, isConnected } = useAccount();
  const [isMinting, setIsMinting] = useState(false);
  const [mintSuccess, setMintSuccess] = useState(false);

  console.log('NFTMintButton - isConnected:', isConnected, 'address:', address); // Debug

  const { 
    writeContract, 
    data: hash, 
    error: writeError 
  } = useWriteContract();

  const { 
    isLoading: isConfirming, 
    isSuccess: isConfirmed,
    error: confirmError 
  } = useWaitForTransactionReceipt({
    hash,
  });

  const handleMint = async () => {
    if (!isConnected || !address) {
      onMintError?.('Please connect your wallet first');
      return;
    }

    try {
      setIsMinting(true);
      
      await writeContract({
        address: NFT_CONTRACT_ADDRESS,
        abi: NFT_ABI,
        functionName: 'mint',
        args: [address],
        value: parseEther(NFT_MINT_PRICE),
      });
      
    } catch (error: unknown) {
      console.error('Mint error:', error);
      setIsMinting(false);
      const errorMessage = error instanceof Error ? error.message : 'Failed to mint NFT';
      onMintError?.(errorMessage);
    }
  };

  // Gérer le succès de la transaction
  if (isConfirmed && hash && !mintSuccess) {
    setMintSuccess(true);
    setIsMinting(false);
    onMintSuccess?.(hash);
  }

  // Gérer les erreurs
  if ((writeError || confirmError) && isMinting) {
    setIsMinting(false);
    const errorMessage = writeError?.message || confirmError?.message || 'Transaction failed';
    onMintError?.(errorMessage);
  }

  // État de succès
  if (mintSuccess) {
    return (
      <div className="text-center space-y-3">
        <div className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold">
          ✅ NFT Minted Successfully!
        </div>
        {hash && (
          <a
            href={`https://testnet.monadscan.xyz/tx/${hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-purple-600 hover:text-purple-700 underline"
          >
            View on MonadScan
          </a>
        )}
      </div>
    );
  }

  // État de minting en cours
  if (isMinting || isConfirming) {
    return (
      <button
        disabled
        className="px-6 py-3 bg-purple-400 text-white rounded-lg cursor-not-allowed font-semibold flex items-center justify-center gap-2"
      >
        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        {isConfirming ? 'Confirming...' : 'Minting...'}
      </button>
    );
  }

  // État non connecté - Afficher le bouton de connexion
  if (!isConnected) {
    return (
      <div className="text-center space-y-3">
        <div className="text-gray-600 mb-3">
          Connect your wallet to mint your Victory NFT!
        </div>
        <ConnectButton.Custom>
          {({
            account,
            chain,
            
            openConnectModal,
            mounted,
          }) => {
            const ready = mounted;
            const connected = ready && account && chain;

            return (
              <div
                {...(!ready && {
                  'aria-hidden': true,
                  'style': {
                    opacity: 0,
                    pointerEvents: 'none',
                    userSelect: 'none',
                  },
                })}
              >
                {(() => {
                  if (!connected) {
                    return (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          openConnectModal();
                        }}
                        type="button"
                        className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg"
                      >
                        🔗 Connect Wallet to Mint
                      </button>
                    );
                  }

                  return (
                    <div className="text-center space-y-2">
                      <div className="text-sm text-gray-600">
                        Wallet connected successfully!
                      </div>
                      <div className="text-xs text-gray-500">
                        {account.displayName} on {chain.name}
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          }}
        </ConnectButton.Custom>
      </div>
    );
  }

  // État connecté - Afficher le bouton de mint
  return (
    <div className="text-center space-y-3">
      <div className="text-sm text-gray-600">
        Wallet: {address?.slice(0, 6)}...{address?.slice(-4)}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleMint();
        }}
        className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg"
      >
        🎉 Mint Victory NFT ({NFT_MINT_PRICE} MON)
      </button>
    </div>
  );
}