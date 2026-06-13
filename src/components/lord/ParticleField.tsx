import { useEffect, useState } from "react";

/**
 * ParticleField - Animated background particle effect
 */
export function ParticleField() {
  const [particles, setParticles] = useState<
    Array<{ id: number; x: number; y: number; vx: number; vy: number }>
  >([]);

  useEffect(() => {
    // Initialize particles
    const initialParticles = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
    }));
    setParticles(initialParticles);

    // Animation loop
    const interval = setInterval(() => {
      setParticles((prev) =>
        prev.map((p) => ({
          ...p,
          x: (p.x + p.vx + 100) % 100,
          y: (p.y + p.vy + 100) % 100,
        })),
      );
    }, 50);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <svg className="w-full h-full">
        {particles.map((p) => (
          <circle
            key={p.id}
            cx={`${p.x}%`}
            cy={`${p.y}%`}
            r="0.5"
            fill="var(--hud)"
            opacity="0.1"
          />
        ))}
      </svg>
    </div>
  );
}
