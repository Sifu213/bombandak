import { WalletConnect } from './components/WalletConnect'
import { MintButton } from './components/MintButton'
import { GlobalStats } from './components/GlobalStats'
import { ViewMyNFTs } from './components/ViewMyNFTs'
import { Leaderboard } from './components/Leaderboard'
import { OwnerPanel } from './components/OwnerPanel'

function App() {
  return (
    <div className="min-h-screen flex flex-col">

      <header className="w-full px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white flex items-center gap-3">
            <img
              src="/bombandaks.png"
              alt="Logo"
              className="w-8 h-8  sm:w-10 sm:h-10 lg:w-12 lg:h-12"
            />
            Bobamdak
          </h1>
          <WalletConnect />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 sm:px-4 lg:px-4">
        <div className="max-w-7xl w-full mx-auto">



          <div className="mt-0 lg:mt-2 bg-white/10 backdrop-blur-sm rounded-xl p-6 mb-4 lg:p-3 border border-white/20">
            <h4 className="text-xl font-semibold text-white mb-4">How to Play</h4>
            <div className="text-center">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-sm text-white">
                <div className="space-y-2">
                  <div className="text-2xl font-semibold">1️⃣ Mint</div>
                  <p>Mint your Bombandak with 24h countdown before explosion</p>
                </div>
                <div className="space-y-2">
                  <div className="text-2xl font-semibold">2️⃣ Transfer</div>
                  <p>Send it to someone to reinit the 24h countdown</p>
                  <p>Never send back to previous owners!</p>
                </div>
                <div className="space-y-2">
                  <div className="text-2xl font-semibold">3️⃣ Survive</div>
                  <p>Keep it alive as long as possible!</p>
                </div>
                <div className="space-y-2">
                  <div className="text-2xl font-semibold">4️⃣ Rewards</div>
                  <p>NFT who live the longuest will allow all his owners to get the reward pool!</p>
                </div>
              </div>
            </div>
          </div>


          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 lg:p-8 border border-white/20">
              <GlobalStats />
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 lg:p-8 border border-white/20">
              <h3 className="text-xl lg:text-2xl font-semibold text-white mb-6 text-center xl:text-left">
                Actions
              </h3>
              <div className="space-y-4">
                <MintButton />
                <ViewMyNFTs />
                <OwnerPanel />
              </div>

              <img
                src="/bombandak.png"
                alt="Logo"
                className="mx-auto block w-full mt-4 h-auto max-h-60 object-contain"
              />
            </div>

            <Leaderboard />

          </div>

        </div>
      </main>

      <footer className="w-full px-4 sm:px-6 lg:px-8 py-0">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-gray-400 text-sm">
            <nav>
              <ul className="flex items-center justify-center gap-4">
                <li>
                  Made by <a href="https://x.com/sifu_lam" target="_blank" rel="noopener noreferrer">Sifu_lam</a> for
                </li>
                <li>
                  <img src="/logomonad.png" alt="monad" className="h-3 w-auto" />
                </li>
              </ul>
            </nav>
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App