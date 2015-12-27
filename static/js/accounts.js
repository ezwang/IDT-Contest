$(document).ready(function() {
    $("#users").DataTable({
        "ajax": "/accounts/userdata",
        "autoWidth": false,
        "columnDefs": [
            {
                "render": function(data, type, row) {
                    if (data > 0) {
                        return 'Administrator';
                    }
                    else {
                        return 'Normal User';
                    }
                },
                "targets": -1
            }
        ]
    });
    $("#users tbody").on("click", "tr", function(e) {
        $(this).toggleClass("selected");
    });
});
