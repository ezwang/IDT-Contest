jQuery.timeago.settings.allowFuture = true;

var packages = {};
// TODO: better check for mobile devices
var mobile = window.innerWidth <= 480;
var is_admin = false;
var can_edit = false;
var default_zoom = mobile ? 1 : 2;

var s_zoom_amount = parseInt($.cookie('s_zoom')) || 12;
var s_map_type = $.cookie('s_type') || "roadmap";
var s_display_units = $.cookie('s_units') || "km";

var km_to_mi = 0.62137119;

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

function canAccess(uuid) {
    if (is_admin) {
        return true;
    }
    if (!can_edit) {
        return false;
    }
    return packages[uuid].global;
}

function addPackage(uuid, name, delivered, dLat, dLon, global) {
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
    }),delivered:delivered, destination:new google.maps.LatLng(dLat, dLon), unloaded:false, speedData:{coords1:null, coords2:null, time1:null, time2:null}, global:global};
    $("#list").append("<li data-id='" + uuid + "'><i class='fa-li fa fa-archive'></i> <span class='name'>" + escapeHtml(name) + "</span>" + (canAccess(uuid) ? "<span class='opt'><i class='p-rename fa fa-pencil'></i></span>" : "") + "</li>");
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
    $("#list").removeClass("noresults");
    if ($("#list").children("li:hidden").length > 0) {
        $("#package_count").text(" (" + $("#list li:visible").length + " visible, " + $("#list li").length + " total)");
        if ($("#list li:visible").length == 0) {
            $("#list").addClass("noresults");
        }
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
    var dist_left = distance(packages[trackingUUID].destination.lat(), packages[trackingUUID].destination.lng(), lastPoint.lat(), lastPoint.lng());
    if (s_display_units == "km") {
        $("#packageinfo #pdist").text(Math.round(dist_left) + " km");
        $("#packageinfo #pspeed").text(Math.round(currentSpeed) + " km/h");
    }
    else {
        $("#packageinfo #pdist").text(Math.round(dist_left * km_to_mi) + " mi");
        $("#packageinfo #pspeed").text(Math.round(currentSpeed * km_to_mi) + " mi/h");
    }
    $("#packageinfo #pmethod").html("");
    if (lastPoint.ele > 70000) {
        $("#packageinfo #pmethod").append("<i title='Rocket' class='fa fa-rocket'></i>");
    }
    else if (lastPoint.ele > 9000) {
        $("#packageinfo #pmethod").append("<i title='Plane' class='fa fa-plane'></i>");
    }
    else {
        if (currentSpeed < 5) {
            $("#packageinfo #pmethod").append("<i title='Walk' class='fa fa-male'></i>");
        }
        else if (currentSpeed < 20) {
            $("#packageinfo #pmethod").append("<i title='Bicycle' class='fa fa-bicycle'></i>");
        }
        else if (currentSpeed < 2000) {
            $("#packageinfo #pmethod").append("<i title='Truck' class='fa fa-truck'></i>");
        }
        else {
            $("#packageinfo #pmethod").append("<i title='Unknown' class='fa fa-question'>");
        }
        if (currentSpeed < 2000) {
            $("#packageinfo #pmethod").append(" / <i title='Boat' class='fa fa-ship'></i>");
        }
    }
    if (currentSpeed > 0) {
        var finDate = new Date(packages[trackingUUID].speedData.time2*1000);
        finDate.setSeconds(dist_left*60*60/currentSpeed);
        $("#packageinfo #peta").text(jQuery.timeago(finDate));
    }
    else {
        $("#packageinfo #peta").text("Unknown");
    }
}

function speed(uuid) {
    if (uuid in packages) {
        if (!packages[uuid].speedData.time2 || !packages[uuid].speedData.coords2) {
            return 0;
        }
        return distance(packages[uuid].speedData.coords1[0], packages[uuid].speedData.coords1[1], packages[uuid].speedData.coords2[0], packages[uuid].speedData.coords2[1]) / (packages[uuid].speedData.time2 - packages[uuid].speedData.time1) * 60 * 60;
    } 
}

