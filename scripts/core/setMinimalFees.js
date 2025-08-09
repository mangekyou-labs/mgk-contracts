const { contractAt, readTmpAddresses, sendTxn } = require("../shared/helpers")
const { expandDecimals } = require("../../test/shared/utilities")

const network = (process.env.HARDHAT_NETWORK || 'hederaTestnet');

async function main() {
  const [signer] = await ethers.getSigners()
  
  // Read deployed addresses
  const addresses = readTmpAddresses()
  
  // Get vault contract
  const vault = await contractAt("Vault", addresses.vault)
  
  console.log("🔧 Setting Minimal Fees to Work with Current Prices")
  console.log("Vault address:", vault.address)
  
  try {
    // Check current price and calculate what we need
    const { link } = require('./tokens')[network]
    const linkPrice = await vault.getMinPrice(link.address)
    console.log("Current LINK price:", ethers.utils.formatUnits(linkPrice, 30), "USD")
    
    // With 10 LINK collateral
    const collateralAmount = expandDecimals(10, 18)
    const collateralValue = linkPrice.mul(collateralAmount).div(expandDecimals(1, 18))
    console.log("10 LINK collateral value:", ethers.utils.formatUnits(collateralValue, 30), "USD")
    
    // Set liquidation fee to 10% of collateral value
    const safeLiquidationFee = collateralValue.div(10)
    console.log("Safe liquidation fee (10% of collateral):", ethers.utils.formatUnits(safeLiquidationFee, 30), "USD")
    
    // Get current settings
    const currentTaxBasisPoints = await vault.taxBasisPoints()
    const currentStableTaxBasisPoints = await vault.stableTaxBasisPoints()
    const currentMintBurnFeeBasisPoints = await vault.mintBurnFeeBasisPoints()
    const currentSwapFeeBasisPoints = await vault.swapFeeBasisPoints()
    const currentStableSwapFeeBasisPoints = await vault.stableSwapFeeBasisPoints()
    const currentMinProfitTime = await vault.minProfitTime()
    const currentHasDynamicFees = await vault.hasDynamicFees()
    
    // Set ultra-minimal fees
    await sendTxn(
      vault.setFees(
        currentTaxBasisPoints,           // keep same
        currentStableTaxBasisPoints,     // keep same  
        currentMintBurnFeeBasisPoints,   // keep same
        currentSwapFeeBasisPoints,       // keep same
        currentStableSwapFeeBasisPoints, // keep same
        1,                              // _marginFeeBasisPoints (0.01%)
        safeLiquidationFee,             // _liquidationFeeUsd (dynamic)
        currentMinProfitTime,           // keep same
        currentHasDynamicFees           // keep same
      ),
      "Set minimal fees"
    )
    
    const newLiquidationFee = await vault.liquidationFeeUsd()
    console.log("✅ New liquidation fee:", ethers.utils.formatUnits(newLiquidationFee, 30), "USD")
    
    // Test position viability
    const availableForPosition = collateralValue.sub(newLiquidationFee)
    console.log("Available for position:", ethers.utils.formatUnits(availableForPosition, 30), "USD")
    
    if (availableForPosition.gt(0)) {
      console.log("✅ Positions should now work!")
      
      // Calculate safe position size
      const safePositionSize = availableForPosition.mul(90).div(100) // 90% safety margin
      console.log("Safe position size:", ethers.utils.formatUnits(safePositionSize, 30), "USD")
      
      // Estimate leverage
      const effectiveLeverage = safePositionSize.div(collateralValue)
      console.log("Effective leverage:", ethers.utils.formatUnits(effectiveLeverage, 30), "x")
      
    } else {
      console.log("❌ Still not viable")
    }
    
  } catch (error) {
    console.log("Error:", error.message)
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
