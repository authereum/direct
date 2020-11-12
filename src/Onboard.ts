import OnboardSDK from 'bnc-onboard'
import { ethers } from 'ethers'
import { EventEmitter } from 'events'

import {
  blocknativeDappId,
  fortmaticApiKey,
  portisDappId,
  squarelinkClientId
} from './config'

interface IOptions {
  networkId?: number
  rpcUrl?: string
}

class Onboard extends EventEmitter {
  _provider: any
  _onboard: any
  _selectedWallet: any

  constructor (options: IOptions = {}) {
    super()

    const { networkId, rpcUrl } = options

    const wallets = [
      // { walletName: 'authereum', preferred: true },
      {
        walletName: 'walletConnect',
        infuraKey: '8e4fe7af961f48a1958584ec36742b44',
        preferred: true
      },
      { walletName: 'metamask', preferred: true },
      { walletName: 'ledger', rpcUrl: rpcUrl, preferred: true },
      {
        walletName: 'trezor',
        appUrl: 'authereum.com',
        email: 'contract@authereum.com',
        rpcUrl: rpcUrl,
        preferred: true
      },
      { walletName: 'dapper' },
      { walletName: 'fortmatic', apiKey: fortmaticApiKey },
      { walletName: 'portis', apiKey: portisDappId, label: 'Portis' },
      { walletName: 'torus' },
      { walletName: 'squarelink', apiKey: squarelinkClientId },
      { walletName: 'coinbase' },
      { walletName: 'trust', rpcUrl: rpcUrl },
      { walletName: 'opera' },
      { walletName: 'operaTouch' },
      { walletName: 'status' },
      { walletName: 'imToken', rpcUrl: rpcUrl }
    ]

    const opts: any = {
      dappId: blocknativeDappId,
      networkId,
      walletSelect: {
        wallets: wallets
      },
      subscriptions: {
        address: this.handleAddressChange,
        wallet: this.handleWalletChange
      },
      walletCheck: [
        { checkName: 'derivationPath' },
        { checkName: 'connect' },
        { checkName: 'accounts' },
        { checkName: 'network' }
      ]
    }

    this._onboard = OnboardSDK(opts)
  }

  handleAddressChange = async (address: string) => {
    this.emit('accountChange', address)
  }

  handleWalletChange = async (wallet: any) => {
    const { name, provider } = wallet

    await this._onboard.walletCheck()

    this._selectedWallet = name
    if (provider) {
      this._provider = provider
    }
    const address = await this.getAddress()
    this.emit('walletChange', { name, address })
  }

  async walletCheck (walletName?: string) {
    await this._onboard.walletSelect(walletName)
    await this._onboard.walletCheck()
  }

  async showWalletSector () {
    await this._onboard.walletSelect()
    await this._onboard.walletCheck()
  }

  async reset () {
    return this._onboard.walletReset()
  }

  getState () {
    return this._onboard.getState()
  }

  getWalletName () {
    return this._selectedWallet
  }

  getAddress () {
    const signer = this.getSigner()
    return signer.getAddress()
  }

  getProvider () {
    return this._provider
  }

  getEthersProvider () {
    return new ethers.providers.Web3Provider(this.getProvider())
  }

  getSigner () {
    return this.getEthersProvider().getSigner()
  }

  setConfig (config: any) {
    return this._onboard.config(config)
  }
}

export default Onboard
