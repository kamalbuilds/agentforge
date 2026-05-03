// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "forge-std/Test.sol";
import "../src/RoyaltyVault.sol";

contract RoyaltyVaultTest is Test {
    RoyaltyVault internal vault;
    address internal owner          = makeAddr("owner");
    address internal breedingMarket = makeAddr("breedingMarket");
    address internal alice          = makeAddr("alice");
    address internal bob            = makeAddr("bob");
    address internal carol          = makeAddr("carol");

    function setUp() public {
        vm.prank(owner);
        vault = new RoyaltyVault(owner);

        vm.prank(owner);
        vault.setBreedingMarket(breedingMarket);

        vm.deal(carol, 10 ether);
    }

    // -------------------------------------------------------------------------
    // Only BreedingMarket can register splits
    // -------------------------------------------------------------------------

    function test_RegisterSplitOnlyBreedingMarket() public {
        address[] memory recipients = new address[](1);
        uint96[]  memory bps        = new uint96[](1);
        recipients[0] = alice;
        bps[0]        = 10_000;

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(RoyaltyVault.OnlyBreedingMarket.selector, alice));
        vault.registerSplit(0, recipients, bps);
    }

    function test_RegisterSplitSucceeds() public {
        address[] memory recipients = new address[](2);
        uint96[]  memory bps        = new uint96[](2);
        recipients[0] = alice;
        recipients[1] = bob;
        bps[0]        = 5_000;
        bps[1]        = 5_000;

        vm.prank(breedingMarket);
        vault.registerSplit(42, recipients, bps);

        assertTrue(vault.hasSplit(42));
        (address[] memory r, uint96[] memory b) = vault.getSplit(42);
        assertEq(r.length, 2);
        assertEq(b[0], 5_000);
        assertEq(b[1], 5_000);
    }

    function test_CannotRegisterSplitTwice() public {
        address[] memory recipients = new address[](1);
        uint96[]  memory bps        = new uint96[](1);
        recipients[0] = alice;
        bps[0]        = 10_000;

        vm.prank(breedingMarket);
        vault.registerSplit(1, recipients, bps);

        vm.prank(breedingMarket);
        vm.expectRevert(abi.encodeWithSelector(RoyaltyVault.SplitAlreadyRegistered.selector, 1));
        vault.registerSplit(1, recipients, bps);
    }

    function test_BpsOver10000Reverts() public {
        address[] memory recipients = new address[](2);
        uint96[]  memory bps        = new uint96[](2);
        recipients[0] = alice;
        recipients[1] = bob;
        bps[0]        = 6_000;
        bps[1]        = 5_000; // total 11_000 > 10_000

        vm.prank(breedingMarket);
        vm.expectRevert(abi.encodeWithSelector(RoyaltyVault.BpsExceeds10000.selector, uint96(11_000)));
        vault.registerSplit(2, recipients, bps);
    }

    function test_ArrayLengthMismatchReverts() public {
        address[] memory recipients = new address[](2);
        uint96[]  memory bps        = new uint96[](1);
        recipients[0] = alice;
        recipients[1] = bob;
        bps[0]        = 10_000;

        vm.prank(breedingMarket);
        vm.expectRevert(RoyaltyVault.ArrayLengthMismatch.selector);
        vault.registerSplit(3, recipients, bps);
    }

    // -------------------------------------------------------------------------
    // Deposit + claim pull pattern
    // -------------------------------------------------------------------------

    function test_DepositAllocatesToRecipients() public {
        address[] memory recipients = new address[](2);
        uint96[]  memory bps        = new uint96[](2);
        recipients[0] = alice;
        recipients[1] = bob;
        bps[0]        = 7_000; // 70%
        bps[1]        = 3_000; // 30%

        vm.prank(breedingMarket);
        vault.registerSplit(10, recipients, bps);

        vm.prank(carol);
        vault.deposit{value: 1 ether}(10);

        assertEq(vault.pending(alice), 0.7 ether);
        assertEq(vault.pending(bob),   0.3 ether);
    }

    function test_ClaimPullsBalance() public {
        address[] memory recipients = new address[](1);
        uint96[]  memory bps        = new uint96[](1);
        recipients[0] = alice;
        bps[0]        = 10_000;

        vm.prank(breedingMarket);
        vault.registerSplit(20, recipients, bps);

        vm.prank(carol);
        vault.deposit{value: 1 ether}(20);

        assertEq(vault.pending(alice), 1 ether);

        uint256 aliceBefore = alice.balance;
        vault.claim(alice);

        assertEq(alice.balance - aliceBefore, 1 ether);
        assertEq(vault.pending(alice), 0);
    }

    function test_ClaimRevertsWhenNothingPending() public {
        vm.expectRevert(abi.encodeWithSelector(RoyaltyVault.NothingToClaim.selector, alice));
        vault.claim(alice);
    }

    function test_MultipleDepositsAccumulate() public {
        address[] memory recipients = new address[](1);
        uint96[]  memory bps        = new uint96[](1);
        recipients[0] = alice;
        bps[0]        = 10_000;

        vm.prank(breedingMarket);
        vault.registerSplit(30, recipients, bps);

        vm.startPrank(carol);
        vault.deposit{value: 0.5 ether}(30);
        vault.deposit{value: 0.5 ether}(30);
        vm.stopPrank();

        assertEq(vault.pending(alice), 1 ether);
    }

    function test_DepositRevertsForUnregisteredSplit() public {
        vm.prank(carol);
        vm.expectRevert(abi.encodeWithSelector(RoyaltyVault.NoSplitRegistered.selector, 99));
        vault.deposit{value: 1 ether}(99);
    }

    function test_ClaimRevertsForZeroAddress() public {
        vm.expectRevert(RoyaltyVault.ZeroAddress.selector);
        vault.claim(address(0));
    }

    // -------------------------------------------------------------------------
    // Fuzz: deposit splits correctly for varying amounts
    // -------------------------------------------------------------------------

    function testFuzz_DepositSplitSum(uint128 amount) public {
        vm.assume(amount > 0);
        vm.deal(carol, amount);

        address[] memory recipients = new address[](2);
        uint96[]  memory bps        = new uint96[](2);
        recipients[0] = alice;
        recipients[1] = bob;
        bps[0]        = 6_000;
        bps[1]        = 4_000;

        vm.prank(breedingMarket);
        vault.registerSplit(50, recipients, bps);

        vm.prank(carol);
        vault.deposit{value: amount}(50);

        // The sum of pending balances must equal the deposited amount.
        assertEq(vault.pending(alice) + vault.pending(bob), uint256(amount));
    }
}