function round(num, decimals) {
    return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

var geocoding_enabled = true;

function requestGeocoding(curUUID) {
    $.getJSON("/packageaddress/" + encodeURIComponent(curUUID), function(data) {
        if (data.status == "disabled") {
            geocoding_enabled = false;
            return;
        }
        if (data.status == "empty") {
            packages[curUUID].destinationAddress = false;
            return;
        }
        if (data.status == "pending") {
            setTimeout(function() {
                requestGeocoding(curUUID);
            }, 1000);
            return;
        }
        packages[curUUID].destinationAddress = data.location;
        if (curUUID == trackingUUID) {
            $("#packageinfo #pdest").text(data.location);
        }
    });
}

function pad (str, max) {
    str = str.toString();
    return str.length < max ? pad("0" + str, max) : str;
}

function updateTimeTaken(uuid) {
    if (uuid != trackingUUID) {
        return;
    }
    var path = packages[trackingUUID].polyline.getPath();
    if (path.getLength() < 2) {
        setTimeout(function() {
            updateTimeTaken(uuid);
        }, 1000);
        return;
    }
    var firstPoint = path.getAt(0).time;
    var lastPoint = path.getAt(path.getLength()-1).time;
    var seconds = lastPoint - firstPoint;
    var days = Math.floor(seconds / 86400);
    seconds -= days*86400;
    var hours = Math.floor(seconds / 3600);
    seconds -= hours*3600;
    var minutes = Math.floor(seconds / 60);
    seconds -= minutes*60;
    $("#packageinfo #ptaken").text(days + " " + (days == 1 ? 'day' : 'days') + " " + pad(hours, 2) + ":" + pad(minutes, 2) + ":" + pad(seconds, 2));
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
    if (packages[trackingUUID].destinationAddress) {
        $("#packageinfo #pdest").text(packages[trackingUUID].destinationAddress);
    }
    else {
        $("#packageinfo #pdest").text("(" + round(packages[trackingUUID].destination.lat(), 3) + ", " + round(packages[trackingUUID].destination.lng(), 3) + ")");
        if (geocoding_enabled) {
            if (typeof packages[trackingUUID].destinationAddress === 'undefined') {
                var curUUID = trackingUUID;
                requestGeocoding(curUUID);
            }
        }
    }
    $("#packageinfo #pstatus").text(packages[trackingUUID].delivered ? 'Delivered' : 'In Transit');
    if (packages[trackingUUID].delivered) {
        $("#packageinfo #ptransit-container").hide();
        $("#packageinfo #pdelivered-container").show();
        $("#packageinfo #ptaken").html("<i class='fa fa-circle-o-notch fa-spin'></i>");
        updateTimeTaken(trackingUUID);
    }
    else {
        $("#packageinfo #ptransit-container").show();
        $("#packageinfo #pdelivered-container").hide();
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
        pos.time = time;
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
            // TODO: move this to the initial load instead of on every point
            if (Math.abs(time - new Date().getTime()/1000) > 3600*24*30) {
                addPackageDeleteButton(uuid);
            }
            else {
                addPackageDeleteButton(uuid, true);
            }
        }
    }
    else {
        console.warn('Package with UUID ' + uuid + ' was not initalized!');
    }
}

function addPackageDeleteButton(uuid, remove) {
    remove = remove || false;
    if (remove) {
        $("#list li[data-id='" + uuid + "'] .opt .p-delete").remove();
    }
    else if (canAccess(uuid)) {
        if ($("#list li[data-id='" + uuid + "']").has(".p-delete").length == 0) {
            $("#list li[data-id='" + uuid + "'] .opt").append("<i class='p-delete fa fa-times'></i>");
        }
    }
}

function setDelivered(uuid) {
    if (uuid in packages) {
        packages[uuid].delivered = true;
        packages[uuid].marker.setIcon('http://maps.google.com/mapfiles/ms/icons/blue-dot.png');
        $("#list li[data-id='" + uuid + "']>i").addClass('fa-check').removeClass('fa-archive');
        addPackageDeleteButton(uuid);
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
            // TODO: return package permissions
            addPackage(uuid, v[1], v[2], v[3], v[4], v[5]);
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
        addPackage(data.uuid, data.name, false, data.dest[0], data.dest[1], data.global);
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
        $.getJSON("/map/delete_package/" + uuid, function(data) {
            if (data.error) {
                // TODO: better error message
                alert(data.error);
            }
        });
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
        $.post("/map/rename_package/" + uuid, "name=" + encodeURIComponent(name), function(data) {
            if (data.error) {
                // TODO: better error message
                alert(data.error);
            }
        }, 'json');
    }
    if (trackingUUID == uuid) {
        updateInfoBox();
    }
    $("#list").children().detach().sort(function(a, b) {
        return $(a).text().localeCompare($(b).text());
    }).appendTo($("#list"));
}

