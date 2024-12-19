const { getFrameSigner, deployContract, contractAt, sendTxn, readTmpAddresses, writeTmpAddresses } = require("../shared/helpers")
const { expandDecimals } = require("../../test/shared/utilities")
const { toUsd } = require("../../test/shared/units")

const network = (process.env.HARDHAT_NETWORK || 'mainnet');
const tokens = require('./tokens')[network];

const {
  ARBITRUM_URL,
  ARBITRUM_CAP_KEEPER_KEY,
  AVAX_URL,
  AVAX_CAP_KEEPER_KEY,
  HEDERA_TESTNET_URL,
  HEDERA_TESTNET_PRIVATE_KEY
} = require("../../env.json")

const depositFee = 30 // 0.3%

async function getArbValues(signer) {
  const vault = await contractAt("Vault", "0x489ee077994B6658eAfA855C308275EAd8097C4A", signer)
  const timelock = await contractAt("Timelock", await vault.gov(), signer)
  const router = await contractAt("Router", await vault.router(), signer)
  const shortsTracker = await contractAt("ShortsTracker", "0xf58eEc83Ba28ddd79390B9e90C4d3EbfF1d434da", signer)
  const weth = await contractAt("WETH", tokens.nativeToken.address)
  const orderBook = await contractAt("OrderBook", "0x09f77E8A13De9a35a7231028187e9fD5DB8a2ACB")
  const referralStorage = await contractAt("ReferralStorage", "0xe6fab3f0c7199b0d34d7fbe83394fc0e0d06e99d")

  const orderKeepers = [
    { address: "0xd4266F8F82F7405429EE18559e548979D49160F3" },
    { address: "0x2D1545d6deDCE867fca3091F49B29D16B230a6E4" }
  ]
  const liquidators = [
    { address: "0x44311c91008DDE73dE521cd25136fD37d616802c" }
  ]

  const partnerContracts = [
    "0x9ba57a1D3f6C61Ff500f598F16b97007EB02E346", // Vovo ETH up vault
    "0x5D8a5599D781CC50A234D73ac94F4da62c001D8B", // Vovo ETH down vault
    "0xE40bEb54BA00838aBE076f6448b27528Dd45E4F0", // Vovo BTC up vault
    "0x1704A75bc723A018D176Dc603b0D1a361040dF16", // Vovo BTC down vault
    "0xbFbEe90E2A96614ACe83139F41Fa16a2079e8408", // Vovo GLP ETH up vault
    "0x0FAE768Ef2191fDfCb2c698f691C49035A53eF0f", // Vovo GLP ETH down vault
    "0x2b8E28667A29A5Ab698b82e121F2b9Edd9271e93", // Vovo GLP BTC up vault
    "0x46d6dEE922f1d2C6421895Ba182120C784d986d3", // Vovo GLP BTC down vault
    "0x3327a5F041E821f476E00572ee0862fbcaa32993", // Jones ETH Hedging
    "0x2F9980d6fb25bD972196B19E243e36Dbde60618B", // Jones gOHM Hedging
    "0xC75417CB103D7008eCb07aa6fbf214eE2c127901", // Jones DPX Hedging
    "0x37a86cB53981CC762709B2c402B0F790D58F95BF", // Jones rDPX Hedging
  ]

  return { vault, timelock, router, shortsTracker, weth, depositFee, orderBook, referralStorage, orderKeepers, liquidators, partnerContracts }
}

async function getAvaxValues(signer) {
  const vault = await contractAt("Vault", "0x9ab2De34A33fB459b538c43f251eB825645e8595")
  const timelock = await contractAt("Timelock", await vault.gov(), signer)
  const router = await contractAt("Router", await vault.router(), signer)
  const shortsTracker = await contractAt("ShortsTracker", "0x9234252975484D75Fd05f3e4f7BdbEc61956D73a", signer)
  const weth = await contractAt("WETH", tokens.nativeToken.address)
  const orderBook = await contractAt("OrderBook", "0x4296e307f108B2f583FF2F7B7270ee7831574Ae5")
  const referralStorage = await contractAt("ReferralStorage", "0x827ed045002ecdabeb6e2b0d1604cf5fc3d322f8")

  const orderKeepers = [
    { address: "0x06f34388A7CFDcC68aC9167C5f1C23DD39783179" },
    { address: "0xf26f52d5985F6391E541A8d638e1EDaa522Ae56C" }
  ]
  const liquidators = [
    { address: "0x7858A4C42C619a68df6E95DF7235a9Ec6F0308b9" }
  ]

  const partnerContracts = []

  return { vault, timelock, router, shortsTracker, weth, depositFee, orderBook, referralStorage, orderKeepers, liquidators, partnerContracts }
}

