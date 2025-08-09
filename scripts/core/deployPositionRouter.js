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

async function getArbValues(signer) {
  const provider = new ethers.providers.JsonRpcProvider(HEDERA_TESTNET_URL)
  const capKeeperWallet = new ethers.Wallet(ARBITRUM_CAP_KEEPER_KEY).connect(provider)

  const vault = await contractAt("Vault", "0x489ee077994B6658eAfA855C308275EAd8097C4A")
  const timelock = await contractAt("Timelock", await vault.gov(), signer)
  const router = await contractAt("Router", await vault.router(), signer)
  const weth = await contractAt("WETH", tokens.nativeToken.address)
  const referralStorage = await contractAt("ReferralStorage", "0xe6fab3F0c7199b0d34d7FbE83394fc0e0D06e99d")
  const shortsTracker = await contractAt("ShortsTracker", "0xf58eEc83Ba28ddd79390B9e90C4d3EbfF1d434da", signer)
  const shortsTrackerTimelock = await contractAt("ShortsTrackerTimelock", "0xf58eEc83Ba28ddd79390B9e90C4d3EbfF1d434da", signer)
  const depositFee = "30" // 0.3%
  const minExecutionFee = "100000000000000" // 0.0001 ETH

  return {
    capKeeperWallet,
    vault,
    timelock,
    router,
    weth,
    referralStorage,
    shortsTracker,
    shortsTrackerTimelock,
    depositFee,
    minExecutionFee,
    positionKeepers
  }
}

async function getAvaxValues(signer) {
  const provider = new ethers.providers.JsonRpcProvider(AVAX_URL)
  const capKeeperWallet = new ethers.Wallet(AVAX_CAP_KEEPER_KEY).connect(provider)

  const vault = await contractAt("Vault", "0x33Ce5A8D250861e35ae30361bA5634540EBCaEB2")
  const timelock = await contractAt("Timelock", await vault.gov(), signer)
  const router = await contractAt("Router", await vault.router(), signer)
  const weth = await contractAt("WETH", tokens.nativeToken.address)
  const referralStorage = await contractAt("ReferralStorage", "0x827ED045002eCdAbEb6e2b0d1604cf5fC3d322F8")
  const shortsTracker = await contractAt("ShortsTracker", "0x9234252975484D75Fd05f3e4f7BdbEc61956D73a", signer)
  const shortsTrackerTimelock = await contractAt("ShortsTrackerTimelock", "0xf58eEc83Ba28ddd79390B9e90C4d3EbfF1d434da", signer)
  const depositFee = "30" // 0.3%
  const minExecutionFee = "20000000000000000" // 0.02 AVAX

  return {
    capKeeperWallet,
    vault,
    timelock,
    router,
    weth,
    referralStorage,
    shortsTracker,
    shortsTrackerTimelock,
    depositFee,
    minExecutionFee
  }
}

