$(document).ready(function() {
    var table = $("#users").DataTable({
        "ajax": "/accounts/userdata",
        "autoWidth": false,
        "aoColumns": [
            {"mData": function() { return ""; }},
            {"mData": "username"},
            {"mData": "email"},
            {"mData": "type"}
        ],
        "columnDefs": [
            {
                "orderable": false,
                "width": "8px",
                "className": 'select-checkbox',
                "targets": 0
            },
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
            },
            {
                "render": function(data, type, row) {
                    return $("<div />").text(data).html();
                },
                "targets": [1, 2]
            }
        ],
        "order": [[1, "asc"]]
    });
    $("#btn-create").click(function(e) {
        $.post("/accounts/add", $("#user-form :input").serialize(), function(data) {
            if (data.error) {
                Messenger().post({
                    message: data.error,
                    type: "danger"
                });
            }
            else {
                table.ajax.reload(updateButtons);
                if (data.warning) {
                    Messenger().post({
                        message: data.warning,
                        type: "warning"
                    });
                }
                else {
                    Messenger().post({
                        message: "User account created!",
                        type: "success"
                    });
                }
            }
        }, 'json');
    });
    $("#btn-modify").click(function(e) {
        $.post("/accounts/modify", $("#user-form :input").serialize(), function(data) {
            if (data.error) {
                Messenger().post({
                    message: data.error,
                    type: "danger"
                });
            }
            else {
                table.ajax.reload(updateButtons);
                if (data.warning) {
                    Messenger().post({
                        message: data.warning,
                        type: "warning"
                    });
                }
                else {
                    Messenger().post({
                        message: "User account modified!",
                        type: "success"
                    });
                }
            }
        }, 'json');
    });
    $("#btn-delete").click(function(e) {
        $.post("/accounts/delete", $("#user-form :input").serialize(), function(data) {
            if (data.error) {
                Messenger().post({
                    message: data.error,
                    type: "danger"
                });
            }
            else {
                table.ajax.reload(updateButtons);
                if (data.warning) {
                    Messenger().post({
                        message: data.warning,
                        type: "warning"
                    });
                }
                else {
                    Messenger().post({
                        message: "User account(s) deleted!",
                        type: "success"
                    });
                }
            }
        }, 'json');
    });
    function perm_table_update() {
        $("#package-list").children().remove();
        $.getJSON("/accounts/permissions/" + ($("#id").val() ? $("#id").val() : "-1"), function(data) {
            $.each(data.packages, function(k, v) {
                $("#package-list").append("<div class='package-permission' data-id='" + v[2] + "'><span>" + v[0] + "</span><i class='fa fa-times pull-right'></i><i class='pull-right fa " + (v[1] ? 'fa-globe' : 'fa-user') + "'></i></div>");
            });
        });
    }
    $("#btn-permissions").click(function(e) {
        $("#uuid").typeahead('val', '');
        $("#bulk-uuid").val('');
        if (!$("#id").val()) {
            $("#perm-type, #bulk-perm-type").val("global").prop("disabled", true);
        }
        else {
            $("#perm-type, #bulk-perm-type").val("user").prop("disabled", false);
        }
        if ($("#users tr.selected").length == 1) {
            $("#permissions-user-name").text(table.row($("#users tr.selected")).data()["username"]);
            $("#permissions-user-info").show();
        }
        else if ($("#users tr.selected").length > 0) {
            $("#permissions-user-name").html("<span style='font-weight:normal'> one of the <b>" + $("#users tr.selected").length + "</b> users selected.<br />If you add a permission, it will apply to all users that are selected</span>");
            $("#permissions-user-info").show();
        }
        else {
            $("#permissions-user-info").hide();
        }
        perm_table_update();
    });
    $("#uuid").keypress(function(e) {
        if (e.keyCode == 13) {
            $("#uuid-add").click();
        }
    });
    $("#permissions-bulk-edit").on("click", function(e) {
        e.preventDefault();
        $("#permissions-bulk-edit-info, #single-permission-editing, #bulk-permission-editing").toggle();
    });
    $("#bulk-uuid-add").click(function(e) {
        e.preventDefault();
        var uuids = $("#bulk-uuid").val().split("\n");
        var errors = 0;
        var count = uuids.length;
        $("#bulk-uuid-add").prop("disabled", true);
        $.each(uuids, function(k, v) {
            $.post("/accounts/permissions/add", ($("#bulk-perm-type").val() == "user" ? $("#id, #bulk-perm-type").serialize() : "type=global&id=-1") + "&uuid=" + encodeURIComponent(v), function(data) {
                if (data.error) {
                    errors += 1;
                }
                count--;
                if (count <= 0) {
                    $("#bulk-uuid-add").prop("disabled", false);
                    Messenger().post({
                        message: "Bulk insertion complete! " + (uuids.length - errors) + "/" + uuids.length + " permission(s) added.",
                        type: errors == 0 ? "success" : (errors == uuids.length ? "danger" : "warning")
                    });
                }
            });
        });
    });
    $("#uuid-add").click(function(e) {
        $.post("/accounts/permissions/add", ($("#perm-type").val() == "user" ? $("#id, #uuid, #perm-type").serialize() : "type=global&id=-1&uuid=" + encodeURIComponent($("#uuid").val())), function(data) {
            if (data.error) {
                Messenger().post({
                    message: data.error,
                    type: "danger"
                });
                return;
            }
            if ($("#users tr.selected").length > 1) {
                $.each(data.id, function(v) {
                    var perm = "<div class='package-permission' data-id='" + v + "'><span>" + $("#uuid").val() + "</span><i class='fa fa-times pull-right'></i><i class='pull-right fa fa-" + ($("#perm-type").val() == "global" ? "globe" : "user") + "'></i></div>";
                    if ($("#perm-type").val() == "global") {
                        $("#package-list").append(perm);
                    }
                    else {
                        $("#package-list").prepend(perm);
                    }
                });
            }
            else {
                var perm = "<div class='package-permission' data-id='" + data.id + "'><span>" + $("#uuid").val() + "</span><i class='fa fa-times pull-right'></i><i class='pull-right fa fa-" + ($("#perm-type").val() == "global" ? "globe" : "user") + "'></i></div>";
                if ($("#perm-type").val() == "global") {
                    $("#package-list").append(perm);
                }
                else {
                    $("#package-list").prepend(perm);
                }
            }
        }, 'json').always(function() {
            $("#uuid").typeahead('val', '');
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
        updateButtons();
    });
    $("#users tbody").on("click", ".select-checkbox", function(e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).parent().toggleClass("selected");
        updateButtons();
    });
    $("#password-edit").click(function(e) {
        $("#password").prop("disabled", false).val("").focus();
        $("#password-opt").hide();
    });
    function generateRandomPassword(length) {
        var chars = "abcdefghijklmnopqrstuvwxyz!@#$%^&*()-+ABCDEFGHIJKLMNOP1234567890";
        var pass = "";
        if (window.crypto) {
            try {
                var secArray = new Uint32Array(length);
                window.crypto.getRandomValues(secArray);
                for (var x = 0; x < length; x++) {
                    pass += chars[secArray[x] % chars.length];
                }
                return pass;
            }
            catch (err) { }
        }
        for (var x = 0; x < length; x++) {
            var i = Math.floor(Math.random() * chars.length);
            pass += chars.charAt(i);
        }
        return pass;
    }
    $("#password-generate").click(function(e) {
        $("#password").prop("disabled", false).attr("type", "text").val(generateRandomPassword(16)).focus();
        $("#password-opt").hide();
    });
    function updateButtons() {
        var ids = [];
        $.each($("#users tr.selected"), function(k, v) {
            ids.push(table.row(this).data()["id"]);
        });
        $("#id").val(ids.join());
        $("#btn-delete").text("Delete Account");
        $("#username, #type, #email").prop("disabled", false);
        var items = $("#users tr.selected").length;
        $("#password").attr("type", "password");
        $("#password-opt").hide();
        if (items == 0) {
            $("#username, #email, #password").val("");
            $("#btn-permissions, #btn-create, #password").prop("disabled", false);
            $("#btn-modify, #btn-delete").prop("disabled", true);
        }
        else if (items == 1) {
            var row = $("#users tr.selected")[0];
            $("#password-opt").show();
            $("#btn-create, #password").prop("disabled", true);
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
            $("#password").prop("disabled", true).val("");
            $("#btn-create, #btn-modify").prop("disabled", true);
            $("#btn-permissions, #btn-delete").prop("disabled", false);
            $.each($("#users tr.selected"), function(k, v) {
                if (table.row(this).data()["type"] > 0) {
                    $("#btn-permissions").prop("disabled", true);
                    return false;
                }
            });
            $("#btn-delete").text("Delete Accounts");
        }
    }
    var substringMatcher = function(strs) {
        return function findMatches(q, cb) {
            if (q == '') {
                cb(strs);
                return;
            }
            var matches, substringRegex;

            matches = [];

            substrRegex = new RegExp(q, 'i');

            $.each(strs, function(i, str) {
                $.each(str, function(i, piece) {
                    if (substrRegex.test(piece)) {
                        matches.push(str);
                        return false;
                    }
                });
            });

            cb(matches);
        };
    };
    $.getJSON('/getpackages', function(data) {
        var uuids = [];
        $.each(data.data, function(k, v) {
            uuids.push([v[0], v[1]]);
        });
        $("#uuid").typeahead({
            hint:true,
            highlight:true,
            minLength:0
        }, {
            name:'uuids',
            source:substringMatcher(uuids),
            displayKey: function(data) {
                return data[0];
            },
            templates: {
                suggestion: function(data) {
                    return '<div>' + data[1] + '<div style="font-family:monospace">' + data[0] + '</div></div>';
                }
            }
        });
    });
});
