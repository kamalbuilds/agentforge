// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title OffchainResolver
 * @notice ENS resolver implementing EIP-3668 (CCIP-Read) for offchain data resolution.
 *         Subnames of the registered parent name resolve via a CCIP-Read gateway that
 *         reads state from the 0G Galileo chain and signs the response with a known signer.
 *
 * @dev Implements ENSIP-10 (IExtendedResolver) so that the ENS Universal Resolver can
 *      call `resolve(bytes,bytes)` for wildcard resolution of any subdomain.
 */
contract OffchainResolver {
    using ECDSA for bytes32;

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------
    event NewSigners(address[] signers);
    event UrlChanged(string url);

    // -----------------------------------------------------------------------
    // EIP-3668 error — triggers CCIP-Read in the client
    // -----------------------------------------------------------------------
    error OffchainLookup(
        address sender,
        string[] urls,
        bytes callData,
        bytes4 callbackFunction,
        bytes extraData
    );

    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------
    address public immutable signer;
    string  public url;

    // -----------------------------------------------------------------------
    // Constructor
    // -----------------------------------------------------------------------

    /**
     * @param _url     CCIP-Read gateway URL template.
     *                 Must contain `{sender}` and `{data}` placeholders per EIP-3668.
     *                 Example: https://example.com/ccip/{sender}/{data}.json
     * @param _signer  Address whose signature the gateway attaches to every response.
     *                 Must match the wallet controlled by CCIP_SIGNER_KEY in the gateway.
     */
    constructor(string memory _url, address _signer) {
        require(_signer != address(0), "signer cannot be zero address");
        url    = _url;
        signer = _signer;
    }

    // -----------------------------------------------------------------------
    // ENSIP-10 — IExtendedResolver
    // -----------------------------------------------------------------------

    /**
     * @notice EIP-165 supportsInterface.
     *         Returns true for IExtendedResolver (0x9061b923) so the ENS Universal
     *         Resolver recognises this contract as a wildcard resolver.
     */
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x9061b923  // IExtendedResolver
            || interfaceId == 0x01ffc9a7; // ERC-165
    }

    /**
     * @notice Called by the ENS Universal Resolver for any name that falls under the
     *         registered resolver's node.  Always reverts with OffchainLookup to
     *         trigger CCIP-Read in the client.
     *
     * @dev The first parameter is the DNS-encoded name (unused at this layer; the gateway
     *      derives context from `data`).
     * @param data  ABI-encoded resolver call (e.g. addr(bytes32), text(bytes32,string)).
     */
    function resolve(bytes calldata /* name */, bytes calldata data)
        external
        view
        returns (bytes memory)
    {
        string[] memory urls = new string[](1);
        urls[0] = url;

        revert OffchainLookup(
            address(this),
            urls,
            data,
            OffchainResolver.resolveWithProof.selector,
            data
        );
    }

    // -----------------------------------------------------------------------
    // CCIP-Read callback
    // -----------------------------------------------------------------------

    /**
     * @notice Callback invoked by the client after the gateway returns a signed response.
     *
     * @param response   ABI-encoded `(bytes result, uint64 expires, bytes signature)` from
     *                   the gateway.
     * @param extraData  Original resolver calldata (passed through OffchainLookup.extraData).
     *
     * @return result    The raw ABI-encoded resolver result (address, string, etc.).
     */
    function resolveWithProof(bytes calldata response, bytes calldata extraData)
        external
        view
        returns (bytes memory result)
    {
        // Decode gateway response
        (bytes memory resultData, uint64 expires, bytes memory sig) =
            abi.decode(response, (bytes, uint64, bytes));

        // Response must not be expired
        require(block.timestamp <= expires, "OffchainResolver: response expired");

        // Reconstruct the signed message per our gateway's signing scheme:
        //   keccak256(abi.encodePacked(address(this), expires, keccak256(extraData), keccak256(resultData)))
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                hex"1900",
                address(this),
                expires,
                keccak256(extraData),
                keccak256(resultData)
            )
        );

        // Recover signer
        address recovered = ECDSA.recover(messageHash, sig);
        require(recovered == signer, "OffchainResolver: invalid signature");

        return resultData;
    }

    // -----------------------------------------------------------------------
    // Admin helpers (owner-only would be cleaner but kept minimal for demo)
    // -----------------------------------------------------------------------

    /**
     * @notice Returns the configured gateway URL.
     */
    function getUrl() external view returns (string memory) {
        return url;
    }
}
