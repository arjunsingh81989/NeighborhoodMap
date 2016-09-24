// Default location: Hollywood, CA
var DEFAULT_LAT = 34.0983425;
var DEFAULT_LON = -118.3267434;
// Radius (in meters) to search nearby locations
var NEARBY_RADIUS = 10000;
// Initial search keyword
var INITIAL_SEARCH = "Restaurant";
var INITIAL_RESULTS = 30;  // set to a non-positive number to show all

// Flickr's API key
var FLICKR_KEY = '5f4517f1930a9be6c5eb382a7b9bea92';
// URL for query Flickr's API
var FLICKR_ENDPOINT = 'https://api.flickr.com/services/rest/';
// Helper function to return HTML elemetns for a Flickr thumbnail
function flickrPhotoThumbnail(photo) {
    var thumnnailUrl = "http://farm" + photo.farm + ".static.flickr.com/" + 
        photo.server + "/" + photo.id + "_" + photo.secret + "_" + "t.jpg";
    var photoUrl = "http://www.flickr.com/photos/" + photo.owner + "/" + photo.id;
    return '<a href="' + photoUrl + '" target="_blank"><img alt="" src="' + thumnnailUrl + '"></a>';
}
// Template for the content of InfoWindow of each marker
var infoWindowContent = 
'<div id="%ID%" class="info-window">' + 
    '<h3>%NAME%</h3>' +
    '<p>%ADDRESS%</p>' +
    '<div class="thumbnails">Related images from Flickr...</div>' +
'</div>';

// class Location
// Constructor: create a location item for the LocationsModel used in this page.
// A location is constructed from a place data returned by the Google Maps
// Places library.
function Location(map, placeData) {
    var self = this;
    
    // Save some selected place data returned by Google Map API
    self.id = placeData.id;
    self.name = placeData.name;
    self.icon = placeData.icon;
    self.lat = placeData.geometry.location.lat();
    self.lon = placeData.geometry.location.lng();
    if (placeData.formatted_address) {
        self.address = placeData.formatted_address;
    } else if (placeData.vicinity) {
        self.address = placeData.vicinity;
    } else {
        self.address = '';
    }

    // create a marker for this location
    self.marker = gmaps.createMarker({
        location: placeData.geometry.location,
        name: self.name,
        icon: self.icon
    });
    
    // Create an InfoWindow for the marker of this location
    var content = infoWindowContent
            .replace('%ID%', self.id)
            .replace('%NAME%', self.name)
            .replace('%ADDRESS%', self.address);
    self.infoWindow = new google.maps.InfoWindow({
        content: content
    });
    // Indicate that related images for this location haven't been loaded yet
    self.imagesLoaded = false;
    
    // An observable field for this location: to indicate if this location
    // is being selected (as shown in a list)
    self.selected = ko.observable(false);
    // Subscribe a callback whenever this field is changed
    self.selected.subscribe(function(selected) {
        if (selected === true) {
            // Show InfoWindow, and animate the marker icon to indicate
            // that this location is being selected
            self.infoWindow.open(map, self.marker);
            self.marker.setAnimation(google.maps.Animation.BOUNCE);
            if (!self.imagesLoaded) {
                // Search for related images from Flickr
                self.searchFlickrImages();
            }
            
        } else {
            // Hide InfoWindow and reset no animation for non-selected location
            self.infoWindow.close();
            self.marker.setAnimation(null);
        }
    });
    
    // Show this marker in the map
    self.show = function() {
        self.marker.setMap(map);
        if (self.selected()) {
            self.marker.setAnimation(google.maps.Animation.BOUNCE);
        }
    };
    // Hide this marker from the map
    self.hide = function() {
        self.marker.setMap(null);
    };
    
    // Function to search for related images for this location using 
    // Flickr Search API
    self.searchFlickrImages = function() {
        // Setup search parameters
        var params = {
            method: 'flickr.photos.search',
            api_key: FLICKR_KEY,
            format: 'json',
            nojsoncallback: 1,
            text: self.name, // using location's name as search keywords
            lat: self.lat,   // also search by Geographic location
            lon: self.lon,
            accuracy: 10,    // control the accuracy level (1~16)
            per_page: 4      // maximum number of images returned
        };
        
        // This HTML element is within the InfoWindow of this location's marker
        var thumbnails = $('#' + self.id + ' .thumbnails');
        
        // Asynchronously search for Flickr images
        $.ajax(FLICKR_ENDPOINT, {
            data: params,
        }).done(function(response) {
            // console.log(response);
            
            // Show the search result
            if (response.photos.pages > 0) {
                thumbnails.html('');
                ko.utils.arrayForEach(response.photos.photo, function(photo) {
                    thumbnails.append(flickrPhotoThumbnail(photo));
                });
            } else {
                thumbnails.html("<span class='text-info'>No Images Found on Flickr</span>");
            }

        }).fail(function(error) {
            // console.log(error);
            // Indicate the search has failed.
            thumbnails.html("<span class='text-warning'>Error searching Flickr's Images</span>");
        }).always(function() {
            // Set flag to make sure the search is called once per location
            self.imagesLoaded = true;
        });
    };
}

