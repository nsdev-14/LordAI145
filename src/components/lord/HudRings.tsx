import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface HudRingsProps {
  size?: number;
  state?: "idle" | "listening" | "processing" | "speaking";
}

export function HudRings({ size = 200, state = "idle" }: HudRingsProps) {
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (state === "idle" || state === "listening") {
      const interval = setInterval(() => {
        setRotation((prev) => (prev + 2) % 360);
      }, 50);
      return () => clearInterval(interval);
    }
  }, [state]);

  const getAnimationClass = () => {
    switch (state) {
      case "listening":
        return "animate-pulse";
      case "processing":
        return "";
      case "speaking":
        return "animate-bounce";
      default:
        return "";
    }
  };

  return (
    <div className="flex items-center justify-center" style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 200 200"
        className={cn("w-full h-full", getAnimationClass())}
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        {/* Outer ring */}
        <circle
          cx="100"
          cy="100"
          r="90"
          fill="none"
          stroke="var(--hud)"
          strokeWidth="1"
          opacity="0.3"
        />
        {/* Middle ring */}
        <circle
          cx="100"
          cy="100"
          r="60"
          fill="none"
          stroke="var(--hud)"
          strokeWidth="1"
          opacity="0.5"
        />
        {/* Inner ring */}
        <circle
          cx="100"
          cy="100"
          r="30"
          fill="none"
          stroke="var(--hud)"
          strokeWidth="2"
          opacity="0.8"
        />
        {/* Center dot */}
        <circle
          cx="100"
          cy="100"
          r="4"
          fill="var(--hud)"
          filter="drop-shadow(0 0 4px var(--hud))"
        />
      </svg>
    </div>
  );
}
