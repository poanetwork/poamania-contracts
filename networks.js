const HDWalletProvider = require('truffle-hdwallet-provider');
require('dotenv').config();

module.exports = {
  networks: {
    development: {
      protocol: 'http',
      host: 'localhost',
      port: 8545,
      gas: 5000000,
      gasPrice: 5e9,
      networkId: '*',
    },
    sokol: {
      provider: () => new HDWalletProvider(process.env.MNEMONIC, 'https://sokol.poa.network'),
      gasPrice: 1e9,
      networkId: 77,
    },
  },
};
