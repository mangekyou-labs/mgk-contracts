const { deployContract, contractAt, sendTxn, readTmpAddresses, writeTmpAddresses } = require("../shared/helpers")
const { expandDecimals } = require("../../test/shared/utilities")
const { signExternally } = require("../shared/signer")
const { toUsd } = require("../../test/shared/units")

const network = (process.env.HARDHAT_NETWORK || 'mainnet');
const tokens = require('./tokens')[network];

const PositionRouter = require("../../artifacts/contracts/core/PositionRouter.sol/PositionRouter.json")

const {
  ARBITRUM_URL,
  ARBITRUM_CAP_KEEPER_KEY,
  AVAX_URL,
  AVAX_CAP_KEEPER_KEY,
  HEDERA_TESTNET_URL,
  HEDERA_CAP_KEEPER_KEY,
} = require("../../env.json")

async function getArbValues() {
  const pyth = { address: "0xff1a0f4744e8582df1ae09d5611b887b6a12925c" }
  const provider = new ethers.providers.JsonRpcProvider(ARBITRUM_URL)
  const capKeeperWallet = new ethers.Wallet(ARBITRUM_CAP_KEEPER_KEY).connect(provider)

  const { btc, eth, usdce, usdc, link, uni, usdt, mim, frax, dai } = tokens
  const tokenArr = [btc, eth, usdce, usdc, link, uni, usdt, mim, frax, dai]

  const fastPriceTokens = [btc, eth, link, uni]
  const fastPriceFeedIds = [
    "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43", // btc
    "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace", // eth
    "0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221", // link
    "0x78d185a741d07edb3412b09008b7c5cfb9bbbd7d568bf00ba737b456ba171501", // uni
  ]

  const priceFeedTimelock = { address: "0x7b1FFdDEEc3C4797079C7ed91057e399e9D43a8B" }

  const updater1 = { address: "0xd85A5c465824537eA2005590Da909447bca12525" }
  const updater2 = { address: "0x3FC8e4ED7695F44358B387d67940DF580d80bD5B" }
  const keeper1 = { address: "0xB5125Ddd773bf34671B60BB6FB31ae8AD43d0F86" }
  const keeper2 = { address: "0x70Fc9aE264E1e48BF77868a7A0A30Bf91f4E0d72" }
  const updaters = [updater1.address, updater2.address, keeper1.address, keeper2.address]

  const tokenManager = { address: "0x2c247a44928d66041D9F7B11A69d7a84d25207ba" }

  const positionRouter = new ethers.Contract("0xb87a436B93fFE9D75c5cFA7bAcFff96430b09868", PositionRouter.abi, capKeeperWallet);

  // const fastPriceEvents = await deployContract("FastPriceEvents", [])
  const fastPriceEvents = await contractAt("FastPriceEvents", "0x4530b7DE1958270A2376be192a24175D795e1b07")

  const chainlinkFlags = { address: "0x3C14e07Edd0dC67442FA96f1Ec6999c57E810a83" }

  return {
    pyth,
    fastPriceTokens,
    fastPriceFeedIds,
    fastPriceEvents,
    tokenManager,
    positionRouter,
    chainlinkFlags,
    tokenArr,
    updaters,
    priceFeedTimelock
  }
}

async function getAvaxValues() {
  const pyth = { address: "0x4305FB66699C3B2702D4d05CF36551390A4c69C6" }
  const provider = new ethers.providers.JsonRpcProvider(AVAX_URL)
  const capKeeperWallet = new ethers.Wallet(AVAX_CAP_KEEPER_KEY).connect(provider)

  const { avax, btc, btcb, eth, mim, usdce, usdc } = tokens
  const tokenArr = [avax, btc, btcb, eth, mim, usdce, usdc]

  const fastPriceTokens = [avax, btc, btcb, eth]
  const fastPriceFeedIds = [
    "0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7", // avax
    "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43", // btc
    "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43", // btcb
    "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace", // eth
  ]

  const priceFeedTimelock = { address: "0xCa8b5F2fF7B8d452bE8972B44Dc026Be96b97228" }

  const updater1 = { address: "0xd85A5c465824537eA2005590Da909447bca12525" }
  const updater2 = { address: "0x3FC8e4ED7695F44358B387d67940DF580d80bD5B" }
  const keeper1 = { address: "0xB5125Ddd773bf34671B60BB6FB31ae8AD43d0F86" }
  const keeper2 = { address: "0x70Fc9aE264E1e48BF77868a7A0A30Bf91f4E0d72" }
  const updaters = [updater1.address, updater2.address, keeper1.address, keeper2.address]

  const tokenManager = { address: "0x9bf98C09590CeE2Ec5F6256449754f1ba77d5aE5" }

  const positionRouter = new ethers.Contract("0xffF6D276Bc37c61A23f06410Dce4A400f66420f8", PositionRouter.abi, capKeeperWallet);

  // const fastPriceEvents = await deployContract("FastPriceEvents", [])
  const fastPriceEvents = await contractAt("FastPriceEvents", "0x02b7023D43bc52bFf8a0C54A9F2ecec053523Bf6")

  return {
    pyth,
    fastPriceTokens,
    fastPriceFeedIds,
    fastPriceEvents,
    tokenManager,
    positionRouter,
    tokenArr,
    updaters,
    priceFeedTimelock
  }
}

