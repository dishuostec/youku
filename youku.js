/* =============================================================
 * Youku parser v0.1
 * https://github.com/dishuostec/youku
 * ============================================================ */

var http = require('http'),
  url = require('url');

var server = http.createServer(handle_http_request);

server.listen(80);

function handle_http_request (request, response) {
  var request_query = url.parse(request.url).query;
  var query = {};

  if (request_query) {
     request_query.split('&').forEach(function(str) {
      var picec = str.split('=');
      query[picec[0]] = decodeURIComponent(picec[1]);
    });
  }

  var id = query.u || '';
  var type = query.t || 'flv';

  if (id.indexOf('v.youku.com') >= 0) {
    var match = id.match(/v_show\/id_([a-zA-Z0-9]+)/);
    if (match === null) {
      response.writeHead(400);
      response.write('Invalid ID');
      response.end();
      return;
    }

    id = match[1];
  } else if ( ! id.match(/^[a-zA-Z0-9]+$/)) {
    response.writeHead(400);
    response.write('Invalid ID');
    response.end();
    return;
  }

  new Youku(id).get_list(type, response);
}

function Youku (id) {
  this.id = id;
}

Youku.prototype.get_data = function() {
  http.get({
    host: 'v.youku.com',
    port: 80,
    path: '/player/getPlayList/VideoIDS/'+this.id,
  }, function(res) {
    res.setEncoding('utf-8');

    var json = '';
    res.on('data', function(chunk) {
      json += chunk;
    }.bind(this)).on('end', function() {
      var data;
      try {
        data = JSON.parse(json);
        data = data.data[0];
      } catch(e) {
        console.log('error', e, json);
        data = {};
      }

      'title,logo,seed,key1,key2,streamfileids,segs'.split(',').forEach(function(k) {
        this[k] = data[k] || null;
      }.bind(this));

      console.log(this.id, this.type, this.title);

      this.create_list();
    }.bind(this));
  }.bind(this));
};

Youku.prototype.get_list = function(type, response) {
  this.type = type || 'flv';
  this.response = response;
  this.get_data();
};

Youku.prototype.create_list = function() {
  var type = this.type;
  var list = [];

  if (this.segs && this.segs[type]) {
    this.segs[type].forEach(function(seg) {
      var num = seg.no.toString(16);
      if (num.length === 1) {
        num = '0' + num;
      }
      var sid = this.get_sid();
      var file_id = this.get_file_id();
      var key = seg.k || this.get_key();

      file_id = file_id.slice(0, 8) + num + file_id.slice(10);

      list.push('http://f.youku.com/player/getFlvPath/sid/'+sid+'_'+num+'/st/'+type+'/fileid/'+file_id+'?K='+key);
    }.bind(this));
  }

  
  this.response.write(JSON.stringify({
    title: this.title,
    thumb: this.logo,
    list: list
  }));
  this.response.end();
};

Youku.prototype.get_sid = function() {
  return Date.now().toString(10) + (Math.floor(Math.random() * 9000) + 10000);
};

Youku.prototype.get_mixed_seed = function() {
  if ( ! this.mixed) {
    var seed = this.seed;
    var source = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ/\\:._-1234567890'.split('');
    var len = source.length;
    var mixed = [];
    
    for (var i = 0; i < len; i ++) {
      seed = (seed * 211 + 30031) % 65536;
      var index = Math.floor(seed / 65536 * source.length);
      mixed[i] = source[index];
      source.splice(index, 1);
    }

    this.mixed = mixed;
  }

  return this.mixed;
};

Youku.prototype.get_file_id = function() {
  if ( ! this.file_id) {
    var clip = this.streamfileids[this.type].split('*');
    var mixed = this.get_mixed_seed();

    this.file_id = clip.map(function(a, i){
      return a.length == 0 ? '' : mixed[parseInt(a, 10)];
    }).join('');
  }

  return this.file_id;
};

Youku.prototype.get_key = function() {
  if ( ! this.key) {
    var k = parseInt(this.key1, 16);
    k ^= 0xa55aa5a5;
    this.key = this.key2 + k.toString(16);
  }

  return this.key;
};
