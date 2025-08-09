const { contractAt, readTmpAddresses, sendTxn } = require("../shared/helpers")
const { expandDecimals } = require("../../test/shared/utilities")

const network = (process.env.HARDHAT_NETWORK || 'hederaTestnet');

async function main() {
  const [signer] = await ethers.getSigners()
  
  // Read deployed addresses
  const addresses = readTmpAddresses()
  
  // Get vault contract
  const vault = await contractAt("Vault", addresses.vault)
  
  console.log("🔧 Adjusting Vault Settings for Testing")
  console.log("Vault address:", vault.address)
  console.log("Signer address:", signer.address)
  
  try {
    // Check current liquidation fee
    const currentLiquidationFee = await vault.liquidationFeeUsd()
    console.log("Current liquidation fee (USD):", ethers.utils.formatUnits(currentLiquidationFee, 30))
    
    // Get current fee settings first
    const currentTaxBasisPoints = await vault.taxBasisPoints()
    const currentStableTaxBasisPoints = await vault.stableTaxBasisPoints()
    const currentMintBurnFeeBasisPoints = await vault.mintBurnFeeBasisPoints()
    const currentSwapFeeBasisPoints = await vault.swapFeeBasisPoints()
    const currentStableSwapFeeBasisPoints = await vault.stableSwapFeeBasisPoints()
    const currentMarginFeeBasisPoints = await vault.marginFeeBasisPoints()
    const currentMinProfitTime = await vault.minProfitTime()
    const currentHasDynamicFees = await vault.hasDynamicFees()
    
    console.log("\n=== Current Fee Settings ===")
    console.log("Tax basis points:", currentTaxBasisPoints.toString())
    console.log("Margin fee basis points:", currentMarginFeeBasisPoints.toString())
    console.log("Liquidation fee USD:", ethers.utils.formatUnits(currentLiquidationFee, 30))
    
    // Set much lower fees for testing
    const newLiquidationFee = expandDecimals(1, 28) // $0.01
    const newMarginFee = 1 // 0.01%
    
    console.log("\n=== Setting Lower Fees for Testing ===")
    console.log("New liquidation fee:", ethers.utils.formatUnits(newLiquidationFee, 30), "USD")
    console.log("New margin fee:", newMarginFee, "basis points")
    
    await sendTxn(
      vault.setFees(
        currentTaxBasisPoints,           // _taxBasisPoints (keep same)
        currentStableTaxBasisPoints,     // _stableTaxBasisPoints (keep same)
        currentMintBurnFeeBasisPoints,   // _mintBurnFeeBasisPoints (keep same)
        currentSwapFeeBasisPoints,       // _swapFeeBasisPoints (keep same)
        currentStableSwapFeeBasisPoints, // _stableSwapFeeBasisPoints (keep same)
        newMarginFee,                    // _marginFeeBasisPoints (reduce)
        newLiquidationFee,               // _liquidationFeeUsd (reduce)
        currentMinProfitTime,            // _minProfitTime (keep same)
        currentHasDynamicFees            // _hasDynamicFees (keep same)
      ),
      "Set lower fees for testing"
    )
    
    // Verify the changes
    const updatedLiquidationFee = await vault.liquidationFeeUsd()
    const updatedMarginFee = await vault.marginFeeBasisPoints()
    console.log("✅ New liquidation fee:", ethers.utils.formatUnits(updatedLiquidationFee, 30), "USD")
    console.log("✅ New margin fee:", updatedMarginFee.toString(), "basis points")
    
    // Test position viability now
    console.log("\n=== Testing Position Viability ===")
    const { link } = require('./tokens')[network]
    
    const linkPrice = await vault.getMinPrice(link.address)
    console.log("LINK price:", ethers.utils.formatUnits(linkPrice, 30))
    
    const collateralAmount = expandDecimals(2, 18) // 2 LINK
    const collateralValue = linkPrice.mul(collateralAmount).div(expandDecimals(1, 18))
    
    console.log("With 2 LINK collateral:")
    console.log("- Collateral value:", ethers.utils.formatUnits(collateralValue, 30), "USD")
    console.log("- Liquidation fee:", ethers.utils.formatUnits(updatedLiquidationFee, 30), "USD")
    console.log("- Available for position:", ethers.utils.formatUnits(collateralValue.sub(updatedLiquidationFee), 30), "USD")
    
    if (collateralValue.gt(updatedLiquidationFee)) {
      console.log("✅ Positions should now be possible!")
      
      // Calculate max safe leverage
      const availableForPosition = collateralValue.sub(updatedLiquidationFee)
      const maxPositionSize = availableForPosition.mul(95).div(100) // 95% safety margin
      const leverage = maxPositionSize.div(collateralValue.sub(updatedLiquidationFee))
      
      console.log("- Max safe position size:", ethers.utils.formatUnits(maxPositionSize, 30), "USD")
      console.log("- Estimated safe leverage:", ethers.utils.formatUnits(leverage, 30), "x")
      
    } else {
      console.log("❌ Still not viable - need higher LINK price or lower fees")
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