async function getHederaTestnetValues(signer) {
  const provider = new ethers.providers.JsonRpcProvider(HEDERA_TESTNET_URL)
  const capKeeperWallet = new ethers.Wallet(HEDERA_TESTNET_PRIVATE_KEY).connect(provider)
  const deployer = { address: "0xeD37FD0d6F0f69236E7472B36796e133D20EcC32" }

  const vault = await contractAt("Vault", "0x2D641633FE39fAc1E79085dCAF91244EcBBda809", capKeeperWallet)
  const timelock = await contractAt("Timelock", await vault.gov(), capKeeperWallet)
  const router = await contractAt("Router", await vault.router(), capKeeperWallet)
  const shortsTracker = await contractAt("ShortsTracker", "0xEbB9F472C853675678e797D06D33682df8b167c8", capKeeperWallet)
  const weth = await contractAt("WETH", tokens.nativeToken.address)
  const orderBook = await contractAt("OrderBook", "0x9171bF1A725A6EDCCe44A8A124216775Eb324165")
  const referralStorage = await contractAt("ReferralStorage", "0x97bB30637DD7A71997F905Cd142cF89d2887ADb8")

  const orderKeepers = [
    { address: "0xeD37FD0d6F0f69236E7472B36796e133D20EcC32" }
  ]
  const liquidators = [
    { address: "0xeD37FD0d6F0f69236E7472B36796e133D20EcC32" }
  ]

  const partnerContracts = []

  return {
    capKeeperWallet,
    vault,
    timelock,
    router,
    shortsTracker,
    weth,
    depositFee,
    orderBook,
    referralStorage,
    orderKeepers,
    liquidators,
    partnerContracts
  }
}

async function getValues(signer) {
  if (network === "arbitrum") {
    return getArbValues(signer)
  }

  if (network === "avax") {
    return getAvaxValues(signer)
  }

  if (network === "hederaTestnet") {
    return getHederaTestnetValues(signer)
  }
}

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(HEDERA_TESTNET_URL)
  const signer = new ethers.Wallet(HEDERA_TESTNET_PRIVATE_KEY, provider)
  const deployer = { address: "0xeD37FD0d6F0f69236E7472B36796e133D20EcC32" }

  const {
    capKeeperWallet,
    vault,
    timelock,
    router,
    shortsTracker,
    weth,
    depositFee,
    orderBook,
    referralStorage,
    orderKeepers,
    liquidators,
    partnerContracts
  } = await getValues(signer)

  const positionUtils = await deployContract("PositionUtils", [])


  console.log("Deploying new position manager")
  const positionManagerArgs = [vault.address, router.address, shortsTracker.address, weth.address, depositFee, orderBook.address]

  const positionManagerContractFactory = await ethers.getContractFactory("PositionManager", {
    libraries: {
      PositionUtils: positionUtils.address
    }
  })

  const positionManager = await positionManagerContractFactory.deploy(...positionManagerArgs)

  writeTmpAddresses({
    positionManager: positionManager.address
  })

  await positionManager.deployed()
  console.log("positionManager address:", positionManager.address)

  // Use capKeeperWallet for all transactions
  await sendTxn(positionManager.setReferralStorage(referralStorage.address), "positionManager.setReferralStorage")
  await sendTxn(positionManager.setShouldValidateIncreaseOrder(false), "positionManager.setShouldValidateIncreaseOrder(false)")

  for (let i = 0; i < orderKeepers.length; i++) {
    const orderKeeper = orderKeepers[i]
    await sendTxn(positionManager.setOrderKeeper(orderKeeper.address, true), "positionManager.setOrderKeeper")
  }

  for (let i = 0; i < liquidators.length; i++) {
    const liquidator = liquidators[i]
    await sendTxn(positionManager.setLiquidator(liquidator.address, true), "positionManager.setLiquidator")
  }

  await sendTxn(timelock.setContractHandler(positionManager.address, true), "timelock.setContractHandler(positionManager)")
  await sendTxn(timelock.setLiquidator(vault.address, positionManager.address, true), "timelock.setLiquidator(vault, positionManager)")
  await sendTxn(shortsTracker.setHandler(positionManager.address, true), "shortsTracker.setHandler(positionManager)")
  await sendTxn(router.addPlugin(positionManager.address), "router.addPlugin(positionManager)")

  for (let i = 0; i < partnerContracts.length; i++) {
    const partnerContract = partnerContracts[i]
    await sendTxn(positionManager.setPartner(partnerContract, true), "positionManager.setPartner")
  }

  await sendTxn(positionManager.setGov(await vault.gov()), "positionManager.setGov")

  console.log("done.")
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
