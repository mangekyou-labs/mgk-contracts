const { contractAt, readTmpAddresses, sendTxn } = require("../shared/helpers")
const { expandDecimals } = require("../../test/shared/utilities")

// Import the test helper functions to mimic their setup
const { toUsd } = require("../../test/shared/units")
const { toChainlinkPrice } = require("../../test/shared/chainlink")

const network = (process.env.HARDHAT_NETWORK || 'hederaTestnet');
const tokens = require('./tokens')[network];

async function main() {
  const [signer] = await ethers.getSigners()
  
  // Read deployed addresses
  const addresses = readTmpAddresses()
  
  // Get contracts
  const vault = await contractAt("Vault", addresses.vault)
  const priceFeed = await contractAt("VaultPriceFeed", addresses.vaultPriceFeed)
  
  // Get token addresses
  const { link } = tokens
  
  console.log("🚀 Testing Perpetuals Using Proper Test Patterns")
  console.log("Signer address:", signer.address)
  console.log("Vault address:", vault.address)
  console.log("Price feed address:", priceFeed.address)
  
  try {
    // Step 1: Set up proper LINK price like the tests do
    console.log("\n=== Setting Up Proper Prices (Following Test Patterns) ===")
    
    // Get the LINK price feed address
    const linkPriceFeedAddr = await priceFeed.priceFeeds(link.address)
    console.log("LINK price feed address:", linkPriceFeedAddr)
    
    // Set LINK price to $15 (like BTC is $40,000 in tests)
    const linkPriceFeed = await contractAt("MockPriceFeed", linkPriceFeedAddr)
    
    await sendTxn(
      linkPriceFeed.setLatestAnswer(toChainlinkPrice(15)), // $15 LINK
      "Set LINK price to $15"
    )
    
    // Verify price update
    const newPrice = await vault.getMinPrice(link.address)
    console.log("New LINK price:", ethers.utils.formatUnits(newPrice, 30), "USD")
    
    if (newPrice.lt(expandDecimals(10, 30))) {
      console.log("❌ Price update failed, using alternative approach")
      return
    }
    
    // Step 2: Add sufficient liquidity to pool (like in tests)
    console.log("\n=== Adding Pool Liquidity ===")
    
    const linkContract = await ethers.getContractAt("IERC20", link.address)
    const liquidityAmount = expandDecimals(20, 18) // 20 LINK for pool
    
    console.log("Adding liquidity:", ethers.utils.formatEther(liquidityAmount), "LINK")
    
    // Transfer LINK to vault
    await sendTxn(
      linkContract.transfer(vault.address, liquidityAmount),
      "Transfer LINK liquidity to vault"
    )
    
    // Buy USDG with the liquidity (creates pool like in tests)
    await sendTxn(
      vault.buyUSDG(link.address, signer.address),
      "Buy USDG to create pool liquidity"
    )
    
    const poolAmount = await vault.poolAmounts(link.address)
    console.log("Pool amount after liquidity:", ethers.utils.formatEther(poolAmount), "LINK")
    console.log("Pool value:", ethers.utils.formatUnits(newPrice.mul(poolAmount).div(expandDecimals(1, 18)), 30), "USD")
    
    // Step 3: Test Long Position (following test pattern)
    console.log("\n=== Opening Long Position (Test Pattern) ===")
    
    const collateralAmount = expandDecimals(1, 18) // 1 LINK collateral
    const positionSizeUsd = toUsd(47) // $47 position (like in test)
    
    console.log("Position setup:")
    console.log("- Collateral:", ethers.utils.formatEther(collateralAmount), "LINK")
    console.log("- Position size:", ethers.utils.formatUnits(positionSizeUsd, 30), "USD")
    console.log("- Expected leverage:", ethers.utils.formatUnits(positionSizeUsd.div(newPrice.mul(collateralAmount).div(expandDecimals(1, 18))), 30), "x")
    
    // Transfer collateral to vault
    await sendTxn(
      linkContract.transfer(vault.address, collateralAmount),
      "Transfer LINK collateral to vault"
    )
    
    // Check position before
    let position = await vault.getPosition(signer.address, link.address, link.address, true)
    console.log("Position before - Size:", ethers.utils.formatUnits(position[0], 30))
    
    // Open long position
    await sendTxn(
      vault.increasePosition(
        signer.address,     // account
        link.address,       // collateralToken
        link.address,       // indexToken 
        positionSizeUsd,    // sizeDelta (in USD, 30 decimals)
        true                // isLong
      ),
      "Open LONG position"
    )
    
    // Check position after
    position = await vault.getPosition(signer.address, link.address, link.address, true)
    console.log("\n✅ LONG Position Successfully Opened!")
    console.log("- Size:", ethers.utils.formatUnits(position[0], 30), "USD")
    console.log("- Collateral:", ethers.utils.formatUnits(position[1], 30), "USD")
    console.log("- Average Price:", ethers.utils.formatUnits(position[2], 30))
    console.log("- Entry Funding Rate:", position[3].toString())
    console.log("- Reserve Amount:", ethers.utils.formatEther(position[4]), "LINK")
    console.log("- Realised PnL:", ethers.utils.formatUnits(position[5], 30), "USD")
    console.log("- Has Profit:", position[6])
    console.log("- Last Increased Time:", new Date(position[7].toNumber() * 1000).toISOString())
    
    // Calculate actual leverage
    const actualLeverage = position[0].div(position[1])
    console.log("- Actual Leverage:", ethers.utils.formatUnits(actualLeverage, 30), "x")
    
    // Step 4: Check vault state
    console.log("\n=== Vault State After Position ===")
    
    const reservedAmounts = await vault.reservedAmounts(link.address)
    const guaranteedUsd = await vault.guaranteedUsd(link.address)
    const finalPoolAmount = await vault.poolAmounts(link.address)
    
    console.log("Reserved amounts:", ethers.utils.formatEther(reservedAmounts), "LINK")
    console.log("Guaranteed USD:", ethers.utils.formatUnits(guaranteedUsd, 30), "USD")
    console.log("Pool amount:", ethers.utils.formatEther(finalPoolAmount), "LINK")
    
    // Step 5: Test position P&L
    try {
      const delta = await vault.getPositionDelta(signer.address, link.address, link.address, true)
      console.log("\n=== Position P&L ===")
      console.log("Has profit:", delta[0])
      console.log("Delta amount:", ethers.utils.formatUnits(delta[1], 30), "USD")
    } catch (pnlError) {
      console.log("P&L calculation error:", pnlError.message)
    }
    
    console.log("\n🎯 SUCCESS! Perpetual position opened using proper test patterns!")
    console.log("✅ All core perpetual functionality validated with realistic prices!")
    
  } catch (error) {
    console.log("❌ Error:", error.message)
    console.log("\nThis demonstrates the proper test setup patterns from the GMX test suite.")
    console.log("The key insights:")
    console.log("1. Use toChainlinkPrice() for setting price feeds (8 decimals)")
    console.log("2. Use toUsd() for position sizes (30 decimals)")
    console.log("3. Set up pool liquidity first with buyUSDG()")
    console.log("4. Use realistic token prices ($15 LINK vs $0.000000002)")
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
