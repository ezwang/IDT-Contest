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
    $("#list").append("<li data-id='" + uuid + "'><i class='fa-li fa fa-archive'></i> <span class='name'>" + name + "</span><span class='opt'><i class='p-rename fa fa-pencil'></i></span></li>");
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
    trackingUUID = uuid;
    updateInfoBox();
}

function updateInfoBox() {
    if (!trackingUUID) {
        $("#packageinfo #phelp").show();
        $("#packageinfo #pinfo").hide();
        return;
    }
    $("#packageinfo #phelp").hide();
    $("#packageinfo #pinfo").show();
    $("#packageinfo #pname").text(packages[trackingUUID].name);
    $("#packageinfo #puuid").text(trackingUUID);
    $("#packageinfo #pstatus").text(packages[trackingUUID].delivered ? 'Delivered' : 'In Transit');
}

function addPoint(uuid, lat, lon) {
    if (uuid in packages) {
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
    else {
        console.warn('Package with UUID ' + uuid + ' was not initalized!');
    }
}

function setDelivered(uuid) {
    if (uuid in packages) {
        packages[uuid].delivered = true;
        packages[uuid].marker.setIcon('http://maps.google.com/mapfiles/ms/icons/blue-dot.png');
        $("#list li[data-id='" + uuid + "'] i").addClass('fa-check').removeClass('fa-archive');
        $("#list li[data-id='" + uuid + "'] .opt").append("<i class='p-delete fa fa-times'></i>");
        packages[uuid].marker.setPosition(packages[uuid].destination);
    }
    else {
        console.warn('Package with UUID ' + uuid + 'was not initalized!');
    }
}

var map;
var socket;
function initMap() {
    map = new google.maps.Map(document.getElementById('map'), {
        center: {lat: 20, lng: 0},
        zoom: 2,
        streetViewControl: false,
        mapTypeControl: false
    });
    map.addListener('drag', function() {
        trackingUUID = false;
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
        addPackage(data.uuid, data.name, false, data.dest[0], data.dest[1]);
    });
    socket.on('packagedelivered', function(data) {
        setDelivered(data.uuid);
    });
    socket.on('plot', function(data) {
        addPoint(data.uuid, data.lat, data.lon);
    });
}

function package_delete(uuid) {
    $("#list li[data-id='" + uuid + "']").remove();
    packages[uuid].marker.setMap(null);
    packages[uuid].polyline.setMap(null);
    delete packages[uuid];
    $.get("/map/delete_package/" + uuid, function(data) {});
    if (trackingUUID == uuid) {
        trackingUUID = false;
        updateInfoBox();
    }
}

function package_rename(uuid, name) {
    $("#list li[data-id='" + uuid + "'] .name").text(name);
    packages[uuid].name = name;
    packages[uuid].marker.setTitle(name);
    $.get("/map/rename_package/" + uuid + "/" + encodeURIComponent(name), function(data) {});
    if (trackingUUID == uuid) {
        updateInfoBox();
    }
}

function package_visible(uuid, show) {
    packages[uuid].marker.setVisible(show);
    packages[uuid].polyline.setVisible(show);
    if (show) {
        $("#list li[data-id='" + uuid + "']").show();
    }
    else {
        $("#list li[data-id='" + uuid + "']").hide();
    }
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
            map.setZoom(2);
            trackingUUID = false;
            updateInfoBox();
        }
    });
    $(document).keydown(function(e) {
        if (e.keyCode == 114 || e.ctrlKey && e.keyCode === 70) {
            $("#search").focus();
            e.preventDefault();
        }
    });
    $("#list").on("click", "li", function(e) {
        e.preventDefault();
        onMarkerClick($(this).attr("data-id"));
    });
    $("#list").on("click", ".p-rename", function(e) {
        e.preventDefault();
        e.stopPropagation();
        var uuid = $(this).parent().parent().attr('data-id');
        var oldname = $(this).parent().parent().find('.name').text();
        var name = prompt('What should the new name for this package be?\n' + uuid, oldname);
        if (!name || name == oldname) {
            return;
        }
        package_rename(uuid, name);
    });
    $("#list").on("click", ".p-delete", function(e) {
        e.preventDefault();
        e.stopPropagation();
        var uuid = $(this).parent().parent().attr('data-id');
        if (!confirm('Are you sure you want to delete this package record?\n' + uuid)) {
            return;
        }
        package_delete(uuid);
    });
    $("#search").on('keyup blur paste', function() {
        if (!$(this).val()) {
            $("#list li").each(function(k, v) {
                package_visible($(this).attr('data-id'), true);
            });
        }
        else {
            $("#list li").each(function(k, v) {
                if ($(this).attr('data-id').indexOf($("#search").val()) <= -1 && $(this).text().indexOf($("#search").val()) <= -1) {
                    package_visible($(this).attr('data-id'), false);
                }
                else {
                    package_visible($(this).attr('data-id'), true);
                }
            });
        }
    });
});
