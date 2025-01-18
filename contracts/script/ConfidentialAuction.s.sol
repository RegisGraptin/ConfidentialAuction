// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {ConfidentialAuction} from "../src/ConfidentialAuction.sol";

contract ConfidentialAuctionScript is Script {
    ConfidentialAuction public confidentialAuction;

    function setUp() public {}

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        confidentialAuction = new ConfidentialAuction(
            "SuperToken",
            "SPT",
            1_000_000,
            block.timestamp + 10_000_000
        );

        vm.stopBroadcast();
    }
}
