import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseEther, type Address, type Hex, type PublicClient } from 'viem';
import { dopplerERC20V1Abi } from '../../../../src/evm/abis';
import { DopplerERC20V1 } from '../../../../src/evm/entities/token/derc20/DopplerERC20V1';
import {
  createMockPublicClient,
  createMockWalletClient,
} from '../../setup/fixtures/clients';
import { mockTokenAddress } from '../../setup/fixtures/addresses';

describe('DopplerERC20V1', () => {
  let token: DopplerERC20V1;
  let publicClient: PublicClient;
  let walletClient: ReturnType<typeof createMockWalletClient>;

  const beneficiary = '0x1234567890123456789012345678901234567890' as Address;
  const controller = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address;
  const delegatee = '0x2222222222222222222222222222222222222222' as Address;
  const owner = '0x3333333333333333333333333333333333333333' as Address;
  const spender = '0x4444444444444444444444444444444444444444' as Address;
  const pool = '0x5555555555555555555555555555555555555555' as Address;
  const bytes32A = `0x${'11'.repeat(32)}` as Hex;
  const bytes32B = `0x${'22'.repeat(32)}` as Hex;
  const signature = `0x${'11'.repeat(32)}${'22'.repeat(32)}1b` as Hex;
  const txHash =
    '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as Hex;

  const functionNames = () =>
    dopplerERC20V1Abi
      .filter((entry) => entry.type === 'function')
      .map((entry) => entry.name);

  const eventNames = () =>
    dopplerERC20V1Abi
      .filter((entry) => entry.type === 'event')
      .map((entry) => entry.name);

  const errorNames = () =>
    dopplerERC20V1Abi
      .filter((entry) => entry.type === 'error')
      .map((entry) => entry.name);

  it('exports the canonical amount-based overloads', () => {
    const releaseForEntries = dopplerERC20V1Abi.filter(
      (entry) => entry.type === 'function' && entry.name === 'releaseFor',
    );
    const availableEntries = dopplerERC20V1Abi.filter(
      (entry) =>
        entry.type === 'function' &&
        entry.name === 'computeAvailableVestedAmount',
    );

    expect(releaseForEntries).toHaveLength(2);
    const [amountReleaseFor, scheduleReleaseFor] = releaseForEntries;
    if (!amountReleaseFor || !scheduleReleaseFor) {
      throw new Error('Expected both releaseFor overloads');
    }

    expect(releaseForEntries.map((entry) => entry.inputs.length)).toEqual([
      2, 3,
    ]);
    expect(amountReleaseFor.inputs[1]?.name).toBe('amount');
    expect([
      scheduleReleaseFor.inputs[0]?.name,
      scheduleReleaseFor.inputs[1]?.name,
      scheduleReleaseFor.inputs[2]?.name,
    ]).toEqual(['beneficiary', 'scheduleId', 'amount']);
    expect(availableEntries.map((entry) => entry.inputs.length)).toEqual([
      2, 1,
    ]);
  });

  it('includes full deployed ABI groups', () => {
    const initialize = dopplerERC20V1Abi.find(
      (entry) => entry.type === 'function' && entry.name === 'initialize',
    );
    if (!initialize || initialize.type !== 'function') {
      throw new Error('Expected initialize function');
    }

    expect(initialize.inputs.map((input) => input.type)).toEqual([
      'string',
      'string',
      'uint256',
      'address',
      'address',
      'tuple[]',
      'address[]',
      'uint256[]',
      'uint256[]',
      'string',
      'uint256',
      'uint48',
      'address',
      'address[]',
    ]);
    expect(initialize.inputs[5]?.type).toBe('tuple[]');

    expect(functionNames()).toEqual(
      expect.arrayContaining([
        'CLOCK_MODE',
        'clock',
        'delegates',
        'getVotes',
        'getPastVotes',
        'getPastTotalSupply',
        'delegate',
        'delegateBySig',
        'checkpointCount',
        'checkpointAt',
        'getVotesTotalSupply',
        'getPastVotesTotalSupply',
        'permit',
        'nonces',
        'DOMAIN_SEPARATOR',
        'owner',
        'transferOwnership',
        'renounceOwnership',
        'requestOwnershipHandover',
        'cancelOwnershipHandover',
        'completeOwnershipHandover',
        'ownershipHandoverExpiresAt',
        'pool',
        'isPoolLocked',
        'lockPool',
        'unlockPool',
        'vestingStart',
        'vestedTotalAmount',
        'totalUnreleasedOf',
        'burn',
      ]),
    );

    expect(eventNames()).toEqual(
      expect.arrayContaining([
        'VestingScheduleCreated',
        'VestingAllocated',
        'TokensReleased',
        'UpdateTokenURI',
        'BalanceLimitDisabled',
        'Transfer',
        'Approval',
        'DelegateChanged',
        'DelegateVotesChanged',
        'OwnershipTransferred',
        'OwnershipHandoverRequested',
        'OwnershipHandoverCanceled',
      ]),
    );

    expect(errorNames()).toEqual(
      expect.arrayContaining([
        'ArrayLengthsMismatch',
        'PoolLocked',
        'PoolAlreadyLocked',
        'PoolAlreadyUnlocked',
        'NoReleasableAmount',
        'BalanceLimitNotActive',
        'UnknownScheduleId',
        'InvalidSchedule',
        'InvalidAllocation',
        'InvalidBalanceLimitTimestamp',
        'InvalidBalanceLimit',
        'BalanceLimitExceeded',
        'InsufficientReleasableAmount',
        'TotalSupplyOverflow',
        'AllowanceOverflow',
        'AllowanceUnderflow',
        'InsufficientBalance',
        'InsufficientAllowance',
        'InvalidPermit',
        'PermitExpired',
        'Permit2AllowanceIsFixedAtInfinity',
        'ERC5805FutureLookup',
        'ERC5805DelegateSignatureExpired',
        'ERC5805DelegateInvalidSignature',
        'ERC5805CheckpointIndexOutOfBounds',
        'ERC5805CheckpointValueOverflow',
        'ERC5805CheckpointValueUnderflow',
        'Unauthorized',
        'NewOwnerIsZeroAddress',
        'NoHandoverRequest',
        'AlreadyInitialized',
        'InvalidInitialization',
        'NotInitializing',
      ]),
    );
  });

  beforeEach(() => {
    publicClient = createMockPublicClient() as PublicClient;
    walletClient = createMockWalletClient();
    token = new DopplerERC20V1(publicClient, walletClient, mockTokenAddress);
  });

  it('reads votes, permit, ownership, pool, and vesting direct state', async () => {
    vi.mocked(publicClient.readContract)
      .mockResolvedValueOnce(delegatee)
      .mockResolvedValueOnce(100n)
      .mockResolvedValueOnce(90n)
      .mockResolvedValueOnce(1_000n)
      .mockResolvedValueOnce(900n)
      .mockResolvedValueOnce(12345n)
      .mockResolvedValueOnce('mode=blocknumber&from=default')
      .mockResolvedValueOnce(2n)
      .mockResolvedValueOnce([123n, 456n] as never)
      .mockResolvedValueOnce(3n)
      .mockResolvedValueOnce(bytes32A)
      .mockResolvedValueOnce(owner)
      .mockResolvedValueOnce(1_700_000_000n)
      .mockResolvedValueOnce(pool)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(1_690_000_000n)
      .mockResolvedValueOnce(parseEther('50000'));

    await expect(token.getDelegates(beneficiary)).resolves.toBe(delegatee);
    await expect(token.getVotes(beneficiary)).resolves.toBe(100n);
    await expect(token.getPastVotes(beneficiary, 50n)).resolves.toBe(90n);
    await expect(token.getVotesTotalSupply()).resolves.toBe(1_000n);
    await expect(token.getPastVotesTotalSupply(50n)).resolves.toBe(900n);
    await expect(token.getClock()).resolves.toBe(12345);
    await expect(token.getClockMode()).resolves.toBe(
      'mode=blocknumber&from=default',
    );
    await expect(token.getCheckpointCount(beneficiary)).resolves.toBe(2n);
    await expect(token.getCheckpointAt(beneficiary, 1n)).resolves.toEqual({
      checkpointClock: 123,
      checkpointValue: 456n,
    });
    await expect(token.getNonce(owner)).resolves.toBe(3n);
    await expect(token.getDomainSeparator()).resolves.toBe(bytes32A);
    await expect(token.getOwner()).resolves.toBe(owner);
    await expect(token.getOwnershipHandoverExpiresAt(owner)).resolves.toBe(
      1_700_000_000n,
    );
    await expect(token.getPool()).resolves.toBe(pool);
    await expect(token.isPoolLocked()).resolves.toBe(true);
    await expect(token.getVestingStart()).resolves.toBe(1_690_000_000n);
    await expect(token.getVestedTotalAmount()).resolves.toBe(
      parseEther('50000'),
    );

    const expectedCalls: Array<{ functionName: string; args?: unknown[] }> = [
      { functionName: 'delegates', args: [beneficiary] },
      { functionName: 'getVotes', args: [beneficiary] },
      { functionName: 'getPastVotes', args: [beneficiary, 50n] },
      { functionName: 'getVotesTotalSupply' },
      { functionName: 'getPastVotesTotalSupply', args: [50n] },
      { functionName: 'clock' },
      { functionName: 'CLOCK_MODE' },
      { functionName: 'checkpointCount', args: [beneficiary] },
      { functionName: 'checkpointAt', args: [beneficiary, 1n] },
      { functionName: 'nonces', args: [owner] },
      { functionName: 'DOMAIN_SEPARATOR' },
      { functionName: 'owner' },
      { functionName: 'ownershipHandoverExpiresAt', args: [owner] },
      { functionName: 'pool' },
      { functionName: 'isPoolLocked' },
      { functionName: 'vestingStart' },
      { functionName: 'vestedTotalAmount' },
    ];

    expectedCalls.forEach((expectedCall, index) => {
      const baseCall = {
        address: mockTokenAddress,
        abi: expect.any(Array),
        functionName: expectedCall.functionName,
      };
      expect(publicClient.readContract).toHaveBeenNthCalledWith(
        index + 1,
        expectedCall.args ? { ...baseCall, args: expectedCall.args } : baseCall,
      );
    });
  });

  it('reads ERC20 metadata, balances, supply, and allowance', async () => {
    vi.mocked(publicClient.readContract)
      .mockResolvedValueOnce('Doppler V1')
      .mockResolvedValueOnce('DPLR')
      .mockResolvedValueOnce(18)
      .mockResolvedValueOnce('ipfs://token-metadata')
      .mockResolvedValueOnce(1234n)
      .mockResolvedValueOnce(5678n)
      .mockResolvedValueOnce(42n);

    await expect(token.getName()).resolves.toBe('Doppler V1');
    await expect(token.getSymbol()).resolves.toBe('DPLR');
    await expect(token.getDecimals()).resolves.toBe(18);
    await expect(token.getTokenURI()).resolves.toBe('ipfs://token-metadata');
    await expect(token.getBalanceOf(beneficiary)).resolves.toBe(1234n);
    await expect(token.getTotalSupply()).resolves.toBe(5678n);
    await expect(token.getAllowance(owner, spender)).resolves.toBe(42n);

    expect(publicClient.readContract).toHaveBeenNthCalledWith(1, {
      address: mockTokenAddress,
      abi: expect.any(Array),
      functionName: 'name',
    });
    expect(publicClient.readContract).toHaveBeenNthCalledWith(2, {
      address: mockTokenAddress,
      abi: expect.any(Array),
      functionName: 'symbol',
    });
    expect(publicClient.readContract).toHaveBeenNthCalledWith(3, {
      address: mockTokenAddress,
      abi: expect.any(Array),
      functionName: 'decimals',
    });
    expect(publicClient.readContract).toHaveBeenNthCalledWith(4, {
      address: mockTokenAddress,
      abi: expect.any(Array),
      functionName: 'tokenURI',
    });
    expect(publicClient.readContract).toHaveBeenNthCalledWith(5, {
      address: mockTokenAddress,
      abi: expect.any(Array),
      functionName: 'balanceOf',
      args: [beneficiary],
    });
    expect(publicClient.readContract).toHaveBeenNthCalledWith(6, {
      address: mockTokenAddress,
      abi: expect.any(Array),
      functionName: 'totalSupply',
    });
    expect(publicClient.readContract).toHaveBeenNthCalledWith(7, {
      address: mockTokenAddress,
      abi: expect.any(Array),
      functionName: 'allowance',
      args: [owner, spender],
    });
  });

  it('reads schedule vesting data', async () => {
    vi.mocked(publicClient.readContract)
      .mockResolvedValueOnce(2n)
      .mockResolvedValueOnce([90n, 180n] as never)
      .mockResolvedValueOnce([0n, 1n] as never)
      .mockResolvedValueOnce(parseEther('100000'))
      .mockResolvedValueOnce(parseEther('1234'))
      .mockResolvedValueOnce(parseEther('5678'))
      .mockResolvedValueOnce([
        parseEther('10000'),
        parseEther('2500'),
      ] as never);

    await expect(token.getVestingScheduleCount()).resolves.toBe(2n);
    await expect(token.getVestingSchedule(0n)).resolves.toEqual({
      cliffDuration: 90n,
      duration: 180n,
    });
    await expect(token.getScheduleIdsOf(beneficiary)).resolves.toEqual([
      0n,
      1n,
    ]);
    await expect(token.getTotalAllocatedOf(beneficiary)).resolves.toBe(
      parseEther('100000'),
    );
    await expect(
      token.getAvailableVestedAmountForSchedule(beneficiary, 1n),
    ).resolves.toBe(parseEther('1234'));
    await expect(token.getAvailableVestedAmount(beneficiary)).resolves.toBe(
      parseEther('5678'),
    );
    await expect(
      token.getVestingDataForSchedule(beneficiary, 1n),
    ).resolves.toEqual({
      totalAmount: parseEther('10000'),
      releasedAmount: parseEther('2500'),
    });

    expect(publicClient.readContract).toHaveBeenNthCalledWith(1, {
      address: mockTokenAddress,
      abi: expect.any(Array),
      functionName: 'vestingScheduleCount',
    });
    expect(publicClient.readContract).toHaveBeenNthCalledWith(2, {
      address: mockTokenAddress,
      abi: expect.any(Array),
      functionName: 'vestingSchedules',
      args: [0n],
    });
    expect(publicClient.readContract).toHaveBeenNthCalledWith(3, {
      address: mockTokenAddress,
      abi: expect.any(Array),
      functionName: 'getScheduleIdsOf',
      args: [beneficiary],
    });
  });

  it('reads balance-limit state', async () => {
    vi.mocked(publicClient.readContract)
      .mockResolvedValueOnce(parseEther('10000'))
      .mockResolvedValueOnce(1_800_000_000)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(controller)
      .mockResolvedValueOnce(false);

    await expect(token.getMaxBalanceLimit()).resolves.toBe(parseEther('10000'));
    await expect(token.getBalanceLimitEnd()).resolves.toBe(1_800_000_000);
    await expect(token.isBalanceLimitActive()).resolves.toBe(true);
    await expect(token.getController()).resolves.toBe(controller);
    await expect(token.isExcludedFromBalanceLimit(beneficiary)).resolves.toBe(
      false,
    );

    expect(publicClient.readContract).toHaveBeenNthCalledWith(5, {
      address: mockTokenAddress,
      abi: expect.any(Array),
      functionName: 'isExcludedFromBalanceLimit',
      args: [beneficiary],
    });
  });

  it('writes governance, permit, ownership, pool, and burn actions', async () => {
    const expectedWrites: Array<{
      run: () => Promise<Hex>;
      functionName: string;
      args: unknown[];
    }> = [
      {
        run: () => token.approve(spender, 25n),
        functionName: 'approve',
        args: [spender, 25n],
      },
      {
        run: () => token.transfer(beneficiary, 50n),
        functionName: 'transfer',
        args: [beneficiary, 50n],
      },
      {
        run: () => token.transferFrom(owner, beneficiary, 75n),
        functionName: 'transferFrom',
        args: [owner, beneficiary, 75n],
      },
      {
        run: () => token.delegate(delegatee),
        functionName: 'delegate',
        args: [delegatee],
      },
      {
        run: () => token.permit(owner, spender, 100n, 200n, signature),
        functionName: 'permit',
        args: [owner, spender, 100n, 200n, 27, bytes32A, bytes32B],
      },
      {
        run: () => token.transferOwnership(owner),
        functionName: 'transferOwnership',
        args: [owner],
      },
      {
        run: () => token.renounceOwnership(),
        functionName: 'renounceOwnership',
        args: [],
      },
      {
        run: () => token.requestOwnershipHandover(),
        functionName: 'requestOwnershipHandover',
        args: [],
      },
      {
        run: () => token.cancelOwnershipHandover(),
        functionName: 'cancelOwnershipHandover',
        args: [],
      },
      {
        run: () => token.completeOwnershipHandover(owner),
        functionName: 'completeOwnershipHandover',
        args: [owner],
      },
      {
        run: () => token.lockPool(pool),
        functionName: 'lockPool',
        args: [pool],
      },
      {
        run: () => token.unlockPool(),
        functionName: 'unlockPool',
        args: [],
      },
      {
        run: () => token.updateTokenURI('ipfs://updated-token-uri'),
        functionName: 'updateTokenURI',
        args: ['ipfs://updated-token-uri'],
      },
      {
        run: () => token.burn(123n),
        functionName: 'burn',
        args: [123n],
      },
    ];

    vi.mocked(publicClient.simulateContract).mockImplementation(
      async (call: unknown) => ({ request: call }) as never,
    );
    vi.mocked(walletClient.writeContract).mockResolvedValue(txHash);

    for (const expectedWrite of expectedWrites) {
      await expect(expectedWrite.run()).resolves.toBe(txHash);
    }

    expectedWrites.forEach((expectedWrite, index) => {
      expect(publicClient.simulateContract).toHaveBeenNthCalledWith(index + 1, {
        address: mockTokenAddress,
        abi: expect.any(Array),
        functionName: expectedWrite.functionName,
        args: expectedWrite.args,
        account: walletClient.account,
      });
    });
    expect(walletClient.writeContract).toHaveBeenCalledTimes(
      expectedWrites.length,
    );
  });

  it('passes gas overrides through write simulations and wallet writes', async () => {
    const gas = 123_456n;

    vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
      request: {
        address: mockTokenAddress,
        abi: dopplerERC20V1Abi,
        functionName: 'approve',
        args: [spender, 1n],
      },
    } as never);
    vi.mocked(walletClient.writeContract).mockResolvedValueOnce(txHash);

    await expect(token.approve(spender, 1n, { gas })).resolves.toBe(txHash);

    expect(walletClient.writeContract).toHaveBeenCalledWith({
      address: mockTokenAddress,
      abi: dopplerERC20V1Abi,
      functionName: 'approve',
      args: [spender, 1n],
      gas,
    });
  });

  it('writes delegateBySig from wallet typed data', async () => {
    vi.mocked(publicClient.readContract)
      .mockResolvedValueOnce(7n)
      .mockResolvedValueOnce('Doppler Token');
    vi.mocked(publicClient.simulateContract).mockImplementation(
      async (call: unknown) => ({ request: call }) as never,
    );
    walletClient.signTypedData = vi.fn().mockResolvedValue(signature);
    const walletAccount = walletClient.account as { address: Address };
    vi.mocked(walletClient.writeContract).mockResolvedValue(txHash);

    await expect(token.delegateBySig(delegatee, 999n)).resolves.toBe(txHash);

    expect(walletClient.signTypedData).toHaveBeenCalledWith({
      domain: {
        name: 'Doppler Token',
        version: '1',
        chainId: 1,
        verifyingContract: mockTokenAddress,
      },
      types: {
        Delegation: [
          { name: 'delegatee', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'expiry', type: 'uint256' },
        ],
      },
      primaryType: 'Delegation',
      message: { delegatee, nonce: 7n, expiry: 999n },
      account: walletAccount.address,
    });
    expect(publicClient.simulateContract).toHaveBeenCalledWith({
      address: mockTokenAddress,
      abi: expect.any(Array),
      functionName: 'delegateBySig',
      args: [delegatee, 7n, 999n, 27, bytes32A, bytes32B],
      account: walletAccount,
    });
  });

  it('writes partial release overloads and balance-limit controls', async () => {
    vi.mocked(publicClient.simulateContract)
      .mockResolvedValueOnce({
        request: { functionName: 'release', args: [0n, 100n] },
      } as never)
      .mockResolvedValueOnce({
        request: { functionName: 'release', args: [50n] },
      } as never)
      .mockResolvedValueOnce({
        request: { functionName: 'releaseFor', args: [beneficiary, 1n, 25n] },
      } as never)
      .mockResolvedValueOnce({
        request: { functionName: 'releaseFor', args: [beneficiary, 10n] },
      } as never)
      .mockResolvedValueOnce({
        request: { functionName: 'disableBalanceLimit', args: [] },
      } as never);
    vi.mocked(walletClient.writeContract).mockResolvedValue(txHash);

    await expect(token.releaseSchedule(0n, 100n)).resolves.toBe(txHash);
    await expect(token.release(50n)).resolves.toBe(txHash);
    await expect(token.releaseFor(beneficiary, 1n, 25n)).resolves.toBe(txHash);
    await expect(token.releaseFor(beneficiary, 10n)).resolves.toBe(txHash);
    await expect(token.disableBalanceLimit()).resolves.toBe(txHash);

    expect(publicClient.simulateContract).toHaveBeenNthCalledWith(1, {
      address: mockTokenAddress,
      abi: expect.any(Array),
      functionName: 'release',
      args: [0n, 100n],
      account: walletClient.account,
    });
    expect(publicClient.simulateContract).toHaveBeenNthCalledWith(2, {
      address: mockTokenAddress,
      abi: expect.any(Array),
      functionName: 'release',
      args: [50n],
      account: walletClient.account,
    });
    expect(publicClient.simulateContract).toHaveBeenNthCalledWith(3, {
      address: mockTokenAddress,
      abi: expect.any(Array),
      functionName: 'releaseFor',
      args: [beneficiary, 1n, 25n],
      account: walletClient.account,
    });
    expect(publicClient.simulateContract).toHaveBeenNthCalledWith(4, {
      address: mockTokenAddress,
      abi: expect.any(Array),
      functionName: 'releaseFor',
      args: [beneficiary, 10n],
      account: walletClient.account,
    });
  });

  it('throws on write methods without a wallet client', async () => {
    const readOnly = new DopplerERC20V1(
      publicClient,
      undefined,
      mockTokenAddress,
    );

    await expect(readOnly.release(1n)).rejects.toThrow(
      'Wallet client required for write operations',
    );
    await expect(readOnly.disableBalanceLimit()).rejects.toThrow(
      'Wallet client required for write operations',
    );
    await expect(readOnly.delegate(delegatee)).rejects.toThrow(
      'Wallet client required for write operations',
    );
    await expect(readOnly.transferOwnership(owner)).rejects.toThrow(
      'Wallet client required for write operations',
    );
    await expect(readOnly.lockPool(pool)).rejects.toThrow(
      'Wallet client required for write operations',
    );
    await expect(readOnly.burn(1n)).rejects.toThrow(
      'Wallet client required for write operations',
    );
  });
});
