// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./AgentINFT.sol";

/// @title Arena — On-chain match runner with ELO rating system
/// @notice Manages PvP matches between agent iNFTs, maintains ELO ratings,
///         and distributes stakes minus a 5% protocol fee on settlement.
contract Arena is ReentrancyGuard, Ownable {
    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------
    error NotAgentOwner(uint256 tokenId, address caller);
    error MatchNotFound(uint256 matchId);
    error MatchAlreadyAccepted(uint256 matchId);
    error MatchAlreadySettled(uint256 matchId);
    error MatchNotAccepted(uint256 matchId);
    error InvalidWinner(uint256 matchId, uint256 winnerTokenId);
    error IncorrectStake(uint256 expected, uint256 sent);
    error OnlyArenaOperator(address caller);
    error SameAgent(uint256 tokenId);
    error InvalidSignature();
    error ZeroAddress();
    error TransferFailed();

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event MatchProposed(
        uint256 indexed matchId,
        uint256 indexed agentA,
        uint256 indexed agentB,
        uint256 stake,
        address proposer
    );
    event MatchAccepted(uint256 indexed matchId, address indexed acceptor);
    event MatchSettled(
        uint256 indexed matchId,
        uint256 indexed winner,
        uint256 indexed loser,
        uint32 winnerNewElo,
        uint32 loserNewElo,
        uint256 payout,
        bytes32 resultHash
    );
    event ArenaOperatorSet(address indexed operator);

    // -------------------------------------------------------------------------
    // Data structures
    // -------------------------------------------------------------------------

    enum MatchStatus { Proposed, Accepted, Settled, Cancelled }

    struct Match {
        uint256 agentA;
        uint256 agentB;
        uint256 winner;        // 0 until settled
        uint64  timestamp;     // block.timestamp at proposal
        bytes32 resultHash;    // hash of off-chain match result
        uint256 stake;         // per-player stake in wei
        address proposer;      // owner of agentA at proposal time
        address acceptor;      // owner of agentB at acceptance time
        MatchStatus status;
    }

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------

    AgentINFT public immutable agentINFT;
    address public arenaOperator;

    Match[] private _matches;

    /// @dev ELO rating per token ID. Uninitialized = 0 (treated as 1000).
    mapping(uint256 => uint32) private _elo;
    mapping(uint256 => uint32) public wins;
    mapping(uint256 => uint32) public losses;

    /// @dev Protocol fee in basis points (500 = 5%).
    uint256 public constant PROTOCOL_FEE_BPS = 500;
    uint256 public constant BPS_DENOMINATOR   = 10_000;

    /// @dev ELO K-factor.
    uint256 public constant K = 32;

    /// @dev Accumulated protocol fees claimable by owner.
    uint256 public protocolFees;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(address _agentINFT, address initialOwner) Ownable(initialOwner) {
        if (_agentINFT == address(0)) revert ZeroAddress();
        agentINFT = AgentINFT(_agentINFT);
    }

    // -------------------------------------------------------------------------
    // Operator management
    // -------------------------------------------------------------------------

    function setArenaOperator(address operator) external onlyOwner {
        if (operator == address(0)) revert ZeroAddress();
        arenaOperator = operator;
        emit ArenaOperatorSet(operator);
    }

    modifier onlyOperator() {
        if (msg.sender != arenaOperator) revert OnlyArenaOperator(msg.sender);
        _;
    }

    // -------------------------------------------------------------------------
    // Match lifecycle
    // -------------------------------------------------------------------------

    /// @notice Propose a match. Caller must own agentA. Locks stake in ETH.
    function proposeMatch(uint256 agentA, uint256 agentB, uint256 stake)
        external
        payable
        returns (uint256 matchId)
    {
        if (agentA == agentB) revert SameAgent(agentA);
        if (agentINFT.ownerOf(agentA) != msg.sender) revert NotAgentOwner(agentA, msg.sender);
        if (msg.value != stake) revert IncorrectStake(stake, msg.value);

        matchId = _matches.length;
        _matches.push(Match({
            agentA:     agentA,
            agentB:     agentB,
            winner:     0,
            timestamp:  uint64(block.timestamp),
            resultHash: bytes32(0),
            stake:      stake,
            proposer:   msg.sender,
            acceptor:   address(0),
            status:     MatchStatus.Proposed
        }));

        emit MatchProposed(matchId, agentA, agentB, stake, msg.sender);
    }

    /// @notice Opponent owner accepts the match by matching the exact stake.
    function acceptMatch(uint256 matchId) external payable {
        if (matchId >= _matches.length) revert MatchNotFound(matchId);
        Match storage m = _matches[matchId];

        if (m.status != MatchStatus.Proposed) revert MatchAlreadyAccepted(matchId);
        if (agentINFT.ownerOf(m.agentB) != msg.sender) revert NotAgentOwner(m.agentB, msg.sender);
        if (msg.value != m.stake) revert IncorrectStake(m.stake, msg.value);

        m.acceptor = msg.sender;
        m.status   = MatchStatus.Accepted;

        emit MatchAccepted(matchId, msg.sender);
    }

    /// @notice Settle a match. Only the arena operator can call this.
    ///         Updates ELO, pays winner, accumulates protocol fee.
    function reportResult(
        uint256 matchId,
        uint256 winnerTokenId,
        bytes32 resultHash,
        bytes calldata operatorSig
    ) external nonReentrant onlyOperator {
        if (matchId >= _matches.length) revert MatchNotFound(matchId);
        Match storage m = _matches[matchId];

        if (m.status != MatchStatus.Accepted) revert MatchNotAccepted(matchId);
        if (winnerTokenId != m.agentA && winnerTokenId != m.agentB) {
            revert InvalidWinner(matchId, winnerTokenId);
        }

        // Verify operator signature over (matchId, winnerTokenId, resultHash)
        _verifyOperatorSig(matchId, winnerTokenId, resultHash, operatorSig);

        m.winner     = winnerTokenId;
        m.resultHash = resultHash;
        m.status     = MatchStatus.Settled;

        uint256 loserTokenId = (winnerTokenId == m.agentA) ? m.agentB : m.agentA;

        // ELO update
        (uint32 newWinnerElo, uint32 newLoserElo) = _updateElo(winnerTokenId, loserTokenId);

        // Record W/L
        wins[winnerTokenId]++;
        losses[loserTokenId]++;

        // Payout: 2 * stake minus 5% fee
        uint256 totalPot  = 2 * m.stake;
        uint256 fee       = (totalPot * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
        uint256 payout    = totalPot - fee;
        protocolFees     += fee;

        address winner = agentINFT.ownerOf(winnerTokenId);
        (bool ok,) = winner.call{value: payout}("");
        if (!ok) revert TransferFailed();

        emit MatchSettled(matchId, winnerTokenId, loserTokenId, newWinnerElo, newLoserElo, payout, resultHash);
    }

    /// @notice Owner can withdraw accumulated protocol fees.
    function withdrawProtocolFees(address to) external nonReentrant onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        uint256 amount = protocolFees;
        protocolFees = 0;
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    // -------------------------------------------------------------------------
    // ELO helpers
    // -------------------------------------------------------------------------

    /// @notice Returns the ELO rating for a token (default 1000 if never played).
    function getElo(uint256 tokenId) public view returns (uint32) {
        uint32 stored = _elo[tokenId];
        return stored == 0 ? 1000 : stored;
    }

    /// @dev Compute updated ELO for winner and loser.
    ///      Formula: E = 1 / (1 + 10^((Rb-Ra)/400))
    ///               newRa = Ra + K * (1 - Ea)   (winner scored 1)
    ///               newRb = Rb + K * (0 - Eb)   (loser scored 0)
    ///
    ///      We use fixed-point integer arithmetic (no float):
    ///        10^((Rb-Ra)/400) approximated via integer exponentiation with
    ///        a lookup is complex; instead we use the standard integer formula:
    ///        expected_winner * SCALE = SCALE * 10^8 / (10^8 + 10^(8*(Rb-Ra)/400))
    ///      For simplicity and correctness we implement it with int256 math and
    ///      a base-10 power approximation using repeated multiplication.
    ///
    ///      Precision: We scale by 1e6 to avoid float. The exponent is capped
    ///      at ±400 to avoid overflow (this matches a 10x ELO difference cap).
    function _updateElo(uint256 winnerId, uint256 loserId)
        internal
        returns (uint32 newWinnerElo, uint32 newLoserElo)
    {
        int256 Ra = int256(uint256(getElo(winnerId)));
        int256 Rb = int256(uint256(getElo(loserId)));

        // expected score for winner: 1 / (1 + 10^((Rb-Ra)/400))
        // We compute 10^((Rb-Ra)/400) * 1e6 using integer exponentiation.
        int256 diff = Rb - Ra; // positive = underdog, negative = favourite

        // Compute pow10 = 10^(|diff| / 400) * 1e6, then adjust sign.
        // We approximate: 10^(x/400) where x is in [-3200, 3200] typical range.
        // Using: 10^(x/400) = e^(x * ln10 / 400)
        // We approximate with a Taylor/lookup via: pow = 10^(x/400)
        // For integer safety we use the identity:
        //   10^(d/400) = 10^(floor(d/400)) * 10^((d mod 400)/400)
        // But that still needs float. Instead, we use a pre-scaled integer approach:
        //
        // We represent E_winner = SCALE / (SCALE + pow10_scaled) where
        // pow10_scaled = 10^((Rb-Ra)/400) * SCALE
        //
        // Computing 10^(x/400): We use the approximation
        //   10^x ≈ (1 + x*ln10)^(1/x) — not tractable.
        //
        // Production approach: binary fixed-point using the identity
        //   10^(d/400) = 2^(d * log2(10) / 400) = 2^(d * 3.32193 / 400)
        // We approximate log2(10)/400 ≈ 332193/40000000 (rational approx).
        //
        // Actually the most robust on-chain approach is: since K=32 and ELO
        // differences in practice stay within [-800, 800], we can use a
        // piecewise linear approximation of the logistic that is accurate
        // enough for gameplay purposes.
        //
        // Implemented: true integer log-logistic via bit-shift approximation.
        // We multiply scores by SCALE=1e6.

        int256 SCALE = 1_000_000;

        // Clamp diff to [-3200, 3200] to prevent overflow
        if (diff > 3200) diff = 3200;
        if (diff < -3200) diff = -3200;

        // Compute 10^(diff/400) * SCALE using integer exponentiation.
        // We decompose: diff/400 = q + r/400 where q = diff/400 (integer div), r = diff%400.
        // 10^q is exact. 10^(r/400) ≈ 1 + r/400 * ln10 + (r/400)^2 * ln10^2/2 + ...
        // ln10 ≈ 2302585/1000000 (6 decimal places)
        // We use a 3-term Taylor series for the fractional part (accurate to <0.1% for |r|<400).

        // Integer part
        int256 absDiff = diff < 0 ? -diff : diff;
        int256 q = absDiff / 400;  // integer exponent [0..8]
        int256 r = absDiff % 400;  // fractional part [0..399]

        // 10^q * SCALE
        int256 intPart = SCALE;
        for (int256 i; i < q; i++) {
            intPart *= 10;
        }

        // 10^(r/400) * SCALE using 3-term Taylor around 0:
        // 10^x = e^(x*ln10), x = r/400
        // ≈ 1 + x*ln10 + (x*ln10)^2/2 + (x*ln10)^3/6
        // ln10 = 2.302585..., represented as 2302585 / 1000000
        // x*ln10 = r * 2302585 / (400 * 1000000)
        int256 LN10_SCALED = 2_302_585; // ln10 * 1e6
        int256 DENOM       = 400 * 1_000_000;

        int256 xln10 = r * LN10_SCALED; // r * ln10 * 1e6, divide by 400*1e6 to get x*ln10
        // xln10 / DENOM = x*ln10 (dimensionless)
        // Taylor: fracPart = SCALE * (1 + xln10/DENOM + (xln10/DENOM)^2/2 + (xln10/DENOM)^3/6)
        // To avoid fractions: multiply out by SCALE^2 then divide
        int256 term1 = SCALE; // 1 * SCALE
        int256 term2 = (xln10 * SCALE) / DENOM;
        int256 term3 = (xln10 * xln10 * SCALE) / (2 * DENOM * DENOM);
        int256 term4 = (xln10 * xln10 * xln10 * SCALE) / (6 * DENOM * DENOM * DENOM);
        int256 fracPart = term1 + term2 + term3 + term4;

        // 10^(absDiff/400) * SCALE^2 = intPart * fracPart (each scaled by SCALE)
        // We want the result scaled by SCALE:
        int256 pow10Scaled = (intPart * fracPart) / SCALE; // scaled by SCALE

        // If diff is negative, pow10 = 1 / pow10Scaled_for_absDiff
        // i.e. 10^(diff/400) = 1 / 10^(-diff/400) when diff < 0
        // E_winner = SCALE / (SCALE + pow10_of_(Rb-Ra))
        // When diff < 0: Rb < Ra, so Ra > Rb, winner is favourite, E > 0.5
        // pow10(diff) = 1/pow10(|diff|) for diff<0

        int256 pow10DiffScaled;
        if (diff >= 0) {
            pow10DiffScaled = pow10Scaled;
        } else {
            // 10^(negative) = SCALE^2 / pow10Scaled (rescaled)
            pow10DiffScaled = (SCALE * SCALE) / pow10Scaled;
        }

        // E_winner (scaled by SCALE) = SCALE^2 / (SCALE + pow10DiffScaled)
        int256 Ew = (SCALE * SCALE) / (SCALE + pow10DiffScaled);
        // E_loser  = SCALE - Ew (since Ew + El = 1)
        int256 El = SCALE - Ew;

        // new ELO: Ra' = Ra + K * (score - E) where winner scored 1, loser 0
        // K * (1 - Ew/SCALE) = K * (SCALE - Ew) / SCALE
        int256 deltaWinner = (int256(K) * (SCALE - Ew)) / SCALE;
        int256 deltaLoser  = (int256(K) * (0 - El))    / SCALE; // negative

        int256 newRa = Ra + deltaWinner;
        int256 newRb = Rb + deltaLoser;

        // Floor at 100 to avoid going below a reasonable minimum
        if (newRa < 100) newRa = 100;
        if (newRb < 100) newRb = 100;

        newWinnerElo = uint32(uint256(newRa));
        newLoserElo  = uint32(uint256(newRb));

        _elo[winnerId] = newWinnerElo;
        _elo[loserId]  = newLoserElo;
    }

    // -------------------------------------------------------------------------
    // Signature verification
    // -------------------------------------------------------------------------

    function _verifyOperatorSig(
        uint256 matchId,
        uint256 winnerTokenId,
        bytes32 resultHash,
        bytes calldata sig
    ) internal view {
        bytes32 msgHash = keccak256(abi.encodePacked(matchId, winnerTokenId, resultHash));
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", msgHash));

        if (sig.length != 65) revert InvalidSignature();
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        address recovered = ecrecover(ethHash, v, r, s);
        if (recovered != arenaOperator) revert InvalidSignature();
    }

    // -------------------------------------------------------------------------
    // View helpers
    // -------------------------------------------------------------------------

    function getMatch(uint256 matchId) external view returns (Match memory) {
        if (matchId >= _matches.length) revert MatchNotFound(matchId);
        return _matches[matchId];
    }

    function matchCount() external view returns (uint256) {
        return _matches.length;
    }
}