async function getHederaTestnetValues(signer) {
  const provider = new ethers.providers.JsonRpcProvider(HEDERA_TESTNET_URL)
  const capKeeperWallet = new ethers.Wallet(HEDERA_TESTNET_PRIVATE_KEY).connect(provider)
  const deployer = { address: "0xeD37FD0d6F0f69236E7472B36796e133D20EcC32" }

  const vault = await contractAt("Vault", "0x2D641633FE39fAc1E79085dCAF91244EcBBda809")
  // const timelockDeployed = await deployContract("Timelock", [
  //   deployer.address, // _admin
  //   5 * 24 * 60 * 60, // _buffer
  //   ethers.constants.AddressZero, // _tokenManager
  //   ethers.constants.AddressZero, // _mintReceiver
  //   ethers.constants.AddressZero, // _glpManager
  //   ethers.constants.AddressZero, // _prevGlpManager
  //   ethers.constants.AddressZero, // _rewardRouter
  //   expandDecimals(1000, 18), // _maxTokenSupply
  //   10, // _marginFeeBasisPoints
  //   100 // _maxMarginFeeBasisPoints
  // ])
  // writeTmpAddresses({
  //   vaultTimelock: timelockDeployed.address
  // })

  // await sendTxn(vault.setGov(timelockDeployed.address), "vault.setGov")

  const timelock = await contractAt("Timelock", await vault.gov(), capKeeperWallet)

  const router = await contractAt("Router", await vault.router(), capKeeperWallet)
  const weth = await contractAt("WETH", tokens.nativeToken.address)
  const referralStorage = await contractAt("ReferralStorage", "0x97bB30637DD7A71997F905Cd142cF89d2887ADb8")
  const shortsTracker = await contractAt("ShortsTracker", "0xEbB9F472C853675678e797D06D33682df8b167c8", capKeeperWallet)

  const shortsTrackerTimelockDeployed = await deployContract("ShortsTrackerTimelock", [deployer.address, 60, 300, 0])
  writeTmpAddresses({
    shortsTrackerTimelock: shortsTrackerTimelockDeployed.address
  })
  await sendTxn(shortsTracker.setGov("shortsTrackerTimelockDeployed.address"), "shortsTracker.setGov")

  const shortsTrackerTimelock = await contractAt("ShortsTrackerTimelock", await shortsTracker.gov(), capKeeperWallet)
  const depositFee = "30" // 0.3%
  const minExecutionFee = "20000000000000000" // 0.02 HBAR

  return {
    capKeeperWallet,
    vault,
    timelock,
    router,
    weth,
    referralStorage,
    shortsTracker,
    shortsTrackerTimelock,
    depositFee,
    minExecutionFee
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
  const signer = await getFrameSigner()
  const deployer = { address: "0xeD37FD0d6F0f69236E7472B36796e133D20EcC32" }

  const {
    capKeeperWallet,
    vault,
    timelock,
    router,
    weth,
    shortsTracker,
    shortsTrackerTimelock,
    depositFee,
    minExecutionFee,
    referralStorage
  } = await getValues(signer)

  const positionUtils = await deployContract("PositionUtils", [])


  /* COMMENT WHEN NEED TO DEPLOY
  const referralStorageTimelock = await deployContract("Timelock", [
    deployer.address, // _admin
    5 * 24 * 60 * 60, // _buffer
    ethers.constants.AddressZero, // _tokenManager
    ethers.constants.AddressZero, // _mintReceiver
    ethers.constants.AddressZero, // _glpManager
    ethers.constants.AddressZero, // _prevGlpManager
    ethers.constants.AddressZero, // _rewardRouter
    expandDecimals(1000, 18), // _maxTokenSupply
    50, // marginFeeBasisPoints 0.5%
    500, // maxMarginFeeBasisPoints 5%
  ])
  writeTmpAddresses({
    referralStorageTimelock: referralStorageTimelock.address
  })
  await sendTxn(referralStorage.setGov(referralStorageTimelock.address), "referralStorage.setGov")
  */

  await positionUtils.deployed()
  writeTmpAddresses({
    positionUtils: positionUtils.address
  })


  const referralStorageGov = await contractAt("Timelock", "0x147211793495687538ec26a44156CCF2e3A4F2C1", capKeeperWallet)

  const positionRouterArgs = [vault.address, router.address, weth.address, shortsTracker.address, depositFee, minExecutionFee]

  const positionRouterContractFactory = await ethers.getContractFactory("PositionRouter", {
    libraries: {
      PositionUtils: positionUtils.address
    }
  })
  const positionRouter = await positionRouterContractFactory.deploy(...positionRouterArgs)

  writeTmpAddresses({
    positionRouter: positionRouter.address
  })

  await positionRouter.deployed()
  //Workaround
  const positionRouterAddress = positionRouter.address
  console.log("positionRouterAddress: ", positionRouterAddress)

  await sendTxn(positionRouter.setReferralStorage(referralStorage.address), "positionRouter.setReferralStorage")
  await sendTxn(referralStorageGov.signalSetHandler("0x97bB30637DD7A71997F905Cd142cF89d2887ADb8", positionRouterAddress, true), "referralStorage.signalSetHandler(positionRouter)")

  await sendTxn(shortsTrackerTimelock.signalSetHandler(shortsTracker.address, positionRouterAddress, true), "shortsTrackerTimelock.signalSetHandler(positionRouter)")

  await sendTxn(router.addPlugin(positionRouterAddress), "router.addPlugin")

  await sendTxn(positionRouter.setDelayValues(0, 180, 30 * 60), "positionRouter.setDelayValues")
  await sendTxn(timelock.setContractHandler(positionRouterAddress, true), "timelock.setContractHandler(positionRouter)")

  await sendTxn(positionRouter.setGov(await vault.gov()), "positionRouter.setGov")

  await sendTxn(positionRouter.setAdmin(capKeeperWallet.address), "positionRouter.setAdmin")
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
