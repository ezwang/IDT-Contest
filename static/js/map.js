jQuery.timeago.settings.allowFuture = true;

var packages = {};
// TODO: better check for mobile devices
var mobile = window.innerWidth <= 480;
var is_admin = false;
var default_zoom = mobile ? 1 : 2;

var s_zoom_amount = parseInt($.cookie('s_zoom')) || 12;
var s_map_type = $.cookie('s_type') || "roadmap";

function escapeHtml(text) {
    var map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };

    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

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
    }),delivered:delivered, destination:new google.maps.LatLng(dLat, dLon), unloaded:false, speedData:{coords1:null, coords2:null, time1:null, time2:null}};
    $("#list").append("<li data-id='" + uuid + "'><i class='fa-li fa fa-archive'></i> <span class='name'>" + escapeHtml(name) + "</span>" + (is_admin ? "<span class='opt'><i class='p-rename fa fa-pencil'></i></span>" : "") + "</li>");
    if (delivered) {
        setDelivered(uuid);
    }
    packages[uuid].marker.addListener('click', function() {
        onMarkerClick(uuid);
    });
    updatePackageCount();
}

function updatePackageCount() {
    $("#package_count").text(" (" + $("#list li").length + " total)");
    if ($("#list").children("li:hidden").length > 0) {
        $("#package_count").text(" (" + $("#list li:visible").length + " visible, " + $("#list li").length + " total)");
    }
}

var trackingUUID = false;

function onMarkerClick(uuid) {
    trackingUUID = uuid;
    if (packages[uuid].unloaded) {
        loadPoints(uuid);
        packages[uuid].unloaded = false;
    }
    map.panTo(packages[uuid].marker.getPosition());
    map.setZoom(s_zoom_amount);
    updateInfoBox();
}

function distance(lat1, lng1, lat2, lng2) { 
    return 2 * 6371 * Math.asin(Math.sqrt(Math.pow(Math.sin((lat2-lat1)/2), 2) + Math.cos(lat1)*Math.cos(lat2)*Math.pow(Math.sin((lng2-lng1)/2), 2)));
}

function updateDistanceCalculations(uuid) {
    if (uuid != trackingUUID) {
        return;
    }
    $("#packageinfo #peta").text("Loading...");
    if (packages[trackingUUID].polyline.getPath().getLength() == 0) {
        setTimeout(function() {
            updateDistanceCalculations(uuid);
        }, 100);
        return;
    }
    // TODO: remote total_dist_traveled if not using it
    var total_dist_traveled = 0;
    var path = packages[trackingUUID].polyline.getPath();
    for (var i=1; i<path.getLength(); i++) {
        var lat1 = path.getAt(i-1).lat(), lng1 = path.getAt(i-1).lng();
        var lat2 = path.getAt(i).lat(), lng2 = path.getAt(i).lng();
        // TODO: account for elevation in kilometers
        total_dist_traveled += distance(lat1, lng1, lat2, lng2);
    }
    // TODO: better eta
    var currentSpeed = speed(uuid);
    var lastPoint = path.getAt(path.getLength()-1);
    $("#packageinfo #pspeed").text(Math.round(currentSpeed * 100)/100 + " km/h");
    $("#packageinfo #pmethod").html("");
    if (lastPoint.ele > 60000) {
        $("#packageinfo #pmethod").append("<i class='fa fa-rocket'></i>");
    }
    else if (lastPoint.ele > 9000) {
        $("#packageinfo #pmethod").append("<i class='fa fa-plane'></i>");
    }
    else {
        if (currentSpeed < 20) {
            $("#packageinfo #pmethod").append("<i class='fa fa-bicycle'></i>");
        }
        else {
            $("#packageinfo #pmethod").append("<i class='fa fa-truck'></i>");
        }
        $("#packageinfo #pmethod").append(" / <i class='fa fa-ship'></i>");
    }
    if (currentSpeed > 0) {
        var dist_left = distance(packages[trackingUUID].destination.lat(), packages[trackingUUID].destination.lng(), lastPoint.lat(), lastPoint.lng());
        var finDate = new Date(packages[trackingUUID].speedData.time2*1000);
        finDate.setSeconds(dist_left*60*60/currentSpeed);
        $("#packageinfo #peta").text(/*Math.round(total_dist_traveled) + " km traveled, " + Math.round(currentSpeed) + " km/h, " + Math.round(dist_left) + " km left, " + */jQuery.timeago(finDate));
    }
    else {
        $("#packageinfo #peta").text("Unknown");
    }
}

function speed(uuid) {
    if (uuid in packages) {
        if (!packages[uuid].speedData.time2) {
            return 0;
        }
        return distance(packages[uuid].speedData.coords1[0], packages[uuid].speedData.coords1[1], packages[uuid].speedData.coords2[0], packages[uuid].speedData.coords2[1]) / (packages[uuid].speedData.time2 - packages[uuid].speedData.time1) * 60 * 60;
    } 
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
    if (packages[trackingUUID].delivered) {
        $("#packageinfo #peta-container, #pspeed-container").hide();
    }
    else {
        $("#packageinfo #peta-container, #pspeed-container").show();
        updateDistanceCalculations(trackingUUID);
    }
    if (mobile) {
        scale_sidebar();
    }
}

