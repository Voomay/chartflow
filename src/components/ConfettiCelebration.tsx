import React, { useEffect, useRef } from 'react';

interface ConfettiCelebrationProps {
  burstKey: number;
}

interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  color: string;
  shape: 'ribbon' | 'circle' | 'star' | 'diamond';
  rotation: number;
  rotationSpeed: number;
  tiltAngle: number;
  tiltSpeed: number;
  gravity: number;
  drag: number;
  wobble: number;
  wobbleSpeed: number;
  opacity: number;
  decay: number;
}

const CONFETTI_COLORS = [
  '#10b981', // Emerald
  '#34d399', // Mint Emerald
  '#fbbf24', // Gold
  '#f59e0b', // Amber Gold
  '#38bdf8', // Sky Blue
  '#60a5fa', // Royal Blue
  '#f43f5e', // Rose
  '#ec4899', // Pink
  '#a855f7', // Purple
  '#fde047', // Bright Yellow
  '#ffffff', // Shimmer White
];

const SHAPES: ConfettiParticle['shape'][] = ['ribbon', 'ribbon', 'circle', 'star', 'diamond'];

export const ConfettiCelebration: React.FC<ConfettiCelebrationProps> = ({ burstKey }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<ConfettiParticle[]>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!burstKey) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const spawnCannon = (
      originX: number,
      originY: number,
      baseAngleRad: number,
      spreadRad: number,
      count: number,
      minSpeed: number,
      maxSpeed: number
    ) => {
      for (let i = 0; i < count; i++) {
        const angle = baseAngleRad + (Math.random() - 0.5) * spreadRad;
        const speed = minSpeed + Math.random() * (maxSpeed - minSpeed);
        const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
        particlesRef.current.push({
          x: originX,
          y: originY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          width: 7 + Math.random() * 7,
          height: shape === 'ribbon' ? 12 + Math.random() * 8 : 7 + Math.random() * 6,
          color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
          shape,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.22,
          tiltAngle: Math.random() * Math.PI * 2,
          tiltSpeed: 0.08 + Math.random() * 0.14,
          gravity: 0.26 + Math.random() * 0.12,
          drag: 0.982 + Math.random() * 0.008,
          wobble: Math.random() * Math.PI * 2,
          wobbleSpeed: 0.06 + Math.random() * 0.08,
          opacity: 1,
          decay: 0.0045 + Math.random() * 0.004,
        });
      }
    };

    const w = window.innerWidth;
    const h = window.innerHeight;

    // Wave 1: Center-screen trophy burst + Left & Right angled cannons
    spawnCannon(w * 0.5, h * 0.52, -Math.PI / 2, Math.PI * 0.85, 75, 11, 24);
    spawnCannon(w * 0.12, h * 0.88, -Math.PI * 0.36, Math.PI * 0.32, 55, 15, 28);
    spawnCannon(w * 0.88, h * 0.88, -Math.PI * 0.64, Math.PI * 0.32, 55, 15, 28);

    // Wave 2: Secondary high celebratory salvo 220ms later
    const wave2Timer = window.setTimeout(() => {
      const cw = window.innerWidth;
      const ch = window.innerHeight;
      spawnCannon(cw * 0.28, ch * 0.75, -Math.PI * 0.44, Math.PI * 0.4, 50, 13, 25);
      spawnCannon(cw * 0.72, ch * 0.75, -Math.PI * 0.56, Math.PI * 0.4, 50, 13, 25);
    }, 220);

    // Wave 3: Golden finale burst 460ms later
    const wave3Timer = window.setTimeout(() => {
      const cw = window.innerWidth;
      const ch = window.innerHeight;
      spawnCannon(cw * 0.5, ch * 0.45, -Math.PI / 2, Math.PI * 0.95, 60, 10, 22);
    }, 460);

    const drawStar = (c: CanvasRenderingContext2D, r: number) => {
      c.beginPath();
      for (let i = 0; i < 5; i++) {
        const outerAngle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
        const px = Math.cos(outerAngle) * r;
        const py = Math.sin(outerAngle) * r;
        if (i === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      }
      c.closePath();
      c.fill();
    };

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const list = particlesRef.current;
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.vx *= p.drag;
        p.vy = p.vy * p.drag + p.gravity;
        p.wobble += p.wobbleSpeed;
        p.x += p.vx + Math.sin(p.wobble) * 0.9;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        p.tiltAngle += p.tiltSpeed;
        p.opacity -= p.decay;

        if (p.opacity <= 0.02 || p.y > canvas.height + 60) {
          list.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, p.opacity));
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        const scaleY = Math.cos(p.tiltAngle);
        ctx.scale(1, Math.abs(scaleY) < 0.18 ? 0.18 : scaleY);
        ctx.fillStyle = p.color;

        if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.width * 0.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.shape === 'star') {
          drawStar(ctx, p.width * 0.65);
        } else if (p.shape === 'diamond') {
          ctx.beginPath();
          ctx.moveTo(0, -p.height * 0.55);
          ctx.lineTo(p.width * 0.55, 0);
          ctx.lineTo(0, p.height * 0.55);
          ctx.lineTo(-p.width * 0.55, 0);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.fillRect(-p.width * 0.5, -p.height * 0.5, p.width, p.height);
        }
        ctx.restore();
      }

      if (particlesRef.current.length > 0) {
        rafRef.current = requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        rafRef.current = null;
      }
    };

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      clearTimeout(wave2Timer);
      clearTimeout(wave3Timer);
    };
  }, [burstKey]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-[120]"
    />
  );
};
