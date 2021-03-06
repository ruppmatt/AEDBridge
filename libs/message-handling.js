define(
  [
     'dojo/dom',
     'dojo/dom-construct',
     'dojo/dom-attr',
     'dojo/dom-class',
     'dojo/dom-style',
     'dojo/_base/lang',
     'dojo/_base/array',
     'dojo/on',
     'dojo/query',
     'jquery',
   ], function (dom, domConstruct, domAttr, domClass, domStyle, lang, array, on, query, jQuery){

     var ws_diag = null;

     function setSocket(s){
       ws_diag = s;
     }
    //Get jquery and json view (which depends on it) seutp
    var $ = jQuery;
    $.getScript('/libs/jquery.jsonview.js');

    var datetime_opts = {
       hour12: false,
       hour: '2-digit',
       minute: '2-digit'
    };

    /*
     Toggle whether or not a message is displayed.  If there is currently
     no data being displayed inside for this message, then go ahead
     and request that the full message be retrieved and displayed.
     Otherwise, delete the dom element currently displaying the message
     rather than trying to hide it (to save resources).
    */
    function toggleMsgByNdx(ndx) {
       if (ndx != '-') {
          var existing_data = dom.byId('div_data_ndx_' + ndx);
          if (existing_data != undefined) {
             domConstruct.destroy(existing_data);
          } else {
             ws_diag.emit('db_request', {
                ndx: ndx
             });
          }
       }
    }



    /*
     Place each message div in the main messages div.
     Message headings require special handling to get
     the inverted coloring properly set.
    */
    function appendMsg(node) {
       var msg_div = dom.byId('messages');
       domConstruct.place(node, msg_div);
       query('.entry>.header', node).forEach(function(n) {
          var s = domStyle.getComputedStyle(n);
          domStyle.set(n, 'background-color', s.color);
          domStyle.set(n, 'color', 'white');
       });
    }


    /*
     Create the div element for each message to be displayed
    */
    function createMsgElement(msg) {
       var meta = msg['meta'];
       var data = msg['data'];
       var ndx = (meta._ndx !== undefined) ? JSON.stringify(meta['_ndx']) : '';
       var msg_type = (data.type !== undefined) ? data.type : "Unknown";
       var msg_name = (data.name !== undefined) ? data.name : "";
       var msg_from = (meta._from !== undefined) ? meta._from : "unknown";
       var is_data = (meta._from === 'internal') ? '' : 'is_data';
       var update = (meta._tx_update !== undefined) ? meta._tx_update : (new Intl.DateTimeFormat('en-US', datetime_opts)).format(new Date())
       var msg_io_type = (meta._io_type !== undefined) ? meta._io_type : '-';
       var update_class = (msg_type == 'update') ? 'update' : '';

       // Provide icons for IN or OUT messages
       switch (msg_io_type.toLowerCase()) {
          case undefined:
             msg_io_type = '&MediumSpace';
             break;
          case 'out':
             msg_io_type = '&#10094;';
             break;
          case 'in':
             msg_io_type = '&#10095;';
             break;
          case '-':
             msg_io_type = '&sdot;';
             break;
          default:
             msg_io_type = '&EmptyVerySmallSquare';
             break;
       };

       // Some messages have additional information that can be placed
       // into the header
       switch (msg_type) {
          case 'userFeedback':
             msg_name = data.level;
             break;
          case 'update':
             msg_name = data.update;
             break;
           case 'av_debug':
             msg_name = '';
             if (Array.isArray(data.mode)){
               for (k=0; k<data.mode.length-1; k++){
                 msg_name += data.mode[k] + ' &diamond; ';
               }
               msg_name += data.mode[data.mode.length-1];
             }
             break;
       };


       // Message Entry Container
       var root_div = domConstruct.create('div', {
          class: 'msg ' + is_data + ' ' + msg_from + ' ' + update_class
       });
       var num_div = domConstruct.create('div', {
          class: 'ndx'
       }, root_div);
       num_div.textContent = '[' + ndx + ' @ ' + update + ']';

       // Message Entry
       var msg_div = domConstruct.create('div', {
          id: 'ndx_' + ndx,
          class: 'entry'
       }, root_div);

       // Message Entry Header
       var msg_header_div = domConstruct.create('div', {
          class: 'header'
       }, msg_div);
       var msg_header_IO_div = domConstruct.create('div', {
          class: 'io_type'
       }, msg_header_div);
       msg_header_IO_div.innerHTML = msg_io_type;
       var msg_header_title_div = domConstruct.create('div', {
          class: 'title'
       }, msg_header_div);
       msg_header_title_div.innerHTML = msg_type + ' : ' + msg_name;

       if (is_data) {
          var _this = this;
          var f = lang.hitch(_this, toggleMsgByNdx, ndx);
          on(msg_header_div, 'click', f);
       }

       return root_div;
    }



    /*
     When a new message is received, create the appropriate nodes
     and append them to the messages div.
    */
    function createAndAppendMessage(msg) {
       appendMsg(createMsgElement(msg));
    }

    /*
     Sometimes, especially when the socket server is reset, the messages
     being dispalyed are out of sync with what the server contains.  When
     a refresh is necessary, delete all data message elements and redisplay
     the conents of the messages in the database.
    */
    function doMessageRefresh(msgs) {
       array.forEach(query('.is_data'), function(n) {
          domConstruct.destroy(n);
       });
       createAndAppendMessage({
          meta: {
             _from: 'internal'
          },
          data: {
             type: 'DB',
             name: 'db_refresh'
          }
       });
       array.forEach(msgs, function(m) {
          createAndAppendMessage(m);
       });
    }


    /*
     When a message is requested to be displayed (usually if the header
     for the message, which is always displayed, is clicked), this method
     is called when the server makes it available.  The necessary div
     elements and json view objects are created at this time.
    */
    function displayMessageAtNdx(e) {
       var ndx = e.ndx;
       if (ndx != undefined) {
          var msg_div = dom.byId('ndx_' + e.ndx);
          if (msg_div != undefined) {
             var msg_id_name = 'div_data_ndx_' + ndx;
             msg_data = domConstruct.create('div', {
                id: msg_id_name,
                class: 'div_msg_data'
             }, msg_div);
             $('#' + msg_id_name).JSONView(e.data, {
                collapsed: true,
                nl2br: true
             });
          }
       }
    }

  return {
    createAndAppendMessage:createAndAppendMessage,
    doMessageRefresh:doMessageRefresh,
    displayMessageAtNdx:displayMessageAtNdx,
    setSocket:setSocket
  };

});
