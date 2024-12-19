const { deployContract, writeTmpAddresses } = require("../shared/helpers")

async function main() {
  const governable = await deployContract("Governable", [], "Governable")
  writeTmpAddresses({
    governable: governable.address
  })
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
