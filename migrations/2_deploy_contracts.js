var Adoption = artifacts.require("Adoption");
var PetManagement = artifacts.require("PetManagement");

module.exports = function(deployer) {
  deployer.deploy(Adoption);
  deployer.deploy(PetManagement);
};