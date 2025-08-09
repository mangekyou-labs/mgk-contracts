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
  const { nativeToken, link } = tokens
  
  console.log("Testing swaps between HBAR and LINK...")
  console.log("Signer address:", signer.address)
  console.log("Vault address:", vault.address)
  console.log("Router address:", router.address)
  
  // Check initial balances
  console.log("\n=== Initial Balances ===")
  const hbarContract = await ethers.getContractAt("IERC20", nativeToken.address)
  const linkContract = await ethers.getContractAt("IERC20", link.address)
  
  const initialHbarBalance = await hbarContract.balanceOf(signer.address)
  const initialLinkBalance = await linkContract.balanceOf(signer.address)
  
  console.log("Initial HBAR balance:", ethers.utils.formatEther(initialHbarBalance))
  console.log("Initial LINK balance:", ethers.utils.formatEther(initialLinkBalance))
  
  // Check pool amounts
  console.log("\n=== Pool Amounts ===")
  const hbarPoolAmount = await vault.poolAmounts(nativeToken.address)
  const linkPoolAmount = await vault.poolAmounts(link.address)
  
  console.log("HBAR pool amount:", ethers.utils.formatEther(hbarPoolAmount))
  console.log("LINK pool amount:", ethers.utils.formatEther(linkPoolAmount))
  
  // Test 1: Swap HBAR to LINK
  try {
    const swapAmount = expandDecimals(1, 18) // 1 HBAR
    console.log(`\n=== Swapping ${ethers.utils.formatEther(swapAmount)} HBAR to LINK ===`)
    
    // Approve router to spend HBAR
    await sendTxn(
      hbarContract.approve(router.address, swapAmount),
      "Approve HBAR for router"
    )
    
    // Get expected output
    const expectedOutput = await vault.getMinPrice(link.address)
    console.log("Expected LINK price:", ethers.utils.formatEther(expectedOutput))
    
    // Perform swap
    await sendTxn(
      router.swap(nativeToken.address, link.address, signer.address),
      "Swap HBAR to LINK"
    )
    
    console.log("✅ HBAR to LINK swap completed!")
  } catch (error) {
    console.log("HBAR to LINK swap error:", error.message)
  }
  
  // Test 2: Swap LINK to HBAR
  try {
    const swapAmount = expandDecimals(0.5, 18) // 0.5 LINK
    console.log(`\n=== Swapping ${ethers.utils.formatEther(swapAmount)} LINK to HBAR ===`)
    
    // Approve router to spend LINK
    await sendTxn(
      linkContract.approve(router.address, swapAmount),
      "Approve LINK for router"
    )
    
    // Perform swap
    await sendTxn(
      router.swap(link.address, nativeToken.address, signer.address),
      "Swap LINK to HBAR"
    )
    
    console.log("✅ LINK to HBAR swap completed!")
  } catch (error) {
    console.log("LINK to HBAR swap error:", error.message)
  }
  
  // Check final balances
  console.log("\n=== Final Balances ===")
  const finalHbarBalance = await hbarContract.balanceOf(signer.address)
  const finalLinkBalance = await linkContract.balanceOf(signer.address)
  
  console.log("Final HBAR balance:", ethers.utils.formatEther(finalHbarBalance))
  console.log("Final LINK balance:", ethers.utils.formatEther(finalLinkBalance))
  
  console.log("\n✅ Swap testing completed!")
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
