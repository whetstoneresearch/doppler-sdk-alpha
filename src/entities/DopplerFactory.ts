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
  MigrationConfig,
  StaticAuctionBuildConfig,
  DynamicAuctionBuildConfig,
  PriceRange,
  TickRange
} from '../types'
import { getAddresses } from '../addresses'
import { 
  WAD, 
  DEAD_ADDRESS,
  ZERO_ADDRESS,
  DEFAULT_EPOCH_LENGTH,
  DEFAULT_AUCTION_DURATION,
  DEFAULT_LOCK_DURATION, 
  BASIS_POINTS,
  DEFAULT_PD_SLUGS,
  DAY_SECONDS,
  FLAG_MASK,
  DOPPLER_FLAGS,
  DEFAULT_V3_START_TICK,
  DEFAULT_V3_END_TICK,
  DEFAULT_V3_NUM_POSITIONS,
  DEFAULT_V3_FEE,
  DEFAULT_V3_VESTING_DURATION,
  DEFAULT_V3_INITIAL_SUPPLY,
  DEFAULT_V3_NUM_TOKENS_TO_SELL,
  DEFAULT_V3_YEARLY_MINT_RATE,
  DEFAULT_V3_PRE_MINT,
  DEFAULT_V3_MAX_SHARE_TO_BE_SOLD,
  DEFAULT_V4_YEARLY_MINT_RATE,
  DEFAULT_V3_INITIAL_VOTING_DELAY,
  DEFAULT_V3_INITIAL_VOTING_PERIOD,
  DEFAULT_V3_INITIAL_PROPOSAL_THRESHOLD,
  DEFAULT_V4_INITIAL_VOTING_DELAY,
  DEFAULT_V4_INITIAL_VOTING_PERIOD,
  DEFAULT_V4_INITIAL_PROPOSAL_THRESHOLD
} from '../constants'
import { airlockAbi, uniswapV3InitializerAbi, uniswapV4InitializerAbi, v2MigratorAbi, v3MigratorAbi, v4MigratorAbi, DERC20Bytecode, DopplerBytecode } from '../abis'

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
   * Build configuration for creating a new dynamic auction (V4-style)
   * This method provides sensible defaults and automatic calculations similar to V4 SDK's buildConfig
   * 
   * @param config - Build configuration with minimal required parameters
   * @param userAddress - User address for vesting and salt generation
   * @returns Complete parameters ready for createDynamicAuction
   */
  public buildDynamicAuctionConfig(
    config: DynamicAuctionBuildConfig,
    userAddress: Address
  ): CreateDynamicAuctionParams {
    // Apply defaults
    const duration = config.duration ?? DEFAULT_AUCTION_DURATION
    const epochLength = config.epochLength ?? DEFAULT_EPOCH_LENGTH
    const numeraire = config.numeraire ?? ZERO_ADDRESS
    const numPdSlugs = config.numPdSlugs ?? DEFAULT_PD_SLUGS
    const yearlyMintRate = config.yearlyMintRate ?? DEFAULT_V4_YEARLY_MINT_RATE
    const useGovernance = config.useGovernance ?? true
    const integrator = config.integrator ?? ZERO_ADDRESS

    // Validate that either priceRange or tickRange is provided
    if (!config.priceRange && !config.tickRange) {
      throw new Error('Either priceRange or tickRange must be provided')
    }

    // Calculate ticks from price range if needed
    let startTick: number
    let endTick: number
    
    if (config.priceRange) {
      const ticks = this.computeTicks(config.priceRange, config.tickSpacing)
      startTick = ticks.startTick
      endTick = ticks.endTick
    } else if (config.tickRange) {
      startTick = config.tickRange.startTick
      endTick = config.tickRange.endTick
    } else {
      throw new Error('Failed to determine tick range')
    }

    // Calculate gamma if not provided
    const gamma = config.gamma ?? this.computeOptimalGamma(
      startTick,
      endTick,
      duration,
      epochLength,
      config.tickSpacing
    )

    // Prepare vesting configuration
    const hasVesting = config.recipients.length > 0 && config.amounts.length > 0
    const vestingConfig = hasVesting ? {
      duration: Number(config.vestingDuration),
      cliffDuration: 0 // V4 SDK doesn't use cliff duration
    } : undefined

    // Prepare governance configuration
    const governanceConfig = useGovernance ? {
      initialVotingDelay: DEFAULT_V4_INITIAL_VOTING_DELAY,
      initialVotingPeriod: DEFAULT_V4_INITIAL_VOTING_PERIOD,
      initialProposalThreshold: DEFAULT_V4_INITIAL_PROPOSAL_THRESHOLD
    } : undefined

    // Build the complete configuration
    return {
      token: {
        name: config.name,
        symbol: config.symbol,
        tokenURI: config.tokenURI,
        yearlyMintRate: yearlyMintRate
      },
      sale: {
        initialSupply: config.totalSupply,
        numTokensToSell: config.numTokensToSell,
        numeraire: numeraire
      },
      auction: {
        duration: duration,
        epochLength: epochLength,
        startTick: startTick,
        endTick: endTick,
        gamma: gamma,
        minProceeds: config.minProceeds,
        maxProceeds: config.maxProceeds,
        numPdSlugs: numPdSlugs
      },
      pool: {
        fee: config.fee,
        tickSpacing: config.tickSpacing
      },
      vesting: vestingConfig,
      governance: governanceConfig,
      migration: config.migration,
      integrator: integrator,
      userAddress: userAddress,
      startTimeOffset: config.startTimeOffset,
      blockTimestamp: config.blockTimestamp
    }
  }

  /**
   * Build configuration for creating a new static auction (V3-style)
   * This method provides sensible defaults similar to V3 SDK
   * 
   * @param config - Build configuration with minimal required parameters
   * @param userAddress - User address for vesting and salt generation
   * @returns Complete parameters ready for createStaticAuction
   */
  public buildStaticAuctionConfig(
    config: StaticAuctionBuildConfig,
    userAddress: Address
  ): CreateStaticAuctionParams {
    // Apply defaults
    const totalSupply = config.totalSupply ?? DEFAULT_V3_INITIAL_SUPPLY
    const numTokensToSell = config.numTokensToSell ?? DEFAULT_V3_NUM_TOKENS_TO_SELL
    const fee = config.fee ?? DEFAULT_V3_FEE
    const numPositions = config.numPositions ?? DEFAULT_V3_NUM_POSITIONS
    const maxShareToBeSold = config.maxShareToBeSold ?? DEFAULT_V3_MAX_SHARE_TO_BE_SOLD
    const yearlyMintRate = config.yearlyMintRate ?? DEFAULT_V3_YEARLY_MINT_RATE
    const vestingDuration = config.vestingDuration ?? DEFAULT_V3_VESTING_DURATION
    const useGovernance = config.useGovernance ?? true
    const integrator = config.integrator ?? ZERO_ADDRESS

    // Handle vesting recipients and amounts
    const recipients = config.recipients ?? [userAddress]
    const amounts = config.amounts ?? [DEFAULT_V3_PRE_MINT]

    // Validate that either priceRange or tickRange is provided
    if (!config.priceRange && !config.tickRange) {
      // Use default tick range if neither is provided
      var startTick = DEFAULT_V3_START_TICK
      var endTick = DEFAULT_V3_END_TICK
    } else if (config.priceRange) {
      // Calculate tick spacing based on fee
      const tickSpacing = fee === 100 ? 1 : fee === 500 ? 10 : fee === 3000 ? 60 : 200
      const ticks = this.computeTicks(config.priceRange, tickSpacing)
      var startTick = ticks.startTick
      var endTick = ticks.endTick
    } else if (config.tickRange) {
      var startTick = config.tickRange.startTick
      var endTick = config.tickRange.endTick
    } else {
      throw new Error('Failed to determine tick range')
    }

    // Prepare vesting configuration
    const hasVesting = recipients.length > 0 && amounts.length > 0
    const vestingConfig = hasVesting ? {
      duration: Number(vestingDuration),
      cliffDuration: 0 // V3 SDK doesn't use cliff duration
    } : undefined

    // Prepare governance configuration
    const governanceConfig = useGovernance ? {
      initialVotingDelay: DEFAULT_V3_INITIAL_VOTING_DELAY,
      initialVotingPeriod: DEFAULT_V3_INITIAL_VOTING_PERIOD,
      initialProposalThreshold: DEFAULT_V3_INITIAL_PROPOSAL_THRESHOLD
    } : undefined

    // Build the complete configuration
    return {
      token: {
        name: config.name,
        symbol: config.symbol,
        tokenURI: config.tokenURI,
        yearlyMintRate: yearlyMintRate
      },
      sale: {
        initialSupply: totalSupply,
        numTokensToSell: numTokensToSell,
        numeraire: config.numeraire
      },
      pool: {
        startTick: startTick,
        endTick: endTick,
        fee: fee,
        numPositions: numPositions,
        maxShareToBeSold: maxShareToBeSold
      },
      vesting: vestingConfig,
      governance: governanceConfig,
      migration: config.migration,
      integrator: integrator,
      userAddress: userAddress
    }
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
    // V3 initializer expects InitData struct with specific field order
    const poolInitializerData = encodeAbiParameters(
      [
        { 
          type: 'tuple',
          components: [
            { type: 'uint24', name: 'fee' },
            { type: 'int24', name: 'tickLower' },
            { type: 'int24', name: 'tickUpper' },
            { type: 'uint16', name: 'numPositions' },
            { type: 'uint256', name: 'maxShareToBeSold' }
          ]
        }
      ],
      [{
        fee: params.pool.fee,
        tickLower: params.pool.startTick,
        tickUpper: params.pool.endTick,
        numPositions: params.pool.numPositions ?? DEFAULT_V3_NUM_POSITIONS,
        maxShareToBeSold: params.pool.maxShareToBeSold ?? DEFAULT_V3_MAX_SHARE_TO_BE_SOLD
      }]
    )
    
    // 2. Encode migration data based on MigrationConfig
    const liquidityMigratorData = this.encodeMigrationData(params.migration)
    
    // 3. Encode token parameters
    const vestingDuration = params.vesting?.duration ?? BigInt(0)
    const yearlyMintRate = params.token.yearlyMintRate ?? DEFAULT_V3_YEARLY_MINT_RATE
    
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
        params.token.name,
        params.token.symbol,
        yearlyMintRate,
        BigInt(vestingDuration),
        params.vesting ? [params.userAddress] : [],
        params.vesting ? [params.sale.initialSupply - params.sale.numTokensToSell] : [],
        params.token.tokenURI
      ]
    )
    
    // 4. Encode governance factory data
    const governanceFactoryData = encodeAbiParameters(
      [
        { type: 'string' },
        { type: 'uint48' },
        { type: 'uint32' },
        { type: 'uint256' },
      ],
      [
        params.token.name,
        params.governance?.initialVotingDelay ?? DEFAULT_V3_INITIAL_VOTING_DELAY,
        params.governance?.initialVotingPeriod ?? DEFAULT_V3_INITIAL_VOTING_PERIOD,
        params.governance?.initialProposalThreshold ?? DEFAULT_V3_INITIAL_PROPOSAL_THRESHOLD
      ]
    )
    
    // 5. Generate a unique salt
    const salt = this.generateRandomSalt(params.userAddress)
    
    // Build the complete CreateParams for the V4-style ABI
    const createParams = {
      initialSupply: params.sale.initialSupply,
      numTokensToSell: params.sale.numTokensToSell,
      numeraire: params.sale.numeraire,
      tokenFactory: addresses.tokenFactory,
      tokenFactoryData: tokenFactoryData,
      governanceFactory: addresses.governanceFactory,
      governanceFactoryData: governanceFactoryData,
      poolInitializer: addresses.v3Initializer,
      poolInitializerData: poolInitializerData,
      liquidityMigrator: this.getMigratorAddress(params.migration),
      liquidityMigratorData: liquidityMigratorData,
      integrator: params.integrator ?? ZERO_ADDRESS,
      salt: salt,
    }
    
    // Call the airlock contract to create the pool
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations')
    }
    
    const { request, result } = await this.publicClient.simulateContract({
      address: addresses.airlock,
      abi: airlockAbi,
      functionName: 'create',
      args: [{...createParams}],
      account: this.walletClient.account,
    })
    
    const hash = await this.walletClient.writeContract(request)
    
    // Wait for transaction and get the receipt
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash })
    
    // The create function returns [asset, pool, governance, timelock, migrationPool]
    // We can get these from the simulation result or parse from logs
    if (result && Array.isArray(result) && result.length >= 2) {
      return {
        poolAddress: result[1] as Address, // pool is the second element
        tokenAddress: result[0] as Address, // asset (token) is the first element
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
      
      if (decoded.eventName === 'Create') {
        return {
          poolAddress: (decoded.args as any).poolOrHook as Address,
          tokenAddress: (decoded.args as any).asset as Address,
          transactionHash: hash
        }
      }
    }
    
    throw new Error('Failed to get pool and token addresses from transaction')
  }
  
  /**
   * Generate a random salt based on user address
   */
  private generateRandomSalt(account: Address): Hex {
    // Use crypto.getRandomValues for secure random generation
    const array = new Uint8Array(32)
    
    // Try to use crypto API if available (Node.js or browser)
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(array)
    } else {
      // Fallback: use timestamp and account for deterministic generation
      const timestamp = Date.now()
      const timestampBytes = new Uint8Array(8)
      for (let i = 0; i < 8; i++) {
        timestampBytes[i] = (timestamp >> (i * 8)) & 0xff
      }
      
      // Fill array with timestamp and account-based entropy
      for (let i = 0; i < 32; i++) {
        if (i < 8) {
          array[i] = timestampBytes[i]
        } else {
          array[i] = i
        }
      }
    }
    
    // XOR with address bytes for additional entropy
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
    // Use provided block timestamp or fetch the latest
    let blockTimestamp: number
    if (params.blockTimestamp !== undefined) {
      blockTimestamp = params.blockTimestamp
    } else {
      const latestBlock = await this.publicClient.getBlock({ blockTag: 'latest' })
      blockTimestamp = Number(latestBlock.timestamp)
    }
    
    // Use startTimeOffset if provided, otherwise default to 30 seconds
    const startTimeOffset = params.startTimeOffset ?? 30
    const startTime = blockTimestamp + startTimeOffset
    const endTime = blockTimestamp + params.auction.duration * DAY_SECONDS + startTimeOffset
    
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
    const yearlyMintRate = params.token.yearlyMintRate ?? DEFAULT_V4_YEARLY_MINT_RATE
    
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
        params.governance?.initialVotingDelay ?? DEFAULT_V4_INITIAL_VOTING_DELAY,
        params.governance?.initialVotingPeriod ?? DEFAULT_V4_INITIAL_VOTING_PERIOD,
        params.governance?.initialProposalThreshold ?? DEFAULT_V4_INITIAL_PROPOSAL_THRESHOLD
      ]
    )
    
    // 8. Build the complete CreateParams for the V4-style ABI
    const createParams = {
      initialSupply: params.sale.initialSupply,
      numTokensToSell: params.sale.numTokensToSell,
      numeraire: params.sale.numeraire,
      tokenFactory: addresses.tokenFactory,
      tokenFactoryData: encodedTokenFactoryData,
      governanceFactory: addresses.governanceFactory,
      governanceFactoryData: governanceFactoryData,
      poolInitializer: addresses.v4Initializer,
      poolInitializerData: poolInitializerData,
      liquidityMigrator: this.getMigratorAddress(params.migration),
      liquidityMigratorData: liquidityMigratorData,
      integrator: params.integrator ?? ZERO_ADDRESS,
      salt: salt,
    }
    
    // Call the airlock contract to create the pool
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations')
    }
    
    const { request, result } = await this.publicClient.simulateContract({
      address: addresses.airlock,
      abi: airlockAbi,
      functionName: 'create',
      args: [{...createParams}],
      account: this.walletClient.account,
    })
    
    const hash = await this.walletClient.writeContract(request)
    
    // Wait for transaction and get the receipt
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash })
    
    // Get actual addresses from the return value or event logs
    let actualHookAddress: Address = hookAddress
    let actualTokenAddress: Address = tokenAddress
    
    if (result && Array.isArray(result) && result.length >= 2) {
      // The create function returns [asset, pool, governance, timelock, migrationPool]
      actualTokenAddress = result[0] as Address
      actualHookAddress = result[1] as Address // For V4, pool is the hook address
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
        
        if (decoded.eventName === 'Create') {
          actualHookAddress = (decoded.args as any).poolOrHook as Address
          actualTokenAddress = (decoded.args as any).asset as Address
        }
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
        // The V4 migrator expects beneficiaries with shares in WAD (1e18) format
        const WAD = BigInt(1e18)
        const beneficiaryData: { beneficiary: Address; shares: bigint }[] = []
        
        // Convert percentage-based beneficiaries to shares-based
        for (const b of config.streamableFees.beneficiaries) {
          beneficiaryData.push({
            beneficiary: b.address,
            shares: (BigInt(b.percentage) * WAD) / BigInt(BASIS_POINTS)
          })
        }
        
        // Sort beneficiaries by address in ascending order (required by contract)
        beneficiaryData.sort((a, b) => {
          const addrA = a.beneficiary.toLowerCase()
          const addrB = b.beneficiary.toLowerCase()
          return addrA < addrB ? -1 : addrA > addrB ? 1 : 0
        })
        
        // Note: The contract will validate that the airlock owner gets at least 5%
        // If not present, the SDK user should add it manually
        
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
            beneficiaryData.map(b => ({
              beneficiary: b.beneficiary,
              shares: b.shares
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
   * Computes tick values from price range
   * @param priceRange - The price range in human-readable format
   * @param tickSpacing - The tick spacing for the pool
   * @returns The tick range
   */
  private computeTicks(priceRange: PriceRange, tickSpacing: number): TickRange {
    // Convert prices to ticks using the formula: tick = log(price) / log(1.0001) * tickSpacing
    const startTick = Math.floor(Math.log(priceRange.startPrice) / Math.log(1.0001) / tickSpacing) * tickSpacing
    const endTick = Math.ceil(Math.log(priceRange.endPrice) / Math.log(1.0001) / tickSpacing) * tickSpacing

    return {
      startTick,
      endTick
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
    let gamma = Math.ceil(tickDelta / totalEpochs) * tickSpacing
    // Ensure gamma is at least 1 tick spacing
    gamma = Math.max(tickSpacing, gamma)

    if (gamma % tickSpacing !== 0) {
      throw new Error('Computed gamma must be divisible by tick spacing')
    }

    return gamma
  }

  /**
   * Mines a salt and hook address with the appropriate flags
   * 
   * This method iterates through possible salt values to find a combination that:
   * - Produces a hook address with required Doppler flags
   * - Maintains proper token ordering relative to numeraire
   * - Ensures deterministic deployment addresses
   * 
   * @param params - Parameters for hook address mining
   * @returns Tuple of [salt, hook address, token address, pool data, token data]
   * @throws {Error} If no valid salt can be found within the search limit
   * @private
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
    customDerc20Bytecode?: `0x${string}`
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

    const { poolManager, numTokensToSell, poolInitializer } = params

    const hookInitHashData = encodeAbiParameters(
      [
        { type: 'address' },
        { type: 'uint256' },
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
        { type: 'address' },
        { type: 'uint24' },
      ],
      [
        poolManager,
        numTokensToSell,
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
        poolInitializer,
        fee,
      ]
    )

    const hookInitHash = keccak256(
      encodePacked(
        ['bytes', 'bytes'],
        [DopplerBytecode as Hex, hookInitHashData]
      )
    )

    const {
      name,
      symbol,
      yearlyMintRate,
      vestingDuration,
      recipients,
      amounts,
      tokenURI,
    } = params.tokenFactoryData

    // Encode token factory data using helper method
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

    const { airlock, initialSupply } = params

    const initHashData = encodeAbiParameters(
      [
        { type: 'string' },
        { type: 'string' },
        { type: 'uint256' },
        { type: 'address' },
        { type: 'address' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'address[]' },
        { type: 'uint256[]' },
        { type: 'string' },
      ],
      [
        name,
        symbol,
        initialSupply,
        airlock,
        airlock,
        yearlyMintRate,
        vestingDuration,
        recipients,
        amounts,
        tokenURI,
      ]
    )

    const tokenInitHash = keccak256(
      encodePacked(['bytes', 'bytes'], [params.customDerc20Bytecode as Hex ?? DERC20Bytecode as Hex, initHashData])
    )

    // Use the exact flags from V4 SDK
    const flags = BigInt(
      (1 << 13) | // BEFORE_INITIALIZE_FLAG
      (1 << 12) | // AFTER_INITIALIZE_FLAG
      (1 << 11) | // BEFORE_ADD_LIQUIDITY_FLAG
      (1 << 7) |  // BEFORE_SWAP_FLAG
      (1 << 6) |  // AFTER_SWAP_FLAG
      (1 << 5)    // BEFORE_DONATE_FLAG
    )

    for (let salt = BigInt(0); salt < BigInt(1_000_000); salt++) {
      const saltBytes = `0x${salt.toString(16).padStart(64, '0')}` as Hash
      const hook = this.computeCreate2Address(
        saltBytes,
        hookInitHash,
        params.deployer
      )
      const token = this.computeCreate2Address(
        saltBytes,
        tokenInitHash,
        params.tokenFactory
      )

      const hookBigInt = BigInt(hook)
      const tokenBigInt = BigInt(token)
      const numeraireBigInt = BigInt(params.numeraire)

      if (
        (hookBigInt & FLAG_MASK) === flags &&
        ((isToken0 && tokenBigInt < numeraireBigInt) ||
          (!isToken0 && tokenBigInt > numeraireBigInt))
      ) {
        return [saltBytes, hook, token, poolInitializerData, tokenFactoryData]
      }
    }

    throw new Error('AirlockMiner: could not find salt')
  }

  /**
   * Computes the CREATE2 address for a contract deployment
   * @param salt - The salt used for deployment
   * @param initCodeHash - Hash of the initialization code
   * @param deployer - Address of the deploying contract
   * @returns The computed contract address
   * @private
   */
  private computeCreate2Address(
    salt: Hash,
    initCodeHash: Hash,
    deployer: Address
  ): Address {
    const encoded = encodePacked(
      ['bytes1', 'address', 'bytes32', 'bytes32'],
      ['0xff', deployer, salt, initCodeHash]
    )
    return getAddress(`0x${keccak256(encoded).slice(-40)}`)
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