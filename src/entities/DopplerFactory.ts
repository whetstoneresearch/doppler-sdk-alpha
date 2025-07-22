import { 
  type Address, 
  type Hex, 
  type Hash,
  type PublicClient, 
  type WalletClient,
  encodeAbiParameters, 
  parseEther, 
  toHex,
  encodePacked,
  keccak256,
  getAddress,
  decodeEventLog
} from 'viem'
import type { 
  CreateStaticAuctionParams, 
  CreateDynamicAuctionParams,
  MigrationConfig 
} from '../types'
import { getAddresses } from '../addresses'
import { 
  WAD, 
  DEAD_ADDRESS, 
  DEFAULT_EPOCH_LENGTH, 
  DEFAULT_LOCK_DURATION, 
  BASIS_POINTS,
  DEFAULT_PD_SLUGS,
  DAY_SECONDS,
  FLAG_MASK,
  DOPPLER_FLAGS
} from '../constants'
import { airlockAbi, uniswapV3InitializerAbi, uniswapV4InitializerAbi, v2MigratorAbi, v3MigratorAbi, v4MigratorAbi } from '../abis'

export class DopplerFactory {
  private publicClient: PublicClient
  private walletClient?: WalletClient
  private chainId: number
  
  constructor(publicClient: PublicClient, walletClient: WalletClient | undefined, chainId: number) {
    this.publicClient = publicClient
    this.walletClient = walletClient
    this.chainId = chainId
  }

  /**
   * Create a new static auction (using Uniswap V3 for initial liquidity)
   * @param params Configuration for the static auction
   * @returns The address of the created pool and token
   */
  async createStaticAuction(params: CreateStaticAuctionParams): Promise<{
    poolAddress: Address
    tokenAddress: Address
    transactionHash: string
  }> {
    // Validate parameters
    this.validateStaticAuctionParams(params)
    
    const addresses = getAddresses(this.chainId)
    
    // 1. Encode pool initializer data
    const poolInitializerData = encodeAbiParameters(
      [
        { 
          type: 'tuple',
          components: [
            { type: 'uint256', name: 'numTokensToSell' },
            { type: 'int24', name: 'startTick' },
            { type: 'int24', name: 'endTick' },
            { type: 'uint24', name: 'fee' }
          ]
        }
      ],
      [{
        numTokensToSell: params.sale.numTokensToSell,
        startTick: params.pool.startTick,
        endTick: params.pool.endTick,
        fee: params.pool.fee
      }]
    )
    
    // 2. Encode migration data based on MigrationConfig
    const liquidityMigratorData = this.encodeMigrationData(params.migration)
    
    // 3. Encode token parameters
    const vestingDuration = params.vesting?.duration ?? BigInt(0)
    const yearlyMintRate = parseEther('0.02') // 2% yearly mint rate
    
    const tokenParams = {
      name: params.token.name,
      symbol: params.token.symbol,
      tokenURI: params.token.tokenURI,
      vestingDuration: BigInt(vestingDuration),
      yearlyMintRate: yearlyMintRate,
      totalSupply: params.sale.initialSupply,
      initialRecipients: params.vesting ? [params.userAddress] : [],
      initialAmounts: params.vesting ? [params.sale.initialSupply - params.sale.numTokensToSell] : []
    }
    
    // 4. Create the creation params for Airlock
    const creationParams = {
      poolInitializer: addresses.v3Initializer,
      liquidityMigrator: this.getMigratorAddress(params.migration),
      governor: addresses.governanceFactory, // Using default governance factory
      numeraire: params.sale.numeraire,
      integrator: params.integrator ?? DEAD_ADDRESS,
      poolInitializerData: poolInitializerData,
      liquidityMigratorData: liquidityMigratorData
    }
    
    // 5. Generate a unique salt
    const salt = this.generateRandomSalt(params.userAddress)
    
    // Call the airlock contract to create the pool
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations')
    }
    
