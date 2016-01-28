$(document).ready(function() {
    var s_zoom = $.cookie('s_zoom') || 12;
    var s_type = $.cookie('s_type') || 'roadmap';
    var s_units = $.cookie('s_units') || 'km';
    function update() {
        $("#s_type .btn").addClass("btn-secondary").removeClass("btn-primary");
        $("#s_type .btn").filter(function() { return $(this).text().toLowerCase().indexOf(s_type) > -1; }).toggleClass("btn-primary btn-secondary");
        $("#s_zoom").val(s_zoom);
        $("input[type=radio][name=s_units][value='" + s_units + "']").attr("checked", true);
    }
    update();
    // TODO: save these on the server too
    $("#s_type .btn").click(function(e) {
        s_type = $(this).text().toLowerCase();
        $.cookie("s_type", s_type);
        update();
    });
    $("#s_zoom").change(function(e) {
        s_zoom = $(this).val();
        $.cookie("s_zoom", s_zoom);
        update();
    });
    $("input[type=radio][name=s_units]").change(function(e) {
        s_units = $(this).val();
        $.cookie("s_units", s_units);
        update();
    });
    if ($.cookie('s_nodeleteconfirm') == 'true') {
        $("#s_deleteconfirm_container").show();
    }
    $("#s_deleteconfirm").click(function(e) {
        e.preventDefault();
        $.cookie('s_nodeleteconfirm', false);
        $("#s_deleteconfirm_container").slideUp();
    });
});
