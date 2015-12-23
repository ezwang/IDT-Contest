$(document).ready(function() {
    $("form").submit(function(e) {
        e.preventDefault();
        var valid = true;
        $(this).find('form-group').removeClass('has-danger');
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
            if (data.error) {
                a.find('.form-info').html(data.error).slideDown();
            }
        }, 'json');
    });
});
