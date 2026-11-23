import React from "react";
import {
  Audio,
  Sequence,
  cancelRender,
  continueRender,
  delayRender,
  interpolate,
  useVideoConfig,
} from "remotion";

const durations = new Map<string, Promise<number>>();
function audioDuration(url: string): Promise<number> {
  let pending = durations.get(url);
  if (!pending) {
    pending = new Promise((resolve, reject) => {
      const element = document.createElement("audio");
      const finish = (error?: Error) => {
        clearTimeout(timer);
        element.onloadedmetadata = null;
        element.onerror = null;
        const duration = element.duration;
        element.removeAttribute("src");
        element.load();
        if (error) reject(error);
        else resolve(duration);
      };
      const timer = setTimeout(
        () => finish(new Error("EMP voice liner metadata timed out")),
        15000,
      );
      element.onloadedmetadata = () =>
        finish(
          Number.isFinite(element.duration) && element.duration > 0
            ? undefined
            : new Error("Invalid EMP voice liner duration"),
        );
      element.onerror = () =>
        finish(new Error("Could not load EMP voice liner"));
      element.preload = "metadata";
      element.src = url;
    });
    durations.set(url, pending);
  }
  return pending;
}

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
/** Full mixes are passed through. Only the automatically mixed source music is ducked. */
export const EmpAudio: React.FC<{
  music: string;
  fullMix: string;
  liner: string;
  short: boolean;
}> = ({ music, fullMix, liner, short }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const [duration, setDuration] = React.useState(0);
  const [initial] = React.useState(() =>
    delayRender("Read EMP voice duration"),
  );
  React.useEffect(() => {
    let active = true;
    const handle = delayRender("Load EMP voice metadata");
    (liner && !fullMix ? audioDuration(liner) : Promise.resolve(0))
      .then((value) => {
        if (active) {
          setDuration(value);
          continueRender(handle);
          continueRender(initial);
        }
      })
      .catch((error) => {
        if (active) cancelRender(error);
      });
    return () => {
      active = false;
      continueRender(handle);
      continueRender(initial);
    };
  }, [liner, fullMix, initial]);
  if (fullMix) return <Audio src={fullMix} />;
  const fade = Math.min(0.02, duration / 4);
  const start = Math.round((short ? 0.55 : 4.04) * fps);
  const end = durationInFrames / fps;
  const voiceStart = start / fps;
  return (
    <>
      <Audio
        src={music}
        volume={(frame) => {
          const time = frame / fps;
          const duck =
            liner && duration > 0
              ? interpolate(
                  time,
                  [
                    voiceStart - 0.18,
                    voiceStart,
                    voiceStart + duration,
                    voiceStart + duration + 0.3,
                  ],
                  [0.8, 0.25, 0.25, 0.8],
                  clamp,
                )
              : 0.8;
          return (
            duck *
            interpolate(time, [0, 0.08, end - 0.35, end], [0, 1, 1, 0], clamp)
          );
        }}
      />
      {liner && duration > 0 && (
        <Sequence
          from={start}
          durationInFrames={Math.ceil(duration * fps)}
          layout="none"
        >
          <Audio
            src={liner}
            volume={(frame) =>
              interpolate(
                frame / fps,
                [0, fade, duration - fade, duration],
                [0, 1, 1, 0],
                clamp,
              )
            }
          />
        </Sequence>
      )}
    </>
  );
};
