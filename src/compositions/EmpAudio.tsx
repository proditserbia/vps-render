import React from "react";
import {
  Audio,
  Sequence,
  cancelRender,
  continueRender,
  delayRender,
  useVideoConfig,
} from "remotion";
import {empMusicLevel,empVoiceLevel} from './empAudioLevels';

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

/** Full mixes are passed through. Only the automatically mixed source music is ducked. */
export const EmpAudio: React.FC<{
  music: string;
  fullMix: string;
  liner: string;
  short: boolean;
  musicStartFrame?: number;
}> = ({ music, fullMix, liner, short, musicStartFrame=0 }) => {
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
  const start = Math.round((short ? 0.55 : 4.04) * fps);
  return (
    <>
      {music && <Audio
        src={music}
        trimBefore={musicStartFrame}
        volume={frame=>empMusicLevel(frame,fps,durationInFrames,duration,short,Boolean(liner))}
      />}
      {liner && duration > 0 && (
        <Sequence
          from={start}
          durationInFrames={Math.ceil(duration * fps)}
          layout="none"
        >
          <Audio
            src={liner}
            volume={frame=>empVoiceLevel(frame,fps,duration)}
          />
        </Sequence>
      )}
    </>
  );
};
