var packages = {};

var map;
var trackingUUID;
var socket;
function initMap() {
    map = new google.maps.Map(document.getElementById('map'), {
        center: {lat: 0, lng: 0},
        zoom: 2,
        streetViewControl: false
    });
    socket = io.connect('//' + document.domain + ':' + location.port);
    socket.on('newpackage', function(data) {
        packages[data.uuid] = {name:data.name, polyline:new google.maps.Polyline({
            strokeColor:'#000000',
            strokeWeight:3,
            map: map
        }), marker:new google.maps.Marker({
            map:map,
            title:data.name
        }),delivered:false};
        trackingUUID = data.uuid;
    });
    socket.on('packagedelivered', function(data) {
        packages[data.uuid].delivered = true;
        packages[data.uuid].marker.setIcon('http://maps.google.com/mapfiles/ms/icons/blue-dot.png');
    });
    socket.on('plot', function(data) {
        var path = packages[data.uuid].polyline.getPath();
        var pos = new google.maps.LatLng(data.lat,data.lon);
        path.push(pos);
        if (trackingUUID == data.uuid) {
            map.panTo(pos);
        }
        packages[data.uuid].marker.setPosition(pos);
    });
}
