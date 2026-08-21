/*-----------------------------------------------------------------------------
    Portfolio page behaviour: isotope filtering and the image/video lightbox.
    Lifted out of the old scripts.js, which also carried the preloader, splash
    animations, and nav handling that this page no longer has.
-----------------------------------------------------------------------------*/

(function ($) {
    "use strict";

    $('.expand-img').magnificPopup({
        type: 'image',
        gallery: { enabled: true }
    });

    $('.expand-video').magnificPopup({
        type: 'iframe',
        gallery: { enabled: true }
    });

    $('#container').imagesLoaded(function () {
        var $grid = $('.portfolio-masonary').isotope({
            itemSelector: '.prt-grid',
            percentPosition: true,
            masonry: {
                columnWidth: '.prt-grid'
            }
        });

        $('.fortfolio-filter').on('click', 'button', function () {
            $grid.isotope({ filter: $(this).attr('data-filter') });
        });
    });

    $('.fortfolio-filter button').on('click', function (event) {
        $(this).siblings('.active').removeClass('active');
        $(this).addClass('active');
        event.preventDefault();
    });

})(jQuery);
