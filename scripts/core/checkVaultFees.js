const { contractAt, readTmpAddresses } = require("../shared/helpers")
const { expandDecimals } = require("../../test/shared/utilities")

const network = (process.env.HARDHAT_NETWORK || 'hederaTestnet');
const tokens = require('./tokens')[network];

async function main() {
  const [signer] = await ethers.getSigners()
  
  // Read deployed addresses
  const addresses = readTmpAddresses()
  
  // Get vault contract
  const vault = await contractAt("Vault", addresses.vault)
  const { link } = tokens
  
  console.log("🔍 Checking Vault Fees and Position Requirements")
  console.log("Vault address:", vault.address)
  
  try {
    // Check fee structure
    console.log("\n=== Fee Structure ===")
    
    const marginFeeBasisPoints = await vault.marginFeeBasisPoints()
    const liquidationFeeUsd = await vault.liquidationFeeUsd()
    const fundingRateFactor = await vault.fundingRateFactor()
    const stableFundingRateFactor = await vault.stableFundingRateFactor()
    
    console.log("Margin fee basis points:", marginFeeBasisPoints.toString(), "(" + (marginFeeBasisPoints.toNumber() / 100) + "%)")
    console.log("Liquidation fee USD:", ethers.utils.formatUnits(liquidationFeeUsd, 30))
    console.log("Funding rate factor:", fundingRateFactor.toString())
    console.log("Stable funding rate factor:", stableFundingRateFactor.toString())
    
    // Check LINK-specific settings
    console.log("\n=== LINK Token Settings ===")
    
    const isWhitelisted = await vault.whitelistedTokens(link.address)
    const tokenDecimals = await vault.tokenDecimals(link.address)
    const tokenWeights = await vault.tokenWeights(link.address)
    const minProfitBasisPoints = await vault.minProfitBasisPoints(link.address)
    const maxUsdgAmounts = await vault.maxUsdgAmounts(link.address)
    const isStableToken = await vault.stableTokens(link.address)
    const isShortableToken = await vault.shortableTokens(link.address)
    
    console.log("Is whitelisted:", isWhitelisted)
    console.log("Token decimals:", tokenDecimals.toString())
    console.log("Token weight:", tokenWeights.toString())
    console.log("Min profit basis points:", minProfitBasisPoints.toString(), "(" + (minProfitBasisPoints.toNumber() / 100) + "%)")
    console.log("Max USDG amount:", ethers.utils.formatUnits(maxUsdgAmounts, 30))
    console.log("Is stable token:", isStableToken)
    console.log("Is shortable token:", isShortableToken)
    
    // Check current price
    const linkPrice = await vault.getMinPrice(link.address)
    console.log("Current LINK price:", ethers.utils.formatUnits(linkPrice, 30))
    
    // Calculate minimum position requirements
    console.log("\n=== Position Requirements Analysis ===")
    
    // For a position to be valid:
    // 1. Collateral must cover liquidation fees
    // 2. Position size must be reasonable vs collateral
    
    const collateralAmount = expandDecimals(5, 18) // Try 5 LINK
    const collateralValueUsd = linkPrice.mul(collateralAmount).div(expandDecimals(1, 18))
    
    console.log(`With ${ethers.utils.formatEther(collateralAmount)} LINK collateral:`)
    console.log("- Collateral value (USD):", ethers.utils.formatUnits(collateralValueUsd, 30))
    console.log("- Liquidation fee:", ethers.utils.formatUnits(liquidationFeeUsd, 30))
    console.log("- Available for position:", ethers.utils.formatUnits(collateralValueUsd.sub(liquidationFeeUsd), 30))
    
    // Calculate safe position size (2x leverage)
    const safePositionSize = collateralValueUsd.mul(2)
    console.log("- Safe 2x position size:", ethers.utils.formatUnits(safePositionSize, 30))
    
    // Calculate fees for this position
    const marginFee = safePositionSize.mul(marginFeeBasisPoints).div(10000)
    console.log("- Margin fee for position:", ethers.utils.formatUnits(marginFee, 30))
    console.log("- Total fees:", ethers.utils.formatUnits(liquidationFeeUsd.add(marginFee), 30))
    
    const netCollateral = collateralValueUsd.sub(liquidationFeeUsd).sub(marginFee)
    console.log("- Net collateral after fees:", ethers.utils.formatUnits(netCollateral, 30))
    
    if (netCollateral.gt(0)) {
      console.log("✅ This position would be viable!")
    } else {
      console.log("❌ This position would fail - fees exceed collateral")
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