function package_visible(uuid, show) {
    if (!(uuid in packages) || $("#list li[data-id='" + uuid + "']").is(":visible") == show) {
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

var mobile_keyboard_hide = false;

function scale_sidebar() {
    var val = $(window).height()-$("#logo_padding").height()-$("#search").height() - 65 - $("#packagelist .title").height();
    if ($("#guest").is(":visible")) {
        val -= $("#guest").height();
    }
    else {
        val -= $("#member").height();
    }
    // put package info on left if mobile device
    if (window.innerWidth <= 480) {
        val -= $("#packageinfo").height() + 30;
        // compensate for onscreen keyboard height on mobile
        if ($(".rename-prompt:focus").length > 0) {
            val += $("#member").height() + $("#packageinfo").height();
            $("#packageinfo, #member").hide();
            mobile_keyboard_hide = true;
        }
        else if (mobile_keyboard_hide) {
            $("#packageinfo, #member").show();
            mobile_keyboard_hide = false;
        }
    }
    $("#packagelist .message").css("max-height", val);
}

$(document).ready(function() {
    if ($("#is_admin").text() == "True") {
        is_admin = true;
    }
    if ($("#can_edit").text() == "True") {
        can_edit = true;
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
    $("#list").on("keyup", ".rename-prompt", function(e) {
        var uuid = $(this).parent().parent().attr('data-id');
        var oldname = $(this).attr('data-old');
        if (e.keyCode == 27) {
            $("#list li[data-id='" + uuid + "'] .name").text(oldname);
            $("#list li[data-id='" + uuid + "'] .p-rename").addClass("fa-pencil").removeClass("fa-check");
            e.preventDefault();
            e.stopPropagation();
        }
        if (e.keyCode == 13) {
            var newname = $("#list li[data-id='" + uuid + "'] .name input").val();
            $("#list li[data-id='" + uuid + "'] .p-rename").addClass("fa-pencil").removeClass("fa-check");
            if (newname && newname != oldname) {
                package_rename(uuid, newname);
            }
            else {
                $("#list li[data-id='" + uuid + "'] .name").text(oldname);
            }
        }
    });
    $("#list").on("click", ".rename-prompt", function(e) {
        e.preventDefault();
        e.stopPropagation();
    });
    $("#list").on("click", ".p-rename", function(e) {
        e.preventDefault();
        e.stopPropagation();
        var uuid = $(this).parent().parent().attr('data-id');
        if ($("#list li[data-id='" + uuid + "'] .name .rename-prompt").length > 0) {
            var oldname = $("#list li[data-id='" + uuid + "'] .name input").attr('data-old');
            var newname = $("#list li[data-id='" + uuid + "'] .name input").val();
            $(this).addClass("fa-pencil").removeClass("fa-check");
            if (newname && newname != oldname) {
                package_rename(uuid, newname);
            }
            else {
                $("#list li[data-id='" + uuid + "'] .name").text(oldname);
            }
            return;
        }
        $(this).addClass("fa-check").removeClass("fa-pencil");
        var oldname = $(this).parent().parent().find('.name').text();
        $("#list li[data-id='" + uuid + "'] .name").html("<input class='rename-prompt' type='text' />");
        $("#list li[data-id='" + uuid + "'] .name input").val(oldname).attr('data-old', oldname).focus().select();
    });
    $("#deleteModal-confirm").click(function(e) {
        if ($("#deleteModal-prompt").is(":checked")) {
            $.cookie("s_nodeleteconfirm", true);
        }
        package_delete($("#deleteModal-uuid").text());
        $("#deleteModal").modal('hide');
    });
    $("#list").on("click", ".p-delete", function(e) {
        e.preventDefault();
        e.stopPropagation();
        var uuid = $(this).parent().parent().attr('data-id');
        if ($("#list li[data-id='" + uuid + "'] .name .rename-prompt").length > 0) {
            var oldname = $("#list li[data-id='" + uuid + "'] .name input").attr('data-old');
            $("#list li[data-id='" + uuid + "'] .p-rename").addClass("fa-pencil").removeClass("fa-check");
            $("#list li[data-id='" + uuid + "'] .name").text(oldname);
            return;
        }
        if ($.cookie("s_nodeleteconfirm") != "true") {
            $("#deleteModal-delivered").toggle(!packages[uuid].delivered);
            $("#deleteModal-name").text($("#list li[data-id='" + uuid + "'] .name").text());
            $("#deleteModal-uuid").text(uuid);
            $("#deleteModal").modal('show');
        }
        else {
            package_delete(uuid);
        }
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
            var term = $("#search").val().toLowerCase().split(",");
            var sort_delivered = false;
            var sort_transit = false;
            $.each(term, function(k, v) {
                if (v.indexOf("delivered") > -1) {
                    sort_delivered = true;
                }
                if (v.indexOf("transit") > -1) {
                    sort_transit = true;
                }
            });
            $("#list li").each(function(k, v) {
                var is_visible = false;
                var a = $(this);
                $.each(term, function(k, v) {
                    if (a.attr('data-id').indexOf(v) > -1 || a.text().toLowerCase().indexOf(v) > -1) {
                        is_visible = true;
                        return false;
                    }
                });
                var delivered = packages[$(this).attr('data-id')].delivered;
                if (sort_delivered && delivered) {
                    is_visible = true;
                }
                if (sort_transit && !delivered) {
                    is_visible = true;
                }
                package_visible($(this).attr('data-id'), is_visible);
            });
        }
        updatePackageCount();
    });
});
