// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "forge-std/Script.sol";

interface IETHRegistrarController {
    struct Price {
        uint256 base;
        uint256 premium;
    }

    // RegisterRequest struct — actual encoding on Sepolia (uint8 reverseRecord, bytes32 fuses)
    struct RegisterRequest {
        string  name;
        address owner;
        uint256 duration;
        bytes32 secret;
        address resolver;
        bytes[] data;
        uint8   reverseRecord;
        bytes32 ownerControlledFuses;
    }

    function rentPrice(string memory name, uint256 duration) external view returns (Price memory price);

    function available(string memory name) external returns (bool);

    function makeCommitment(RegisterRequest memory request) external pure returns (bytes32);

    function commit(bytes32 commitment) external;

    function register(RegisterRequest calldata request) external payable;
}

contract ENSRegister is Script {
    address constant ENS_CONTROLLER = 0xfb3cE5D01e0f33f41DbB39035dB9745962F1f968;

    function run() external {
        address owner = vm.envAddress("DEPLOYER_ADDR");
        address resolver = vm.envAddress("RESOLVER_ADDR");
        bytes32 secret = vm.envBytes32("ENS_SECRET");
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        string memory name = "agentforge";
        uint256 duration = 31536000; // 1 year

        IETHRegistrarController controller = IETHRegistrarController(ENS_CONTROLLER);

        // Check availability
        bool avail = controller.available(name);
        console.log("Available:", avail);
        require(avail, "Name not available");

        // Get price
        IETHRegistrarController.Price memory price = controller.rentPrice(name, duration);
        uint256 totalPrice = price.base + price.premium;
        console.log("Price (base):", price.base);
        console.log("Price (premium):", price.premium);
        console.log("Total:", totalPrice);

        // Build RegisterRequest
        IETHRegistrarController.RegisterRequest memory req = IETHRegistrarController.RegisterRequest({
            name: name,
            owner: owner,
            duration: duration,
            secret: secret,
            resolver: resolver,
            data: new bytes[](0),
            reverseRecord: 0,
            ownerControlledFuses: bytes32(0)
        });

        // Make commitment
        bytes32 commitment = controller.makeCommitment(req);
        console.log("Commitment:");
        console.logBytes32(commitment);

        vm.startBroadcast(deployerKey);

        // Commit
        controller.commit(commitment);
        console.log("Committed! Waiting for min commitment age...");

        vm.stopBroadcast();
    }
}
