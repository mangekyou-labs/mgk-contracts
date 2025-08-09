const { contractAt, readTmpAddresses, sendTxn } = require("../shared/helpers")

const network = (process.env.HARDHAT_NETWORK || 'hederaTestnet');

async function main() {
  const [signer] = await ethers.getSigners()
  
  // Read deployed addresses
  const addresses = readTmpAddresses()
  
  // Get vault contract
  const vault = await contractAt("Vault", addresses.vault)
  
  console.log("Checking vault permissions...")
  console.log("Signer address:", signer.address)
  console.log("Vault address:", vault.address)
  
  try {
    // Check if vault is in manager mode
    const inManagerMode = await vault.inManagerMode()
    console.log("Vault in manager mode:", inManagerMode)
    
    // Check if our signer is a manager
    const isManager = await vault.isManager(signer.address)
    console.log("Signer is manager:", isManager)
    
    // Check vault governor
    const gov = await vault.gov()
    console.log("Vault governor:", gov)
    console.log("Signer is governor:", gov.toLowerCase() === signer.address.toLowerCase())
    
    // Check USDG address
    const usdg = await vault.usdg()
    console.log("USDG token address:", usdg)
    
    if (inManagerMode && !isManager) {
      console.log("\n❌ Issue found: Vault is in manager mode but signer is not a manager")
      console.log("Solutions:")
      console.log("1. Add signer as manager: vault.setManager(signerAddress, true)")
      console.log("2. Disable manager mode: vault.setInManagerMode(false)")
    } else if (!inManagerMode) {
      console.log("\n✅ Vault is not in manager mode - USDG operations should work")
    } else {
      console.log("\n✅ Signer has manager permissions")
    }
    
  } catch (error) {
    console.log("Error checking permissions:", error.message)
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
