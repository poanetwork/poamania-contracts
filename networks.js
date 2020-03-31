const HDWalletProvider = require('truffle-hdwallet-provider');
require('dotenv').config();

function getProvider(network) {
  return () => new HDWalletProvider(process.env.MNEMONIC, `https://${network}.poa.network`);
}

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
      provider: getProvider('sokol'),
      gasPrice: 1e9,
      networkId: 77,
    },
    core: {
      provider: getProvider('core'),
      gasPrice: 1e9,
      networkId: 99,
    },
  },
};
