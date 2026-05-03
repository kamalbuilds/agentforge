// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "forge-std/Test.sol";
import "../src/AgentINFT.sol";

contract AgentINFTTest is Test {
    AgentINFT internal nft;
    address   internal owner   = makeAddr("owner");
    address   internal minter  = makeAddr("minter");
    address   internal alice   = makeAddr("alice");
    address   internal bob     = makeAddr("bob");

    function setUp() public {
        vm.prank(owner);
        nft = new AgentINFT(owner);

        vm.prank(owner);
        nft.addMinter(minter);
    }

    // -------------------------------------------------------------------------
    // Minting
    // -------------------------------------------------------------------------

    function test_MintByMinter() public {
        vm.prank(minter);
        uint256 tokenId = nft.mint(alice, "Qm_weights", "Qm_meta", 0, 0, bytes32(0));
        assertEq(nft.ownerOf(tokenId), alice);
        assertEq(tokenId, 1); // IDs start at 1; 0 is reserved as "no parent" sentinel
    }

    function test_MintIncrementsTokenId() public {
        vm.startPrank(minter);
        uint256 id0 = nft.mint(alice, "cid0", "meta0", 0, 0, bytes32(0));
        uint256 id1 = nft.mint(alice, "cid1", "meta1", 0, 0, bytes32(0));
        vm.stopPrank();
        assertEq(id0, 1);
        assertEq(id1, 2);
    }

    function test_MintRevertsForNonMinter() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(AgentINFT.NotMinter.selector, alice));
        nft.mint(alice, "cid", "meta", 0, 0, bytes32(0));
    }

    function test_RemoveMinterRevokes() public {
        vm.prank(owner);
        nft.removeMinter(minter);

        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(AgentINFT.NotMinter.selector, minter));
        nft.mint(alice, "cid", "meta", 0, 0, bytes32(0));
    }

    // -------------------------------------------------------------------------
    // Lineage tracking
    // -------------------------------------------------------------------------

    function test_GenesisLineageIsEmpty() public {
        vm.prank(minter);
        uint256 id = nft.mint(alice, "cid", "meta", 0, 0, bytes32(0));
        uint256[] memory ancestors = nft.lineage(id);
        assertEq(ancestors.length, 0);
    }

    function test_LineageSingleGeneration() public {
        vm.startPrank(minter);
        uint256 a = nft.mint(alice, "cid_a", "meta_a", 0, 0, bytes32(0));
        uint256 b = nft.mint(alice, "cid_b", "meta_b", 0, 0, bytes32(0));
        uint256 child = nft.mint(alice, "cid_c", "meta_c", a, b, bytes32(0));
        vm.stopPrank();

        uint256[] memory ancestors = nft.lineage(child);
        assertEq(ancestors.length, 2);
        // Must contain a and b
        bool hasA;
        bool hasB;
        for (uint256 i; i < ancestors.length; i++) {
            if (ancestors[i] == a) hasA = true;
            if (ancestors[i] == b) hasB = true;
        }
        assertTrue(hasA);
        assertTrue(hasB);
    }

    function test_LineageMultiGeneration() public {
        vm.startPrank(minter);
        uint256 gen0A = nft.mint(alice, "c0a", "m0a", 0, 0, bytes32(0)); // 0
        uint256 gen0B = nft.mint(alice, "c0b", "m0b", 0, 0, bytes32(0)); // 1
        uint256 gen1  = nft.mint(alice, "c1",  "m1",  gen0A, gen0B, bytes32(0)); // 2, gen=1
        uint256 gen0C = nft.mint(alice, "c0c", "m0c", 0, 0, bytes32(0));         // 3
        uint256 gen2  = nft.mint(alice, "c2",  "m2",  gen1, gen0C, bytes32(0));  // 4, gen=2
        vm.stopPrank();

        assertEq(nft.generation(gen2), 2);

        uint256[] memory ancestors = nft.lineage(gen2);
        // Should contain gen1, gen0C, gen0A, gen0B (all ancestors within depth 8)
        assertGe(ancestors.length, 3);

        bool hasGen1;
        for (uint256 i; i < ancestors.length; i++) {
            if (ancestors[i] == gen1) hasGen1 = true;
        }
        assertTrue(hasGen1);
    }

    function test_GenerationIsMaxParentPlusOne() public {
        vm.startPrank(minter);
        uint256 a  = nft.mint(alice, "a", "m", 0, 0, bytes32(0));  // gen 0
        uint256 b  = nft.mint(alice, "b", "m", 0, 0, bytes32(0));  // gen 0
        uint256 c  = nft.mint(alice, "c", "m", a, b, bytes32(0));  // gen 1
        uint256 d  = nft.mint(alice, "d", "m", a, 0, bytes32(0));  // gen 1 (single parent)
        uint256 e  = nft.mint(alice, "e", "m", c, d, bytes32(0));  // gen 2
        vm.stopPrank();

        assertEq(nft.generation(a), 0);
        assertEq(nft.generation(b), 0);
        assertEq(nft.generation(c), 1);
        assertEq(nft.generation(d), 1);
        assertEq(nft.generation(e), 2);
    }

    // -------------------------------------------------------------------------
    // Transfer emits ReencryptionRequired
    // -------------------------------------------------------------------------

    function test_TransferEmitsReencryptionRequired() public {
        vm.prank(minter);
        uint256 id = nft.mint(alice, "cid", "meta", 0, 0, bytes32(0));

        vm.expectEmit(true, true, false, false);
        emit AgentINFT.ReencryptionRequired(id, bob);

        vm.prank(alice);
        nft.transferFrom(alice, bob, id);
    }

    function test_MintDoesNotEmitReencryption() public {
        // On mint (from=address(0)) the event should NOT be emitted
        vm.recordLogs();
        vm.prank(minter);
        nft.mint(alice, "cid", "meta", 0, 0, bytes32(0));

        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes32 sig = keccak256("ReencryptionRequired(uint256,address)");
        for (uint256 i; i < logs.length; i++) {
            assertNotEq(logs[i].topics[0], sig);
        }
    }

    // -------------------------------------------------------------------------
    // Clone
    // -------------------------------------------------------------------------

    function test_CloneCreatesNewToken() public {
        vm.prank(minter);
        uint256 id = nft.mint(alice, "cid_weights", "meta", 0, 0, bytes32(0));

        bytes32 newKey = keccak256("new_key");

        vm.expectEmit(true, true, true, false);
        emit AgentINFT.Cloned(id, 2, bob); // first mint = ID 1, clone = ID 2

        vm.prank(minter);
        uint256 cloneId = nft.clone(id, bob, newKey);

        assertEq(nft.ownerOf(cloneId), bob);

        AgentINFT.TokenData memory cloneData = nft.getTokenData(cloneId);
        AgentINFT.TokenData memory srcData   = nft.getTokenData(id);
        assertEq(cloneData.weightCID,   srcData.weightCID);
        assertEq(cloneData.sealedKeyHash, newKey);
        assertEq(cloneData.parentA, id);
    }

    function test_CloneRevertsOnNonExistentToken() public {
        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(AgentINFT.TokenDoesNotExist.selector, 999));
        nft.clone(999, alice, bytes32(0));
    }

    // -------------------------------------------------------------------------
    // authorizeUsage
    // -------------------------------------------------------------------------

    function test_AuthorizeUsage() public {
        vm.prank(minter);
        uint256 id = nft.mint(alice, "cid", "meta", 0, 0, bytes32(0));

        uint64 expiry = uint64(block.timestamp + 1 days);

        vm.expectEmit(true, true, false, true);
        emit AgentINFT.UsageAuthorized(id, bob, expiry);

        vm.prank(alice);
        nft.authorizeUsage(id, bob, expiry);

        assertTrue(nft.hasUsageRight(id, bob));
    }

    function test_UsageExpiredAfterTimestamp() public {
        vm.prank(minter);
        uint256 id = nft.mint(alice, "cid", "meta", 0, 0, bytes32(0));

        uint64 expiry = uint64(block.timestamp + 1 hours);
        vm.prank(alice);
        nft.authorizeUsage(id, bob, expiry);

        vm.warp(block.timestamp + 2 hours);
        assertFalse(nft.hasUsageRight(id, bob));
    }

    function test_AuthorizeUsageRevertsForNonOwner() public {
        vm.prank(minter);
        uint256 id = nft.mint(alice, "cid", "meta", 0, 0, bytes32(0));

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(AgentINFT.NotTokenOwner.selector, id, bob));
        nft.authorizeUsage(id, alice, uint64(block.timestamp + 1 days));
    }

    // -------------------------------------------------------------------------
    // setRoyalty
    // -------------------------------------------------------------------------

    function test_SetRoyalty() public {
        vm.prank(minter);
        uint256 id = nft.mint(alice, "cid", "meta", 0, 0, bytes32(0));

        vm.prank(alice);
        nft.setRoyalty(id, alice, 500); // 5%

        (address receiver, uint256 amount) = nft.royaltyInfo(id, 10_000);
        assertEq(receiver, alice);
        assertEq(amount, 500);
    }

    function test_SetRoyaltyRevertsForNonOwner() public {
        vm.prank(minter);
        uint256 id = nft.mint(alice, "cid", "meta", 0, 0, bytes32(0));

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(AgentINFT.NotTokenOwner.selector, id, bob));
        nft.setRoyalty(id, bob, 500);
    }

    function test_SetRoyaltyRevertsForInvalidBps() public {
        vm.prank(minter);
        uint256 id = nft.mint(alice, "cid", "meta", 0, 0, bytes32(0));

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(AgentINFT.InvalidRoyaltyBps.selector, uint96(10_001)));
        nft.setRoyalty(id, alice, 10_001);
    }

    // -------------------------------------------------------------------------
    // ERC-165
    // -------------------------------------------------------------------------

    function test_SupportsERC721() public view {
        assertTrue(nft.supportsInterface(0x80ac58cd)); // ERC721
    }

    function test_SupportsERC2981() public view {
        assertTrue(nft.supportsInterface(0x2a55205a)); // ERC2981
    }
}