// class AppViewModel
// An Knockout model for this application.
// This model  mainly contains an obserable array, single-selection l
// ist of Locations item (class Location above)
function AppViewModel() {
    var self = this;

    // The obserable array of Location objects
    self.locations = ko.observableArray();
    
    // The geography of the current location
    self.currentGeo = null;
    
    // The latitude/longitude of the search location
    self.searchLatLng = {lat: DEFAULT_LAT, lng: DEFAULT_LON};
    
    // The search text to search for nearby locations
    self.searchText = ko.observable('');
    
    // The location to search for nearby locations
    self.searchLocation = ko.observable('');
    
    // Marker of the location for the search
    self.currentMarker = null;
    
    // The scheduled search
    self.searchTask = null;
    
    // Auto complete address for search location
    self.locationAutocomplete = null;
    
    function locationReady() {
        
        // Subscribe for the change in search text
        self.searchText.subscribe(function(searchText) {

            // clear the schedule search
            if (self.searchTask) {
                clearTimeout(self.searchTask);
            }

            // schedule search if user idle for a second
            if (searchText) {
                self.searchTask = setTimeout(self.search, 1000);
            }
        });
        
        // Subscribe for the change in search location
        self.searchLocation.subscribe(function(searchLocation) {        
            gmaps.geoLookup({address: searchLocation}, function(error, result) {
                if (error) {
                    alert(error);
                } else {
                    locationChanged(result);
                }
            });
        });
        
        // setup Auto complete for "searchLocation" field
        self.locationAutocomplete = new google.maps.places.Autocomplete(
            document.getElementById('searchLocation'), {
                types: ['geocode']
            });
        self.locationAutocomplete.addListener('place_changed', locationChanged);
    }
    
    function locationChanged(result) {
        if (!result) {
            // Get the place details from the autocomplete object.
            result = self.locationAutocomplete.getPlace();
        }
        
        self.searchLatLng = {
            lat: result.geometry.location.lat(),
            lng: result.geometry.location.lng()
        };

        // Marker for the search location
        if (self.currentMarker) {
            self.currentMarker.setMap(null);
        }
        self.currentMarker = gmaps.createMarker({
            location: new google.maps.LatLng(self.searchLatLng.lat, self.searchLatLng.lng),
            name: self.searchLocation()
        });

        // Clear previous result
        ko.utils.arrayForEach(self.locations(), function(loc) {
             loc.hide(null);
        });
        self.locations.removeAll();
        
        if (self.searchText())
            self.search();
        else
            self.fitMap();
    }
        
    // This function is called to initialize the locations data and populate
    // the map with markers, called when  the DOM is ready.
    // The initialization performs the following tasks:
    // - Using the current location (if available) or a default location to
    // search for nearby places using Google Maps Places library.
    // - Each nearby place is wrapped in a Location object and saved in the 
    // locations array.
    // - Construct a Google map to show the nearby places.
    self.init = function() {
        self.hideSidebar();
        
        function getCurrentPositionCallback() {
            // look up for the address of the current location
            gmaps.reverseLocation(self.searchLatLng, function(error, result) {
                if (error) {
                    alert(error);
                } else {
                    self.currentGeo = result;
                    self.searchLocation(utilGetCity(result));
                    
                    // Marker for the current location
                    self.currentMarker = gmaps.createMarker({
                        location: new google.maps.LatLng(
                                result.geometry.location.lat(), 
                                result.geometry.location.lng()),
                        name: self.searchLocation()
                    });
                    
                    self.fitMap();
                    
                    // Initial search
                    self.searchText(INITIAL_SEARCH);
                    self.search(INITIAL_RESULTS);
                    
                    locationReady();
                }
            });
        }

        if (navigator.geolocation) {
            // Request the current location (if geolocation service is enabled),
            // or using default location
            navigator.geolocation.getCurrentPosition(function(pos) {
                self.searchLatLng.lat = pos.coords.latitude;
                self.searchLatLng.lng = pos.coords.longitude;
                $('#searchLocation').popover('destroy');
                getCurrentPositionCallback();
            }, function(error) {
                console.log(error)
                $('#searchLocation').popover({content: error.message});
                $('#searchLocation').popover('show');
                getCurrentPositionCallback();
            });
        }
        
    };
    
    // Set the given item as the current selection
    self.setSelection = function(item) {
        ko.utils.arrayForEach(self.locations(), function(location) {
            location.selected(location === item ? true : false);
        });
    };
    
    // Fit the map to the screen
    self.fitMap = function() {
        gmaps.fitMap(self.searchLatLng, self.locations());
    };
    
    // Search for places nearby the current search location
    self.search = function(numResults) {
        var searchText = self.searchText();
        if (!searchText)
            return;
        
        console.log("Start searching...", searchText);
        
        // Clear previous result
        ko.utils.arrayForEach(self.locations(), function(loc) {
             loc.hide(null);
        });
        self.locations.removeAll();
        console.log("After"+self.locations().length);
        
        // Search places nearby the specified location
        gmaps.searchPlaces(self.searchText(), self.searchLatLng, NEARBY_RADIUS, 
        function(error, results) {
            if (error) {
                alert(error);
                return;
            }
            console.log("Inside searchPlaces"+self.locations().length);
            ko.utils.arrayForEach(results, function(place) {
                // console.log(place);



                // validate distance to the search location
                var d = utilDistance(self.searchLatLng.lat, self.searchLatLng.lng,
                    place.geometry.location.lat(), place.geometry.location.lng(), 'K');
                if (d * 1000 > NEARBY_RADIUS) {
                    console.log("Result too far", place);
                    return;
                }
                
                if (numResults && self.locations().length >= numResults) {

                    return;
                }

                // Add a Location object for each place returned 
                // by the search
                var location = new Location(gmaps.map, place);
                self.locations.push(location);

                // Click the marker of a location to select a location
                google.maps.event.addListener(location.marker, 'click', function () {
                    self.setSelection(location);
                });
            });
            self.showSidebar();

            // Fit the map for all the locations
            self.fitMap();
        });
    };
    
    // Show the side-bar
    self.showSidebar = function() {
        $("#wrapper").removeClass("toggled");
    };
    // Hide the side-bar
    self.hideSidebar = function() {
        $("#wrapper").addClass("toggled");
    };
}

// Create an instance of LocationsModel and apply binding between the View-Model
var appModel = new AppViewModel();
// Apply binding to the location model
ko.applyBindings(appModel);

var gmaps;

// Callback when the Google API is ready
function init() {
    // For using the Google Maps API
    gmaps = new GMapsAPI();
    
    // Initialize locations and the map
    appModel.init();    

    $(window).resize(function() {
        appModel.fitMap();
    });
}

// When the DOM is ready
$(document).ready(function() {
    // click event to show-hide the sidebar
    $("#sidebar-toggle").click(function(e) {
        e.preventDefault();
        $("#wrapper").toggleClass("toggled");
    });
    
    // Show the popover one time
    $('#searchLocation').on('shown.bs.popover', function() {
        setTimeout(function() {
            $('#searchLocation').popover('destroy');
        }, 2000);
    });
});

