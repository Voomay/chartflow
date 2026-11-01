import React, { useEffect, useRef, useState } from 'react';

/** Native proportions inside a landscape tablet, with no controls over the footage. */
export function HomepageDemoVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const userPausedRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false
  );

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const changed = () => {
      setReduceMotion(media.matches);
      if (media.matches) videoRef.current?.pause();
    };
    media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || reduceMotion) return;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (conn?.saveData) return;

    let inView = true;
    let readyToPlay = false;
    let timerId: number | undefined;

    const tryPlay = () => {
      if (!inView || !readyToPlay || userPausedRef.current || document.hidden) return;
      if (video.preload === 'none') {
        video.preload = 'metadata';
      }
      if (video.paused) {
        void video.play().catch(() => {});
      }
    };

    // Defer heavy video stream start until after first paint so initial page load is instant on all devices
    timerId = window.setTimeout(() => {
      readyToPlay = true;
      tryPlay();
    }, 180);

    const observer =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            (entries) => {
              const entry = entries[0];
              if (!entry) return;
              inView = entry.isIntersecting;
              if (inView) {
                tryPlay();
              } else if (!video.paused) {
                video.pause();
              }
            },
            { threshold: 0.15 }
          )
        : null;

    observer?.observe(video);

    const onVisibility = () => {
      if (document.hidden) {
        if (!video.paused) video.pause();
      } else {
        tryPlay();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (timerId !== undefined) window.clearTimeout(timerId);
      observer?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [reduceMotion]);

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      userPausedRef.current = false;
      if (video.preload === 'none') video.preload = 'metadata';
      void video.play().catch(() => {});
    } else {
      userPausedRef.current = true;
      video.pause();
    }
  };

  return <figure className="relative w-full">
    <div data-testid="homepage-tablet-frame" className="relative rounded-[1.6rem] sm:rounded-[2.8rem] border border-[#3b3c40] bg-gradient-to-br from-[#323337] via-[#0b0b0d] to-[#242528] p-[3px] shadow-[0_35px_90px_rgba(0,0,0,0.65),0_0_0_1px_rgba(0,0,0,0.9)]">
      <div className="relative overflow-hidden rounded-[1.4rem] sm:rounded-[2.6rem] bg-[#050506] px-3 py-4 sm:px-5 sm:py-6">
        <span aria-hidden="true" className="absolute top-1/2 left-1 sm:left-2 -translate-y-1/2 w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-[#141923] ring-1 ring-white/5" />
        <div className="overflow-hidden rounded-xl sm:rounded-[1.65rem] bg-black ring-1 ring-white/10">
          <video ref={videoRef} aria-label="Chart Replay platform walkthrough, without sound" aria-describedby="homepage-video-description" className="block w-full h-auto object-contain aspect-[1920/902]" width="1920" height="902" poster="/videos/chart-replay-walkthrough-poster.jpg" muted loop playsInline controls={false} disablePictureInPicture disableRemotePlayback preload="none" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}>
            <source src="/videos/chart-replay-walkthrough.mp4" type="video/mp4" />
            Your browser cannot play this video. <a href="/videos/chart-replay-walkthrough.mp4">Watch the platform demo</a>.
          </video>
        </div>
      </div>
    </div>
    <button type="button" onClick={togglePlayback} className="sr-only focus:not-sr-only focus:mt-3 focus:rounded-lg focus:px-4 focus:py-2 focus:bg-slate-900 focus:text-white focus:ring-2 focus:ring-emerald-400">{playing ? 'Pause platform walkthrough' : 'Play platform walkthrough'}</button>
    <figcaption id="homepage-video-description" className="sr-only">A silent demonstration of Chart Replay in a black tablet frame, showing position sizing, chart drawings and replay playback. The video retains its original proportions. A playback button is available when navigating with the keyboard.</figcaption>
  </figure>;
}
