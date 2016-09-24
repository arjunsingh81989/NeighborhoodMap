
/* global google */

// Class that wraps Google Map APIs required by this project
function GMapsAPI() {
    var self = this;
    
    // Create a Google Map
    self.map = new google.maps.Map(document.getElementById('map'), {
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        zoom: 10
    });
    
    // GeoCoder API
    var geocoder = new google.maps.Geocoder;
    
    // Places API
    var places = new google.maps.places.PlacesService(self.map);
    
    // Create a marker on the map
    self.createMarker = function(params) {
        
        // Options to create a marker
        var options = {
            map: self.map,
            position: params.location,
            title: params.name,
            animation: google.maps.Animation.DROP
        };
        
        if (params.icon) {
            // use place's icon as custom marker icon
            options.icon = { 
                url: params.icon,
                size: new google.maps.Size(71, 71),
                origin: new google.maps.Point(0, 0),
                anchor: new google.maps.Point(17, 34),
                scaledSize: new google.maps.Size(25, 25)
            };
        };
        
        return new google.maps.Marker(options);
    };
    
    // Fit the map to the bound of the given list of locations
    self.fitMap = function(currentLoc, locations) {
        
        var bounds = new google.maps.LatLngBounds();
        bounds.extend(new google.maps.LatLng(currentLoc.lat, currentLoc.lng));

        for (var i = 0; i < locations.length; i++) {
            var loc = locations[i];
            bounds.extend(new google.maps.LatLng(loc.lat, loc.lon));
        }

        self.map.fitBounds(bounds);
        self.map.setCenter(bounds.getCenter());
        if (locations.length === 0) {
            self.map.setZoom(10);
        }
        window.mapBounds = bounds;
    };
    
    // Search Geocoding service
    self.geoLookup = function(request, callback) {
        
        geocoder.geocode(request, function(results, status) {
            if (status === 'OK') {
                if (!results[0]) {
                    callback('Geocoder failed: no results found');
                } else {
                    callback(null, results[0]);
                }
            } else {
                callback('Geocoder failed due to: ' + status);
            }
        });
    };

    // Reverse Geocoding by Location
    self.reverseLocation = function(latLng, callback) {
        self.geoLookup({location: latLng}, callback);
    };
    
    // Search nearby places using PlacesService textSearch
    self.searchPlaces = function(query, latLng, radius, callback) {
        
        var request = {
            keyword: query,
            location: new google.maps.LatLng(latLng.lat, latLng.lng),
            radius: radius
        };
        
        // Use TextSearch service for searching nearby places
        places.nearbySearch(request, function (results, status) {
            if (status === google.maps.places.PlacesServiceStatus.OK) {
                callback(null, results);
            } else {
                callback('PlacesService failed due to: ' + status);
            }
        });   
    };
}

// Helper functions

function utilGetCity(geoResult) {
    
    var components = geoResult.address_components;
    for (var i = 0; i < components.length; i++) {
        
        var comp = components[i];
        var types = comp.types;
        for (var j = 0; j < types.length; j++) {
            if (types[j] === 'locality') {
                return comp.long_name;
            }
        }
    }
    return geoResult.formatted_address;
}

// Calculate distance between two latitude/longitude coordinates
// Source: http://www.geodatasource.com/developers/javascript
function utilDistance(lat1, lon1, lat2, lon2, unit) {
	var radlat1 = Math.PI * lat1/180
	var radlat2 = Math.PI * lat2/180
	var theta = lon1-lon2
	var radtheta = Math.PI * theta/180
	var dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
	dist = Math.acos(dist)
	dist = dist * 180/Math.PI
	dist = dist * 60 * 1.1515
	if (unit=="K") { dist = dist * 1.609344 }
	if (unit=="N") { dist = dist * 0.8684 }
	return dist
}