var packages = {};

function addPackage(uuid, name, delivered, dLat, dLon) {
    if (uuid in packages) {
        console.warn('The package with UUID ' + uuid + ' was initalized multiple times!');
    }
    delivered = delivered || false;
    packages[uuid] = {name:name, polyline:new google.maps.Polyline({
        strokeColor:'#000000',
        strokeWeight:3,
        map: map
    }), marker:new google.maps.Marker({
        map:map,
        title:name
    }),delivered:delivered, destination:new google.maps.LatLng(dLat, dLon)};
    $("#list").append("<li data-id='" + uuid + "'><i class='fa-li fa fa-archive'></i> " + name + "</li>");
    if (delivered) {
        setDelivered(uuid);
    }
    packages[uuid].marker.addListener('click', function() {
        onMarkerClick(uuid);
    });
}

var trackingUUID = false;

function onMarkerClick(uuid) {
    map.panTo(packages[uuid].marker.getPosition());
    map.setZoom(12);
    $("#packageinfo #phelp").hide();
    $("#packageinfo #pinfo").show();
    trackingUUID = uuid;
    updateInfoBox();
}

function updateInfoBox() {
    if (!trackingUUID) {
        return;
    }
    $("#packageinfo #pname").text(packages[trackingUUID].name);
    $("#packageinfo #puuid").text(trackingUUID);
    $("#packageinfo #pstatus").text(packages[trackingUUID].delivered ? 'Delivered' : 'In Transit');
}

function addPoint(uuid, lat, lon) {
    var path = packages[uuid].polyline.getPath();
    var pos = new google.maps.LatLng(lat,lon);
    path.push(pos);
    if (!packages[uuid].delivered) {
        packages[uuid].marker.setPosition(pos);
        if (uuid == trackingUUID) {
            map.panTo(pos);
            updateInfoBox();
        }
    }
}

function setDelivered(uuid) {
    packages[uuid].delivered = true;
    packages[uuid].marker.setIcon('http://maps.google.com/mapfiles/ms/icons/blue-dot.png');
    $("#list li[data-id='" + uuid + "'] i").addClass('fa-check').removeClass('fa-archive');
    packages[uuid].marker.setPosition(packages[uuid].destination);
}

var map;
var socket;
function initMap() {
    map = new google.maps.Map(document.getElementById('map'), {
        center: {lat: 20, lng: 0},
        zoom: 3,
        streetViewControl: false
    });
    $.getJSON('/getpackages', function(data) {
        $.each(data.data, function(k, v) {
            var uuid = v[0];
            var dest = v[3].substring(1, v[3].length-1).split(',');
            addPackage(uuid, v[1], v[2], parseFloat(dest[0]), parseFloat(dest[1]));
            $.getJSON('/getpackage/' + v[0], function(data) {
                $.each(data.data, function(k, v) {
                    addPoint(uuid, v[0], v[1]);
                });
            });
        });
    });
    socket = io.connect('//' + document.domain + ':' + location.port);
    socket.on('newpackage', function(data) {
        addPackage(data.uuid, data.name, data.dest[0], data.dest[1]);
    });
    socket.on('packagedelivered', function(data) {
        setDelivered(data.uuid);
    });
    socket.on('plot', function(data) {
        addPoint(data.uuid, data.lat, data.lon);
    });
}

$(document).ready(function() {
    if (!$("#userid").text()) {
        $("#guest").show();
    }
    else {
        $("#member").show();
    }
    $(document).keyup(function(e) {
        if (e.keyCode == 27) {
            map.panTo(new google.maps.LatLng(20, 0));
            map.setZoom(3);
            $("#packageinfo #phelp").show();
            $("#packageinfo #pinfo").hide();
            trackingUUID = false;
        }
    });
    $("#list").on("click", "li", function(e) {
        e.preventDefault();
        onMarkerClick($(this).attr("data-id"));
    });
});
