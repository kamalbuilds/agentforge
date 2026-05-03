// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "forge-std/Script.sol";

interface IETHRegistrarController {
    struct Price {
        uint256 base;
        uint256 premium;
    }

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

    function register(RegisterRequest calldata request) external payable;

    function minCommitmentAge() external view returns (uint256);
}

contract ENSRegisterFinish is Script {
    address constant ENS_CONTROLLER = 0xfb3cE5D01e0f33f41DbB39035dB9745962F1f968;

    function run() external {
        address owner = vm.envAddress("DEPLOYER_ADDR");
        address resolver = vm.envAddress("RESOLVER_ADDR");
        bytes32 secret = vm.envBytes32("ENS_SECRET");
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        string memory name = "agentforge";
        uint256 duration = 31536000;

        IETHRegistrarController controller = IETHRegistrarController(ENS_CONTROLLER);

        IETHRegistrarController.Price memory price = controller.rentPrice(name, duration);
        uint256 totalPrice = price.base + price.premium;
        uint256 overpay = totalPrice + (totalPrice / 10); // 10% buffer
        console.log("Paying:", overpay);

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

        vm.startBroadcast(deployerKey);

        controller.register{value: overpay}(req);
        console.log("Registered agentforge.eth successfully!");

        vm.stopBroadcast();
    }
}
