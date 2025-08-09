const { contractAt, readTmpAddresses } = require("../shared/helpers")
const { expandDecimals } = require("../../test/shared/utilities")

const network = (process.env.HARDHAT_NETWORK || 'hederaTestnet');
const tokens = require('./tokens')[network];

async function main() {
  const [signer] = await ethers.getSigners()
  
  // Read deployed addresses
  const addresses = readTmpAddresses()
  console.log("Deployed addresses:", addresses)
  
  // Get vault contract
  const vault = await contractAt("Vault", addresses.vault)
  console.log("Vault address:", vault.address)
  
  // Get token addresses
  const { nativeToken, link, usdc } = tokens
  
  // Test 1: Check if tokens are whitelisted
  console.log("\n=== Testing Token Whitelisting ===")
  console.log("Native token whitelisted:", await vault.whitelistedTokens(nativeToken.address))
  console.log("Link token whitelisted:", await vault.whitelistedTokens(link.address))
  console.log("USDC token whitelisted:", await vault.whitelistedTokens(usdc.address))
  
  // Test 2: Check token configurations
  console.log("\n=== Testing Token Configurations ===")
  console.log("Native token decimals:", await vault.tokenDecimals(nativeToken.address))
  console.log("Native token weight:", await vault.tokenWeights(nativeToken.address))
  console.log("Native token is stable:", await vault.stableTokens(nativeToken.address))
  console.log("Native token is shortable:", await vault.shortableTokens(nativeToken.address))
  
  // Test 3: Check vault state
  console.log("\n=== Testing Vault State ===")
  console.log("Vault gov:", await vault.gov())
  console.log("Vault price feed:", await vault.priceFeed())
  console.log("Vault USDG:", await vault.usdg())
  console.log("Vault router:", await vault.router())
  console.log("Vault is initialized:", await vault.isInitialized())
  console.log("Vault is swap enabled:", await vault.isSwapEnabled())
  console.log("Vault is leverage enabled:", await vault.isLeverageEnabled())
  
  // Test 4: Check whitelisted token count
  console.log("\n=== Testing Token Count ===")
  console.log("Whitelisted token count:", await vault.whitelistedTokenCount())
  console.log("Total token weights:", await vault.totalTokenWeights())
  
  // Test 5: Check all whitelisted tokens
  console.log("\n=== All Whitelisted Tokens ===")
  const tokenCount = await vault.whitelistedTokenCount()
  for (let i = 0; i < tokenCount; i++) {
    const token = await vault.allWhitelistedTokens(i)
    console.log(`Token ${i}: ${token}`)
  }
  
  console.log("\n✅ Vault test completed successfully!")
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
