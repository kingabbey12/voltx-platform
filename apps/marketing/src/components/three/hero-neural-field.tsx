"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const POINT_COUNT = 84;
const CONNECTION_DISTANCE = 1.7;

function createPointPositions() {
  const positions = new Float32Array(POINT_COUNT * 3);

  for (let index = 0; index < POINT_COUNT; index += 1) {
    const ratio = index / POINT_COUNT;
    const angle = ratio * Math.PI * 12;
    const radius = 1.8 + Math.sin(index * 2.1) * 0.58 + (index % 5) * 0.14;
    const offset = index * 3;

    positions[offset] = Math.cos(angle) * radius;
    positions[offset + 1] = Math.sin(angle) * radius * 0.68;
    positions[offset + 2] = Math.sin(index * 1.9) * 0.92 - ratio * 1.8;
  }

  return positions;
}

function createConnectionPositions(points: Float32Array) {
  const segments: number[] = [];

  for (let first = 0; first < POINT_COUNT; first += 1) {
    for (let second = first + 1; second < POINT_COUNT; second += 1) {
      const firstOffset = first * 3;
      const secondOffset = second * 3;
      const firstX = points[firstOffset]!;
      const firstY = points[firstOffset + 1]!;
      const firstZ = points[firstOffset + 2]!;
      const secondX = points[secondOffset]!;
      const secondY = points[secondOffset + 1]!;
      const secondZ = points[secondOffset + 2]!;
      const dx = firstX - secondX;
      const dy = firstY - secondY;
      const dz = firstZ - secondZ;

      if (Math.sqrt(dx * dx + dy * dy + dz * dz) < CONNECTION_DISTANCE) {
        segments.push(firstX, firstY, firstZ, secondX, secondY, secondZ);
      }
    }
  }

  return new Float32Array(segments);
}

export function HeroNeuralField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reducedMotion = mediaQuery.matches;
    let frameId = 0;
    let disposed = false;
    let pointerX = 0;
    let pointerY = 0;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
      preserveDrawingBuffer: true,
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0, 8);

    const group = new THREE.Group();
    group.position.set(1.2, 0.1, 0);
    scene.add(group);

    const pointPositions = createPointPositions();
    const pointsGeometry = new THREE.BufferGeometry();
    pointsGeometry.setAttribute("position", new THREE.BufferAttribute(pointPositions, 3));
    const pointsMaterial = new THREE.PointsMaterial({
      color: 0xf4c84b,
      size: 0.055,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
    });
    group.add(new THREE.Points(pointsGeometry, pointsMaterial));

    const connectionsGeometry = new THREE.BufferGeometry();
    connectionsGeometry.setAttribute("position", new THREE.BufferAttribute(createConnectionPositions(pointPositions), 3));
    const connectionsMaterial = new THREE.LineBasicMaterial({ color: 0xe4aa34, transparent: true, opacity: 0.16 });
    group.add(new THREE.LineSegments(connectionsGeometry, connectionsMaterial));

    const halo = new THREE.Mesh(
      new THREE.RingGeometry(2.35, 2.37, 96),
      new THREE.MeshBasicMaterial({ color: 0xeac25d, transparent: true, opacity: 0.13, side: THREE.DoubleSide }),
    );
    halo.rotation.x = 0.2;
    group.add(halo);

    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const handlePointerMove = (event: PointerEvent) => {
      pointerX = event.clientX / window.innerWidth - 0.5;
      pointerY = event.clientY / window.innerHeight - 0.5;
    };

    const render = (time = 0) => {
      if (disposed) return;

      if (!reducedMotion) {
        group.rotation.y += (pointerX * 0.18 - group.rotation.y) * 0.018;
        group.rotation.x += (-pointerY * 0.1 - group.rotation.x) * 0.018;
        group.rotation.z = Math.sin(time * 0.0002) * 0.035;
        halo.rotation.z = time * 0.00008;
      }

      renderer.render(scene, camera);
      if (!reducedMotion) frameId = window.requestAnimationFrame(render);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    resize();
    render();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("pointermove", handlePointerMove);
      resizeObserver.disconnect();
      pointsGeometry.dispose();
      pointsMaterial.dispose();
      connectionsGeometry.dispose();
      connectionsMaterial.dispose();
      halo.geometry.dispose();
      (halo.material as THREE.Material).dispose();
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className="h-full w-full" />;
}