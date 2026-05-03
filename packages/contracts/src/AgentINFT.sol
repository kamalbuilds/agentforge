// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title AgentINFT — ERC-7857 Intelligent NFT
/// @notice Represents an AI agent as a non-fungible token with encrypted model weights
///         stored on 0G Storage, following the ERC-7857 specification for Intelligent NFTs.
contract AgentINFT is ERC721, ERC2981, Ownable {
    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------
    error NotMinter(address caller);
    error TokenDoesNotExist(uint256 tokenId);
    error NotTokenOwner(uint256 tokenId, address caller);
    error UsageExpired(uint256 tokenId, address user);
    error ZeroAddress();
    error InvalidRoyaltyBps(uint96 feeBps);

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    /// @notice Emitted on every ownership transfer per ERC-7857: the TEE must
    ///         re-encrypt the model weights for the new owner.
    event ReencryptionRequired(uint256 indexed tokenId, address indexed newOwner);

    /// @notice Emitted when a token is cloned.
    event Cloned(uint256 indexed originalTokenId, uint256 indexed newTokenId, address indexed to);

    /// @notice Emitted when inference usage rights are granted.
    event UsageAuthorized(uint256 indexed tokenId, address indexed user, uint64 expiry);

    /// @notice Emitted when a minter is added or removed.
    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------

    struct TokenData {
        string weightCID;      // 0G Storage CID for encrypted model weights
        string metadataCID;    // 0G Storage CID for metadata
        uint256 parentA;       // token ID of parent A (0 = genesis)
        uint256 parentB;       // token ID of parent B (0 = genesis)
        uint16 generation;     // breeding generation (0 = genesis)
        bytes32 sealedKeyHash; // keccak256 of TEE-sealed decryption key
    }

    struct UsageRight {
        uint64 expiry; // unix timestamp; 0 = never granted
    }

    /// @dev Token IDs start at 1. ID 0 is reserved as the "no parent" sentinel.
    uint256 private _nextTokenId = 1;

    mapping(uint256 => TokenData) private _tokenData;
    mapping(uint256 => mapping(address => UsageRight)) private _usageRights;
    mapping(address => bool) private _minters;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(address initialOwner)
        ERC721("Agent iNFT", "AINFT")
        Ownable(initialOwner)
    {}

    // -------------------------------------------------------------------------
    // Minter access control
    // -------------------------------------------------------------------------

    modifier onlyMinter() {
        if (!_minters[msg.sender]) revert NotMinter(msg.sender);
        _;
    }

    function addMinter(address minter) external onlyOwner {
        if (minter == address(0)) revert ZeroAddress();
        _minters[minter] = true;
        emit MinterAdded(minter);
    }

    function removeMinter(address minter) external onlyOwner {
        _minters[minter] = false;
        emit MinterRemoved(minter);
    }

    function isMinter(address account) external view returns (bool) {
        return _minters[account];
    }

    // -------------------------------------------------------------------------
    // Core minting
    // -------------------------------------------------------------------------

    /// @notice Mint a new agent iNFT. Only callable by authorized minters
    ///         (BreedingMarket and Arena contracts).
    function mint(
        address to,
        string calldata weightCID,
        string calldata metadataCID,
        uint256 parentA,
        uint256 parentB,
        bytes32 sealedKeyHash
    ) external onlyMinter returns (uint256 tokenId) {
        tokenId = _nextTokenId++;
        _safeMint(to, tokenId);

        uint16 generation = 0;
        if (parentA != 0 || parentB != 0) {
            uint16 genA = parentA != 0 ? _tokenData[parentA].generation : 0;
            uint16 genB = parentB != 0 ? _tokenData[parentB].generation : 0;
            generation = (genA > genB ? genA : genB) + 1;
        }

        _tokenData[tokenId] = TokenData({
            weightCID: weightCID,
            metadataCID: metadataCID,
            parentA: parentA,
            parentB: parentB,
            generation: generation,
            sealedKeyHash: sealedKeyHash
        });
    }

    // -------------------------------------------------------------------------
    // ERC-7857: Re-encryption on transfer
    // -------------------------------------------------------------------------

    /// @dev Override _update (ERC721 internal hook) to emit ReencryptionRequired
    ///      on every transfer to a non-zero address (i.e., not burns).
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = super._update(to, tokenId, auth);
        if (to != address(0) && from != address(0)) {
            // Transfer (not mint or burn) — new owner must re-encrypt weights
            emit ReencryptionRequired(tokenId, to);
        }
        return from;
    }

    // -------------------------------------------------------------------------
    // Clone
    // -------------------------------------------------------------------------

    /// @notice Mint a copy of an existing token with the same weights CID but a
    ///         new TEE-sealed key (the cloner provides a new sealedKeyHash).
    function clone(
        uint256 tokenId,
        address to,
        bytes32 newSealedKeyHash
    ) external onlyMinter returns (uint256 newTokenId) {
        if (!_exists(tokenId)) revert TokenDoesNotExist(tokenId);

        TokenData storage src = _tokenData[tokenId];
        newTokenId = _nextTokenId++;
        _safeMint(to, newTokenId);

        _tokenData[newTokenId] = TokenData({
            weightCID: src.weightCID,
            metadataCID: src.metadataCID,
            parentA: tokenId,
            parentB: 0,
            generation: src.generation,
            sealedKeyHash: newSealedKeyHash
        });

        emit Cloned(tokenId, newTokenId, to);
    }

    // -------------------------------------------------------------------------
    // Usage authorization (temporary inference rights)
    // -------------------------------------------------------------------------

    /// @notice Grant temporary inference usage rights to a user.
    function authorizeUsage(
        uint256 tokenId,
        address user,
        uint64 expiry
    ) external {
        if (!_exists(tokenId)) revert TokenDoesNotExist(tokenId);
        if (ownerOf(tokenId) != msg.sender) revert NotTokenOwner(tokenId, msg.sender);
        if (user == address(0)) revert ZeroAddress();

        _usageRights[tokenId][user] = UsageRight({ expiry: expiry });
        emit UsageAuthorized(tokenId, user, expiry);
    }

    /// @notice Returns true if the user currently holds valid inference rights.
    function hasUsageRight(uint256 tokenId, address user) external view returns (bool) {
        UsageRight storage right = _usageRights[tokenId][user];
        return right.expiry > 0 && block.timestamp <= right.expiry;
    }

    // -------------------------------------------------------------------------
    // Royalty (ERC-2981)
    // -------------------------------------------------------------------------

    /// @notice Token owner can set per-token royalty.
    function setRoyalty(
        uint256 tokenId,
        address receiver,
        uint96 feeBps
    ) external {
        if (!_exists(tokenId)) revert TokenDoesNotExist(tokenId);
        if (ownerOf(tokenId) != msg.sender) revert NotTokenOwner(tokenId, msg.sender);
        if (receiver == address(0)) revert ZeroAddress();
        if (feeBps > 10_000) revert InvalidRoyaltyBps(feeBps);

        _setTokenRoyalty(tokenId, receiver, feeBps);
    }

    /// @notice Authorized minters (e.g. BreedingMarket) can set royalty on tokens
    ///         they just minted without needing to be the token owner.
    function setRoyaltyByMinter(
        uint256 tokenId,
        address receiver,
        uint96 feeBps
    ) external onlyMinter {
        if (!_exists(tokenId)) revert TokenDoesNotExist(tokenId);
        if (receiver == address(0)) revert ZeroAddress();
        if (feeBps > 10_000) revert InvalidRoyaltyBps(feeBps);

        _setTokenRoyalty(tokenId, receiver, feeBps);
    }

    // -------------------------------------------------------------------------
    // Lineage traversal (max depth 8)
    // -------------------------------------------------------------------------

    /// @notice Returns the ancestor token IDs up to 8 generations deep.
    ///         BFS/DFS, deduplicates if the same ancestor appears twice.
    function lineage(uint256 tokenId) external view returns (uint256[] memory ancestors) {
        if (!_exists(tokenId)) revert TokenDoesNotExist(tokenId);

        // We use a simple queue-based BFS up to depth 8.
        // Max nodes in a full binary tree of depth 8 = 2^9 - 1 = 511; we cap at 256.
        uint256[] memory queue = new uint256[](512);
        uint256 head;
        uint256 tail;

        // Seed with immediate parents
        TokenData storage root = _tokenData[tokenId];
        if (root.parentA != 0) queue[tail++] = root.parentA;
        if (root.parentB != 0) queue[tail++] = root.parentB;

        uint256[] memory result = new uint256[](256);
        uint256 resultLen;

        // visited mapping — using a small lookup array approach
        // We just track via a bool mapping is not cheap, so we walk and check
        // uniqueness inline (result is bounded).
        uint8 depth;

        while (head < tail && depth < 8 && resultLen < 256) {
            uint256 levelSize = tail - head;
            depth++;

            for (uint256 i; i < levelSize && resultLen < 256; i++) {
                uint256 id = queue[head++];

                // Dedup
                bool seen;
                for (uint256 j; j < resultLen; j++) {
                    if (result[j] == id) { seen = true; break; }
                }
                if (seen) continue;

                result[resultLen++] = id;

                TokenData storage td = _tokenData[id];
                if (td.parentA != 0 && tail < 512) queue[tail++] = td.parentA;
                if (td.parentB != 0 && tail < 512) queue[tail++] = td.parentB;
            }
        }

        ancestors = new uint256[](resultLen);
        for (uint256 i; i < resultLen; i++) {
            ancestors[i] = result[i];
        }
    }

    // -------------------------------------------------------------------------
    // View helpers
    // -------------------------------------------------------------------------

    function getTokenData(uint256 tokenId) external view returns (TokenData memory) {
        if (!_exists(tokenId)) revert TokenDoesNotExist(tokenId);
        return _tokenData[tokenId];
    }

    function generation(uint256 tokenId) external view returns (uint16) {
        if (!_exists(tokenId)) revert TokenDoesNotExist(tokenId);
        return _tokenData[tokenId].generation;
    }

    // -------------------------------------------------------------------------
    // ERC-165 supportsInterface
    // -------------------------------------------------------------------------

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    function _exists(uint256 tokenId) internal view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }
}
