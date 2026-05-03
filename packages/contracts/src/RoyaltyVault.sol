// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";

/// @title RoyaltyVault — Pull-payment royalty distributor for breeding offspring
/// @notice Tracks per-recipient share allocations keyed by offspring token ID.
///         Anyone (e.g., a marketplace forwarding ERC-2981 royalties) can deposit
///         ETH for a given offspring. Recipients pull their share on-demand.
contract RoyaltyVault is Ownable {
    using Address for address payable;

    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------
    error OnlyBreedingMarket(address caller);
    error SplitAlreadyRegistered(uint256 offspringTokenId);
    error ArrayLengthMismatch();
    error BpsExceeds10000(uint96 total);
    error ZeroAddress();
    error NothingToClaim(address recipient);
    error NoSplitRegistered(uint256 offspringTokenId);
    error EmptyRecipients();

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event SplitRegistered(uint256 indexed offspringTokenId, address[] recipients, uint96[] bps);
    event Deposited(uint256 indexed offspringTokenId, uint256 amount);
    event Claimed(address indexed recipient, uint256 amount);
    event BreedingMarketSet(address indexed breedingMarket);

    // -------------------------------------------------------------------------
    // Data structures
    // -------------------------------------------------------------------------

    struct Split {
        address[] recipients;
        uint96[]  bps;         // basis points; must sum to ≤ 10_000
        bool      registered;
    }

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------

    address public breedingMarket;

    /// @dev Split configuration per offspring token ID.
    mapping(uint256 => Split) private _splits;

    /// @dev Accumulated claimable balance per recipient address.
    mapping(address => uint256) private _pending;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(address initialOwner) Ownable(initialOwner) {}

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    function setBreedingMarket(address market) external onlyOwner {
        if (market == address(0)) revert ZeroAddress();
        breedingMarket = market;
        emit BreedingMarketSet(market);
    }

    modifier onlyBreedingMarket() {
        if (msg.sender != breedingMarket) revert OnlyBreedingMarket(msg.sender);
        _;
    }

    // -------------------------------------------------------------------------
    // Split registration
    // -------------------------------------------------------------------------

    /// @notice Register the royalty split for an offspring token.
    ///         Only callable by the BreedingMarket contract.
    function registerSplit(
        uint256 offspringTokenId,
        address[] calldata recipients,
        uint96[] calldata bps
    ) external onlyBreedingMarket {
        if (_splits[offspringTokenId].registered) revert SplitAlreadyRegistered(offspringTokenId);
        if (recipients.length == 0) revert EmptyRecipients();
        if (recipients.length != bps.length) revert ArrayLengthMismatch();

        uint96 totalBps;
        for (uint256 i; i < bps.length; i++) {
            if (recipients[i] == address(0)) revert ZeroAddress();
            totalBps += bps[i];
        }
        if (totalBps > 10_000) revert BpsExceeds10000(totalBps);

        _splits[offspringTokenId] = Split({
            recipients: recipients,
            bps:        bps,
            registered: true
        });

        emit SplitRegistered(offspringTokenId, recipients, bps);
    }

    // -------------------------------------------------------------------------
    // Deposit
    // -------------------------------------------------------------------------

    /// @notice Deposit ETH for distribution to split recipients of a given offspring.
    ///         The deposited amount is immediately allocated to each recipient's
    ///         pending balance according to their bps share.
    function deposit(uint256 offspringTokenId) external payable {
        if (!_splits[offspringTokenId].registered) revert NoSplitRegistered(offspringTokenId);
        if (msg.value == 0) return;

        Split storage split = _splits[offspringTokenId];
        uint256 amount      = msg.value;
        uint256 allocated;

        for (uint256 i; i < split.recipients.length; i++) {
            uint256 share;
            if (i == split.recipients.length - 1) {
                // Last recipient gets the remainder to avoid dust from rounding.
                share = amount - allocated;
            } else {
                share = (amount * split.bps[i]) / 10_000;
            }
            _pending[split.recipients[i]] += share;
            allocated += share;
        }

        emit Deposited(offspringTokenId, amount);
    }

    // -------------------------------------------------------------------------
    // Claim (pull pattern)
    // -------------------------------------------------------------------------

    /// @notice Pull accumulated royalties for `recipient`.
    function claim(address recipient) external {
        if (recipient == address(0)) revert ZeroAddress();
        uint256 amount = _pending[recipient];
        if (amount == 0) revert NothingToClaim(recipient);

        _pending[recipient] = 0;
        payable(recipient).sendValue(amount);

        emit Claimed(recipient, amount);
    }

    // -------------------------------------------------------------------------
    // View helpers
    // -------------------------------------------------------------------------

    /// @notice Returns the pending (unclaimed) balance for a recipient.
    function pending(address recipient) external view returns (uint256) {
        return _pending[recipient];
    }

    /// @notice Returns split configuration for an offspring token.
    function getSplit(uint256 offspringTokenId)
        external
        view
        returns (address[] memory recipients, uint96[] memory bps)
    {
        Split storage s = _splits[offspringTokenId];
        return (s.recipients, s.bps);
    }

    /// @notice Returns true if a split has been registered for this offspring.
    function hasSplit(uint256 offspringTokenId) external view returns (bool) {
        return _splits[offspringTokenId].registered;
    }
}