async function getHederaValues() {
  const pyth = { address: "0xa2aa501b19aff244d90cc15a4cf739d2725b5729" }
  const provider = new ethers.providers.JsonRpcProvider(HEDERA_TESTNET_URL)
  // const capKeeperWallet = new ethers.Wallet(HEDERA_CAP_KEEPER_KEY).connect(provider)

  const { nativeToken, btc, eth, link, usdc } = tokens
  const tokenArr = [nativeToken, link, usdc]

  const fastPriceTokens = [nativeToken, link]
  const fastPriceFeedIds = [
    "0x3728e591097635310e6341af53db8b7ee42da9b3a8d918f9463ce9cca886dfbd", // hbar
    "0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221", // link
  ]

  // const priceFeedTimelock = { address: "0xCa8b5F2fF7B8d452bE8972B44Dc026Be96b97228" }

  const updater1 = { address: "0x7A23f6457A23A7A9D8a0dDab0b85d94123E53389" }
  const updater2 = { address: "0x7A23f6457A23A7A9D8a0dDab0b85d94123E53389" }
  const keeper1 = { address: "0x7A23f6457A23A7A9D8a0dDab0b85d94123E53389" }
  const keeper2 = { address: "0x7A23f6457A23A7A9D8a0dDab0b85d94123E53389" }
  const updaters = [updater1.address, updater2.address, keeper1.address, keeper2.address]

  const tokenManager = { address: "0xAf3C069A40fA3D438FAdcC58737F088B41b1FC0B" }

  // const positionRouter = new ethers.Contract("0xffF6D276Bc37c61A23f06410Dce4A400f66420f8", PositionRouter.abi, capKeeperWallet);

  const fastPriceEvents = await deployContract("FastPriceEvents", [])
  writeTmpAddresses({
    fastPriceEvents: fastPriceEvents.address
  })
  //const fastPriceEvents = await contractAt("FastPriceEvents", "0x02b7023D43bc52bFf8a0C54A9F2ecec053523Bf6")

  return {
    pyth,
    fastPriceTokens,
    fastPriceFeedIds,
    fastPriceEvents,
    tokenManager,
    // positionRouter,
    tokenArr,
    updaters
  }
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
  const deployer = { address: "0x7A23f6457A23A7A9D8a0dDab0b85d94123E53389" }
  const buffer = 60 * 30 // 30 minutes

  const {
    pyth,
    fastPriceTokens,
    fastPriceFeedIds,
    fastPriceEvents,
    tokenManager,
    // positionRouter,
    chainlinkFlags,
    tokenArr,
    updaters,
  } = await getValues()

  const signers = [
    "0xfED930B2DBbc52996b2E107F1396d82256F41c41", // Kyler
    "0xeD37FD0d6F0f69236E7472B36796e133D20EcC32" // Admin
  ]

  if (fastPriceTokens.find(t => !t.fastPricePrecision)) {
    throw new Error("Invalid price precision")
  }

  if (fastPriceTokens.find(t => !t.maxCumulativeDeltaDiff)) {
    throw new Error("Invalid price maxCumulativeDeltaDiff")
  }

  const priceFeedTimelock = await deployContract("PriceFeedTimelock", [
    deployer.address,
    buffer,
    tokenManager.address
  ], "Timelock")

  writeTmpAddresses({
    priceFeedTimelock: priceFeedTimelock.address
  })

  // const vaultPriceFeed = await deployContract("VaultPriceFeed", [])
  const vaultPriceFeed = await contractAt("VaultPriceFeed", "0x5c882561E531064DB9845d4021F94f49E13bB578")

  await sendTxn(vaultPriceFeed.setMaxStrictPriceDeviation(expandDecimals(1, 28)), "vaultPriceFeed.setMaxStrictPriceDeviation") // 0.01 USD
  await sendTxn(vaultPriceFeed.setPriceSampleSpace(1), "vaultPriceFeed.setPriceSampleSpace")
  await sendTxn(vaultPriceFeed.setIsAmmEnabled(false), "vaultPriceFeed.setIsAmmEnabled")

  if (chainlinkFlags) {
    await sendTxn(vaultPriceFeed.setChainlinkFlags(chainlinkFlags.address), "vaultPriceFeed.setChainlinkFlags")
  }

  for (const [i, tokenItem] of tokenArr.entries()) {
    if (tokenItem.spreadBasisPoints === undefined) { continue }
    await sendTxn(vaultPriceFeed.setSpreadBasisPoints(
      tokenItem.address, // _token
      tokenItem.spreadBasisPoints // _spreadBasisPoints
    ), `vaultPriceFeed.setSpreadBasisPoints(${tokenItem.name}) ${tokenItem.spreadBasisPoints}`)
  }

  for (const token of tokenArr) {
    await sendTxn(vaultPriceFeed.setTokenConfig(
      token.address, // _token
      token.priceFeed, // _priceFeed
      token.priceDecimals, // _priceDecimals
      token.isStrictStable // _isStrictStable
    ), `vaultPriceFeed.setTokenConfig(${token.name}) ${token.address} ${token.priceFeed}`)
  }

  const secondaryPriceFeed = await deployContract("FastPriceFeed", [
    pyth.address, // _pyth
    5 * 60, // _priceDuration
    60 * 60, // _maxPriceUpdateDelay
    0, // _minBlockInterval
    250, // _maxDeviationBasisPoints
    vaultPriceFeed.address, // _vaultPriceFeed
    fastPriceEvents.address, // _fastPriceEvents
    deployer.address // _tokenManager
  ])

  writeTmpAddresses({
    secondaryPriceFeed: secondaryPriceFeed.address
  })

  await sendTxn(secondaryPriceFeed.initialize(
    1, // _minAuthorizations
    signers, // _signers
    updaters, // _updaters
    fastPriceTokens.map(t => t.address), // _tokens
    fastPriceFeedIds, // _priceFeedIds
  ), "secondaryPriceFeed.initialize")

  await sendTxn(secondaryPriceFeed.setSpreadBasisPointsIfInactive(50), "secondaryPriceFeed.setSpreadBasisPointsIfInactive")
  await sendTxn(secondaryPriceFeed.setSpreadBasisPointsIfChainError(500), "secondaryPriceFeed.setSpreadBasisPointsIfChainError")
  await sendTxn(secondaryPriceFeed.setMaxCumulativeDeltaDiffs(fastPriceTokens.map(t => t.address), fastPriceTokens.map(t => t.maxCumulativeDeltaDiff)), "secondaryPriceFeed.setMaxCumulativeDeltaDiffs")
  await sendTxn(secondaryPriceFeed.setPriceDataInterval(1 * 60), "secondaryPriceFeed.setPriceDataInterval")

  // setPositionKeeper(secondaryPriceFeed.address, true), "positionRouter.setPositionKeeper(secondaryPriceFeed)")

  await sendTxn(vaultPriceFeed.setSecondaryPriceFeed(secondaryPriceFeed.address), "vaultPriceFeed.setSecondaryPriceFeed")

  // await sendTxn(vaultPriceFeed.setGov(priceFeedTimelock.address), "vaultPriceFeed.setGov")
  // await sendTxn(secondaryPriceFeed.setGov(priceFeedTimelock.address), "secondaryPriceFeed.setGov")
  await sendTxn(secondaryPriceFeed.setTokenManager(tokenManager.address), "secondaryPriceFeed.setTokenManager")

  await signExternally(await fastPriceEvents.populateTransaction.setIsPriceFeed(secondaryPriceFeed.address, true));
}

main().catch((ex) => {
  console.error(ex);
  process.exit(1);
});
