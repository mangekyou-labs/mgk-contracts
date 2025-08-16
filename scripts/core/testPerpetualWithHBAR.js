const { contractAt, readTmpAddresses, sendTxn } = require("../shared/helpers")
const { expandDecimals } = require("../../test/shared/utilities")

const network = (process.env.HARDHAT_NETWORK || 'hederaTestnet');
const tokens = require('./tokens')[network];

async function main() {
  const [signer] = await ethers.getSigners()
  
  // Read deployed addresses
  const addresses = readTmpAddresses()
  
  console.log("🚀 Testing Perpetual Positions with HBAR Collateral")
  console.log("Signer address:", signer.address)
  console.log("Vault address:", addresses.vault)
  
  try {
    // Get contracts
    const vault = await contractAt("Vault", addresses.vault)
    const { link, nativeToken } = tokens
    
    // Check current state
    console.log("\n=== Current State ===")
    const hbarBalance = await ethers.provider.getBalance(signer.address)
    const hbarPrice = await vault.getMinPrice(nativeToken.address)
    const liquidationFee = await vault.liquidationFeeUsd()
    
    console.log("HBAR balance:", ethers.utils.formatEther(hbarBalance))
    console.log("HBAR price:", ethers.utils.formatUnits(hbarPrice, 30), "USD")
    console.log("Liquidation fee:", ethers.utils.formatUnits(liquidationFee, 30), "USD")
    
    // Check vault pool amounts
    const hbarPoolAmount = await vault.poolAmounts(nativeToken.address)
    console.log("HBAR pool amount:", ethers.utils.formatEther(hbarPoolAmount))
    
    if (hbarBalance.eq(0)) {
      console.log("❌ No HBAR balance available for testing")
      return
    }
    
    // Calculate a safe position size
    const collateralAmount = hbarBalance.div(10) // Use 10% of available HBAR
    const collateralValue = hbarPrice.mul(collateralAmount).div(expandDecimals(1, 18))
    
    console.log("\n=== Position Setup ===")
    console.log("Using collateral:", ethers.utils.formatEther(collateralAmount), "HBAR")
    console.log("Collateral value:", ethers.utils.formatUnits(collateralValue, 30), "USD")
    
    if (collateralValue.lte(liquidationFee)) {
      console.log("❌ Collateral value too low compared to liquidation fee")
      console.log("Need more HBAR or lower fees")
      return
    }
    
    // Calculate position size (slightly larger than collateral for leverage)
    const positionSize = collateralValue.add(liquidationFee).add(1) // Just enough to be leveraged
    
    console.log("Position size:", ethers.utils.formatUnits(positionSize, 30), "USD")
    console.log("Effective leverage:", ethers.utils.formatUnits(positionSize.div(collateralValue), 30), "x")
    
    // Try to open a long position using HBAR as collateral and LINK as index
    console.log("\n🟢 === Opening LONG Position (HBAR collateral, LINK index) ===")
    
    try {
      // First, we need to wrap HBAR to WHBAR
      console.log("Wrapping HBAR to WHBAR...")
      
      // Check if we can use native HBAR directly
      console.log("Attempting to use native HBAR directly...")
      
      // Try to open position with native HBAR
      await sendTxn(
        vault.increasePosition(
          signer.address,     // account
          nativeToken.address, // collateralToken (HBAR)
          link.address,       // indexToken (LINK)
          positionSize,       // sizeDelta
          true                // isLong
        ),
        "Open long position with HBAR collateral"
      )
      
      console.log("✅ Position opened successfully!")
      
      // Check the position
      const positionKey = ethers.utils.solidityKeccak256(
        ["address", "address", "address", "bool"],
        [signer.address, nativeToken.address, link.address, true]
      )
      
      const position = await vault.positions(positionKey)
      if (position[0].gt(0)) {
        console.log("\n=== Position Details ===")
        console.log("Position size:", ethers.utils.formatUnits(position[0], 30), "USD")
        console.log("Collateral:", ethers.utils.formatUnits(position[1], 30), "USD")
        console.log("Average price:", ethers.utils.formatUnits(position[2], 30))
        console.log("Entry funding rate:", position[3].toString())
        console.log("Reserve amount:", ethers.utils.formatEther(position[4]), "HBAR")
        
        // Calculate actual leverage
        const actualLeverage = position[0].div(position[1])
        console.log("Actual leverage:", ethers.utils.formatUnits(actualLeverage, 30), "x")
        
        console.log("\n✅ Perpetual position test completed successfully!")
        
        // Test decreasing the position
        console.log("\n🟡 === Testing Position Decrease ===")
        const decreaseSize = position[0].div(2) // Decrease by half
        const decreaseCollateral = position[1].div(2) // Decrease collateral by half
        
        await sendTxn(
          vault.decreasePosition(
            signer.address,     // account
            nativeToken.address, // collateralToken
            link.address,       // indexToken
            decreaseCollateral, // collateralDelta
            decreaseSize,       // sizeDelta
            true,               // isLong
            signer.address      // receiver
          ),
          "Decrease position"
        )
        
        console.log("✅ Position decreased successfully!")
        
        // Check updated position
        const updatedPosition = await vault.positions(positionKey)
        console.log("Updated position size:", ethers.utils.formatUnits(updatedPosition[0], 30), "USD")
        console.log("Updated collateral:", ethers.utils.formatUnits(updatedPosition[1], 30), "USD")
        
      } else {
        console.log("❌ No position created")
      }
      
    } catch (positionError) {
      console.log("❌ Position error:", positionError.message)
      
      // Try alternative approach - use HBAR as both collateral and index
      console.log("\n🟡 === Trying HBAR as both collateral and index ===")
      
      try {
        await sendTxn(
          vault.increasePosition(
            signer.address,     // account
            nativeToken.address, // collateralToken (HBAR)
            nativeToken.address, // indexToken (HBAR)
            positionSize,       // sizeDelta
            true                // isLong
          ),
          "Open long position with HBAR as both collateral and index"
        )
        
        console.log("✅ HBAR position opened successfully!")
        
      } catch (hbarPositionError) {
        console.log("❌ HBAR position error:", hbarPositionError.message)
      }
    }
    
  } catch (error) {
    console.log("❌ Error:", error.message)
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
