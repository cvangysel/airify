var assert = require('assert'),
    express = require('express'),
    airtunes = require('airtunes'),
    spotify = require('libspotify'),
    events = require('events'),
    fs = require('fs'),
    _ = require('underscore'),
    argv = require('optimist')
      .usage('Usage: $0')
      .string('airplay_host')
      .string('airplay_password')
      .string('spotify_user')
      .string('spotify_password')
      .string('spotify_playlist')
      .boolean('shuffle')
      .default('airplay_host', 'localhost')
      .default('volume', 50)
      .default('httpd_port', 8080)
      .describe('airplay_host', 'IP address of host running AirPlay service.')
      .describe('airplay_port', 'Port number of AirPlay service, usually port 5000 (Apple devices) or port 1024 (Bose SoundTouch).')
      .describe('airplay_password', 'Password required for AirPlay service.')
      .describe('spotify_user', 'User name of Spotify Premium account.')
      .describe('spotify_password', 'Password for Spotify Premium account.')
      .describe('spotify_playlist', 'Spotify playlist URI.')
      .describe('volume', 'Sets AirPlay device volume, between 0 and 100.')
      .describe('shuffle', 'Toggle to enable track shuffling.')
      .describe('httpd_port', 'Port number for the web interface.')
      .demand(['airplay_host', 'airplay_port', 'spotify_user', 'spotify_password', 'spotify_playlist'])
      .check(function(argv) { return argv.volume >= 0 && argv.volume <= 100;})
      .argv;

main();

var web = express();

web.get("/", function(req, res) {
  res.sendfile('resources/index.html');
});

web.get(/^\/(css|js|fonts)\/(.+)$/, function(req, res){
  var file = __dirname + '/static/' + req.params[0] + '/' + req.params[1];
  res.sendfile(file);
});

var device = airtunes.add(
  argv.airplay_host,
  {
    'port': argv.airplay_port,
    'password': argv.airplay_password,
    'volume': argv.volume
  });

var hasStarted = false;

device.on('status', function(status) {
  if (!hasStarted) {
    console.log('Connected to AirPlay device (' + device.key + ').');

    hasStarted = true;
  } else {
    // TODO(cvangysel): fix this logic.
    if (status == 'stopped') {
      console.log('Another device took control of device ' + device.key + '.');
    } else {
      console.log('Unknown device status. (' + status + ')');
    }

    process.exit(1);
  }
});

device.on('error', function(err) {
  console.log('device error: ' + err);

  process.exit(1);
});

airtunes.on('buffer', function(status) {
  if(status === 'end') {
    console.log('Playback ended. Waiting for AirTunes devices.');

    setTimeout(function() {
      airtunes.stopAll(function() {
        process.exit();
      });
    }, 2000);
  }
});

function main() {
  var session = new spotify.Session({
      applicationKey: __dirname + '/spotify.key'
  });

  session.login(argv.spotify_user, argv.spotify_password);

  session.once('login', function(err) {
    console.log('Connected to Spotify (' + argv.spotify_user + ').');

    if (err) {
      this.emit('error', err);
    }

    var songStarted = 0;

    var player = session.getPlayer();
    player.pipe(airtunes);

    // TODO(cvangysel): add some error checking here; also take into account that
    // the 'Starred' playlist is not a playlist.
    var playlist = spotify.Playlist.getFromUrl(argv.spotify_playlist);

    if (playlist.isReady()) {
      run(playlist);
    } else {
      playlist.on('ready', function() {
        run(playlist);
      });
    }

    function run(playlist) {
      playlist.getTracks(function(collection) {
        tracks = {};
        queue = [];

        if (argv.shuffle) {
          collection = _.shuffle(collection);
        }

        for (var i = 0; i < collection.length; i ++) {
          var track = collection[i];
          if (!track.isAvailable()) {
            continue;
          }

          track.id = track.getUrl();
          track.score = 0;
          track.originalRank = i;

          tracks[track.id] = track;

          queue.push(track.id);
        }

        web.listen(argv.httpd_port, function() {
          console.log('Administration interface accessible through port ' + argv.httpd_port + '.');
        });

        web.get("/control", function(req, res) {
          res.send(
            JSON.stringify({
              'playlist': playlist,
              'player': null}));
        });

        web.get("/tracks", function(req, res) {
          var selected = [];
          for (var id in queue) {
            var track = tracks[queue[id]];
            if (id == 0) {
              track.remainingTime = track.duration - (new Date().getTime() - songStarted);
            }

            selected.push(track);
          }

          res.send(JSON.stringify(selected));
        });

        web.get(/^\/track\/(.+)\/(up|down)\/?$/, function(req, res) {
          var id = req.params[0];
          var action = req.params[1];

          if (!tracks[id]) {
            res.send(500);
          } else {
            var track = tracks[id];
            var delta = 0;

            switch (action) {
              case "up":
                delta = 1;

                break;
              case "down":
                delta = -1;

                break;
              default:
                res.send(500);

                return;
            }

            track.score += delta;

            var changed = false;
            var i = queue.indexOf(id);

            // If it is not the currently playing track, nudge position if required.
            if (i > 0) {
              j = i - delta;

              while (j > 0 && j < queue.length && (delta > 0 ? (tracks[queue[j]].score < tracks[queue[i]].score) : (tracks[queue[j]].score >= tracks[queue[i]].score))) {
                temp = queue[i];

                queue[i] = queue[j];
                queue[j] = temp;

                i = j
                j -= delta;

                changed = true;
              }
            }

            res.send(changed);
          }
        });

        console.log('Loaded playlist "' + playlist.name + '" with ' + _.size(tracks) + ' tracks.');

        var nextTrack = 0;

        function next() {
          player.stop();

          if (queue.length) {
            var track = tracks[queue[0]];

            console.log('Playing "' + track.title + '" by "' + track.artist.name + '" (' + track.humanDuration + ').');

            player.load(track);
            player.play();

            songStarted = new Date().getTime();
          } else {
            console.log('Finished playing.');

            session.close();
          }
        }

        next();

        player.on('track-end', function() {
          queue.shift();

          next();
        });
      });
    }
  });
}