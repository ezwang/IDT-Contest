$(document).ready(function() {
    var table = $("#users").DataTable({
        "ajax": "/accounts/userdata",
        "autoWidth": false,
        "aoColumns": [
            {"mData": "username"},
            {"mData": "email"},
            {"mData": "type"}
        ],
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
    $("#btn-create").click(function(e) {
        $.post("/accounts/add_account", $("#user-form :input").serialize(), function(data) {
            // TODO: update data table more efficiently
            table.ajax.reload(updateButtons);
        }, 'json');
    });
    $("#btn-modify").click(function(e) {
        $.post("/accounts/modify_account", $("#user-form :input").serialize(), function(data) {
            // TODO: update data table more efficiently
            table.ajax.reload(updateButtons);
        }, 'json');
    });
    $("#btn-delete").click(function(e) {
        $.post("/accounts/delete_account", $("#user-form :input").serialize(), function(data) {
            // TODO: update data table more efficiently
            table.ajax.reload(updateButtons);
        }, 'json');
    });
    $("#btn-permissions").click(function(e) {
        // TODO: load permission data
    });
    $("#modal-permissions-save").click(function(e) {
        // TODO: save permission data
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
        var ids = [];
        $.each($("#users tr.selected"), function(k, v) {
            ids.push(table.row(this).data()["id"]);
        });
        $("#id").val(ids.join());
        $("#btn-delete").text("Delete Account");
        $("#username, #type, #email").prop("disabled", false);
        updateButtons();
    });
    function updateButtons() {
        var items = $("#users tr.selected").length;
        if (items == 0) {
            $("#username, #email").val("");
            $("#btn-create").prop("disabled", false);
            $("#btn-permissions, #btn-modify, #btn-delete").prop("disabled", true);
        }
        else if (items == 1) {
            var row = $("#users tr.selected")[0];
            $("#btn-create").prop("disabled", true);
            $("#btn-permissions, #btn-modify, #btn-delete").prop("disabled", false);
            $("#username").val(table.row(row).data()["username"]);
            $("#email").val(table.row(row).data()["email"]);
            $("#type option[value='" + table.row(row).data()["type"] + "']").prop("selected", true);
        }
        else {
            $("#username, #type, #email").prop("disabled", true).val("(Multiple Accounts)");
            $("#btn-create, #btn-modify").prop("disabled", true);
            $("#btn-permissions, #btn-delete").prop("disabled", false);
            $("#btn-delete").text("Delete Accounts");
        }
    }
});
