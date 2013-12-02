var assert = require('assert'),
    airtunes = require('airtunes'),
    spotify = require('libspotify'),
    _ = require('underscore'),
    argv = require('optimist')
      .usage('Usage: $0')
      .string('airplay_host')
      .string('airplay_password')
      .string('spotify_user')
      .string('spotify_password')
      .string('spotify_playlist')
      .boolean('shuffle')
      .default('host', 'localhost')
      .default('port', 5000)
      .default('volume', 50)
      .demand(['airplay_host', 'spotify_user', 'spotify_password', 'spotify_playlist'])
      .argv;

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
    startSpotify();
  } else {
    // TODO(cvangysel): fix this logic.
    if (status == 'stopped') {
      console.log(device);
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

function startSpotify() {
  var session = new spotify.Session({
      applicationKey: __dirname + '/spotify.key'
  });

  session.login(argv.spotify_user, argv.spotify_password);

  session.once('login', function(err) {
    console.log('Connected to Spotify (' + argv.spotify_user + ').');

    if (err) {
      this.emit('error', err);
    }

    var player = session.getPlayer();
    player.pipe(airtunes);

    // TODO(cvangysel): add some error checking here; also take into account that
    // the 'Starred' playlist is not a playlist.
    var playlist = spotify.Playlist.getFromUrl(argv.spotify_playlist);

    if (playlist.isReady()) {
      playList(playlist);
    } else {
      playlist.on('ready', function() {
        playList(playlist);
      });
    }

    function playList(playlist) {
      playlist.getTracks(function(tracks) {
        console.log('Loaded playlist "' + playlist.name + '" with ' + tracks.length + ' tracks.');

        if (argv.shuffle) {
          tracks = _.shuffle(tracks);
        }

        var nextTrack = 0;

        function next() {
          player.stop();

          if (nextTrack < tracks.length) {
            var track = tracks[nextTrack++];

            console.log('Playing "' + track.title + '" by "' + track.artist.name + '" (' + track.humanDuration + ').');

            player.load(track);
            player.play();
          } else {
            console.log('Finished playing.');

            session.close();
          }
        }

        next();

        player.on('track-end', function() {
          next();
        });
      });
    }
  });
}