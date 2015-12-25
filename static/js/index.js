$(document).ready(function() {
    $("form").submit(function(e) {
        e.preventDefault();
        var valid = true;
        $(this).find('.form-group').removeClass('has-danger');
        $.each($(this).find('input'), function(k, v) {
            if (!$(this).val()) {
                valid = false;
                $(this).parent().addClass('has-danger');
            }
        });
        if (!valid) {
            return;
        }
        var a = $(this);
        $.post($(this).attr('action'), $(this).serialize(), function(data) {
            if (data.redirect) {
                window.location.href = data.redirect;
                return;
            }
            if (data.success) {
                a.find('.form-info').html(data.success).addClass('alert-success').removeClass('alert-danger').slideDown('fast');
            }
            if (data.error) {
                a.find('.form-info').html(data.error).addClass('alert-danger').removeClass('alert-success').slideDown('fast');
            }
            a.find("input[type='password']").val("");
        }, 'json').fail(function() {
            a.find('.form-info').html('Failed to communicate with server!').addClass('alert-danger').removeClass('alert-success').slideDown('fast');
        });
    });
});
