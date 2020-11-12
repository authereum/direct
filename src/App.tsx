import { EventEmitter } from 'events'
import React, { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import validPrivateKey from '@authereum/utils/core/validPrivateKey'
import WalletConnect from '@walletconnect/client'
import encodeParameters from '@authereum/utils/core/encodeParameters'
import getNetworkId from '@authereum/utils/core/getNetworkId'
import hexToUtf8 from '@authereum/utils/core/hexToUtf8'
import Onboard from './Onboard'

import Button from '@material-ui/core/Button'
import TextField from '@material-ui/core/TextField'
import Grid from '@material-ui/core/Grid'
import Card from '@material-ui/core/Card'
import CardContent from '@material-ui/core/CardContent'
import AuthereumAccountAbi from './abi/AuthereumAccount.json'

function App () {
  const [ee] = React.useState(() => new EventEmitter())
  const [privateKey, setPrivateKey] = useState<string>(() => {
    return localStorage.getItem('privateKey') || ''
  })
  const [contractAddress, setContractAddress] = useState<string>(() => {
    return localStorage.getItem('contractAddress') || ''
  })
  const [wallet, setWallet] = useState<any>()
  const [onboard] = useState<any>(() => {
    const network = localStorage.getItem('networkName') || 'mainnet'
    const networkId = getNetworkId(network)
    const rpcUrl = `https://${network}.rpc.authereum.com`
    return new Onboard({ networkId, rpcUrl })
  })
  const [walletName, setWalletName] = useState<any>(
    localStorage.getItem('walletName')
  )
  const [info, setInfo] = useState<any>({})
  const [connectUri, setConnectUri] = useState<any>('')
  const [walletConnectSession, setWalletConnectSession] = useState<any>(
    localStorage.getItem('walletconnect')
      ? JSON.parse(localStorage.getItem('walletconnect') as string)
      : null
  )
  const [walletConnector, setWalletConnector] = useState<any>()
  const [networkName, setNetworkName] = useState<any>(() => {
    return localStorage.getItem('networkName') || 'mainnet'
  })
  const [, setRpcUrl] = useState<string>(() => {
    const network = localStorage.getItem('networkName') || 'mainnet'
    return `https://${network}.rpc.authereum.com`
  })
  const [provider, setProvider] = useState<any>(() => {
    const network = localStorage.getItem('networkName') || 'mainnet'
    const rpcUrl = `https://${network}.rpc.authereum.com`
    return new ethers.providers.JsonRpcProvider(rpcUrl)
  })
  const [callRequest, setCallRequest] = React.useState<any>(null)
  const [callRequestEditable, setCallRequestEditable] = React.useState<boolean>(
    false
  )

  useEffect(() => {
    localStorage.setItem('networkName', networkName)
    const rpcUrl = `https://${networkName}.rpc.authereum.com`
    setRpcUrl(rpcUrl)
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl)
    setProvider(provider)
    const networkId = getNetworkId(networkName)
    onboard.setConfig({ networkId })
  }, [networkName, onboard])

  useEffect(() => {
    if (!privateKey) {
      return
    }

    if (validPrivateKey(privateKey.replace('0x', ''))) {
      const priv = ethers.utils.hexlify('0x' + privateKey)
      const wal = new ethers.Wallet(priv, provider)
      localStorage.setItem('privateKey', privateKey)
      setWallet(wal)
      localStorage.setItem('walletName', 'privateKey')
    }
  }, [privateKey, provider])

  useEffect(() => {
    const setup = async () => {
      if (!walletName) return
      if (walletName === 'privateKey') return
      await onboard.walletCheck(walletName)
      const state = await onboard.getState()
      const { address } = state
      if (!address) {
        return
      }

      setInfo({ address })
      const signer = onboard.getSigner()
      setWallet(signer)
    }

    setup()
  }, [onboard, walletName])

  const handlePrivateKeyChange = (event: any) => {
    event.preventDefault()

    setPrivateKey(event.target.value)
  }

  const handleConnectUri = (event: any) => {
    event.preventDefault()

    const uri = event.target.value
    setConnectUri(uri)
    localStorage.setItem('uri', uri)
  }

  function getCachedSession () {
    const local = localStorage ? localStorage.getItem('walletconnect') : null

    let session = null
    if (local) {
      try {
        session = JSON.parse(local)
      } catch (error) {
        throw error
      }
    }
    return session
  }

  const handleConnect = (event: any) => {
    onboard.showWalletSector()
  }

  // walletconnect doesn't have a way to unsubscribe from event emitter,
  // so we use a custom event emitter as a workaround.
  useEffect(() => {
    const events = [
      'connect',
      'disconnect',
      'session_request',
      'call_request',
      'error'
    ]
    for (let name of events) {
      walletConnector?.on(name, (...args: any[]) => ee.emit(name, ...args))
    }
  }, [walletConnector, ee])

  const handleApprove = (event: any) => {
    event.preventDefault()

    approveCallRequest(callRequest)
  }

  const handleReject = (event: any) => {
    event.preventDefault()

    rejectCallRequest(callRequest)
  }

  const rejectCallRequest = (payload: any) => {
    if (payload.error) {
      walletConnector.rejectRequest(payload)
    } else {
      walletConnector.rejectRequest({ id: payload.id, error: 'Cancelled' })
    }

    setCallRequest(null)
  }

  const approveCallRequest = async (payload: any) => {
    try {
      const isTx = ['eth_signTransaction', 'eth_sendTransaction'].includes(
        payload.method
      )
      let result = null

      if (isTx) {
        const tx = payload.params[0]
        console.log('TX', tx)

        const gasLimit = 300000
        const tx1 = encodeParameters(
          ['address', 'uint256', 'uint256', 'bytes'],
          [tx.to, tx.value || '0x', gasLimit, tx.data || '0x']
        )

        const txs = [tx1]
        console.log('txs', txs)

        const iface = new ethers.utils.Interface(AuthereumAccountAbi)
        const data = await iface.encodeFunctionData(
          'executeMultipleMetaTransactions',
          [txs]
        )

        const nonce = await provider.getTransactionCount(
          await wallet.getAddress()
        )

        let txObj: any = {
          to: contractAddress,
          value: '0x',
          gasLimit,
          gasPrice: tx.gasPrice,
          data: data,
          nonce,
          chainId: getNetworkId(networkName)
        }

        txObj = await ethers.utils.resolveProperties(txObj)

        let hash = ''
        if (walletName === 'privateKey') {
          const signed = await wallet.signTransaction(txObj)
          const { hash: h } = await provider.sendTransaction(signed)
          hash = h
        } else {
          hash = await wallet.sendUncheckedTransaction(txObj)
        }
        console.log('TXHASH', hash)
        result = {
          id: payload.id,
          result: hash
        }
      } else {
        console.log('PARAMS', payload.params)
        let data = payload.params[0]
        let sig = null

        data = hexToUtf8(data)
        console.log('DATA', data)
        sig = await wallet.signMessage(data)
        console.log('SIG', sig)

        result = {
          id: payload.id,
          result: sig
        }
      }

      walletConnector.approveRequest(result)
      setCallRequest(null)
    } catch (err) {
      rejectCallRequest({ id: payload.id, error: err.message })
    }
  }

  const connect = async () => {
    const connector = new WalletConnect({
      uri: connectUri.trim(),
      clientMeta: {
        description: 'WalletConnect Developer App',
        url: window.location.href,
        icons: ['https://walletconnect.org/walletconnect-logo.png'],
        name: 'WalletConnect'
      }
    })

    console.log('CONNECTED', connector.connected)
    if (!connector.connected) {
      await connector.createSession()
    }

    setWalletConnector(connector)
  }

  const getSession = () => {
    try {
      // localStorage 'walletconnect' value is set by walletconnect library
      const session = localStorage.getItem('walletconnect')
      if (!session) {
        return null
      }

      return JSON.parse(session)
    } catch (err) {
      return null
    }
  }

  useEffect(() => {
    const session = getSession()
    if (session) {
      const walletConnector = new WalletConnect({ session })
      setWalletConnector(walletConnector)
    }
  }, [])

  useEffect(() => {
    if (!walletConnector) return
    if (!contractAddress) return
    console.log('setup Ws')

    const handleConnectWs = async (err: Error, p: any) => {
      console.log('connect cb', err, p)
      const session = getCachedSession()
      setWalletConnectSession(session)
    }

    const handleSessionRequest = async (err: Error, payload: any) => {
      if (err) {
        console.error(err)
        return
      }

      console.log('session request', payload)
      walletConnector?.approveSession({
        accounts: [contractAddress],
        chainId: getNetworkId(networkName)
      })
    }

    const handleCallRequest = async (err: Error, payload: any) => {
      if (err) {
        console.error(err)
        return
      }

      console.log('call request', payload)
      setCallRequest(payload)
    }

    const handleDisconnectWs = (err: Error, payload: any) => {
      if (err) {
        console.error(err)
        return
      }

      console.log('disconnect', payload)

      setConnectUri('')
      setWalletConnectSession(null)
      setWalletConnector(null)
    }

    ee.on('connect', handleConnectWs)
    ee.on('session_request', handleSessionRequest)
    ee.on('call_request', handleCallRequest)
    ee.on('disconnect', handleDisconnectWs)

    return () => {
      ee.off('connect', handleConnectWs)
      ee.off('session_request', handleSessionRequest)
      ee.off('call_request', handleCallRequest)
      ee.off('disconnect', handleDisconnectWs)
    }
  }, [ee, walletConnector, contractAddress, networkName])

  const handleWalletDisconnect = async (event: any) => {
    try {
      await onboard.reset()
    } catch (err) {
      console.error(err)
    }
    setWallet(null)
    setWalletName(null)
    localStorage.removeItem('walletName')
    setContractAddress('')
    handleWalletConnectDisconnect(event)
  }

  const handleWalletConnectDisconnect = async (event: any) => {
    setConnectUri('')

    try {
      if (walletConnector) {
        walletConnector.killSession()
        setWalletConnector(null)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleContractAddressChange = (event: any) => {
    const contractAddress = event.target.value
    setContractAddress(contractAddress)
    localStorage.setItem('contractAddress', contractAddress)
  }

  onboard.on('walletChange', (wallet: any) => {
    let { name } = wallet
    if (!name) return

    localStorage.setItem('walletName', name)
    setWalletName(name)
  })

  onboard.on('accountChange', (address: any) => {})

  useEffect(() => {
    const setup = async () => {
      if (!wallet) return
      const address = await wallet.getAddress()
      setInfo({
        address
      })
    }

    setup()
  }, [wallet])
  const handleEditClick = (event: any) => {
    setCallRequestEditable(true)
  }
  const updateCallRequest = (event: any) => {
    const value = event.target.value
    try {
      setCallRequest(JSON.parse(value))
    } catch (err) {
      console.error(err)
    }
  }
  const handleEditBlur = (event: any) => {
    setCallRequestEditable(false)
  }

  const updateNetworkName = (event: any) => {
    setNetworkName(event.target.value)
  }
  const renderNetworkSelect = () => {
    return (
      <select value={networkName} onChange={updateNetworkName}>
        <option value='mainnet'>Mainnet</option>
        <option value='kovan'>Kovan</option>
        <option value='goerli'>Goerli</option>
        <option value='rinkeby'>Rinkeby</option>
        <option value='ropsten'>Ropsten</option>
      </select>
    )
  }
  const renderConnected = () => {
    if (!wallet) return null
    return (
      <>
        <div style={{ marginBottom: '0.5rem' }}>Wallet Name: {walletName}</div>
        <div style={{ marginBottom: '1rem' }}>
          {info.address && (
            <div style={{ marginBottom: '1rem' }}>
              Connected address (admin key): {info.address}
            </div>
          )}
          {contractAddress && (
            <div style={{ marginBottom: '1rem' }}>
              Authereum account address: {contractAddress}
            </div>
          )}
          {!walletConnectSession && (
            <>
              {contractAddress && (
                <div>
                  <label>WalletConnect URI</label>
                  <TextField
                    variant='outlined'
                    label='Connect URI'
                    placeholder='wc:'
                    type='text'
                    value={connectUri}
                    onChange={handleConnectUri}
                  />
                  <Button color='primary' variant='contained' onClick={connect}>
                    Connect
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
        {!contractAddress && (
          <div style={{ marginBottom: '1rem' }}>
            <label>Enter authereum account address:</label>
            <TextField
              type='text'
              variant='outlined'
              label='Contract address'
              placeholder='Enter contract address'
              value={contractAddress}
              onChange={handleContractAddressChange}
            />
          </div>
        )}
        {walletConnectSession && (
          <div>
            <div>
              Connected to:
              <a
                href={walletConnector?._peerMeta.url}
                target='_blank'
                rel='noopener noreferrer'
              >
                <img
                  style={{ width: '16px', verticalAlign: 'middle' }}
                  src={walletConnector?._peerMeta?.icons[0]}
                  alt='icon'
                />
                <span>{walletConnector?._peerMeta.name}</span>
              </a>
            </div>
            <div style={{ margin: '4rem 0' }}>
              {callRequest ? (
                <div>
                  {callRequestEditable ? (
                    <textarea
                      style={{
                        width: '100%',
                        height: '300px'
                      }}
                      value={JSON.stringify(callRequest, null, 2)}
                      onChange={updateCallRequest}
                      onBlur={handleEditBlur}
                    />
                  ) : (
                    <div onClick={handleEditClick}>
                      <small>
                        <em>click to edit</em>
                      </small>
                      <pre
                        style={{
                          display: 'block',
                          width: '100%'
                        }}
                      >
                        {JSON.stringify(callRequest, null, 2)}
                      </pre>
                    </div>
                  )}
                  <Button
                    color='primary'
                    variant='contained'
                    onClick={handleApprove}
                  >
                    Approve
                  </Button>
                  <Button
                    color='secondary'
                    variant='outlined'
                    onClick={handleReject}
                  >
                    Reject
                  </Button>
                </div>
              ) : (
                <em>Awaiting call requests...</em>
              )}
            </div>
          </div>
        )}
        <div>
          {walletConnectSession && (
            <div style={{ marginBottom: '1rem' }}>
              <Button
                color='secondary'
                variant='outlined'
                onClick={handleWalletConnectDisconnect}
              >
                disconnect WalletConnect
              </Button>
            </div>
          )}
          <div>
            <Button
              color='secondary'
              variant='outlined'
              onClick={handleWalletDisconnect}
            >
              disconnect {walletName} wallet
            </Button>
          </div>
        </div>
      </>
    )
  }
  const renderDisconnected = () => {
    if (wallet) return null
    return (
      <div style={{ textAlign: 'center' }}>
        <div>
          <Button color='primary' variant='contained' onClick={handleConnect}>
            Connect wallet
          </Button>
        </div>
        <div style={{ margin: '1rem 0' }}>or</div>
        <div>
          <TextField
            disabled={true}
            type='text'
            variant='outlined'
            label='Private key'
            placeholder={'Enter private key'}
            value={privateKey}
            onChange={handlePrivateKeyChange}
          />
        </div>
      </div>
    )
  }
  return (
    <Grid style={{ maxWidth: '500px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1rem' }}>
        <h1>Authereum Direct</h1>
        {renderNetworkSelect()}
      </div>
      <Card>
        <CardContent>
          {renderConnected()}
          {renderDisconnected()}
        </CardContent>
      </Card>
    </Grid>
  )
}

export default App
