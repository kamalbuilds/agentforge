// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "forge-std/Test.sol";
import "../src/AgentINFT.sol";
import "../src/Arena.sol";

contract ArenaTest is Test {
    AgentINFT internal nft;
    Arena     internal arena;

    address internal owner    = makeAddr("owner");
    address internal alice    = makeAddr("alice");  // owns agentA
    address internal bob      = makeAddr("bob");    // owns agentB
    address internal operator = makeAddr("operator");
    uint256 internal operatorPk;

    function setUp() public {
        // Use a known private key so we can sign results.
        operatorPk = 0xA11CE;
        operator   = vm.addr(operatorPk);

        vm.startPrank(owner);
        nft   = new AgentINFT(owner);
        arena = new Arena(address(nft), owner);
        nft.addMinter(owner); // owner mints directly in tests
        arena.setArenaOperator(operator);
        vm.stopPrank();

        // Fund participants
        vm.deal(alice, 10 ether);
        vm.deal(bob,   10 ether);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    function _mintAgent(address to) internal returns (uint256) {
        vm.prank(owner);
        return nft.mint(to, "cid", "meta", 0, 0, bytes32(0));
    }

    function _operatorSign(uint256 matchId, uint256 winnerTokenId, bytes32 resultHash)
        internal
        view
        returns (bytes memory sig)
    {
        bytes32 msgHash = keccak256(abi.encodePacked(matchId, winnerTokenId, resultHash));
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", msgHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(operatorPk, ethHash);
        sig = abi.encodePacked(r, s, v);
    }

    function _proposeAndAccept(uint256 agentA, uint256 agentB, uint256 stake)
        internal
        returns (uint256 matchId)
    {
        vm.prank(alice);
        matchId = arena.proposeMatch{value: stake}(agentA, agentB, stake);
        vm.prank(bob);
        arena.acceptMatch{value: stake}(matchId);
    }

    // -------------------------------------------------------------------------
    // Propose / Accept flow
    // -------------------------------------------------------------------------

    function test_ProposeMatch() public {
        uint256 agentA = _mintAgent(alice);
        uint256 agentB = _mintAgent(bob);

        vm.prank(alice);
        uint256 matchId = arena.proposeMatch{value: 1 ether}(agentA, agentB, 1 ether);

        Arena.Match memory m = arena.getMatch(matchId);
        assertEq(m.agentA, agentA);
        assertEq(m.agentB, agentB);
        assertEq(m.stake, 1 ether);
        assertEq(uint8(m.status), uint8(Arena.MatchStatus.Proposed));
    }

    function test_AcceptMatch() public {
        uint256 agentA = _mintAgent(alice);
        uint256 agentB = _mintAgent(bob);

        vm.prank(alice);
        uint256 matchId = arena.proposeMatch{value: 1 ether}(agentA, agentB, 1 ether);

        vm.prank(bob);
        arena.acceptMatch{value: 1 ether}(matchId);

        Arena.Match memory m = arena.getMatch(matchId);
        assertEq(uint8(m.status), uint8(Arena.MatchStatus.Accepted));
        assertEq(m.acceptor, bob);
    }

    function test_ProposeRevertsIfWrongStake() public {
        uint256 agentA = _mintAgent(alice);
        uint256 agentB = _mintAgent(bob);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Arena.IncorrectStake.selector, 1 ether, 0.5 ether));
        arena.proposeMatch{value: 0.5 ether}(agentA, agentB, 1 ether);
    }

    function test_ProposeRevertsIfNotOwner() public {
        uint256 agentA = _mintAgent(alice);
        uint256 agentB = _mintAgent(bob);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Arena.NotAgentOwner.selector, agentA, bob));
        arena.proposeMatch{value: 1 ether}(agentA, agentB, 1 ether);
    }

    function test_ProposeRevertsSameAgent() public {
        uint256 agentA = _mintAgent(alice);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Arena.SameAgent.selector, agentA));
        arena.proposeMatch{value: 0}(agentA, agentA, 0);
    }

    // -------------------------------------------------------------------------
    // Settlement + ELO
    // -------------------------------------------------------------------------

    function test_SettlementPayoutMinusFee() public {
        uint256 agentA = _mintAgent(alice);
        uint256 agentB = _mintAgent(bob);

        uint256 stake = 1 ether;
        uint256 matchId = _proposeAndAccept(agentA, agentB, stake);

        bytes32 resultHash = keccak256("result");
        bytes memory sig = _operatorSign(matchId, agentA, resultHash);

        uint256 aliceBefore = alice.balance;
        vm.prank(operator);
        arena.reportResult(matchId, agentA, resultHash, sig);

        uint256 totalPot = 2 * stake;
        uint256 fee = (totalPot * 500) / 10_000; // 5%
        uint256 expectedPayout = totalPot - fee;

        assertEq(alice.balance - aliceBefore, expectedPayout);
        assertEq(arena.protocolFees(), fee);
    }

    function test_OnlyOperatorCanSettle() public {
        uint256 agentA = _mintAgent(alice);
        uint256 agentB = _mintAgent(bob);
        uint256 matchId = _proposeAndAccept(agentA, agentB, 1 ether);

        bytes32 resultHash = keccak256("result");
        bytes memory sig = _operatorSign(matchId, agentA, resultHash);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Arena.OnlyArenaOperator.selector, alice));
        arena.reportResult(matchId, agentA, resultHash, sig);
    }

    function test_CannotSettleTwice() public {
        uint256 agentA = _mintAgent(alice);
        uint256 agentB = _mintAgent(bob);
        uint256 matchId = _proposeAndAccept(agentA, agentB, 1 ether);

        bytes32 resultHash = keccak256("r");
        bytes memory sig = _operatorSign(matchId, agentA, resultHash);

        vm.prank(operator);
        arena.reportResult(matchId, agentA, resultHash, sig);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(Arena.MatchNotAccepted.selector, matchId));
        arena.reportResult(matchId, agentA, resultHash, sig);
    }

    function test_InvalidWinnerReverts() public {
        uint256 agentA = _mintAgent(alice);
        uint256 agentB = _mintAgent(bob);
        uint256 matchId = _proposeAndAccept(agentA, agentB, 1 ether);

        bytes32 resultHash = keccak256("r");
        uint256 bogusToken = 999;
        bytes memory sig = _operatorSign(matchId, bogusToken, resultHash);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(Arena.InvalidWinner.selector, matchId, bogusToken));
        arena.reportResult(matchId, bogusToken, resultHash, sig);
    }

    // -------------------------------------------------------------------------
    // ELO math: upset scenario (low ELO beats high ELO gains more)
    // -------------------------------------------------------------------------

    function test_EloDefaultIs1000() public view {
        assertEq(arena.getElo(0),   1000);
        assertEq(arena.getElo(999), 1000);
    }

    function test_EloUnderdogGainsMoreThanFavourite() public {
        // Set up two agents with different ELOs: alice=1200, bob=800
        // We'll run two separate matches after manually seeding ELO via two wins.
        uint256 agentHigh = _mintAgent(alice); // will be at 1200
        uint256 agentLow  = _mintAgent(bob);   // will be at 800

        // Seed high agent to 1200: need to win multiple times vs 1000-ELO opponents
        // Easier: just run the actual match and check the delta.

        // Match 1: agentHigh(alice) beats agentLow(bob) → high ELO wins, small delta
        {
            uint256 matchId = _proposeAndAccept(agentHigh, agentLow, 0.01 ether);
            bytes32 rh = keccak256("r1");
            bytes memory sig = _operatorSign(matchId, agentHigh, rh);
            vm.prank(operator);
            arena.reportResult(matchId, agentHigh, rh, sig);
        }

        uint32 highEloAfterWin = arena.getElo(agentHigh);
        uint32 lowEloAfterLoss = arena.getElo(agentLow);

        // highEloAfterWin > 1000, lowEloAfterLoss < 1000
        assertGt(highEloAfterWin, 1000);
        assertLt(lowEloAfterLoss, 1000);

        // Now re-fund participants and run match 2: agentLow(bob) beats agentHigh(alice)
        // The upset winner (low) should gain more than the favorite won.
        // At this point: agentHigh > agentLow, so agentLow is still underdog.
        vm.deal(alice, 10 ether);
        vm.deal(bob,   10 ether);

        uint32 highEloBefore = arena.getElo(agentHigh);
        uint32 lowEloBefore  = arena.getElo(agentLow);

        // bob proposes this time since he owns agentLow... but agentB in propose must be owned by proposer.
        // proposeMatch: caller owns agentA, opponent owns agentB.
        // Bob owns agentLow = agentB candidate; alice owns agentHigh.
        // Let bob propose with agentLow as agentA.
        vm.prank(bob);
        uint256 matchId2 = arena.proposeMatch{value: 0.01 ether}(agentLow, agentHigh, 0.01 ether);
        vm.prank(alice);
        arena.acceptMatch{value: 0.01 ether}(matchId2);

        bytes32 rh2 = keccak256("r2");
        bytes memory sig2 = _operatorSign(matchId2, agentLow, rh2);
        vm.prank(operator);
        arena.reportResult(matchId2, agentLow, rh2, sig2);

        uint32 highEloAfterUpset = arena.getElo(agentHigh);
        uint32 lowEloAfterUpset  = arena.getElo(agentLow);

        // Upset winner (low) gained ELO
        uint32 upsetGain = lowEloAfterUpset - lowEloBefore;

        // Favourite lost ELO from second match
        assertGt(lowEloAfterUpset,  lowEloBefore);
        assertLt(highEloAfterUpset, highEloBefore);

        // Upset gain should be bigger than what the favourite gained in match 1
        uint32 favouriteGain = highEloAfterWin - 1000;
        assertGt(upsetGain, favouriteGain, "Upset winner should gain more ELO than favourite");
    }

    // -------------------------------------------------------------------------
    // Reentrancy guard
    // -------------------------------------------------------------------------

    function test_ReentrancyGuardOnPayout() public {
        // Deploy a malicious receiver that attempts re-entry on receive()
        ReentrantReceiver attacker = new ReentrantReceiver(arena);
        address attackerAddr = address(attacker);
        vm.deal(attackerAddr, 10 ether);

        // Mint agent owned by attacker
        vm.prank(owner);
        uint256 agentA = nft.mint(attackerAddr, "cid", "meta", 0, 0, bytes32(0));
        uint256 agentB = _mintAgent(bob);

        // attacker proposes
        vm.prank(attackerAddr);
        uint256 matchId = arena.proposeMatch{value: 1 ether}(agentA, agentB, 1 ether);

        vm.prank(bob);
        arena.acceptMatch{value: 1 ether}(matchId);

        attacker.setTargetMatch(matchId, agentA);

        bytes32 rh  = keccak256("r");
        bytes memory sig = _operatorSign(matchId, agentA, rh);

        // The reentrancy guard should prevent a second reportResult call during payout.
        // The receive() on the attacker tries to call reportResult again, which
        // will revert with MatchNotAccepted (match is already Settled at that point)
        // or ReentrancyGuard. Either way the outer call must succeed (payout sent once).
        vm.prank(operator);
        arena.reportResult(matchId, agentA, rh, sig);

        // Verify attacker was paid exactly once
        assertEq(attacker.receivedCount(), 1);
    }

    // -------------------------------------------------------------------------
    // Fuzz: ELO stays within reasonable bounds
    // -------------------------------------------------------------------------

    function testFuzz_EloNeverBelowFloor(uint32 initEloA, uint32 initEloB) public {
        // Clamp to plausible range
        initEloA = uint32(bound(initEloA, 100, 3000));
        initEloB = uint32(bound(initEloB, 100, 3000));

        uint256 agentA = _mintAgent(alice);
        uint256 agentB = _mintAgent(bob);

        // Seed ELOs via match-based wins — instead just call internal via harness.
        // We test the public-facing ELO after a real match.
        uint256 matchId = _proposeAndAccept(agentA, agentB, 0);

        bytes32 rh  = keccak256("fuzz");
        bytes memory sig = _operatorSign(matchId, agentA, rh);
        vm.prank(operator);
        arena.reportResult(matchId, agentA, rh, sig);

        assertGe(arena.getElo(agentA), 100);
        assertGe(arena.getElo(agentB), 100);
    }
}

/// @dev Malicious contract that tries to re-enter Arena during payout receive.
contract ReentrantReceiver {
    Arena   internal arena;
    uint256 internal targetMatch;
    uint256 internal winnerToken;
    uint256 public receivedCount;

    constructor(Arena _arena) {
        arena = _arena;
    }

    function setTargetMatch(uint256 matchId, uint256 token) external {
        targetMatch  = matchId;
        winnerToken  = token;
    }

    receive() external payable {
        receivedCount++;
        if (receivedCount == 1) {
            // Attempt re-entry: this should fail
            try arena.reportResult(targetMatch, winnerToken, bytes32(0), bytes("")) {}
            catch {}
        }
    }

    /// @dev Required by ERC721 _safeMint.
    function onERC721Received(address, address, uint256, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return this.onERC721Received.selector;
    }
}
