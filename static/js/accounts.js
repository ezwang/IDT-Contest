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
    function perm_table_update() {
        $("#package-list").children().remove();
        $.getJSON("/accounts/permissions/" + $("#id").val(), function(data) {
            $.each(data.packages, function(k, v) {
                $("#package-list").append("<div class='package-permission' data-id='" + v[2] + "'><span>" + v[0] + "</span><i class='fa fa-times pull-right'></i><i class='pull-right fa " + (v[1] ? 'fa-globe' : 'fa-user') + "'></i></div>");
            });
        });
    }
    $("#btn-permissions").click(function(e) {
        perm_table_update();
    });
    $("#uuid").keypress(function(e) {
        if (e.keyCode == 13) {
            $("#uuid-add").click();
        }
    });
    var permtimeoutid = false;
    $("#uuid-add").click(function(e) {
        if (permtimeoutid) {
            clearTimeout(permtimeoutid);
            permtimeoutid = false;
        }
        $.post("/accounts/permissions/add", $("#id, #uuid, #perm-type").serialize(), function(data) {
            if (data.error) {
                $("#perm-info").text(data.error).slideDown();
                permtimeoutid = setTimeout(function() {
                    $("#perm-info").slideUp();
                }, 3000);
                return;
            }
            var perm = "<div class='package-permission' data-id='" + data.id + "'><span>" + $("#uuid").val() + "</span><i class='fa fa-times pull-right'></i><i class='pull-right fa fa-" + ($("#perm-type").val() == "global" ? "globe" : "user") + "'></i></div>";
            if ($("#perm-type").val() == "global") {
                $("#package-list").append(perm);
            }
            else {
                $("#package-list").prepend(perm);
            }
        }, 'json').always(function() {
            $("#uuid").val("");
        });
    });
    $("#package-list").on("click", ".fa-times", function() {
        var a = $(this);
        $.getJSON("/accounts/permissions/remove/" + $(this).parent().data("id"), function(data) {
            a.parent().remove();
        });
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
            if (table.row(row).data()["type"] > 0) {
                $("#btn-permissions").prop("disabled", true);
            }
            $("#username").val(table.row(row).data()["username"]);
            $("#email").val(table.row(row).data()["email"]);
            $("#type option[value='" + table.row(row).data()["type"] + "']").prop("selected", true);
        }
        else {
            $("#username, #type, #email").prop("disabled", true).val("(Multiple Accounts)");
            $("#btn-permissions, #btn-create, #btn-modify").prop("disabled", true);
            $("#btn-delete").prop("disabled", false);
            $("#btn-delete").text("Delete Accounts");
        }
    }
});
