import type { GetStaticProps } from 'next';
import Image from 'next/image';
import type { FC } from 'react';
import { Fragment, useState } from 'react';
import toast from 'react-hot-toast';
import { createGlobalState } from 'react-hooks-global-state';
import { decode } from 'he';
import type { SpotifyTrack, SpotifyPlaylist } from '../types/spotify';
import { getPlaylist } from '../utils/spotify';
import { ArrowUpRight } from 'react-feather';

type PlaylistProps = {
  data: SpotifyPlaylist;
  tracks: SpotifyTrack[];
};

const formatter = new Intl.ListFormat('en-AU', {
  style: 'long',
  type: 'conjunction',
});

const { useGlobalState } = createGlobalState({ interactableNotified: false });

const Track = ({ track }: SpotifyTrack, index: number) => {
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [fadeIn, setFadeIn] = useState<ReturnType<typeof setInterval> | null>(
    null
  );
  const [fadeOut, setFadeOut] = useState<ReturnType<typeof setInterval> | null>(
    null
  );
  const [interactable, setInteractable] = useState<boolean>(false);
  const [interactableNotified, setInteractableNotified] = useGlobalState(
    'interactableNotified'
  );

  const play = () => {
    if (audio || !track.preview_url) {
      return;
    }

    const newAudio = new Audio(track.preview_url);
    newAudio.volume = 0;

    newAudio
      .play()
      .then(() => {
        setInteractable(true);
        if (interactableNotified) {
          setInteractableNotified(false);
          toast.success('Nice! You’re good to go.');
        }
      })
      .catch((error) => {
        const message =
          error instanceof Error ? error.message : (error as string);
        if (message.includes("user didn't interact with the document first")) {
          if (!interactableNotified) {
            toast(
              'Please click anywhere on the page to preview tracks on hover.'
            );
            setInteractableNotified(true);
            return;
          }
          return;
        }

        if (!message.includes('interrupted by a call to pause()')) {
          toast.error(message);
        }
      });

    const timer = setInterval(() => {
      if (newAudio.volume < 1) {
        newAudio.volume = Number((newAudio.volume + 0.05).toFixed(2));
      } else if (fadeIn) {
        clearInterval(fadeIn);
      }
    }, 100);

    setFadeIn(timer);
    setAudio(newAudio);
  };

  const stop = () => {
    if (!audio) {
      return;
    }

    const originalVolume = audio.volume;

    setAudio(null);

    if (fadeIn) {
      clearInterval(fadeIn);
    }

    setFadeOut(
      setInterval(() => {
        if (audio.volume > 0) {
          audio.volume = Number((audio.volume - 0.05).toFixed(2));
        } else if (fadeOut) {
          clearInterval(fadeOut);
        }
      }, 100)
    );

    setTimeout(() => {
      audio.pause();
    }, (originalVolume / 0.05) * 100);
  };

  return (
    <Fragment key={track.id}>
      {Boolean(index) && (
        <hr className="border-t border-gray-100 dark:border-gray-800" />
      )}
      <div
        className="relative"
        onMouseOver={play}
        onMouseLeave={stop}
        onFocus={play}
        onBlur={stop}
        role="button"
        tabIndex={0}
      >
        {Boolean(track.preview_url) && (
          <div
            className={`
            absolute left-0 top-0 h-full bg-gray-100 dark:bg-gray-800
            ${audio && interactable
                ? 'w-full transition-all duration-[30s] ease-linear'
                : 'w-0'
              }
          `}
          />
        )}
        <div className="relative flex items-center gap-4 p-2">
          <div className="relative flex shrink-0 overflow-hidden rounded-sm">
            <Image src={track.album.images[0].url} width={48} height={48} />
          </div>
          <div className="relative flex flex-1 flex-col">
            <p className="text-md leading-normal text-gray-900 line-clamp-1 dark:text-white">
              {track.name}
            </p>
            <p className="text-sm text-gray-500 line-clamp-1 dark:text-gray-400">
              {track.artists[0].name} &bull; {track.album.name}
            </p>
          </div>
        </div>
      </div>
    </Fragment>
  );
};

const Playlist: FC<PlaylistProps> = ({ data, tracks }) => {
  const duration = (
    tracks.reduce((acc, track) => acc + track.track.duration_ms, 0) / 3600000
  ).toFixed(1);
  const artists: { name: string; count: number }[] = [];

  tracks.forEach((track) => {
    track.track.artists.forEach((artist) => {
      const existing = artists.find(({ name }) => name === artist.name);

      if (existing) {
        existing.count += 1;
      } else if (artist.name) {
        artists.push({ name: artist.name, count: 1 });
      }
    });
  });

  const uniqueArtists = new Set(artists.map((artist) => artist.name));
  const topArtists = artists
    .sort((artist1, artist2) => (artist2.count > artist1.count ? 1 : -1))
    .slice(0, 5)
    .map((artist) => artist.name);
  const description = data.description.endsWith('.')
    ? data.description
    : `${data.description}.`;

  return (
    <div className="container max-w-2xl py-24 px-4 grid gap-8 mx-auto">
      <div className="grid gap-4">
        <h1 className="text-3xl font-semibold">{data.name}</h1>
        <p className="text-md font-normal text-gray-900 dark:text-white">
          <span>{decode(description)} </span>
          <span>Featuring {formatter.format(topArtists)}.</span>
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {[
            `${duration} hours`,
            `${data.tracks.total} tracks`,
            `${uniqueArtists.size} artists`,
          ].join(' · ')}
        </p>
      </div>
      <div>
        <a className="py-3 px-5 rounded-md bg-[#1DB965] text-white inline-flex items-center gap-2" href={data.external_urls.spotify}>
          <Image src="/spotify.svg" width={16} height={16} alt="" />
          <span>Open in Spotify</span>
          <ArrowUpRight size={16} />
        </a>
      </div>
      <div>{tracks.map(Track)}</div>
    </div>
  );
};

export const getStaticProps: GetStaticProps = async () => {
  const { data, tracks } = await getPlaylist('4rjnOMuLcXn41kDbg5J2s4');

  return {
    props: {
      data,
      tracks,
    },
  };
};

export default Playlist;
