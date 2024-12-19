const { deployContract, sendTxn, writeTmpAddresses } = require("../shared/helpers")

async function main() {
    // Read addresses from forge script outputs
    const vaultAddress = ""; // Add your Vault address
    const usdgAddress = ""; // Add your USDG address
    const nativeTokenAddress = ""; // Add your WHBAR address

    // Deploy Router
    const router = await deployContract("Router", [
        vaultAddress,
        usdgAddress,
        nativeTokenAddress
    ])

    // Save router address
    writeTmpAddresses({
        router: router.address
    })

    console.log("Router deployed at:", router.address)
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error)
        process.exit(1)
    })