import getNetworkId from '@authereum/utils/core/getNetworkId'
import getRpcProviderUrl from '@authereum/utils/core/getRpcProviderUrl'

const networkName = process.env.REACT_APP_NETWORK || 'mainnet'
const isMainnet = networkName === 'mainnet'

const blocknativeDappId = process.env.REACT_APP_BLOCKNATIVE_DAPP_ID
const squarelinkClientId = process.env.REACT_APP_SQUARELINK_CLIENT_ID
const portisDappId = process.env.REACT_APP_PORTIS_DAPP_ID
let fortmaticApiKey = process.env.REACT_APP_FORTMATIC_API_KEY

const networkId = getNetworkId(networkName)
const rpcUri = getRpcProviderUrl(networkName)

export {
  blocknativeDappId,
  squarelinkClientId,
  fortmaticApiKey,
  portisDappId,
  networkId,
  rpcUri,
  isMainnet
}
