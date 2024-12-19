const { deployContract, contractAt, sendTxn, writeTmpAddresses } = require("../shared/helpers")
const { expandDecimals } = require("../../test/shared/utilities")

const network = (process.env.HARDHAT_NETWORK || 'mainnet');
const tokens = require('./tokens')[network];

async function main() {
  const { nativeToken } = tokens

  const orderBook = await deployContract("OrderBook", []);

  // Arbitrum mainnet addresses
  await sendTxn(orderBook.initialize(
    "0x10B0628681e63a9610fec17f08A3aaE9cd1Edf3e", // router
    "0x2D641633FE39fAc1E79085dCAF91244EcBBda809", // vault
    nativeToken.address, // whbar
    "0xCdd92f8983b4c0F9588DcEE98434B4f8F62ED2ef", // usdg
    "10000000000000000", // 0.01 HBAR
    expandDecimals(10, 30) // min purchase token amount usd
  ), "orderBook.initialize");

  writeTmpAddresses({
    orderBook: orderBook.address
  })
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
