const { contractAt, readTmpAddresses, sendTxn } = require("../shared/helpers")

const network = (process.env.HARDHAT_NETWORK || 'hederaTestnet');

async function main() {
  const [signer] = await ethers.getSigners()
  
  // Read deployed addresses
  const addresses = readTmpAddresses()
  
  // Get vault contract
  const vault = await contractAt("Vault", addresses.vault)
  
  console.log("Setting up vault manager permissions...")
  console.log("Signer address:", signer.address)
  console.log("Vault address:", vault.address)
  
  try {
    // Check current state
    const inManagerMode = await vault.inManagerMode()
    const isManager = await vault.isManager(signer.address)
    const gov = await vault.gov()
    
    console.log("Current state:")
    console.log("- In manager mode:", inManagerMode)
    console.log("- Signer is manager:", isManager)
    console.log("- Signer is governor:", gov.toLowerCase() === signer.address.toLowerCase())
    
    if (inManagerMode && !isManager) {
      console.log("\nAdding signer as manager...")
      await sendTxn(
        vault.setManager(signer.address, true),
        "Set signer as manager"
      )
      
      // Verify
      const newIsManager = await vault.isManager(signer.address)
      console.log("✅ Signer is now manager:", newIsManager)
      
    } else if (isManager) {
      console.log("✅ Signer is already a manager")
    } else {
      console.log("✅ Vault not in manager mode - no action needed")
    }
    
    // Also check if router needs to be a manager
    const router = await contractAt("Router", addresses.router)
    const routerIsManager = await vault.isManager(router.address)
    console.log("Router is manager:", routerIsManager)
    
    if (inManagerMode && !routerIsManager) {
      console.log("Adding router as manager...")
      await sendTxn(
        vault.setManager(router.address, true),
        "Set router as manager"
      )
      console.log("✅ Router is now manager")
    }
    
  } catch (error) {
    console.log("Error setting up manager:", error.message)
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
