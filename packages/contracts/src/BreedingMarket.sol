// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./AgentINFT.sol";
import "./RoyaltyVault.sol";

/// @title BreedingMarket — Mint offspring iNFTs from two approved parent agents
/// @notice Manages breeding requests, fee distribution to parent owners, and
///         delegates the actual fine-tune merge operation to an off-chain
///         breedingOperator (0G Compute agent). Offspring metadata is provided
///         by the operator upon fulfillment.
contract BreedingMarket is Ownable {
    using Address for address payable;

    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------
    error ParentNotApproved(uint256 tokenId);
    error NotParentOwner(uint256 tokenId, address caller);
    error OnlyBreedingOperator(address caller);
    error RequestNotFound(uint256 reqId);
    error RequestAlreadyFulfilled(uint256 reqId);
    error SameParent(uint256 tokenId);
    error InvalidRoyaltyBps(uint96 bps);
    error ZeroAddress();
    error TransferFailed();
    error InvalidSignature();

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event BreedRequested(
        uint256 indexed reqId,
        uint256 indexed parentA,
        uint256 indexed parentB,
        address requester,
        uint256 fee,
        uint96 royaltyBpsToParents
    );
    event BreedFulfilled(
        uint256 indexed reqId,
        uint256 indexed offspringTokenId,
        uint16 generation
    );
    event BreedingApprovalSet(uint256 indexed tokenId, address indexed owner, bool approved);
    event BreedingOperatorSet(address indexed operator);

    // -------------------------------------------------------------------------
    // Data structures
    // -------------------------------------------------------------------------

    struct BreedRequest {
        uint256 parentA;
        uint256 parentB;
        address requester;
        uint256 fee;
        uint96  royaltyBpsToParents; // combined royalty bps split 50/50 between parent owners
        uint64  createdAt;
        bool    fulfilled;
    }

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------

    AgentINFT public immutable agentINFT;
    RoyaltyVault public immutable royaltyVault;
    address public breedingOperator;

    BreedRequest[] private _requests;

    /// @dev Per-token breeding approval set by the token owner.
    mapping(uint256 => bool) private _breedingApproval;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(
        address _agentINFT,
        address _royaltyVault,
        address initialOwner
    ) Ownable(initialOwner) {
        if (_agentINFT == address(0)) revert ZeroAddress();
        if (_royaltyVault == address(0)) revert ZeroAddress();
        agentINFT    = AgentINFT(_agentINFT);
        royaltyVault = RoyaltyVault(_royaltyVault);
    }

    // -------------------------------------------------------------------------
    // Operator management
    // -------------------------------------------------------------------------

    function setBreedingOperator(address operator) external onlyOwner {
        if (operator == address(0)) revert ZeroAddress();
        breedingOperator = operator;
        emit BreedingOperatorSet(operator);
    }

    modifier onlyOperator() {
        if (msg.sender != breedingOperator) revert OnlyBreedingOperator(msg.sender);
        _;
    }

    // -------------------------------------------------------------------------
    // Breeding approval
    // -------------------------------------------------------------------------

    /// @notice Token owner opts their agent into breeding.
    function setBreedingApproval(uint256 tokenId, bool approved) external {
        if (agentINFT.ownerOf(tokenId) != msg.sender) revert NotParentOwner(tokenId, msg.sender);
        _breedingApproval[tokenId] = approved;
        emit BreedingApprovalSet(tokenId, msg.sender, approved);
    }

    function isBreedingApproved(uint256 tokenId) external view returns (bool) {
        return _breedingApproval[tokenId];
    }

    // -------------------------------------------------------------------------
    // Breed request
    // -------------------------------------------------------------------------

    /// @notice Request a breeding between two approved parents.
    ///         msg.value = breeding fee. Immediately split 50/50 to parent owners.
    ///         royaltyBpsToParents: total ERC-2981 royalty bps applied to future trades;
    ///         split 50/50 to parentA owner and parentB owner via RoyaltyVault.
    function requestBreed(
        uint256 parentA,
        uint256 parentB,
        uint96 royaltyBpsToParents
    ) external payable returns (uint256 reqId) {
        if (parentA == parentB) revert SameParent(parentA);
        if (royaltyBpsToParents > 10_000) revert InvalidRoyaltyBps(royaltyBpsToParents);

        // Both parents must be approved for breeding
        if (!_breedingApproval[parentA]) revert ParentNotApproved(parentA);
        if (!_breedingApproval[parentB]) revert ParentNotApproved(parentB);

        reqId = _requests.length;
        _requests.push(BreedRequest({
            parentA:             parentA,
            parentB:             parentB,
            requester:           msg.sender,
            fee:                 msg.value,
            royaltyBpsToParents: royaltyBpsToParents,
            createdAt:           uint64(block.timestamp),
            fulfilled:           false
        }));

        // Immediately distribute fee: 50% to parentA owner, 50% to parentB owner.
        if (msg.value > 0) {
            address ownerA = agentINFT.ownerOf(parentA);
            address ownerB = agentINFT.ownerOf(parentB);

            uint256 halfFee   = msg.value / 2;
            uint256 remainder = msg.value - halfFee; // handles odd-wei rounding

            payable(ownerA).sendValue(halfFee);
            payable(ownerB).sendValue(remainder);
        }

        emit BreedRequested(reqId, parentA, parentB, msg.sender, msg.value, royaltyBpsToParents);
    }

    // -------------------------------------------------------------------------
    // Breed fulfillment
    // -------------------------------------------------------------------------

    /// @notice Fulfill a pending breed request. Only callable by the breedingOperator.
    ///         Mints the offspring iNFT and registers the royalty split in RoyaltyVault.
    function fulfillBreed(
        uint256 reqId,
        string calldata offspringWeightCID,
        string calldata metadataCID,
        bytes32 sealedKeyHash,
        bytes calldata operatorSig
    ) external onlyOperator returns (uint256 newTokenId) {
        if (reqId >= _requests.length) revert RequestNotFound(reqId);
        BreedRequest storage req = _requests[reqId];
        if (req.fulfilled) revert RequestAlreadyFulfilled(reqId);

        // Verify operator signature over (reqId, offspringWeightCID hash, sealedKeyHash)
        _verifyOperatorSig(reqId, offspringWeightCID, sealedKeyHash, operatorSig);

        req.fulfilled = true;

        // Determine generation: max(parentA.generation, parentB.generation) + 1
        // AgentINFT.mint already computes this from parentA/parentB token data,
        // but we pass parents so it can look them up.
        newTokenId = agentINFT.mint(
            req.requester,
            offspringWeightCID,
            metadataCID,
            req.parentA,
            req.parentB,
            sealedKeyHash
        );

        uint16 gen = agentINFT.generation(newTokenId);

        // Register royalty split in vault if royaltyBps > 0
        if (req.royaltyBpsToParents > 0) {
            address ownerA = agentINFT.ownerOf(req.parentA);
            address ownerB = agentINFT.ownerOf(req.parentB);

            address[] memory recipients = new address[](2);
            uint96[]  memory bps        = new uint96[](2);

            recipients[0] = ownerA;
            recipients[1] = ownerB;

            // Split royalty 50/50 between both parent owners.
            uint96 halfBps = req.royaltyBpsToParents / 2;
            bps[0] = halfBps;
            bps[1] = req.royaltyBpsToParents - halfBps; // handles odd bps

            royaltyVault.registerSplit(newTokenId, recipients, bps);

            // Set ERC-2981 royalty on offspring pointing at the vault for forwarding.
            // Uses setRoyaltyByMinter since BreedingMarket is an authorized minter
            // (not the token owner) at the time of fulfillment.
            agentINFT.setRoyaltyByMinter(newTokenId, address(royaltyVault), req.royaltyBpsToParents);
        }

        emit BreedFulfilled(reqId, newTokenId, gen);
    }

    // -------------------------------------------------------------------------
    // Signature verification
    // -------------------------------------------------------------------------

    function _verifyOperatorSig(
        uint256 reqId,
        string calldata weightCID,
        bytes32 sealedKeyHash,
        bytes calldata sig
    ) internal view {
        bytes32 msgHash = keccak256(abi.encodePacked(reqId, keccak256(bytes(weightCID)), sealedKeyHash));
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
        if (recovered != breedingOperator) revert InvalidSignature();
    }

    // -------------------------------------------------------------------------
    // View helpers
    // -------------------------------------------------------------------------

    function getRequest(uint256 reqId) external view returns (BreedRequest memory) {
        if (reqId >= _requests.length) revert RequestNotFound(reqId);
        return _requests[reqId];
    }

    function requestCount() external view returns (uint256) {
        return _requests.length;
    }
}
