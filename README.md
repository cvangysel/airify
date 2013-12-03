Airify
======

Airify is a [Spotify](http://www.spotify.com) to Apple [AirPlay](http://en.wikipedia.org/wiki/AirPlay) bridge. It provides a command line tool to stream Spotify playlists directly to AirPlay device.

Airify requires an active Spotify Premium subscription.

## Why?

Airify was developed due to the lack of native support for Spotify in [Bose](http://www.bose.com)'s SoundTouch music systems. Bose is planning to include support for more services in the second half of 2014. In the meanwhile users are encouraged to use the built-in AirPlay functionality of Mac OS X.

There are a few issues with this approach:
* It requires a computer running Mac OS X (or possibly a third-party implementation for Windows), preferably in the same local area network, while listening to Spotify on the Bose SoundTouch.
* AirPlay streams all system sounds to the rendering device, which may interfere with other user tasks. It is not suitable for real-time applications as it introduces a two millisecond buffer delay.

Configuring a cronjob for Airify on a [Raspberry Pi](http://www.raspberrypi.org/) makes a pretty darn good alarm clock.

## Installation

Airify expects the C API package [libspotify](https://developer.spotify.com/technologies/libspotify/) (>= 12.1.51) to be available on your system.

On Linux, download and extract the archive for your architecture. Install the library on your system using `make install` (requires root privileges).

On Mac OS X, download and extract the archive. Install the library to your system by copying `libspotify.framework` to `/Library/Frameworks`. Afterwards run the following command in your console to make the binary discoverable during linkage (requires root):

    ln -s /Library/Frameworks/libspotify.framework/libspotify /usr/local/lib/libspotify.dylib

To install Airify:

    cd ~
    git clone https://github.com/cvangysel/airify.git
    npm install

## Usage

Request an application key for [libspotify](https://developer.spotify.com/technologies/libspotify/) from the Spotify developer website. Download your application key to the directory where Airify is installed, rename the file to `spotify.xml`.

Spotify requires new users to log in using their Facebook accounts. For Airify to access your account it needs your Spotify user details (i.e. do not use your Facebook account). You can retrieve these from your Spotify [account](https://www.spotify.com/account/overview/) page.

For selecting a playlist, you need to pass Airify the Spotify URI. To find out the Spotify URI of a playlist right-click the playlist and select 'Copy Spotify URI' in the desktop client.

(Technical note: the list of a user's Starred tracks is technically not a playlist and can not be passed as one.)

Execute `node airify.js` for more information.
