"use client";

import { useEffect, useRef } from "react";

const NODE_COUNT = 55;
const CONNECT_DISTANCE = 150;
const NODE_SPEED = 0.3;
const NODE_RADIUS = 1.5;

const DARK_COLOR = "59, 130, 246";
const DARK_LINE_OPACITY = 0.18;
const DARK_NODE_OPACITY = 0.35;

const LIGHT_COLOR = "37, 99, 235";
const LIGHT_LINE_OPACITY = 0.28;
const LIGHT_NODE_OPACITY = 0.45;

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

function createNodes(w: number, h: number): Node[] {
  return Array.from({ length: NODE_COUNT }, () => {
    const angle = Math.random() * Math.PI * 2;
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      vx: Math.cos(angle) * NODE_SPEED * (0.5 + Math.random()),
      vy: Math.sin(angle) * NODE_SPEED * (0.5 + Math.random()),
    };
  });
}

function getThemeColors() {
  const isLight = document.documentElement.getAttribute("data-theme") === "light";
  return isLight
    ? { isLight: true, color: LIGHT_COLOR, lineOpacity: LIGHT_LINE_OPACITY, nodeOpacity: LIGHT_NODE_OPACITY }
    : { isLight: false, color: DARK_COLOR, lineOpacity: DARK_LINE_OPACITY, nodeOpacity: DARK_NODE_OPACITY };
}

export function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      canvas!.width = window.innerWidth * dpr;
      canvas!.height = window.innerHeight * dpr;
      canvas!.style.width = `${window.innerWidth}px`;
      canvas!.style.height = `${window.innerHeight}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      nodesRef.current = createNodes(window.innerWidth, window.innerHeight);
    }

    resize();
    window.addEventListener("resize", resize);

    function draw() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const nodes = nodesRef.current;
      const { isLight, color, lineOpacity, nodeOpacity } = getThemeColors();

      ctx!.clearRect(0, 0, w, h);

      if (isLight) {
        const g1 = ctx!.createRadialGradient(w * 0.35, h * 0.3, 0, w * 0.35, h * 0.3, w * 0.6);
        g1.addColorStop(0, "rgba(59, 130, 246, 0.08)");
        g1.addColorStop(1, "transparent");
        ctx!.fillStyle = g1;
        ctx!.fillRect(0, 0, w, h);

        const g2 = ctx!.createRadialGradient(w * 0.7, h * 0.75, 0, w * 0.7, h * 0.75, w * 0.45);
        g2.addColorStop(0, "rgba(37, 99, 235, 0.06)");
        g2.addColorStop(1, "transparent");
        ctx!.fillStyle = g2;
        ctx!.fillRect(0, 0, w, h);
      }

      for (const node of nodes) {
        node.x += node.vx;
        node.y += node.vy;

        if (node.x < 0) node.x += w;
        else if (node.x > w) node.x -= w;
        if (node.y < 0) node.y += h;
        else if (node.y > h) node.y -= h;
      }

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < CONNECT_DISTANCE) {
            const opacity = lineOpacity * (1 - dist / CONNECT_DISTANCE);
            ctx!.beginPath();
            ctx!.moveTo(nodes[i].x, nodes[i].y);
            ctx!.lineTo(nodes[j].x, nodes[j].y);
            ctx!.strokeStyle = `rgba(${color}, ${opacity})`;
            ctx!.lineWidth = 0.5;
            ctx!.stroke();
          }
        }
      }

      for (const node of nodes) {
        ctx!.beginPath();
        ctx!.arc(node.x, node.y, NODE_RADIUS, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${color}, ${nodeOpacity})`;
        ctx!.fill();
      }

      if (!prefersReduced) {
        rafRef.current = requestAnimationFrame(draw);
      }
    }

    draw();

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="animated-bg-root pointer-events-none fixed inset-0"
      style={{ zIndex: 1 }}
    />
  );
}
