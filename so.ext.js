/**
 * @name: so.ext
 * @deps: so
 */

;(function($) {

"use strict"; // @tmp

$.extend($.ext, {
    camelizeStyleProperty: function(input) {
        return (""+ input).replace(/-([a-z])/gi, function($0, $1) {
            return $1.toUpperCase();
        });
    },
    dasherizeStyleProperty: function(input) {
        return (""+ input).replace(/([A-Z])/g, function($0, $1) {
            return "-"+ $1.toLowerCase();
        });
    }
});

// define exposer
$.toString("ext", "so.ext");

})(so);