'use strict';

var Common = require('./common');
var path = require('path');
var execFile = require('child_process').execFile;

function StatusController(node) {
  this.node = node;
  this.common = new Common({log: this.node.log});
}

StatusController.prototype.show = function(req, res) {
  var self = this;
  var option = req.query.q;

  switch(option) {
  case 'getDifficulty':
    this.getDifficulty(function(err, result) {
      if (err) {
        return self.common.handleErrors(err, res);
      }
      res.jsonp(result);
    });
    break;
  case 'getLastBlockHash':
    res.jsonp(this.getLastBlockHash());
    break;
  case 'getBestBlockHash':
    this.getBestBlockHash(function(err, result) {
      if (err) {
        return self.common.handleErrors(err, res);
      }
      res.jsonp(result);
    });
    break;
  case 'getInfo':
  default:
    this.getInfo(function(err, result) {
      if (err) {
        return self.common.handleErrors(err, res);
      }
      res.jsonp({
        info: result
      });
    });
  }
};

StatusController.prototype._getConnectionCount = function(callback) {
  var service = this.node.services.bitcoind;
  var cli = '/root/sumcoin/src/sumcoin-cli';
  var args = [];

  if (service.spawn) {
    if (service.spawn.exec) {
      cli = path.join(path.dirname(service.spawn.exec), 'sumcoin-cli');
    }

    if (service.spawn.datadir) {
      args.push('-datadir=' + service.spawn.datadir);
    }
  }

  args.push('getconnectioncount');

  execFile(cli, args, {timeout: 5000}, function(err, stdout) {
    if (err) {
      return callback(err);
    }

    var count = parseInt(String(stdout).trim(), 10);

    if (!isFinite(count)) {
      return callback(new Error('Invalid getconnectioncount response'));
    }

    callback(null, count);
  });
};

StatusController.prototype.getInfo = function(callback) {
  var self = this;

  this.node.services.bitcoind.getInfo(function(err, result) {
    if (err) {
      return callback(err);
    }

    self._getConnectionCount(function(connectionErr, connectionCount) {

      if (connectionErr) {
        connectionCount =
          typeof result.connections === 'number' ?
          result.connections : 0;
      }

      var info = {
        version: result.version,
        protocolversion: result.protocolVersion,
        blocks: result.blocks,
        timeoffset: result.timeOffset,
        connections: connectionCount,
        proxy: result.proxy,
        difficulty: result.difficulty,
        testnet: result.testnet,
        relayfee: result.relayFee,
        errors: result.errors,
        network: result.network
      };

      callback(null, info);
    });
  });
};

StatusController.prototype.getLastBlockHash = function() {
  var hash = this.node.services.bitcoind.tiphash;
  return {
    syncTipHash: hash,
    lastblockhash: hash
  };
};

StatusController.prototype.getBestBlockHash = function(callback) {
  this.node.services.bitcoind.getBestBlockHash(function(err, hash) {
    if (err) {
      return callback(err);
    }
    callback(null, {
      bestblockhash: hash
    });
  });
};

StatusController.prototype.getDifficulty = function(callback) {
  this.node.services.bitcoind.getInfo(function(err, info) {
    if (err) {
      return callback(err);
    }
    callback(null, {
      difficulty: info.difficulty
    });
  });
};

StatusController.prototype.sync = function(req, res) {
  var self = this;
  var status = 'syncing';

  this.node.services.bitcoind.isSynced(function(err, synced) {
    if (err) {
      return self.common.handleErrors(err, res);
    }
    if (synced) {
      status = 'finished';
    }

    self.node.services.bitcoind.syncPercentage(function(err, percentage) {
      if (err) {
        return self.common.handleErrors(err, res);
      }
      var info = {
        status: status,
        blockChainHeight: self.node.services.bitcoind.height,
        syncPercentage: Math.round(percentage),
        height: self.node.services.bitcoind.height,
        error: null,
        type: 'sumcore node'
      };

      res.jsonp(info);

    });

  });

};

// Hard coded to make insight ui happy, but not applicable
StatusController.prototype.peer = function(req, res) {
  res.jsonp({
    connected: true,
    host: '127.0.0.1',
    port: null
  });
};

StatusController.prototype.version = function(req, res) {
  var pjson = require('../package.json');
  res.jsonp({
    version: pjson.version
  });
};

module.exports = StatusController;
