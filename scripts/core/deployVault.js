const { deployContract, contractAt, sendTxn, writeTmpAddresses } = require("../shared/helpers")
const { expandDecimals } = require("../../test/shared/utilities")
const { toUsd } = require("../../test/shared/units")
const { errors } = require("../../test/core/Vault/helpers")

const network = (process.env.HARDHAT_NETWORK || 'hederaTestnet');
const tokens = require('./tokens')[network];

async function main() {
  const { nativeToken } = tokens

  const vault = await deployContract("Vault", [])
  const usdg = await deployContract("USDG", [vault.address])
  const router = await deployContract("Router", [vault.address, usdg.address, nativeToken.address])
  const vaultPriceFeed = await deployContract("VaultPriceFeed", [])
  const glp = await deployContract("GLP", [])
  const shortsTracker = await deployContract("ShortsTracker", [vault.address])
  const glpManager = await deployContract("GlpManager", [vault.address, usdg.address, glp.address, shortsTracker.address, 15 * 60])
  const vaultErrorController = await deployContract("VaultErrorController", [])
  const vaultUtils = await deployContract("VaultUtils", [vault.address])

  // Save all deployed addresses
  writeTmpAddresses({
    vault: vault.address,
    usdg: usdg.address,
    router: router.address,
    vaultPriceFeed: vaultPriceFeed.address,
    glp: glp.address,
    shortsTracker: shortsTracker.address,
    glpManager: glpManager.address,
    vaultErrorController: vaultErrorController.address,
    vaultUtils: vaultUtils.address
  })

  // Rest of your initialization code remains the same
  await sendTxn(vaultPriceFeed.setMaxStrictPriceDeviation(expandDecimals(1, 28)), "vaultPriceFeed.setMaxStrictPriceDeviation")
  await sendTxn(vaultPriceFeed.setPriceSampleSpace(1), "vaultPriceFeed.setPriceSampleSpace")
  await sendTxn(vaultPriceFeed.setIsAmmEnabled(false), "vaultPriceFeed.setIsAmmEnabled")

  await sendTxn(glp.setInPrivateTransferMode(true), "glp.setInPrivateTransferMode")
  await sendTxn(glpManager.setInPrivateMode(true), "glpManager.setInPrivateMode")

  await sendTxn(glp.setMinter(glpManager.address, true), "glp.setMinter")
  await sendTxn(usdg.addVault(glpManager.address), "usdg.addVault(glpManager)")

  await sendTxn(vault.initialize(
    router.address,
    usdg.address,
    vaultPriceFeed.address,
    toUsd(2),
    100,
    100
  ), "vault.initialize")

  await sendTxn(vault.setFundingRate(60 * 60, 100, 100), "vault.setFundingRate")

  await sendTxn(vault.setInManagerMode(true), "vault.setInManagerMode")
  await sendTxn(vault.setManager(glpManager.address, true), "vault.setManager")

  await sendTxn(vault.setFees(
    10, // _taxBasisPoints
    5, // _stableTaxBasisPoints
    20, // _mintBurnFeeBasisPoints
    20, // _swapFeeBasisPoints
    1, // _stableSwapFeeBasisPoints
    10, // _marginFeeBasisPoints
    toUsd(2), // _liquidationFeeUsd
    24 * 60 * 60, // _minProfitTime
    true // _hasDynamicFees
  ), "vault.setFees")

  await sendTxn(vault.setErrorController(vaultErrorController.address), "vault.setErrorController")
  await sendTxn(vaultErrorController.setErrors(vault.address, errors), "vaultErrorController.setErrors")
  await sendTxn(vault.setVaultUtils(vaultUtils.address), "vault.setVaultUtils")

  console.log("Deployment completed. Contract addresses saved to .tmp-addresses-hederaTestnet.json")
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