    const { request, result } = await this.publicClient.simulateContract({
      address: addresses.airlock,
      abi: airlockAbi,
      functionName: 'create',
      args: [tokenParams, creationParams],
      account: this.walletClient.account,
    })
    
    const hash = await this.walletClient.writeContract(request)
    
    // Wait for transaction and get the receipt
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash })
    
    // The create function returns [pool, token] directly
    // We can get these from the simulation result or parse from logs
    if (result && Array.isArray(result) && result.length >= 2) {
      return {
        poolAddress: result[0] as Address,
        tokenAddress: result[1] as Address,
        transactionHash: hash
      }
    }
    
    // Fallback: Parse the Create event from logs
    const createEvent = receipt.logs.find(log => {
      try {
        const decoded = decodeEventLog({
          abi: airlockAbi,
          data: log.data,
          topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
        })
        return decoded.eventName === 'Create'
      } catch {
        return false
      }
    })
    
    if (createEvent) {
      const decoded = decodeEventLog({
        abi: airlockAbi,
        data: createEvent.data,
        topics: createEvent.topics as [`0x${string}`, ...`0x${string}`[]],
      })
      
      return {
        poolAddress: decoded.args.poolOrHook as Address,
        tokenAddress: decoded.args.asset as Address,
        transactionHash: hash
      }
    }
    
    throw new Error('Failed to get pool and token addresses from transaction')
  }
  
  /**
   * Generate a random salt based on user address
   */
  private generateRandomSalt(account: Address): Hex {
    const array = new Uint8Array(32)
    
    // Sequential byte generation
    for (let i = 0; i < 32; i++) {
      array[i] = i
    }
    
    // XOR with address bytes
    if (account) {
      const addressBytes = account.slice(2).padStart(40, '0')
      for (let i = 0; i < 20; i++) {
        const addressByte = parseInt(
          addressBytes.slice(i * 2, (i + 1) * 2),
          16
        )
        array[i] ^= addressByte
      }
    }
    
    return `0x${Array.from(array)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}` as Hex
  }

  /**
   * Create a new dynamic auction (using Uniswap V4 hook for gradual Dutch auction)
   * @param params Configuration for the dynamic auction
   * @returns The address of the created hook and token
   */
  async createDynamicAuction(params: CreateDynamicAuctionParams): Promise<{
    hookAddress: Address
    tokenAddress: Address
    poolId: string
    transactionHash: string
  }> {
    // Validate parameters
    this.validateDynamicAuctionParams(params)
    
    const addresses = getAddresses(this.chainId)
    
    // 1. Calculate gamma if not provided
    const gamma = params.auction.gamma ?? this.computeOptimalGamma(
      params.auction.startTick,
      params.auction.endTick,
      params.auction.duration,
      params.auction.epochLength,
      params.pool.tickSpacing
    )
    
    // 2. Prepare time parameters
    const currentTime = Math.floor(Date.now() / 1000)
    const startTime = currentTime + 30 // Start 30 seconds from now
    const endTime = startTime + params.auction.duration * DAY_SECONDS
    
    // 3. Prepare hook initialization data
    const dopplerData = {
      minimumProceeds: params.auction.minProceeds,
      maximumProceeds: params.auction.maxProceeds,
      startingTime: BigInt(startTime),
      endingTime: BigInt(endTime),
      startingTick: params.auction.startTick,
      endingTick: params.auction.endTick,
      epochLength: BigInt(params.auction.epochLength),
      gamma,
      isToken0: false, // Will be determined during mining
      numPDSlugs: BigInt(params.auction.numPdSlugs ?? DEFAULT_PD_SLUGS),
      fee: params.pool.fee,
      tickSpacing: params.pool.tickSpacing
    }
    
    // 4. Prepare token parameters
    const vestingDuration = params.vesting?.duration ?? BigInt(0)
    const yearlyMintRate = parseEther('0.02') // 2% yearly mint rate
    
    const tokenFactoryData = {
      name: params.token.name,
      symbol: params.token.symbol,
      initialSupply: params.sale.initialSupply,
      airlock: addresses.airlock,
      yearlyMintRate: yearlyMintRate,
      vestingDuration: BigInt(vestingDuration),
      recipients: params.vesting ? [params.userAddress] : [],
      amounts: params.vesting ? [params.sale.initialSupply - params.sale.numTokensToSell] : [],
      tokenURI: params.token.tokenURI
    }
    
    // 5. Mine hook address with appropriate flags
    const [salt, hookAddress, tokenAddress, poolInitializerData, encodedTokenFactoryData] = this.mineHookAddress({
      airlock: addresses.airlock,
      poolManager: addresses.poolManager,
      deployer: addresses.dopplerDeployer,
      initialSupply: params.sale.initialSupply,
      numTokensToSell: params.sale.numTokensToSell,
      numeraire: params.sale.numeraire,
      tokenFactory: addresses.tokenFactory,
      tokenFactoryData: tokenFactoryData,
      poolInitializer: addresses.v4Initializer,
      poolInitializerData: dopplerData
    })
    
    // 6. Encode migration data
    const liquidityMigratorData = this.encodeMigrationData(params.migration)
    
    // 7. Encode governance factory data
    const governanceFactoryData = encodeAbiParameters(
      [
        { type: 'string' },
        { type: 'uint48' },
        { type: 'uint32' },
        { type: 'uint256' },
      ],
      [
        params.token.name,
        7200,  // Initial voting delay
        50400, // Initial voting period  
        BigInt(0) // Initial proposal threshold
      ]
    )
    
    // 8. Create the token parameters for Airlock
    const tokenParams = {
      name: params.token.name,
      symbol: params.token.symbol,
      tokenURI: params.token.tokenURI,
      vestingDuration: BigInt(vestingDuration),
      yearlyMintRate: yearlyMintRate,
      totalSupply: params.sale.initialSupply,
      initialRecipients: params.vesting ? [params.userAddress] : [],
      initialAmounts: params.vesting ? [params.sale.initialSupply - params.sale.numTokensToSell] : []
    }
    
    // 9. Create the creation params for Airlock
    const creationParams = {
      poolInitializer: addresses.v4Initializer,
      liquidityMigrator: this.getMigratorAddress(params.migration),
      governor: addresses.governanceFactory,
      numeraire: params.sale.numeraire,
      integrator: params.integrator ?? DEAD_ADDRESS,
      poolInitializerData: poolInitializerData,
      liquidityMigratorData: liquidityMigratorData
    }
    
    // 10. Call the airlock contract to create the pool
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations')
    }
    
    const { request, result } = await this.publicClient.simulateContract({
      address: addresses.airlock,
      abi: airlockAbi,
      functionName: 'create',
      args: [tokenParams, creationParams],
      account: this.walletClient.account,
    })
    
    const hash = await this.walletClient.writeContract(request)
    
    // Wait for transaction and get the receipt
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash })
    
    // Get actual addresses from the return value or event logs
    let actualHookAddress: Address = hookAddress
    let actualTokenAddress: Address = tokenAddress
    
    if (result && Array.isArray(result) && result.length >= 2) {
      actualHookAddress = result[0] as Address // For V4, pool is the hook address
      actualTokenAddress = result[1] as Address
    } else {
      // Fallback: Parse the Create event from logs
      const createEvent = receipt.logs.find(log => {
        try {
          const decoded = decodeEventLog({
            abi: airlockAbi,
            data: log.data,
            topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
          })
          return decoded.eventName === 'Create'
        } catch {
          return false
        }
      })
      
      if (createEvent) {
        const decoded = decodeEventLog({
          abi: airlockAbi,
          data: createEvent.data,
          topics: createEvent.topics as [`0x${string}`, ...`0x${string}`[]],
        })
        
        actualHookAddress = decoded.args.poolOrHook as Address
        actualTokenAddress = decoded.args.asset as Address
      }
    }
    
    // Calculate pool ID for V4 using actual addresses
    const poolId = this.computePoolId({
      currency0: actualTokenAddress < params.sale.numeraire ? actualTokenAddress : params.sale.numeraire,
      currency1: actualTokenAddress < params.sale.numeraire ? params.sale.numeraire : actualTokenAddress,
      fee: params.pool.fee,
      tickSpacing: params.pool.tickSpacing,
      hooks: actualHookAddress
    })
    
    return {
      hookAddress: actualHookAddress,
      tokenAddress: actualTokenAddress,
      poolId,
      transactionHash: hash
    }
  }

  /**
   * Encode migration data based on the MigrationConfig
   * This replaces the manual encoding methods from the old SDKs
   */
  private encodeMigrationData(config: MigrationConfig): Hex {
    switch (config.type) {
      case 'uniswapV2':
        // V2 migrator expects empty data
        return '0x' as Hex
        
      case 'uniswapV3':
        // Encode V3 migration data: fee and tick spacing
        return encodeAbiParameters(
          [
            { type: 'uint24' }, // fee
            { type: 'int24' }   // tickSpacing
          ],
          [config.fee, config.tickSpacing]
        )
        
      case 'uniswapV4':
        // Encode V4 migration data with streamable fees config
        const beneficiaries = config.streamableFees.beneficiaries
        
        // Sort beneficiaries by address in ascending order
        const sortedBeneficiaries = [...beneficiaries].sort((a, b) => {
          const aNum = BigInt(a.address)
          const bNum = BigInt(b.address)
          return aNum < bNum ? -1 : aNum > bNum ? 1 : 0
        })
        
        // Validate that percentages sum to 10000 (100%)
        const totalPercentage = sortedBeneficiaries.reduce((sum, b) => sum + b.percentage, 0)
        if (totalPercentage !== BASIS_POINTS) {
          throw new Error(`Beneficiary percentages must sum to ${BASIS_POINTS} (100%), but got ${totalPercentage}`)
        }
        
        return encodeAbiParameters(
          [
            { type: 'uint24' },  // fee
            { type: 'int24' },   // tickSpacing
            { type: 'uint32' },  // lockDuration
            {
              type: 'tuple[]', 
              components: [
                { type: 'address', name: 'beneficiary' },
                { type: 'uint96', name: 'shares' }
              ]
            }
          ],
          [
            config.fee,
            config.tickSpacing,
            config.streamableFees.lockDuration,
            sortedBeneficiaries.map(b => ({
              beneficiary: b.address,
              shares: BigInt(b.percentage) * WAD / BigInt(BASIS_POINTS) // Convert percentage to shares in WAD
            }))
          ]
        )
        
      default:
        throw new Error(`Unknown migration type: ${(config as any).type}`)
    }
  }

  /**
   * Validate static auction parameters
   */
  private validateStaticAuctionParams(params: CreateStaticAuctionParams): void {
    // Validate token parameters
    if (!params.token.name || params.token.name.trim().length === 0) {
      throw new Error('Token name is required')
    }
    if (!params.token.symbol || params.token.symbol.trim().length === 0) {
      throw new Error('Token symbol is required')
    }
    
    // Validate tick range
    if (params.pool.startTick >= params.pool.endTick) {
      throw new Error('Start tick must be less than end tick')
    }
    
    // Validate sale config
    if (params.sale.initialSupply <= BigInt(0)) {
      throw new Error('Initial supply must be positive')
    }
    if (params.sale.numTokensToSell <= BigInt(0)) {
      throw new Error('Number of tokens to sell must be positive')
    }
    if (params.sale.numTokensToSell > params.sale.initialSupply) {
      throw new Error('Cannot sell more tokens than initial supply')
    }
    
    // Validate vesting if provided
    if (params.vesting) {
      const vestedAmount = params.sale.initialSupply - params.sale.numTokensToSell
      if (vestedAmount <= BigInt(0)) {
        throw new Error('No tokens available for vesting')
      }
    }
    
    // Validate migration config
    if (params.migration.type === 'uniswapV4' && params.migration.streamableFees) {
      const beneficiaries = params.migration.streamableFees.beneficiaries
      if (beneficiaries.length === 0) {
        throw new Error('At least one beneficiary is required for V4 migration')
      }
      
      // Check that percentages sum to 100%
      const totalPercentage = beneficiaries.reduce((sum, b) => sum + b.percentage, 0)
      if (totalPercentage !== BASIS_POINTS) {
        throw new Error(`Beneficiary percentages must sum to ${BASIS_POINTS} (100%), but got ${totalPercentage}`)
      }
    }
  }

  /**
   * Validate dynamic auction parameters
   */
  private validateDynamicAuctionParams(params: CreateDynamicAuctionParams): void {
    // Validate token parameters
    if (!params.token.name || params.token.name.trim().length === 0) {
      throw new Error('Token name is required')
    }
    if (!params.token.symbol || params.token.symbol.trim().length === 0) {
      throw new Error('Token symbol is required')
    }
    
    // Validate tick range
    if (params.auction.startTick >= params.auction.endTick) {
      throw new Error('Start tick must be less than end tick')
    }
    
    // Validate sale config
    if (params.sale.initialSupply <= BigInt(0)) {
      throw new Error('Initial supply must be positive')
    }
    if (params.sale.numTokensToSell <= BigInt(0)) {
      throw new Error('Number of tokens to sell must be positive')
    }
    if (params.sale.numTokensToSell > params.sale.initialSupply) {
      throw new Error('Cannot sell more tokens than initial supply')
    }
    
    // Validate auction parameters
    if (params.auction.duration <= 0) {
      throw new Error('Auction duration must be positive')
    }
    if (params.auction.epochLength <= 0) {
      throw new Error('Epoch length must be positive')
    }
    if (params.pool.tickSpacing <= 0) {
      throw new Error('Tick spacing must be positive')
    }
    
    // Validate that total duration is divisible by epoch length
    const totalDuration = params.auction.duration * DAY_SECONDS
    if (totalDuration % params.auction.epochLength !== 0) {
      throw new Error('Epoch length must divide total duration evenly')
    }
    
    // Validate gamma if provided
    if (params.auction.gamma !== undefined) {
      if (params.auction.gamma % params.pool.tickSpacing !== 0) {
        throw new Error('Gamma must be divisible by tick spacing')
      }
    }
    
    // Validate migration config
    if (params.migration.type === 'uniswapV4' && params.migration.streamableFees) {
      const beneficiaries = params.migration.streamableFees.beneficiaries
      if (beneficiaries.length === 0) {
        throw new Error('At least one beneficiary is required for V4 migration')
      }
      
      // Check that percentages sum to 100%
      const totalPercentage = beneficiaries.reduce((sum, b) => sum + b.percentage, 0)
      if (totalPercentage !== BASIS_POINTS) {
        throw new Error(`Beneficiary percentages must sum to ${BASIS_POINTS} (100%), but got ${totalPercentage}`)
      }
    }
  }

  /**
   * Get the airlock contract address for the current chain
   */
  private getAirlockAddress(): Address {
    const addresses = getAddresses(this.chainId)
    return addresses.airlock
  }

  /**
   * Get the appropriate initializer address based on auction type
   */
  private getInitializerAddress(isStatic: boolean): Address {
    const addresses = getAddresses(this.chainId)
    return isStatic ? addresses.v3Initializer : addresses.v4Initializer
  }

  /**
   * Get the appropriate migrator address based on migration config
   */
  private getMigratorAddress(config: MigrationConfig): Address {
    const addresses = getAddresses(this.chainId)
    
    switch (config.type) {
      case 'uniswapV2':
        return addresses.v2Migrator
      case 'uniswapV3':
        return addresses.v3Migrator
      case 'uniswapV4':
        return addresses.v4Migrator
      default:
        throw new Error(`Unknown migration type: ${(config as any).type}`)
    }
  }

  /**
   * Compute optimal gamma parameter based on price range and time parameters
   * Gamma determines how much the price can move per epoch during the sale.
   */
  private computeOptimalGamma(
    startTick: number,
    endTick: number,
    durationDays: number,
    epochLength: number,
    tickSpacing: number
  ): number {
    // Calculate total number of epochs
    const totalEpochs = (durationDays * DAY_SECONDS) / epochLength

    // Calculate required tick movement per epoch to cover the range
    const tickDelta = Math.abs(endTick - startTick)
    // Round up to nearest multiple of tick spacing
    let gamma = Math.ceil(tickDelta / totalEpochs / tickSpacing) * tickSpacing
    // Ensure gamma is at least 1 tick spacing
    gamma = Math.max(tickSpacing, gamma)

    if (gamma % tickSpacing !== 0) {
      throw new Error('Computed gamma must be divisible by tick spacing')
    }

    return gamma
  }

  /**
   * Mine a salt and hook address with the appropriate flags for V4
   */
  private mineHookAddress(params: {
    airlock: Address
    poolManager: Address
    deployer: Address
    initialSupply: bigint
    numTokensToSell: bigint
    numeraire: Address
    tokenFactory: Address
    tokenFactoryData: any
    poolInitializer: Address
    poolInitializerData: any
  }): [Hash, Address, Address, Hex, Hex] {
    const isToken0 = params.numeraire !== '0x0000000000000000000000000000000000000000'

    const {
      minimumProceeds,
      maximumProceeds,
      startingTime,
      endingTime,
      startingTick,
      endingTick,
      epochLength,
      gamma,
      numPDSlugs,
      fee,
      tickSpacing,
    } = params.poolInitializerData

    // Encode pool initializer data
    const poolInitializerData = encodeAbiParameters(
      [
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'int24' },
        { type: 'int24' },
        { type: 'uint256' },
        { type: 'int24' },
        { type: 'bool' },
        { type: 'uint256' },
        { type: 'uint24' },
        { type: 'int24' },
      ],
      [
        minimumProceeds,
        maximumProceeds,
        startingTime,
        endingTime,
        startingTick,
        endingTick,
        epochLength,
        gamma,
        isToken0,
        numPDSlugs,
        fee,
        tickSpacing,
      ]
    )

    // Encode token factory data  
    const {
      name,
      symbol,
      yearlyMintRate,
      vestingDuration,
      recipients,
      amounts,
      tokenURI,
    } = params.tokenFactoryData

    const tokenFactoryData = encodeAbiParameters(
      [
        { type: 'string' },
        { type: 'string' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'address[]' },
        { type: 'uint256[]' },
        { type: 'string' },
      ],
      [
        name,
        symbol,
        yearlyMintRate,
        vestingDuration,
        recipients,
        amounts,
        tokenURI,
      ]
    )

    // For simplicity, we'll use a deterministic approach instead of mining
    // In production, this would need actual bytecode hashes and mining logic
    const salt = this.generateRandomSalt(params.numeraire)
    
    // These would be computed via CREATE2 in production
    const hookAddress = '0x' + '1'.repeat(40) as Address // Placeholder
    const tokenAddress = '0x' + '2'.repeat(40) as Address // Placeholder
    
    return [salt, hookAddress, tokenAddress, poolInitializerData, tokenFactoryData]
  }

  /**
   * Compute V4 pool ID from pool key components
   */
  private computePoolId(poolKey: {
    currency0: Address
    currency1: Address  
    fee: number
    tickSpacing: number
    hooks: Address
  }): string {
    // V4 pools are identified by the hash of their PoolKey
    const encoded = encodeAbiParameters(
      [
        { type: 'address' },
        { type: 'address' },
        { type: 'uint24' },
        { type: 'int24' },
        { type: 'address' }
      ],
      [
        poolKey.currency0,
        poolKey.currency1,
        poolKey.fee,
        poolKey.tickSpacing,
        poolKey.hooks
      ]
    )
    return keccak256(encoded)
  }
}