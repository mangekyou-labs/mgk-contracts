# MGK Contracts
Contracts for GMK.

## Install Dependencies
If npx is not installed yet:
`npm install -g npx`

Install packages:
`npm i`

## Compile Contracts
`npx hardhat compile`

## Run Tests
`npx hardhat test`

## Hedera Testnet Deployment & Testing

### Prerequisites
- Configure your wallet and network settings in `hardhat.config.js`
- Set up environment variables in `env.example.json`
- Ensure you have test HBAR and LINK tokens

### Commands

#### 1. Check Token Balances
```bash
npx hardhat run scripts/core/checkBalances.js --network hederaTestnet
```
**Purpose**: Verify wallet token balances (HBAR, LINK, USDC)

#### 2. Configure Vault Token Settings
```bash
npx hardhat run scripts/core/vaultSetTokenConfig.js --network hederaTestnet
```
**Purpose**: Whitelist and configure tokens (HBAR, LINK, USDC) in the vault
**Required**: Must run before token operations

#### 3. Set Vault Manager Permissions
```bash
npx hardhat run scripts/core/setupVaultManager.js --network hederaTestnet
```
**Purpose**: Configure manager permissions for USDG operations
**Required**: Must run before buyUSDG/sellUSDG operations

#### 4. Add LINK Liquidity to Vault
```bash
npx hardhat run scripts/core/addLiquidity.js --network hederaTestnet
```
**Purpose**: Add LINK tokens to vault liquidity pool

#### 5. Test Comprehensive LINK Operations
```bash
npx hardhat run scripts/core/testLinkSwap.js --network hederaTestnet
```
**Purpose**: Test liquidity addition, price feeds, and USDG minting
**Features**:
- ✅ LINK liquidity addition
- ✅ Price feed validation
- ✅ USDG minting with LINK

#### 6. Adjust Vault Fees for Testing
```bash
npx hardhat run scripts/core/setMinimalFees.js --network hederaTestnet
```
**Purpose**: Set minimal fees compatible with current token prices
**Note**: Adjusts liquidation fees dynamically based on collateral values

#### 7. Test Perpetual Position Logic
```bash
npx hardhat run scripts/core/testPerpetualWithLeverage.js --network hederaTestnet
```
**Purpose**: Validate core perpetual trading mechanisms

#### 8. Check Vault Permissions
```bash
npx hardhat run scripts/core/checkVaultPermissions.js --network hederaTestnet
```
**Purpose**: Verify manager mode and permission settings