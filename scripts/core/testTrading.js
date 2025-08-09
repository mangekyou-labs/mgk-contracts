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
  const router = await contractAt("Router", addresses.router)
  const usdg = await contractAt("USDG", addresses.usdg)
  
  // Get token addresses
  const { nativeToken, link, usdc } = tokens
  
  console.log("Testing trading functions...")
  console.log("Signer address:", signer.address)
  console.log("Vault address:", vault.address)
  console.log("Router address:", router.address)
  
  // Test 1: Check if we can get token prices
  console.log("\n=== Testing Price Feeds ===")
  try {
    const nativePrice = await vault.getMaxPrice(nativeToken.address)
    console.log("Native token max price:", nativePrice.toString())
    
    const linkPrice = await vault.getMaxPrice(link.address)
    console.log("Link token max price:", linkPrice.toString())
    
    const usdcPrice = await vault.getMaxPrice(usdc.address)
    console.log("USDC token max price:", usdcPrice.toString())
  } catch (error) {
    console.log("Price feed error:", error.message)
  }
  
  // Test 2: Check pool amounts
  console.log("\n=== Testing Pool Amounts ===")
  console.log("Native token pool amount:", await vault.poolAmounts(nativeToken.address))
  console.log("Link token pool amount:", await vault.poolAmounts(link.address))
  console.log("USDC token pool amount:", await vault.poolAmounts(usdc.address))
  
  // Test 3: Check USDG amounts
  console.log("\n=== Testing USDG Amounts ===")
  console.log("Native token USDG amount:", await vault.usdgAmounts(nativeToken.address))
  console.log("Link token USDG amount:", await vault.usdgAmounts(link.address))
  console.log("USDC token USDG amount:", await vault.usdgAmounts(usdc.address))
  
  // Test 4: Check if we can get swap fees
  console.log("\n=== Testing Swap Fees ===")
  try {
    const swapFee = await vault.swapFeeBasisPoints()
    console.log("Swap fee basis points:", swapFee.toString())
    
    const stableSwapFee = await vault.stableSwapFeeBasisPoints()
    console.log("Stable swap fee basis points:", stableSwapFee.toString())
  } catch (error) {
    console.log("Fee check error:", error.message)
  }
  
  // Test 5: Check if we can get token to USD conversion
  console.log("\n=== Testing Token to USD Conversion ===")
  try {
    const amount = expandDecimals(1, 18) // 1 token
    const usdValue = await vault.tokenToUsdMin(nativeToken.address, amount)
    console.log("1 native token =", usdValue.toString(), "USD")
  } catch (error) {
    console.log("Token to USD conversion error:", error.message)
  }
  
  console.log("\n✅ Trading test completed!")
  console.log("\nNext steps:")
  console.log("1. Add liquidity to the vault using directPoolDeposit")
  console.log("2. Test actual swaps between tokens")
  console.log("3. Test leverage trading (if enabled)")
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
