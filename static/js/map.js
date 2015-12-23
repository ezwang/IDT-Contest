var packages = {};

var map;
var trackingUUID;
var socket;
function initMap() {
    map = new google.maps.Map(document.getElementById('map'), {
        center: {lat: -34.397, lng: 150.644},
        zoom: 12
    });
    socket = io.connect('//' + document.domain + ':' + location.port);
    socket.on('newpackage', function(data) {
        packages[data.uuid] = {name:data.name, polyline:new google.maps.Polyline({
            strokeColor:'#000000',
            strokeWeight:3,
            map: map
        }),delivered:false};
        trackingUUID = data.uuid;
    });
    socket.on('packagedelivered', function(data) {
        packages[data.uuid].delivered = true;
    });
    socket.on('plot', function(data) {
        var path = packages[data.uuid].polyline.getPath();
        var pos = new google.maps.LatLng(data.lat,data.lon);
        path.push(pos);
        if (trackingUUID == data.uuid) {
            map.panTo(pos);
        }
    });
}
