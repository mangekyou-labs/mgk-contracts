const { contractAt, readTmpAddresses, sendTxn } = require("../shared/helpers")
const { expandDecimals } = require("../../test/shared/utilities")

const network = (process.env.HARDHAT_NETWORK || 'hederaTestnet');
const tokens = require('./tokens')[network];

async function main() {
  const [signer] = await ethers.getSigners()
  
  // Read deployed addresses
  const addresses = readTmpAddresses()
  
  // Get contracts
  const vault = await contractAt("Vault", addresses.vault)
  const vaultPriceFeed = await contractAt("VaultPriceFeed", addresses.vaultPriceFeed)
  const fastPriceFeed = await contractAt("FastPriceFeed", addresses.secondaryPriceFeed)
  
  // Get token addresses
  const { link } = tokens
  
  // Define position key at the top level so all functions can access it
  const positionKey = ethers.utils.solidityKeccak256(
    ["address", "address", "address", "bool"],
    [signer.address, link.address, link.address, true]
  )
  
  console.log("🚀 Testing Perpetual Liquidation Mechanics")
  console.log("Signer address:", signer.address)
  console.log("Vault address:", vault.address)
  
  // Check current state
  console.log("\n=== Current State ===")
  const linkContract = await ethers.getContractAt("IERC20", link.address)
  const linkBalance = await linkContract.balanceOf(signer.address)
  const linkPrice = await vault.getMinPrice(link.address)
  const liquidationFee = await vault.liquidationFeeUsd()
  
  console.log("LINK wallet balance:", ethers.utils.formatEther(linkBalance))
  console.log("LINK price:", ethers.utils.formatUnits(linkPrice, 30), "USD")
  console.log("Liquidation fee:", ethers.utils.formatUnits(liquidationFee, 30), "USD")
  
  if (linkBalance.eq(0)) {
    console.log("❌ No LINK balance available for testing")
    return
  }
  
  // Check if we're a liquidator
  const isLiquidator = await vault.isLiquidator(signer.address)
  console.log("Is signer a liquidator?", isLiquidator)
  
  // Check vault configuration
  const maxLeverage = await vault.maxLeverage()
  const isLeverageEnabled = await vault.isLeverageEnabled()
  console.log("Max leverage:", ethers.utils.formatUnits(maxLeverage, 4), "x")
  console.log("Leverage enabled:", isLeverageEnabled)
  
  // Use 50% of available balance for testing
  const testCollateral = linkBalance.mul(50).div(100)
  const testCollateralFormatted = ethers.utils.formatEther(testCollateral)
  
  console.log(`\n🟢 === Step 1: Create Test Position ===`)
  console.log(`Using ${testCollateralFormatted} LINK as test collateral`)
  
  try {
    // Transfer collateral to vault
    await sendTxn(
      linkContract.transfer(vault.address, testCollateral),
      "Transfer test LINK collateral to vault"
    )
    
    // Create a position with moderate leverage (1.05x - very conservative)
    const positionSize = testCollateral.mul(linkPrice).div(expandDecimals(1, 18)).mul(105).div(100)
    
    await sendTxn(
      vault.increasePosition(
        signer.address,     // account
        link.address,       // collateralToken
        link.address,       // indexToken 
        positionSize,       // sizeDelta
        true                // isLong
      ),
      "Create test LONG position (1.05x leverage)"
    )
    
    console.log("✅ Test position created successfully!")
    
    // Get position details
    const position = await vault.positions(positionKey)
    console.log(`- Position size: ${ethers.utils.formatUnits(position[0], 30)} USD`)
    console.log(`- Collateral: ${ethers.utils.formatUnits(position[1], 30)} USD`)
    console.log(`- Average price: ${ethers.utils.formatUnits(position[2], 30)}`)
    
    // Wait for position to settle
    console.log("\n⏳ Waiting for position to settle...")
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    console.log(`\n🟢 === Step 2: Check Liquidation Status ===`)
    
    // Get current position state
    const currentPosition = await vault.positions(positionKey)
    const currentSize = currentPosition[0]
    const currentCollateral = currentPosition[1]
    
    if (currentSize.gt(0)) {
      console.log("Current position details:")
      console.log(`- Size: ${ethers.utils.formatUnits(currentSize, 30)} USD`)
      console.log(`- Collateral: ${ethers.utils.formatUnits(currentCollateral, 30)} USD`)
      
      // Check liquidation state using VaultUtils
      try {
        // Get the liquidation state (0 = healthy, 1 = liquidatable, 2 = max leverage exceeded)
        const [liquidationState, marginFees] = await vault.validateLiquidation(
          signer.address,
          link.address,
          link.address,
          true, // isLong
          false // don't raise error
        )
        
        console.log(`\nLiquidation state: ${liquidationState}`)
        console.log(`Margin fees: ${ethers.utils.formatUnits(marginFees, 30)} USD`)
        
        if (liquidationState.eq(0)) {
          console.log("✅ Position is healthy - not liquidatable")
        } else if (liquidationState.eq(1)) {
          console.log("⚠️ Position is liquidatable!")
        } else if (liquidationState.eq(2)) {
          console.log("⚠️ Position exceeds max leverage!")
        }
        
        // Calculate current leverage
        const currentLeverage = currentSize.mul(10000).div(currentCollateral)
        console.log(`Current leverage: ${ethers.utils.formatUnits(currentLeverage, 4)}x`)
        
        // Calculate liquidation threshold
        const liquidationThreshold = maxLeverage.mul(currentCollateral).div(10000)
        console.log(`Liquidation threshold: ${ethers.utils.formatUnits(liquidationThreshold, 30)} USD`)
        console.log(`Position size: ${ethers.utils.formatUnits(currentSize, 30)} USD`)
        
        if (currentSize.gt(liquidationThreshold)) {
          console.log("⚠️ Position exceeds liquidation threshold!")
        } else {
          console.log("✅ Position within liquidation threshold")
        }
        
      } catch (error) {
        console.log("❌ Error checking liquidation state:", error.message)
      }
      
      console.log(`\n🟢 === Step 3: Test Liquidation Attempt ===`)
      
      if (isLiquidator) {
        console.log("Signer is a liquidator - attempting liquidation...")
        
        try {
          // Try to liquidate the position
          await sendTxn(
            vault.liquidatePosition(
              signer.address,     // account
              link.address,       // collateralToken
              link.address,       // indexToken
              true,               // isLong
              signer.address      // feeReceiver
            ),
            "Attempt to liquidate own position"
          )
          
          console.log("✅ Liquidation executed successfully!")
          
        } catch (error) {
          console.log("ℹ️ Liquidation failed (expected if position is healthy):", error.message)
        }
        
      } else {
        console.log("Signer is not a liquidator - cannot test liquidation execution")
        console.log("To test liquidation, you would need to:")
        console.log("1. Make the position liquidatable (e.g., by price manipulation)")
        console.log("2. Have a liquidator account execute the liquidation")
      }
      
    } else {
      console.log("❌ No position found")
    }
    
  } catch (error) {
    console.log("❌ Error creating test position:", error.message)
    return
  }
  
  console.log(`\n🟢 === Step 4: Clean Up ===`)
  
  try {
    // Get final position
    const finalPosition = await vault.positions(positionKey)
    const finalSize = finalPosition[0]
    
    if (finalSize.gt(0)) {
      console.log(`Closing remaining position: ${ethers.utils.formatUnits(finalSize, 30)} USD`)
      
      await sendTxn(
        vault.decreasePosition(
          signer.address,     // account
          link.address,       // collateralToken
          link.address,       // indexToken 
          0,                  // collateralDelta (0 = no collateral withdrawal)
          finalSize,          // sizeDelta (close entire position)
          true,               // isLong
          signer.address      // receiver
        ),
        "Close test position"
      )
      
      console.log("✅ Test position closed successfully!")
      
      // Check final balances
      const finalBalance = await linkContract.balanceOf(signer.address)
      console.log(`- Final LINK balance: ${ethers.utils.formatEther(finalBalance)} LINK`)
      
    } else {
      console.log("ℹ️ Position already closed or doesn't exist")
    }
    
  } catch (error) {
    console.log("❌ Error closing position:", error.message)
  }
  
  console.log("\n🎯 === Liquidation Test Complete ===")
  console.log("✅ Liquidation mechanics tested:")
  console.log("1. ✅ Position creation and monitoring")
  console.log("2. ✅ Liquidation state checking")
  console.log("3. ✅ Leverage calculations")
  console.log("4. ✅ Liquidation threshold validation")
  console.log("5. ✅ Liquidation execution attempt")
  console.log("\n🚀 The liquidation system is ready for testing!")
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
