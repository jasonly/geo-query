// Need lodash for set operations
var _ = require('lodash');
// Initialize the proximity module with our redis client
var proximity = require('geo-proximity').initialize(require('./server').client);

var keys = proximity.addSet('keys');

// Map query ids from client to "intervalObjects" from our setInterval calls
var intervals = {};

// Store values from previous update cycle for queries
var prevs = {};

// Add a recurring radial geo query
// id: unique identifier for query
// coords: latitude and longitude for center of geo query
// radius: radius for geo query in meters
exports.addQuery = function(id, coords, radius, socket) {
  var cachedQuery = keys.getQueryCache(coords.latitude, coords.longitude, radius);

  intervals[id] = setInterval(function() {
    keys.nearbyWithQueryCache(cachedQuery, function(err, results) {
      console.log('Query results for ' + id + ':', results);
      handleResults(prevs[id] || [], results, socket);
      // Update previous results storage
      prevs[id] = results;
    });
  }, 1000);
};

// Remove a recurring radial geo query
// id: unique identifier for query
exports.removeQuery = function(id) {
  clearInterval(intervals[id]);
  delete intervals[id];
};

// Create or update latitude and longitude of a particular query
// id: unique identifier for query
// coords: latitude and longitude for center of query
exports.setKey = function(id, coords) {
  keys.addLocation(coords.latitude, coords.longitude, id, function(err) {
    if (err) {
      console.error(err);
    }
  });
};

// Remove key from redis store
// id: unique identifier for query
exports.removeKey = function(id) {
  keys.removeLocation(id, function(err) {
    if (err) {
      console.error(err);
    }
  });
};

var handleResults = function(previous, current, socket) {
  var entered = _.difference(current, previous);
  var exited = _.difference(previous, current);
  _.each(entered, function(enteredKey) {
    console.log('Key entered:', enteredKey);
    socket.emit('key_entered', {
      key: enteredKey
    });
  });
  _.each(exited, function(exitedKey) {
    console.log('Key exited:', exitedKey);
    socket.emit('key_exited', {
      key: exitedKey
    });
  });
};

