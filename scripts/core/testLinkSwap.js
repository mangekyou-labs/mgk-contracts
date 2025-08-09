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
  
  // Get token addresses
  const { nativeToken, link, usdc } = tokens
  
  console.log("Testing LINK operations in the vault...")
  console.log("Signer address:", signer.address)
  console.log("Vault address:", vault.address)
  console.log("Router address:", router.address)
  
  // Check initial balances
  console.log("\n=== Initial State ===")
  const linkContract = await ethers.getContractAt("IERC20", link.address)
  const linkBalance = await linkContract.balanceOf(signer.address)
  console.log("LINK wallet balance:", ethers.utils.formatEther(linkBalance))
  
  // Check pool amounts
  const linkPoolAmount = await vault.poolAmounts(link.address)
  console.log("LINK pool amount:", ethers.utils.formatEther(linkPoolAmount))
  
  // Check vault's LINK balance
  const vaultLinkBalance = await linkContract.balanceOf(vault.address)
  console.log("Vault LINK balance:", ethers.utils.formatEther(vaultLinkBalance))
  
  // Test 1: Add more LINK liquidity
  try {
    console.log("\n=== Test 1: Adding More LINK Liquidity ===")
    const addAmount = expandDecimals(2, 18) // 2 LINK
    console.log(`Adding ${ethers.utils.formatEther(addAmount)} more LINK to vault...`)
    
    // Transfer LINK to vault
    await sendTxn(
      linkContract.transfer(vault.address, addAmount),
      "Transfer LINK to vault"
    )
    
    // Register the deposit
    await sendTxn(
      vault.directPoolDeposit(link.address),
      "Add LINK liquidity"
    )
    
    // Check new pool amount
    const newPoolAmount = await vault.poolAmounts(link.address)
    console.log("✅ New LINK pool amount:", ethers.utils.formatEther(newPoolAmount))
    
  } catch (error) {
    console.log("❌ Liquidity addition error:", error.message)
  }
  
  // Test 2: Check if we can get prices
  try {
    console.log("\n=== Test 2: Price Feed Testing ===")
    
    const minPrice = await vault.getMinPrice(link.address)
    const maxPrice = await vault.getMaxPrice(link.address)
    
    console.log("LINK min price:", ethers.utils.formatUnits(minPrice, 30))
    console.log("LINK max price:", ethers.utils.formatUnits(maxPrice, 30))
    
    console.log("✅ Price feeds working!")
    
  } catch (error) {
    console.log("❌ Price feed error:", error.message)
  }
  
  // Test 3: Try to buy USDG with LINK (if configured)
  try {
    console.log("\n=== Test 3: USDG Operations ===")
    
    // Check if we can buy USDG with LINK
    const buyAmount = expandDecimals(1, 18) // 1 LINK worth of USDG
    console.log(`Attempting to buy USDG with ${ethers.utils.formatEther(buyAmount)} LINK...`)
    
    // Transfer LINK to vault first
    await sendTxn(
      linkContract.transfer(vault.address, buyAmount),
      "Transfer LINK for USDG purchase"
    )
    
    // Try to buy USDG
    await sendTxn(
      vault.buyUSDG(link.address, signer.address),
      "Buy USDG with LINK"
    )
    
    console.log("✅ USDG purchase successful!")
    
  } catch (error) {
    console.log("❌ USDG operation error:", error.message)
  }
  
  // Test 4: Check vault state
  console.log("\n=== Test 4: Final Vault State ===")
  
  const finalLinkBalance = await linkContract.balanceOf(signer.address)
  const finalPoolAmount = await vault.poolAmounts(link.address)
  const finalVaultBalance = await linkContract.balanceOf(vault.address)
  
  console.log("Final wallet LINK balance:", ethers.utils.formatEther(finalLinkBalance))
  console.log("Final LINK pool amount:", ethers.utils.formatEther(finalPoolAmount))
  console.log("Final vault LINK balance:", ethers.utils.formatEther(finalVaultBalance))
  
  // Check if USDG was created
  try {
    const usdgAddress = await vault.usdg()
    const usdgContract = await ethers.getContractAt("IERC20", usdgAddress)
    const usdgBalance = await usdgContract.balanceOf(signer.address)
    console.log("USDG balance:", ethers.utils.formatEther(usdgBalance))
  } catch (error) {
    console.log("USDG check error:", error.message)
  }
  
  console.log("\n✅ LINK testing completed!")
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
