$(document).ready(function() {
    var table = $("#users").DataTable({
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
        if (e.shiftKey) {
            $("#users tr.selected:first").nextUntil(this).toggleClass("selected");
            $(this).toggleClass("selected");
            e.preventDefault();
        }
        else {
            var selected = $(this).hasClass("selected");
            if (!e.ctrlKey) {
                if ($("#users tr.selected").length > 1) {
                    selected = false;
                }
                $("#users tr.selected").removeClass("selected");
            }
            if (selected) {
                $(this).removeClass("selected");
            }
            else {
                $(this).addClass("selected");
            }
        }
        var items = $("#users tr.selected").length;
        $("#btn-delete").text("Delete Account");
        $("#username, #type, #email").prop("disabled", false);
        if (items == 0) {
            $("#username, #email").val("");
            $("#btn-create").prop("disabled", false);
            $("#btn-permissions, #btn-modify, #btn-delete").prop("disabled", true);
        }
        else if (items == 1) {
            $("#btn-create").prop("disabled", true);
            $("#btn-permissions, #btn-modify, #btn-delete").prop("disabled", false);
            $("#username").val(table.row(this).data()[0]);
            $("#email").val(table.row(this).data()[1]);
            $("#type option[value='" + table.row(this).data()[2] + "']").prop("selected", true);
        }
        else {
            $("#username, #type, #email").prop("disabled", true).val("(Multiple Accounts)");
            $("#btn-create, #btn-modify").prop("disabled", true);
            $("#btn-permissions, #btn-delete").prop("disabled", false);
            $("#btn-delete").text("Delete Accounts");
        }
    });
});
