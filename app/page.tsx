"use client";

import { useState, useRef, useCallback } from "react";

export default function Stopwatch() {
  const [time, setTime] = useState(0);
  const [running, setRunning] = useState(false);
  const [laps, setLaps] = useState<number[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(() => {
    if (running) return;
    setRunning(true);
    const startTime = Date.now() - time;
    intervalRef.current = setInterval(() => {
      setTime(Date.now() - startTime);
    }, 10);
  }, [running, time]);

  const stop = useCallback(() => {
    if (!running) return;
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, [running]);

  const reset = useCallback(() => {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setTime(0);
    setLaps([]);
  }, []);

  const lap = useCallback(() => {
    if (!running) return;
    setLaps((prev) => [...prev, time]);
  }, [running, time]);

  const format = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const centiseconds = Math.floor((ms % 1000) / 10);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6">
      <h1 className="text-white text-4xl font-bold mb-12 tracking-widest uppercase">
        Stopwatch
      </h1>

      {/* Timer display */}
      <div className="text-white font-mono text-7xl sm:text-8xl font-light mb-12 tabular-nums">
        {format(time)}
      </div>

      {/* Controls */}
      <div className="flex gap-4 mb-10">
        <button
          onClick={lap}
          disabled={!running}
          className="w-20 h-20 rounded-full bg-gray-700 text-white text-sm font-medium disabled:opacity-30 hover:bg-gray-600 active:scale-95 transition-all"
        >
          Lap
        </button>

        {running ? (
          <button
            onClick={stop}
            className="w-20 h-20 rounded-full bg-red-600 text-white text-sm font-medium hover:bg-red-500 active:scale-95 transition-all"
          >
            Stop
          </button>
        ) : (
          <button
            onClick={start}
            className="w-20 h-20 rounded-full bg-green-600 text-white text-sm font-medium hover:bg-green-500 active:scale-95 transition-all"
          >
            {time === 0 ? "Start" : "Resume"}
          </button>
        )}

        <button
          onClick={reset}
          disabled={time === 0 && !running}
          className="w-20 h-20 rounded-full bg-gray-700 text-white text-sm font-medium disabled:opacity-30 hover:bg-gray-600 active:scale-95 transition-all"
        >
          Reset
        </button>
      </div>

      {/* Lap list */}
      {laps.length > 0 && (
        <div className="w-full max-w-sm">
          <div className="border-t border-gray-800">
            {[...laps].reverse().map((lapTime, i) => {
              const lapNumber = laps.length - i;
              const prev = lapNumber > 1 ? laps[lapNumber - 2] : 0;
              return (
                <div
                  key={lapNumber}
                  className="flex justify-between py-3 border-b border-gray-800 text-gray-300 font-mono"
                >
                  <span className="text-gray-500">Lap {lapNumber}</span>
                  <span>{format(lapTime - prev)}</span>
                  <span>{format(lapTime)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
