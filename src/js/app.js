var accounts
var account

App = {
  web3Provider: null,
  contracts: {},

  init: function () {
    ipfsNode = new Ipfs({
      repo: 'ipfs-' + Math.random()
    });
    ipfsNode.once('ready', () => {
      console.log('Online status: ', ipfsNode.isOnline() ? 'online' : 'offline')
    });

    return App.initWeb3();
  },

  initWeb3: function () {
    // Is there an injected web3 instance?
    if (typeof web3 !== 'undefined') {
      App.web3Provider = web3.currentProvider;
    } else {
      // If no injected web3 instance is detected, fall back to Ganache
      App.web3Provider = new Web3.providers.HttpProvider('http://localhost:7545');
    }
    web3 = new Web3(App.web3Provider);

    web3.eth.getAccounts(function (err, accs) {
      if (err != null) {
        alert('There was an error fetching your accounts.')
        return
      }

      if (accs.length === 0) {
        alert('Couldn\'t get any accounts! Make sure your Ethereum client is configured correctly.')
        return
      }

      accounts = accs
      account = accounts[0]
      web3.eth.defaultAccount = account
    });
    return App.initContract();
  },

  initContract: function () {
    $.getJSON('Adoption.json', function (data) {
      // Get the necessary contract artifact file and instantiate it with truffle-contract
      var AdoptionArtifact = data;
      App.contracts.Adoption = TruffleContract(AdoptionArtifact);

      // Set the provider for our contract
      App.contracts.Adoption.setProvider(App.web3Provider);

      // Use our contract to retrieve and mark the adopted pets
      return App.markAdopted();
    });

    $.getJSON('PetManagement.json', function (data) {
      // Get the necessary contract artifact file and instantiate it with truffle-contract
      var PetManagementArtifact = data;
      App.contracts.PetManagement = TruffleContract(PetManagementArtifact);

      // Set the provider for our contract
      App.contracts.PetManagement.setProvider(App.web3Provider);
      App.getPets();
    });

    return App.bindEvents();
  },
  getPets: function () { // Load pets
    var petInstance;

    App.contracts.PetManagement.deployed().then(function (instance) {
      petInstance = instance;

      var event = instance.PetAdded({
        fromBlock: 'latest'
      });
      event.watch(async function (error, result) {
        if (!error) {
          const args = result.args;
          const pet = await petInstance.pets.call(args.petIndex);
          var petsRow = $('#petsRow');
          var petTemplate = $('#petTemplate');

          $.get(`https://ipfs.io/ipfs/${pet[2]}`, function (picture) {
            petTemplate.find('.btn-adopt').attr('data-id', pet[0]);
            petTemplate.find('.panel-title').text(pet[1]);
            petTemplate.find('img').attr('src', picture);
            petTemplate.find('.pet-age').text(pet[3]);
            petTemplate.find('.pet-breed').text(pet[4]);
            petTemplate.find('.pet-location').text(pet[5]);
            petsRow.append(petTemplate.html());
          });
        } else {
          console.error(error);
        }
      });

      return petInstance.petIndex.call();
    }).then(async function (index) {
      var petsRow = $('#petsRow');
      var petTemplate = $('#petTemplate');

      for (i = 0; i < index - 1; i++) {
        const pet = await petInstance.pets.call(i);
        if (pet[1].length < 5) continue;

        $.get(`https://ipfs.io/ipfs/${pet[2]}`, function (picture) {
          petTemplate.find('.btn-adopt').attr('data-id', pet[0]);
          petTemplate.find('.panel-title').text(pet[1]);
          petTemplate.find('img').attr('src', picture);
          petTemplate.find('.pet-age').text(pet[3]);
          petTemplate.find('.pet-breed').text(pet[4]);
          petTemplate.find('.pet-location').text(pet[5]);
          petsRow.append(petTemplate.html());
        });
      }
    }).catch(function (err) {
      console.error(err);
    });
  },

  bindEvents: function () {
    $(document).on('click', '.btn-adopt', App.handleAdopt);

    // List Pet form validator
    $('#listPetForm').bootstrapValidator({
      feedbackIcons: {
        valid: 'glyphicon glyphicon-ok',
        invalid: 'glyphicon glyphicon-remove',
        validating: 'glyphicon glyphicon-refresh'
      },
      fields: {
        'name': {
          validators: {
            notEmpty: {
              message: 'The pet name is required'
            }
          }
        },
        'breed': {
          validators: {
            notEmpty: {
              message: 'The pet breed is required'
            }
          }
        },
        'age': {
          validators: {
            notEmpty: {
              message: 'The pet age is required'
            }
          }
        },
        'location': {
          validators: {
            notEmpty: {
              message: 'The pet location is required'
            }
          }
        },
        'image': {
          validators: {
            notEmpty: {
              message: 'The pet image is required'
            }
          }
        }
      }
    }).on('success.form.bv', function (e) {
      e.preventDefault();

      var $form = $(e.target); // The form instance
      var data = {};
      $form.serializeArray().map(function (x) {
        data[x.name] = x.value;
      });

      var petInstance;
      App.contracts.PetManagement.deployed().then(function (instance) {
        petInstance = instance;
        return petInstance.addPet(data.name, data.breed, parseInt(data.age), data.location, data.ipfsHash, {
          from: account
        });
      }).then(function (result) {
        console.log('Transaction successful! tx hash: ' + JSON.stringify(result.tx));
      }).catch(function (err) {
        console.error(err.message);
      });

      $form.parents('.bootbox').modal('hide');
    });

    $('#closeFormModal').on('click', function () {
      $('.bootbox').modal('hide');
    });

    // List Pet button click handler
    $('#listPet').on('click', function () {
      bootbox
        .dialog({
          title: 'List a new pet',
          message: $('#listPetForm'),
          show: false
        })
        .on('shown.bs.modal', function () {
          $('#listPetForm')
            .show()
            .bootstrapValidator('resetForm', true);
        })
        .on('hide.bs.modal', function (e) {
          $('#listPetForm').hide().appendTo('body');
        })
        .modal('show');
    });

    $('#image').change(function (e) {
      const reader = new FileReader();
      reader.onloadend = function () {
        const buf = buffer.Buffer(reader.result);
        ipfsNode.files.add(buf, (err, result) => {
          if (err) {
            console.error(err);
            return;
          }
          const ipfsHash = result[0].hash;
          let url = `https://ipfs.io/ipfs/${ipfsHash}`;
          console.log(`Pet image url --> ${url}`);
          $("#ipfsHash").val(ipfsHash);
        });
      }

      const image = document.getElementById("image");
      reader.readAsDataURL(image.files[0]);
    });
  },

  markAdopted: function (adopters, account) {
    var adoptionInstance;

    App.contracts.Adoption.deployed().then(function (instance) {
      adoptionInstance = instance;

      return adoptionInstance.getAdopters.call();
    }).then(function (adopters) {
      for (i = 0; i < adopters.length; i++) {
        if (adopters[i] !== '0x0000000000000000000000000000000000000000') {
          $('.panel-pet').eq(i).find('button').text('Success').attr('disabled', true);
        }
      }
    }).catch(function (err) {
      console.error(err.message);
    });
  },

  handleAdopt: function (event) {
    event.preventDefault();
    var petId = parseInt($(event.target).data('id'));
    var adoptionInstance;

    web3.eth.getAccounts(function (error, accounts) {
      if (error) {
        console.error(error);
      }

      var account = accounts[0];
      App.contracts.Adoption.deployed().then(function (instance) {
        adoptionInstance = instance;
        // Execute adopt as a transaction by sending account
        return adoptionInstance.adopt(petId, {
          from: account
        });
      }).then(function (result) {
        return App.markAdopted();
      }).catch(function (err) {
        console.error(err.message);
      });
    });
  }
};

$(function () {
  $(window).load(function () {
    App.init();
  });
});