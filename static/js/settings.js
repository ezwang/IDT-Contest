$(document).ready(function() {
    var s_zoom = $.cookie('s_zoom') || 12;
    var s_type = $.cookie('s_type') || 'roadmap';
    function update() {
        $("#s_type .btn").addClass("btn-secondary").removeClass("btn-primary");
        $("#s_type .btn").filter(function() { return $(this).text().toLowerCase().indexOf(s_type) > -1; }).toggleClass("btn-primary btn-secondary");
        $("#s_zoom").val(s_zoom);
    }
    update();
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
});