function addPoint(uuid, lat, lon, ele, time) {
    time = Date.parse(time)/1000;
    if (uuid in packages) {
        var path = packages[uuid].polyline.getPath();
        var pos = new google.maps.LatLng(lat,lon);
        pos.ele = ele;
        path.push(pos);
        if (!packages[uuid].delivered) {
            packages[uuid].marker.setPosition(pos);
            packages[uuid].speedData.coords1 = packages[uuid].speedData.coords2;
            packages[uuid].speedData.coords2 = [lat, lon];
            packages[uuid].speedData.time1 = packages[uuid].speedData.time2;
            packages[uuid].speedData.time2 = time;
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
        if (is_admin) {
            $("#list li[data-id='" + uuid + "'] .opt").append("<i class='p-delete fa fa-times'></i>");
        }
        packages[uuid].marker.setPosition(packages[uuid].destination);
        if (uuid == trackingUUID) {
            updateInfoBox();
        }
    }
    else {
        console.warn('Package with UUID ' + uuid + 'was not initalized!');
    }
}

function loadPoints(uuid) {
    $.getJSON('/getpackage/' + uuid, function(data) {
        $.each(data.data, function(k, v) {
            addPoint(uuid, v[0], v[1], v[2], v[3]);
        });
    });
}

var map;
var socket;
function initMap() {
    map = new google.maps.Map(document.getElementById('map'), {
        center: {lat: 0, lng: 0},
        zoom: default_zoom,
        streetViewControl: false,
        mapTypeControl: false,
        zoomControl: !mobile,
        mapTypeId: s_map_type
    });
    map.addListener('drag', function() {
        trackingUUID = false;
    });
    $.getJSON('/getpackages', function(data) {
        $.each(data.data, function(k, v) {
            var uuid = v[0];
            addPackage(uuid, v[1], v[2], v[3], v[4]);
            if (v[2]) {
                packages[uuid].unloaded = true;
            }
            else {
                loadPoints(uuid);
            }
        });
    });
    socket = io.connect('//' + document.domain + ':' + location.port);
    socket.on('newpackage', function(data) {
        addPackage(data.uuid, data.name, false, data.dest[0], data.dest[1]);
    });
    socket.on('packagedelivered', function(data) {
        setDelivered(data.uuid);
    });
    socket.on('deletepackage', function(data) {
        package_delete(data.uuid, true);
    });
    socket.on('renamepackage', function(data) {
        package_rename(data.uuid, data.name, true);
    });
    socket.on('refresh', function(data) {
        location.reload();
    });
    socket.on('plot', function(data) {
        addPoint(data.uuid, data.lat, data.lon, data.ele, data.time);
    });
}

function package_delete(uuid, client_only) {
    client_only = client_only || false;
    if (!(uuid in packages)) {
        return;
    }
    $("#list li[data-id='" + uuid + "']").remove();
    packages[uuid].marker.setMap(null);
    packages[uuid].polyline.setMap(null);
    delete packages[uuid];
    if (!client_only) {
        $.get("/map/delete_package/" + uuid, function(data) {});
    }
    if (trackingUUID == uuid) {
        trackingUUID = false;
        updateInfoBox();
    }
    updatePackageCount();
}

function package_rename(uuid, name, client_only) {
    client_only = client_only || false;
    if (!(uuid in packages)) {
        return;
    }
    $("#list li[data-id='" + uuid + "'] .name").text(name);
    packages[uuid].name = name;
    packages[uuid].marker.setTitle(name);
    if (!client_only) {
        $.post("/map/rename_package/" + uuid, "name=" + encodeURIComponent(name), function(data) {});
    }
    if (trackingUUID == uuid) {
        updateInfoBox();
    }
    $("#list").children().detach().sort(function(a, b) {
        return $(a).text().localeCompare($(b).text());
    }).appendTo($("#list"));
}

function package_visible(uuid, show) {
    if ($("#list li[data-id='" + uuid + "']").is(":visible") == show || !(uuid in packages)) {
        return;
    }
    packages[uuid].marker.setVisible(show);
    packages[uuid].polyline.setVisible(show);
    if (show) {
        $("#list li[data-id='" + uuid + "']").show();
    }
    else {
        $("#list li[data-id='" + uuid + "']").hide();
    }
}

function scale_sidebar() {
    var val = $(window).height()-$("#member").height()-$("#logo_padding").height()-$("#search").height()-90;
    if (window.innerWidth <= 480) {
        val -= $("#packageinfo").height() + 30;
    }
    $("#packagelist .message").css("max-height", val);
}

$(document).ready(function() {
    if ($("#is_admin").text() == "True") {
        is_admin = true;
    }
    if (mobile) {
        $("#escapeOutKey").html("<i class='fa fa-search-minus'></i>");
    }
    if (!$("#userid").text()) {
        $("#guest").show();
    }
    else {
        $("#member").show();
    }
    function escapeOut() {
        map.panTo(new google.maps.LatLng(0, 0));
        map.setZoom(default_zoom);
        trackingUUID = false;
        updateInfoBox();
    }
    $(document).keyup(function(e) {
        if (e.keyCode == 27) {
            escapeOut();
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
        // TODO: prettier rename prompt
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
        // TODO: prettier confirm, or undo function
        if (!confirm('Are you sure you want to delete this package record?\n' + uuid)) {
            return;
        }
        package_delete(uuid);
    });
    $(window).resize(function() {
        scale_sidebar();
    });
    $("#toggle").click(function() {
        $("#sidebar, #packageinfo, #searchbox").toggle('slide', {direction:'left'}, 500);
    });
    $("#zoomout").click(function() {
        escapeOut();
    });
    scale_sidebar();
    $("#search").on('keyup blur paste', function() {
        if (!$(this).val()) {
            $("#list li").each(function(k, v) {
                package_visible($(this).attr('data-id'), true);
            });
        }
        else {
            $("#list li").each(function(k, v) {
                if ($(this).attr('data-id').indexOf($("#search").val()) > -1 || $(this).text().indexOf($("#search").val()) > -1) {
                    package_visible($(this).attr('data-id'), true);
                }
                else {
                    package_visible($(this).attr('data-id'), false);
                }
            });
        }
        updatePackageCount();
    });
});
