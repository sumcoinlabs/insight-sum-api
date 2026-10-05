'use strict';

var request = require('request');

var PRIMARY =
  'https://rates.slicewallet.org/api/rates';

var FX_FALLBACK =
  'https://open.er-api.com/v6/latest/USD';

function CurrencyController(options) {
  this.node = options.node;

  var refresh =
    options.currencyRefresh ||
    CurrencyController.DEFAULT_CURRENCY_DELAY;

  this.currencyDelay = refresh * 60000;
  this.bitstampRate = 0;
  this.rates = [];
  this.timestamp = 0;
  this.fxFallbackUsed = false;
  this.fxUpdated = null;
}

CurrencyController.DEFAULT_CURRENCY_DELAY = 10;

function numberValue(value) {
  var n = Number(value);
  return isFinite(n) ? n : null;
}

function normalizeRate(rate) {
  var result = {};

  Object.keys(rate || {}).forEach(function(key) {
    result[key] = rate[key];
  });

  result.code =
    String(result.code || '').toUpperCase();

  var n = numberValue(result.n);

  if (n === null) {
    n = numberValue(result.price);
  }

  result.n = n;
  result.price = n;

  return result;
}

function findRate(rates, code) {
  var i;

  for (i = 0; i < rates.length; i++) {
    if (rates[i].code === code) {
      return rates[i];
    }
  }

  return null;
}

function sortRates(rates) {
  rates.sort(function(a, b) {
    if (a.code === 'USD') return -1;
    if (b.code === 'USD') return 1;

    return a.code.localeCompare(b.code);
  });
}

CurrencyController.prototype._respond =
function(res) {
  res.jsonp({
    status: 200,
    data: {
      bitstamp: this.bitstampRate,
      rates: this.rates,
      fxFallbackUsed: this.fxFallbackUsed,
      fxUpdated: this.fxUpdated
    }
  });
};

CurrencyController.prototype._refresh =
function(callback) {
  var self = this;

  request({
    url: PRIMARY,
    timeout: 10000
  }, function(err, response, body) {

    if (err ||
        !response ||
        response.statusCode !== 200) {

      return callback(
        err || new Error(
          'SliceWallet rates HTTP ' +
          (response && response.statusCode)
        )
      );
    }

    var source;

    try {
      source = JSON.parse(body);
    } catch (parseError) {
      return callback(parseError);
    }

    if (!Array.isArray(source)) {
      return callback(
        new Error('Unexpected SliceWallet rates response')
      );
    }

    var rates = source
      .map(normalizeRate)
      .filter(function(rate) {
        return rate.code && rate.n !== null;
      });

    var usd = findRate(rates, 'USD');

    if (!usd) {
      return callback(
        new Error('USD rate missing from primary source')
      );
    }

    var wanted = {
      CRC: {
        name: 'Costa Rican Colón',
        symbol: '₡'
      },
      MXN: {
        name: 'Mexican Peso',
        symbol: 'MX$'
      }
    };

    var missing = Object.keys(wanted)
      .filter(function(code) {
        return !findRate(rates, code);
      });

    if (!missing.length) {
      sortRates(rates);

      return callback(null, {
        rates: rates,
        fallback: false,
        updated: null
      });
    }

    request({
      url: FX_FALLBACK,
      timeout: 10000,
      json: true
    }, function(fxErr, fxResponse, fxBody) {

      if (fxErr ||
          !fxResponse ||
          fxResponse.statusCode !== 200 ||
          !fxBody ||
          !fxBody.rates) {

        self.node.log.warn(
          'Fiat fallback unavailable; missing: ' +
          missing.join(', ')
        );

        sortRates(rates);

        return callback(null, {
          rates: rates,
          fallback: false,
          updated: null
        });
      }

      missing.forEach(function(code) {
        var fx = numberValue(
          fxBody.rates[code]
        );

        if (fx === null) {
          return;
        }

        var value = usd.n * fx;

        rates.push({
          code: code,
          n: value,
          price: value,
          name: wanted[code].name,
          symbol: wanted[code].symbol
        });
      });

      sortRates(rates);

      callback(null, {
        rates: rates,
        fallback: true,
        updated:
          fxBody.time_last_update_utc || null
      });
    });
  });
};

CurrencyController.prototype.index =
function(req, res) {
  var self = this;
  var now = Date.now();

  if (self.rates.length &&
      now < self.timestamp + self.currencyDelay) {

    return self._respond(res);
  }

  self._refresh(function(err, result) {

    if (err) {
      self.node.log.error(err);

      if (self.rates.length) {
        return self._respond(res);
      }

      return res.status(502).jsonp({
        status: 502,
        error: 'Currency rates temporarily unavailable'
      });
    }

    self.timestamp = Date.now();
    self.rates = result.rates;
    self.fxFallbackUsed = result.fallback;
    self.fxUpdated = result.updated;

    var usd = findRate(
      self.rates,
      'USD'
    );

    self.bitstampRate =
      usd ? usd.n : 0;

    self._respond(res);
  });
};

module.exports = CurrencyController;
