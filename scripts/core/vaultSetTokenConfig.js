const { deployContract, contractAt, sendTxn, readTmpAddresses, callWithRetries } = require("../shared/helpers")
const { expandDecimals } = require("../../test/shared/utilities")
const { toChainlinkPrice } = require("../../test/shared/chainlink")

const network = (process.env.HARDHAT_NETWORK || 'mainnet');
const tokens = require('./tokens')[network];

async function getArbValues() {
  const vault = await contractAt("Vault", "0x489ee077994B6658eAfA855C308275EAd8097C4A")

  const { usdc } = tokens
  const tokenArr = [usdc]

  return { vault, tokenArr }
}

async function getAvaxValues() {
  const vault = await contractAt("Vault", "0x9ab2De34A33fB459b538c43f251eB825645e8595")

  const { btcb } = tokens
  const tokenArr = [btcb]

  return { vault, tokenArr }
}

async function getHederaValues() {
  // Read the deployed vault address from the deployment
  const addresses = readTmpAddresses()
  const vault = await contractAt("Vault", addresses.vault)

  const { nativeToken, link, usdc } = tokens
  const tokenArr = [nativeToken, link, usdc]

  return { vault, tokenArr }
}

async function getValues() {
  if (network === "arbitrum") {
    return getArbValues()
  }

  if (network === "avax") {
    return getAvaxValues()
  }

  if (network === "hederaTestnet") {
    return getHederaValues()
  }
}

async function main() {
  // Use hardhat's ethers directly instead of getFrameSigner
  const [signer] = await ethers.getSigners()

  const { vault, tokenArr } = await getValues()
  
  console.log("vault", vault.address)
  console.log("signer", signer.address)

  // Call setTokenConfig directly on the vault (since deployer is still governor)
  for (const token of tokenArr) {
    await sendTxn(vault.setTokenConfig(
      token.address, // _token
      token.decimals, // _tokenDecimals
      token.tokenWeight, // _tokenWeight
      token.minProfitBps, // _minProfitBps
      expandDecimals(token.maxUsdgAmount, 18), // _maxUsdgAmount
      token.isStable, // _isStable
      token.isShortable // _isShortable
    ), `vault.setTokenConfig(${token.name}) ${token.address}`)
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
