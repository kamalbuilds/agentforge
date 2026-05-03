// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "forge-std/Test.sol";
import "../src/AgentINFT.sol";
import "../src/RoyaltyVault.sol";
import "../src/BreedingMarket.sol";

contract BreedingMarketTest is Test {
    AgentINFT      internal nft;
    RoyaltyVault   internal vault;
    BreedingMarket internal market;

    address internal owner    = makeAddr("owner");
    address internal alice    = makeAddr("alice");  // parentA owner
    address internal bob      = makeAddr("bob");    // parentB owner
    address internal charlie  = makeAddr("charlie");
    uint256 internal operatorPk = 0xB0B;
    address internal operator;

    function setUp() public {
        operator = vm.addr(operatorPk);

        vm.startPrank(owner);
        nft    = new AgentINFT(owner);
        vault  = new RoyaltyVault(owner);
        market = new BreedingMarket(address(nft), address(vault), owner);

        nft.addMinter(owner);           // direct minting in tests
        nft.addMinter(address(market)); // BreedingMarket must be a minter
        vault.setBreedingMarket(address(market));
        market.setBreedingOperator(operator);
        vm.stopPrank();

        vm.deal(alice,   10 ether);
        vm.deal(bob,     10 ether);
        vm.deal(charlie, 10 ether);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    function _mintAgent(address to) internal returns (uint256) {
        vm.prank(owner);
        return nft.mint(to, "cid", "meta", 0, 0, bytes32(0));
    }

    function _approve(uint256 tokenId, address tokenOwner) internal {
        vm.prank(tokenOwner);
        market.setBreedingApproval(tokenId, true);
    }

    function _operatorSign(uint256 reqId, string memory weightCID, bytes32 sealedKeyHash)
        internal
        view
        returns (bytes memory sig)
    {
        bytes32 msgHash = keccak256(abi.encodePacked(reqId, keccak256(bytes(weightCID)), sealedKeyHash));
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", msgHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(operatorPk, ethHash);
        sig = abi.encodePacked(r, s, v);
    }

    // -------------------------------------------------------------------------
    // Breeding approval
    // -------------------------------------------------------------------------

    function test_SetBreedingApproval() public {
        uint256 tokenId = _mintAgent(alice);
        assertFalse(market.isBreedingApproved(tokenId));

        _approve(tokenId, alice);
        assertTrue(market.isBreedingApproved(tokenId));
    }

    function test_SetBreedingApprovalRevertsForNonOwner() public {
        uint256 tokenId = _mintAgent(alice);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(BreedingMarket.NotParentOwner.selector, tokenId, bob));
        market.setBreedingApproval(tokenId, true);
    }

    // -------------------------------------------------------------------------
    // requestBreed: requires approval from both parents
    // -------------------------------------------------------------------------

    function test_RequestBreedRequiresBothApprovals() public {
        uint256 parentA = _mintAgent(alice);
        uint256 parentB = _mintAgent(bob);

        // Neither approved
        vm.prank(charlie);
        vm.expectRevert(abi.encodeWithSelector(BreedingMarket.ParentNotApproved.selector, parentA));
        market.requestBreed{value: 1 ether}(parentA, parentB, 500);

        // Only parentA approved
        _approve(parentA, alice);
        vm.prank(charlie);
        vm.expectRevert(abi.encodeWithSelector(BreedingMarket.ParentNotApproved.selector, parentB));
        market.requestBreed{value: 1 ether}(parentA, parentB, 500);
    }

    function test_RequestBreedSucceedsWhenBothApproved() public {
        uint256 parentA = _mintAgent(alice);
        uint256 parentB = _mintAgent(bob);
        _approve(parentA, alice);
        _approve(parentB, bob);

        vm.prank(charlie);
        uint256 reqId = market.requestBreed{value: 1 ether}(parentA, parentB, 500);
        assertEq(reqId, 0);

        BreedingMarket.BreedRequest memory req = market.getRequest(reqId);
        assertEq(req.parentA, parentA);
        assertEq(req.parentB, parentB);
        assertEq(req.fee, 1 ether);
        assertFalse(req.fulfilled);
    }

    // -------------------------------------------------------------------------
    // Fee split 50/50 to parent owners
    // -------------------------------------------------------------------------

    function test_FeeSplitToParentOwners() public {
        uint256 parentA = _mintAgent(alice);
        uint256 parentB = _mintAgent(bob);
        _approve(parentA, alice);
        _approve(parentB, bob);

        uint256 aliceBefore = alice.balance;
        uint256 bobBefore   = bob.balance;

        vm.prank(charlie);
        market.requestBreed{value: 2 ether}(parentA, parentB, 500);

        assertEq(alice.balance - aliceBefore, 1 ether);
        assertEq(bob.balance   - bobBefore,   1 ether);
    }

    function test_FeeSplitWithOddWei() public {
        uint256 parentA = _mintAgent(alice);
        uint256 parentB = _mintAgent(bob);
        _approve(parentA, alice);
        _approve(parentB, bob);

        uint256 aliceBefore = alice.balance;
        uint256 bobBefore   = bob.balance;

        // 3 wei: half=1, remainder=2 (or half=1, rest=2 depending on division)
        vm.prank(charlie);
        market.requestBreed{value: 3}(parentA, parentB, 0);

        uint256 aliceGot = alice.balance - aliceBefore;
        uint256 bobGot   = bob.balance   - bobBefore;
        assertEq(aliceGot + bobGot, 3, "Total must equal fee");
    }

    // -------------------------------------------------------------------------
    // fulfillBreed: offspring generation = max(parents)+1
    // -------------------------------------------------------------------------

    function test_OffspringGenerationIsMaxParentPlusOne() public {
        // Create gen-0 grandparents
        vm.startPrank(owner);
        uint256 gpA = nft.mint(alice, "cid_gpa", "m", 0, 0, bytes32(0)); // gen 0
        uint256 gpB = nft.mint(alice, "cid_gpb", "m", 0, 0, bytes32(0)); // gen 0
        // Create gen-1 parent
        uint256 pA  = nft.mint(alice, "cid_pa", "m", gpA, gpB, bytes32(0)); // gen 1
        uint256 pB  = nft.mint(bob,   "cid_pb", "m", 0, 0, bytes32(0));     // gen 0
        vm.stopPrank();

        assertEq(nft.generation(pA), 1);
        assertEq(nft.generation(pB), 0);

        _approve(pA, alice);
        _approve(pB, bob);

        vm.prank(charlie);
        uint256 reqId = market.requestBreed{value: 0}(pA, pB, 0);

        bytes32 sk  = keccak256("sealed");
        bytes memory sig = _operatorSign(reqId, "offspring_cid", sk);

        vm.prank(operator);
        uint256 offspringId = market.fulfillBreed(reqId, "offspring_cid", "off_meta", sk, sig);

        // Generation = max(1, 0) + 1 = 2
        assertEq(nft.generation(offspringId), 2);
    }

    function test_FulfillBreedsOnlyByOperator() public {
        uint256 parentA = _mintAgent(alice);
        uint256 parentB = _mintAgent(bob);
        _approve(parentA, alice);
        _approve(parentB, bob);

        vm.prank(charlie);
        uint256 reqId = market.requestBreed{value: 0}(parentA, parentB, 0);

        bytes32 sk = keccak256("sealed");
        bytes memory sig = _operatorSign(reqId, "offspring_cid", sk);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(BreedingMarket.OnlyBreedingOperator.selector, alice));
        market.fulfillBreed(reqId, "offspring_cid", "meta", sk, sig);
    }

    function test_CannotFulfillTwice() public {
        uint256 parentA = _mintAgent(alice);
        uint256 parentB = _mintAgent(bob);
        _approve(parentA, alice);
        _approve(parentB, bob);

        vm.prank(charlie);
        uint256 reqId = market.requestBreed{value: 0}(parentA, parentB, 0);

        bytes32 sk = keccak256("sealed");
        bytes memory sig = _operatorSign(reqId, "offspring_cid", sk);

        vm.prank(operator);
        market.fulfillBreed(reqId, "offspring_cid", "meta", sk, sig);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(BreedingMarket.RequestAlreadyFulfilled.selector, reqId));
        market.fulfillBreed(reqId, "offspring_cid", "meta", sk, sig);
    }

    // -------------------------------------------------------------------------
    // Royalty registered in vault
    // -------------------------------------------------------------------------

    function test_RoyaltyRegisteredInVault() public {
        uint256 parentA = _mintAgent(alice);
        uint256 parentB = _mintAgent(bob);
        _approve(parentA, alice);
        _approve(parentB, bob);

        vm.prank(charlie);
        uint256 reqId = market.requestBreed{value: 0}(parentA, parentB, 1000); // 10% royalty

        bytes32 sk  = keccak256("sealed");
        bytes memory sig = _operatorSign(reqId, "off_cid", sk);

        vm.prank(operator);
        uint256 offspringId = market.fulfillBreed(reqId, "off_cid", "meta", sk, sig);

        assertTrue(vault.hasSplit(offspringId));

        (address[] memory recipients, uint96[] memory bps) = vault.getSplit(offspringId);
        assertEq(recipients.length, 2);
        // Recipients are alice and bob
        bool hasAlice;
        bool hasBob;
        for (uint256 i; i < recipients.length; i++) {
            if (recipients[i] == alice) hasAlice = true;
            if (recipients[i] == bob)   hasBob   = true;
        }
        assertTrue(hasAlice);
        assertTrue(hasBob);

        // BPS must sum to royaltyBpsToParents (1000)
        uint96 totalBps;
        for (uint256 i; i < bps.length; i++) totalBps += bps[i];
        assertEq(totalBps, 1000);
    }

    function test_NoRoyaltyVaultEntryWhenBpsIsZero() public {
        uint256 parentA = _mintAgent(alice);
        uint256 parentB = _mintAgent(bob);
        _approve(parentA, alice);
        _approve(parentB, bob);

        vm.prank(charlie);
        uint256 reqId = market.requestBreed{value: 0}(parentA, parentB, 0);

        bytes32 sk  = keccak256("sk");
        bytes memory sig = _operatorSign(reqId, "cid", sk);

        vm.prank(operator);
        uint256 offspringId = market.fulfillBreed(reqId, "cid", "meta", sk, sig);

        // No royalty bps → vault entry should NOT be registered
        assertFalse(vault.hasSplit(offspringId));
    }
}
