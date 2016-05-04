/**
 * @name: so.ext.modal
 * @deps: so, so.dom
 * @vers: 1.0.2
 */

!function(o){function t(t){this.options=o.mix({},d,t),this.$modal=o.dom(i),this.$modal.find(".modal-box").setStyle("width",this.options.width),null!=this.options.height&&this.$modal.find(".modal-body").setStyle({height:this.options.height,"min-height":this.options.height}),this.$modal.find(".modal-head").setHtml(this.options.title),this.$modal.find(".modal-body").setHtml(this.options.body),o.ext.modalObjects.push(this)}o.ext.modalObjects=[];var i='<div class="modal"><div class="modal-box"><div class="modal-x"><i>&times;</i></div><div class="modal-head"></div><div class="modal-body"></div><div class="modal-foot"></div></div></div>',d={width:450,height:null,title:"",body:"",onOpen:o.fun(),onClose:o.fun(),closable:!1};o.extend(t.prototype,{open:function(){var t=this;this.$modal.find(".modal-x").on("click",function(){t.close()}),this.options.closable&&this.$modal.on("click",function(i){o.dom(i.target).hasClass("modal")&&t.close()}),this.options.buttons&&o.forEach(this.options.buttons,function(i){var d=o.dom("<button class='btn'>");if(d.setText(i.text),"class"in i&&d.addClass(i["class"]),"click"in i){var n=typeof i.click;"string"==n?d.on("click",function(){t.$modal.find("form").fire(i.click)}):"function"==n&&d.on("click",function(o){i.click.call(d[0],o,t)})}t.$modal.find(".modal-foot").append(d,!1)}),this.$modal.appendTo("body",!1);var i,d,n=o.dom("body");i=n.width(),o.dom("html, body").setStyle("overflow","hidden"),d=n.width(),o.dom("body,#head").setStyle("padding-right",d-i),window.setTimeout(function(){t.$modal.find(".modal-box").addClass("open"),"function"==typeof t.options.onOpen&&t.options.onOpen.call(t,t);var o=t.$modal.find(".modal-head");""==o.getHtml()&&o.hide(0);var i=t.$modal.find(".modal-foot");""==i.getHtml()&&i.hide(0)},100)},close:function(t){this.$modal.addClass("close").find(".modal-box").addClass("close");var i=this;window.setTimeout(function(){i.$modal.fadeOut(0,function(t){"function"==typeof i.options.onClose&&i.options.onClose.call(i,i),o.dom(t).remove()})},1e3),o.dom("html, body, #head").setStyle({overflow:"","padding-right":""})}}),o.ext.modal=function(i){if(o.isEmpty(i))throw"Options could not be empty!";return new t(i)},o.dom(window.document).on("keydown",function(t){if(27==t.which)for(var i;i=o.ext.modalObjects.shift();)i.close()})}(so);
