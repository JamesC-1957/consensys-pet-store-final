pragma solidity ^0.4.17;

import 'zeppelin-solidity/contracts/ownership/Ownable.sol';
import 'zeppelin-solidity/contracts/lifecycle/Pausable.sol';

contract PetManagement is Ownable, Pausable {
    struct Pet {
        uint id;
        string name;
        string ipfsHash;
        uint age;
        string breed;
        string locations;
        address creator;
    }

    Pet[] public pets;
    uint public petIndex = 0;

    event PetAdded(uint indexed petIndex, uint indexed age, address indexed creator, string breed);

    function addPet(string _name, string _breed, uint _age, string _location, string _ipfsHash) public whenNotPaused {
        Pet memory pet = Pet(petIndex, _name, _ipfsHash, _age, _breed, _location, msg.sender);
        pets.push(pet);

        emit PetAdded(petIndex, _age, msg.sender, _breed);
        petIndex++;
    }

    function () public {
        revert();
    }

    function kill() public onlyOwner {
        selfdestruct(address(this));
    }
}