pragma solidity ^0.5.2;


/**
 * @title Buy Mechanism Interface
 * @dev 
 */
interface IBuyMechanism {
    function getReceipt(uint256 _txReceiptId) external view
    returns (address buyer, address seller, bytes32 id, uint256 value);
}