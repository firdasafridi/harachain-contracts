pragma solidity ^0.4.25;

import "./interfaces/IDataProvider.sol";

/**
 * @title DataProviderHara
 * @dev Data provider contract by hara.
 */
contract DataProviderHara is IDataProvider {

    address public owner;
    string public endpoint;
        
    // events
    event EndpointChangedLog(string oldEndpoint, string newEndpoint, address by);

    // modifier
    /**
    * @dev Modifier to check if function called by owner.
    */
    modifier onlyOwner() {
        require(msg.sender == owner, "Can only accesed by owner.");
        _;
    }

    modifier endpointExists() {
        require(bytes(endpoint).length > 0, "Endpoint is not exists");
        // require(endpoint != "", "Endpoint is not exists");
        _;
    }

    /**
    * @dev Constructor.
    */
    constructor() public {
        owner = msg.sender;
    }

    /**
    * @dev Function to get Uri item from location Id.
    * @param _locationId Location Id of item.
    * @param _priceId Price Id as a versio of item.
    * @param _buyer Address of buyer.
    */
    function getUri(string _locationId, string _priceId, string _buyer) external view endpointExists returns (string uri){
        return string(abi.encodePacked(endpoint, "?id=", _locationId, "&&version=", _priceId, "&&address=", _buyer));
    }

    /**
    * @dev Function to get Uri item from location Id.
    * @param _newEndpoint Endpoint to be stored on contract.
    */
    function setEndpoint(string _newEndpoint) public onlyOwner {
        string memory _oldEndpoint = endpoint;
        endpoint = _newEndpoint;
        emit EndpointChangedLog(_oldEndpoint, endpoint, msg.sender);
    }
}