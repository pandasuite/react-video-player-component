import React, { useRef, useState } from 'react';
import './App.css';
import _ from 'lodash';
import ReactPlayer from 'react-player';

import { usePandaBridge } from 'pandasuite-bridge-react';
import PandaBridge from 'pandasuite-bridge';

let oldTime = -1;
let fromSynchro = false;

function App() {
  const player = useRef(null);
  const [externalProps, setExternalProps] = useState({});

  const {
    properties,
    markers,
  } = usePandaBridge(
    {
      markers: {
        getSnapshotDataHook: () => {
          if (player.current) {
            return { id: player.current.getCurrentTime() };
          }
          return null;
        },
        setSnapshotDataHook: ({ data }) => {
          if (data && data.id && player.current) {
            player.current.seekTo(parseFloat(data.id));
          }
        },
      },
      actions: {
        playPause: () => {
          setExternalProps({ ...externalProps, playing: !externalProps.playing });
        },
        play: () => {
          setExternalProps({ ...externalProps, playing: true });
        },
        pause: () => {
          setExternalProps({ ...externalProps, playing: false });
        },
        stop: () => {
          PandaBridge.send('onFinishPlaying');
          window.location.reload();
        },
        seek: ({ seconds }) => {
          if (player.current) {
            player.current.seekTo(seconds);
          }
        },
        forward: ({ seconds }) => {
          if (player.current) {
            player.current.seekTo(player.current.getCurrentTime() + seconds);
          }
        },
        rewind: ({ seconds }) => {
          if (player.current) {
            player.current.seekTo(player.current.getCurrentTime() - seconds);
          }
        },
        restartFromBeginning: () => {
          if (player.current) {
            player.current.seekTo(0);
          }
        },
        setVolume: ({ volume }) => {
          setExternalProps({ ...externalProps, volume });
        },
        increaseVolume: ({ volume }) => {
          const currentVolume = _.get(player, 'current.props.volume', 1);
          setExternalProps({ ...externalProps, volume: currentVolume + volume });
        },
        decreaseVolume: ({ volume }) => {
          const currentVolume = _.get(player, 'current.props.volume', 1);
          setExternalProps({ ...externalProps, volume: currentVolume - volume });
        },
        setSpeed: ({ speed }) => {
          setExternalProps({ ...externalProps, playbackRate: speed });
        },
        increaseSpeed: ({ speed }) => {
          const currentRate = _.get(player, 'current.props.playbackRate', 1);
          setExternalProps({ ...externalProps, playbackRate: currentRate + speed });
        },
        decreaseSpeed: ({ speed }) => {
          const currentRate = _.get(player, 'current.props.playbackRate', 1);
          setExternalProps({ ...externalProps, playbackRate: currentRate + speed });
        },
      },
      synchronization: {
        time: (percent) => {
          if (player.current) {
            fromSynchro = true;
            player.current.seekTo((percent * player.current.getDuration()) / 100);
          }
        },
      },
    },
  );

  if (_.isEmpty(properties)) {
    return null;
  }

  if (PandaBridge.isStudio
    && player.current && player.current.props.controls !== properties.controls) {
    window.location.reload();
  }

  function triggerUpdatedData(eventName, forceSeek) {
    if (PandaBridge.isStudio) {
      const currentSeek = forceSeek || player.current.getCurrentTime();
      PandaBridge.send(eventName, {
        controls: [
          {
            id: 'controlBar',
            value: {
              minSeek: 0,
              maxSeek: player.current.getDuration(),
              currentSeek,
            },
          },
        ],
      });
    }
  }

  const playing = _.get(externalProps, 'playing', properties.autoPlay);
  const playbackRate = _.get(externalProps, 'playbackRate', properties.playbackRate);
  const volume = _.get(externalProps, 'volume', properties.volume);

  function handlePlay() {
    if (!externalProps.playing) {
      setExternalProps({ ...externalProps, playing: true });
    }
    PandaBridge.send('onStartingPlay');
  }

  function handlePause() {
    if (externalProps.playing) {
      setExternalProps({ ...externalProps, playing: false });
    }
    PandaBridge.send('onPausePlaying');
  }

  function handleEnded() {
    if (externalProps.playing) {
      setExternalProps({ ...externalProps, playing: false });
    }
    triggerUpdatedData(PandaBridge.UPDATED, -1);
    PandaBridge.send('onFinishPlaying');
  }

  function handleProgress() {
    function isValueInRange(testValue, currentValue, oldValue, minBorder, maxBorder) {
      const minvalue = Math.min(oldValue, currentValue);
      const maxvalue = Math.max(oldValue, currentValue);

      const isLooping = (Math.abs(oldValue - currentValue) > (maxBorder - minBorder) * 0.85)
        && oldValue !== -1;
      return ((isLooping && ((testValue > maxvalue && testValue <= maxBorder)
        || (testValue >= minBorder && testValue <= minvalue)))
        || (!isLooping && ((oldValue <= currentValue
          && (testValue > minvalue && testValue <= maxvalue))
        || (oldValue > currentValue && (testValue >= minvalue && testValue < maxvalue)))));
    }

    const currentTime = player.current.getCurrentTime();
    const duration = player.current.getDuration();

    if (oldTime !== currentTime) {
      triggerUpdatedData(PandaBridge.UPDATED);
    }

    /* Markers */
    if (markers) {
      markers.forEach((marker) => {
        if (isValueInRange(marker.id, currentTime, oldTime, 0, duration)) {
          PandaBridge.send('triggerMarker', marker.id);
        }
      });
    }

    /* Synchronisation status */
    if (!fromSynchro) {
      PandaBridge.send('synchronize', [(currentTime * 100) / duration, 'time', true]);
    } else {
      fromSynchro = false;
    }

    oldTime = currentTime;
  }

  return (
    <ReactPlayer
      ref={player}
      url={properties.url}
      playing={playing}
      loop={properties.loop}
      controls={!!properties.controls}
      playbackRate={playbackRate}
      volume={volume}
      muted={volume === 0}
      width="100%"
      height="100%"
      onDuration={() => triggerUpdatedData(PandaBridge.INITIALIZED)}
      onPlay={handlePlay}
      onPause={handlePause}
      onEnded={handleEnded}
      progressInterval={100}
      onProgress={handleProgress}
    />
  );
}

export default App;
