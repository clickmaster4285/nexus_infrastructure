"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

type LandRing = Array<[number, number]>;
type LandPolygon = { rings: LandRing[]; bounds: [number, number, number, number] };
type LandData = {
  features: Array<{
    geometry: null | { type: "Polygon" | "MultiPolygon"; coordinates: LandRing[] | LandRing[][] };
  }>;
};

const CITIES = [
  { name: "San Francisco", lat: 37.77, lon: -122.42 },
  { name: "New York", lat: 40.71, lon: -74.0 },
  { name: "São Paulo", lat: -23.55, lon: -46.63 },
  { name: "London", lat: 51.51, lon: -0.12 },
  { name: "Frankfurt", lat: 50.11, lon: 8.68 },
  { name: "Helsinki", lat: 60.17, lon: 24.94 },
  { name: "Cape Town", lat: -33.92, lon: 18.42 },
  { name: "Dubai", lat: 25.2, lon: 55.27 },
  { name: "Islamabad", lat: 33.69, lon: 73.06 },
  { name: "Singapore", lat: 1.35, lon: 103.82 },
  { name: "Tokyo", lat: 35.68, lon: 139.69 },
  { name: "Sydney", lat: -33.87, lon: 151.21 },
];

function ringBounds(ring: LandRing): [number, number, number, number] {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const [lon, lat] of ring) {
    minLon = Math.min(minLon, lon);
    minLat = Math.min(minLat, lat);
    maxLon = Math.max(maxLon, lon);
    maxLat = Math.max(maxLat, lat);
  }
  return [minLon, minLat, maxLon, maxLat];
}

function insideRing(lon: number, lat: number, ring: LandRing) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function makeLandPoints(data: LandData, radius: number) {
  const polygons: LandPolygon[] = [];
  for (const feature of data.features) {
    const geometry = feature.geometry;
    if (!geometry) continue;
    const pieces = geometry.type === "Polygon" ? [geometry.coordinates as LandRing[]] : (geometry.coordinates as LandRing[][]);
    for (const rings of pieces) {
      const bounds = ringBounds(rings[0]);
      polygons.push({ rings, bounds });
    }
  }

  const positions: number[] = [];
  const phases: number[] = [];
  const sampleCount = 32000;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let index = 0; index < sampleCount; index++) {
    const y = 1 - 2 * (index + 0.5) / sampleCount;
    const latitude = Math.asin(y);
    const longitude = ((index * goldenAngle + Math.PI) % (Math.PI * 2)) - Math.PI;
    const lat = latitude * 180 / Math.PI;
    const lon = longitude * 180 / Math.PI;
    let land = false;
    for (const polygon of polygons) {
      const [minLon, minLat, maxLon, maxLat] = polygon.bounds;
      if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) continue;
      if (!insideRing(lon, lat, polygon.rings[0])) continue;
      if (polygon.rings.slice(1).some((hole) => insideRing(lon, lat, hole))) continue;
      land = true;
      break;
    }
    if (!land) continue;
    const direction = new THREE.Vector3(
      Math.cos(latitude) * Math.cos(longitude),
      Math.sin(latitude),
      Math.cos(latitude) * Math.sin(longitude),
    );
    const point = direction.multiplyScalar(radius * 1.003);
    positions.push(point.x, point.y, point.z);
    phases.push((index % 997) / 997 * Math.PI * 2);
  }
  return { positions, phases };
}

function addOrbit(group: THREE.Group, radius: number, tiltX: number, tiltY: number, phase: number, color: number) {
  const orbit = new THREE.Group();
  orbit.rotation.set(tiltX, tiltY, phase);
  const points = new THREE.EllipseCurve(0, 0, radius * 1.32, radius * 0.48, 0, Math.PI * 2, false, 0).getPoints(180);
  const geometry = new THREE.BufferGeometry().setFromPoints(points.map((point) => new THREE.Vector3(point.x, point.y, 0)));
  const line = new THREE.LineLoop(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.42, depthWrite: false }));
  orbit.add(line);

  const satellite = new THREE.Mesh(
    new THREE.SphereGeometry(Math.max(2.4, radius * 0.018), 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xbbeeff, toneMapped: false }),
  );
  satellite.userData.orbitRadiusX = radius * 1.32;
  satellite.userData.orbitRadiusY = radius * 0.48;
  orbit.add(satellite);
  group.add(orbit);
  return { orbit, satellite };
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    mesh.geometry?.dispose();
    if (Array.isArray(mesh.material)) mesh.material.forEach((material) => material.dispose());
    else mesh.material?.dispose();
  });
}

export function AnimatedGlobe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const sceneHost = canvas?.parentElement;
    const panel = sceneHost?.closest<HTMLElement>(".login-left");
    if (!canvas || !sceneHost || !panel) return undefined;
    const hostElement: HTMLElement = sceneHost;
    const panelElement: HTMLElement = panel;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
    } catch {
      return undefined;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x020a22, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 4000);
    camera.position.z = 1800;
    const ambient = new THREE.AmbientLight(0x4e9bff, 1.15);
    const keyLight = new THREE.PointLight(0x38bdf8, 2.2, 1800);
    keyLight.position.set(-300, 270, 430);
    const fillLight = new THREE.PointLight(0x1f7bff, 1.35, 1600);
    fillLight.position.set(300, -160, -320);
    scene.add(ambient, keyLight, fillLight);

    const starPositions: number[] = [];
    const starColors: number[] = [];
    const starCount = 420;
    for (let i = 0; i < starCount; i++) {
      starPositions.push((Math.random() - 0.5) * 1500, (Math.random() - 0.5) * 900, -500 - Math.random() * 200);
      const brightness = 0.28 + Math.random() * 0.72;
      starColors.push(0.32 * brightness, 0.68 * brightness, brightness);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
    starGeometry.setAttribute("color", new THREE.Float32BufferAttribute(starColors, 3));
    const starMaterial = new THREE.PointsMaterial({ size: 1.8, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.76, depthWrite: false });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    const root = new THREE.Group();
    scene.add(root);
    let sceneWidth = 0;
    let sceneHeight = 0;
    let globeCenterX = 0;
    let globeCenterY = 0;
    let globeRadius = 0;
    let globeGroup: THREE.Group | null = null;
    let arcGroup: THREE.Group | null = null;
    let orbitObjects: Array<{ orbit: THREE.Group; satellite: THREE.Mesh }> = [];
    let cityRings: THREE.InstancedMesh | null = null;
    let cityMarkers: THREE.InstancedMesh | null = null;
    let cityDirections: THREE.Vector3[] = [];
    let cityPhases: number[] = [];
    let packets: Array<{ curve: THREE.QuadraticBezierCurve3; phase: number }> = [];
    let packetInstances: THREE.InstancedMesh | null = null;
    const cityTransform = new THREE.Object3D();
    const packetTransform = new THREE.Object3D();
    let baseRings: THREE.LineLoop[] = [];
    let globeDots: THREE.Points | null = null;
    let landAbort = new AbortController();
    let disposed = false;
    let resizeQueued = false;
    let resizeRaf = 0;
    let raf = 0;
    let inViewport = true;
    let lastFrame = 0;
    let elapsed = 0;
    let hover = false;
    let dragging = false;
    let pointerId: number | null = null;
    let previousPointer = { x: 0, y: 0 };
    let angularVelocity = 0;
    let tiltVelocity = 0;
    let parallax = { x: 0, y: 0 };
    let targetParallax = { x: 0, y: 0 };
    let reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotionChange = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
      if (arcGroup) arcGroup.visible = !reducedMotion;
    };
    mediaQuery.addEventListener("change", onMotionChange);

    const markerVectors = CITIES.map((city) => {
      const lat = (city.lat * Math.PI) / 180;
      const lon = (city.lon * Math.PI) / 180;
      return new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));
    });

    function clearGlobe() {
      for (const child of [...root.children]) {
        root.remove(child);
        disposeObject(child);
      }
      globeGroup = null;
      arcGroup = null;
      orbitObjects = [];
      cityRings = null;
      cityMarkers = null;
      cityDirections = [];
      cityPhases = [];
      packets = [];
      packetInstances = null;
      baseRings = [];
      globeDots = null;
    }

    function makeLineLoop(points: THREE.Vector3[], color: number, opacity: number) {
      const line = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }),
      );
      return line;
    }

    function buildGlobe() {
      if (!sceneWidth || !sceneHeight) return;
      clearGlobe();
      const leftPadding = parseFloat(getComputedStyle(panelElement).paddingLeft) || 0;
      const rightInset = Math.max(24, window.innerWidth * 0.035);
      const usableWidth = Math.max(180, sceneWidth - leftPadding - rightInset);
      const preferredDiameter = Math.max(340, Math.min(window.innerWidth * 0.38, 560));
      const mobileLayout = window.innerWidth < 1100;
      const verticalSpace = mobileLayout ? sceneHeight - 264 : sceneHeight - 372;
      const diameter = Math.max(180, Math.min(preferredDiameter, usableWidth - 80, verticalSpace));
      globeRadius = diameter / 2;
      const centerX = leftPadding + (sceneWidth - leftPadding - rightInset) / 2;
      const centerY = sceneHeight * (mobileLayout ? 0.55 : 0.5);
      globeCenterX = centerX;
      globeCenterY = centerY;
      hostElement.style.setProperty("--globe-diameter", `${diameter}px`);
      hostElement.style.setProperty("--globe-center-y", `${centerY}px`);
      hostElement.style.setProperty("--globe-top", `${centerY - globeRadius}px`);
      hostElement.style.setProperty("--globe-bottom", `${centerY + globeRadius}px`);

      camera.left = -sceneWidth / 2;
      camera.right = sceneWidth / 2;
      camera.top = sceneHeight / 2;
      camera.bottom = -sceneHeight / 2;
      camera.updateProjectionMatrix();
      camera.position.x = parallax.x;
      camera.position.y = parallax.y;
      camera.lookAt(parallax.x, parallax.y, 0);

      const globe = new THREE.Group();
      globe.position.set(centerX - sceneWidth / 2, sceneHeight / 2 - centerY, 0);
      globeGroup = globe;
      root.add(globe);

      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(globeRadius, 96, 72),
        new THREE.ShaderMaterial({
          vertexShader: `varying vec3 vNormal; varying vec3 vView; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); vNormal=normalize(normalMatrix*normal); vView=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
          fragmentShader: `varying vec3 vNormal; varying vec3 vView; void main(){ vec3 n=normalize(vNormal); vec3 v=normalize(vView); float facing=max(dot(n,v),0.0); float edge=1.0-smoothstep(0.04,0.96,facing); float light=max(dot(n,normalize(vec3(-0.45,0.62,0.65))),0.0); vec3 navy=vec3(0.008,0.039,0.133); vec3 blue=vec3(0.039,0.165,0.478); vec3 color=mix(navy,blue,pow(facing,0.72)); color+=vec3(0.02,0.12,0.24)*light*0.42; color+=vec3(0.015,0.11,0.18)*pow(edge,2.0); gl_FragColor=vec4(color,1.0); }`,
        }),
      );
      globe.add(sphere);

      const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(globeRadius * 1.12, 80, 64),
        new THREE.ShaderMaterial({
          vertexShader: `varying vec3 vNormal; varying vec3 vView; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); vNormal=normalize(normalMatrix*normal); vView=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
          fragmentShader: `varying vec3 vNormal; varying vec3 vView; void main(){ float facing=abs(dot(normalize(vNormal),normalize(vView))); float fresnel=pow(1.0-facing,4.2); float fade=smoothstep(0.0,0.95,fresnel); gl_FragColor=vec4(0.22,0.74,0.98,fresnel*0.27*fade); }`,
          transparent: true,
          blending: THREE.AdditiveBlending,
          side: THREE.BackSide,
          depthWrite: false,
        }),
      );
      atmosphere.renderOrder = 2;
      globe.add(atmosphere);

      const innerGlow = new THREE.Mesh(
        new THREE.SphereGeometry(globeRadius * 1.006, 80, 64),
        new THREE.ShaderMaterial({
          vertexShader: `varying vec3 vNormal; varying vec3 vView; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); vNormal=normalize(normalMatrix*normal); vView=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
          fragmentShader: `varying vec3 vNormal; varying vec3 vView; void main(){ float facing=max(dot(normalize(vNormal),normalize(vView)),0.0); float rim=pow(1.0-facing,3.0); gl_FragColor=vec4(0.12,0.55,0.95,rim*0.1); }`,
          transparent: true,
          blending: THREE.AdditiveBlending,
          side: THREE.BackSide,
          depthWrite: false,
        }),
      );
      innerGlow.renderOrder = 3;
      globe.add(innerGlow);

      const land = new THREE.Group();
      land.renderOrder = 3;
      globe.add(land);
      void fetch("/data/ne_110m_land.geojson", { signal: landAbort.signal })
        .then((response) => {
          if (!response.ok) throw new Error("Could not load the local land map");
          return response.json() as Promise<LandData>;
        })
        .then((data) => {
          if (disposed || !globeGroup || globe !== globeGroup) return;
          const dots = makeLandPoints(data, globeRadius);
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute("position", new THREE.Float32BufferAttribute(dots.positions, 3));
          geometry.setAttribute("aPhase", new THREE.Float32BufferAttribute(dots.phases, 1));
          const material = new THREE.ShaderMaterial({
            uniforms: { uTime: { value: 0 } },
            vertexShader: `attribute float aPhase; uniform float uTime; varying float vFacing; varying float vTwinkle; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); vec3 n=normalize(normalMatrix*normalize(position)); vFacing=max(dot(n,vec3(0.0,0.0,1.0)),0.0); vTwinkle=0.95+0.05*sin(uTime*1.4+aPhase); gl_PointSize=1.85; gl_Position=projectionMatrix*mv; }`,
            fragmentShader: `varying float vFacing; varying float vTwinkle; void main(){ float radius=length(gl_PointCoord-vec2(0.5)); float edge=1.0-smoothstep(0.31,0.5,radius); float brightness=(0.28+0.72*vFacing)*vTwinkle; gl_FragColor=vec4(vec3(0.49,0.83,0.98)*brightness,edge*0.96); }`,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          });
          const points = new THREE.Points(geometry, material);
          points.renderOrder = 3;
          land.add(points);
          globeDots = points;
        })
        .catch((error: unknown) => {
          if (!(error instanceof DOMException && error.name === "AbortError")) console.error("NEXUS globe land data:", error);
        });

      const gridPositions: number[] = [];
      const gridRadius = globeRadius * 1.0015;
      const addGridLine = (points: THREE.Vector3[]) => {
        for (let index = 0; index < points.length - 1; index++) {
          gridPositions.push(...points[index].toArray(), ...points[index + 1].toArray());
        }
      };
      for (let lat = -80; lat <= 80; lat += 20) {
        const latitude = lat * Math.PI / 180;
        const points = Array.from({ length: 181 }, (_, index) => {
          const longitude = (index * 2 - 180) * Math.PI / 180;
          return new THREE.Vector3(Math.cos(latitude) * Math.cos(longitude), Math.sin(latitude), Math.cos(latitude) * Math.sin(longitude)).multiplyScalar(gridRadius);
        });
        addGridLine(points);
      }
      for (let lon = -180; lon < 180; lon += 20) {
        const longitude = lon * Math.PI / 180;
        const points = Array.from({ length: 81 }, (_, index) => {
          const latitude = (index * 2 - 80) * Math.PI / 180;
          return new THREE.Vector3(Math.cos(latitude) * Math.cos(longitude), Math.sin(latitude), Math.cos(latitude) * Math.sin(longitude)).multiplyScalar(gridRadius);
        });
        addGridLine(points);
      }
      const gridGeometry = new THREE.BufferGeometry();
      gridGeometry.setAttribute("position", new THREE.Float32BufferAttribute(gridPositions, 3));
      const grid = new THREE.LineSegments(gridGeometry, new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.1, depthWrite: false }));
      grid.renderOrder = 2;
      globe.add(grid);

      const markerGeometry = new THREE.SphereGeometry(Math.max(3.2, globeRadius * 0.014), 14, 12);
      const markerMaterial = new THREE.MeshBasicMaterial({ color: 0x8aeaff, toneMapped: false });
      const cityMarkerMesh = new THREE.InstancedMesh(markerGeometry, markerMaterial, markerVectors.length);
      cityMarkers = cityMarkerMesh;
      cityMarkerMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const pulseGeometry = new THREE.RingGeometry(globeRadius * 0.021, globeRadius * 0.027, 32);
      const pulseMaterial = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.56, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
      const cityRingMesh = new THREE.InstancedMesh(pulseGeometry, pulseMaterial, markerVectors.length);
      cityRings = cityRingMesh;
      cityRingMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      markerVectors.forEach((direction, index) => {
        const position = direction.clone().multiplyScalar(globeRadius * 1.014);
        cityTransform.position.copy(position);
        cityTransform.scale.setScalar(1);
        cityTransform.updateMatrix();
        cityMarkerMesh.setMatrixAt(index, cityTransform.matrix);
        cityTransform.position.copy(position.clone().multiplyScalar(1.001));
        cityTransform.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
        cityTransform.updateMatrix();
        cityRings!.setMatrixAt(index, cityTransform.matrix);
        cityDirections.push(direction.clone());
        cityPhases.push(index * 0.53);
      });
      cityMarkerMesh.instanceMatrix.needsUpdate = true;
      cityMarkerMesh.renderOrder = 4;
      cityRingMesh.instanceMatrix.needsUpdate = true;
      cityRingMesh.renderOrder = 4;
      globe.add(cityMarkerMesh, cityRingMesh);

      const arcs = new THREE.Group();
      arcs.visible = !reducedMotion;
      globe.add(arcs);
      arcGroup = arcs;
      const packetGeometry = new THREE.SphereGeometry(Math.max(2.2, globeRadius * 0.011), 10, 8);
      const packetMaterial = new THREE.MeshBasicMaterial({ color: 0xcaf5ff, toneMapped: false });
      packetInstances = new THREE.InstancedMesh(packetGeometry, packetMaterial, 8);
      packetInstances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      packetInstances.renderOrder = 5;
      arcs.add(packetInstances);
      for (let i = 0; i < 8; i++) {
        const start = markerVectors[i].clone().multiplyScalar(globeRadius * 1.02);
        const end = markerVectors[(i * 5 + 3) % markerVectors.length].clone().multiplyScalar(globeRadius * 1.02);
        const middle = start.clone().add(end).normalize().multiplyScalar(globeRadius * (1.16 + (i % 3) * 0.035));
        const curve = new THREE.QuadraticBezierCurve3(start, middle, end);
        const tube = new THREE.Mesh(
          new THREE.TubeGeometry(curve, 48, Math.max(0.65, globeRadius * 0.0021), 5, false),
          new THREE.MeshBasicMaterial({ color: i % 2 ? 0x1f7bff : 0x38bdf8, transparent: true, opacity: 0.46, depthWrite: false, toneMapped: false }),
        );
        tube.renderOrder = 4;
        arcs.add(tube);
        packets.push({ curve, phase: i / 8 });
      }

      const orbitSettings = [
        { x: 0.32, y: -0.16, phase: 0, color: 0x38bdf8 },
        { x: -0.42, y: 0.34, phase: 0.9, color: 0x1f7bff },
        { x: 0.64, y: 0.18, phase: -0.6, color: 0x22d3ee },
      ];
      for (const setting of orbitSettings) {
        const orbit = addOrbit(root, globeRadius, setting.x, setting.y, setting.phase, setting.color);
        orbit.orbit.position.copy(globe.position);
        orbitObjects.push(orbit);
      }

      const base = new THREE.Group();
      base.position.set(centerX - sceneWidth / 2, sceneHeight / 2 - centerY - globeRadius * 1.16, -8);
      root.add(base);
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(globeRadius * 0.13, globeRadius * 0.25, globeRadius * 0.62, 32, 1, true),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.075, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
      );
      beam.position.y = globeRadius * 0.42;
      base.add(beam);
      for (let index = 0; index < 3; index++) {
        const radius = globeRadius * (0.72 + index * 0.21);
        const points = Array.from({ length: 112 }, (_, step) => {
          const angle = (step / 112) * Math.PI * 2;
          return new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius * 0.25);
        });
        const ring = makeLineLoop(points, index === 1 ? 0x22d3ee : 0x1f7bff, 0.48 - index * 0.08);
        ring.position.y = -globeRadius * 0.04;
        base.add(ring);
        baseRings.push(ring);
      }
      const core = new THREE.Mesh(
        new THREE.CircleGeometry(globeRadius * 0.38, 48),
        new THREE.MeshBasicMaterial({ color: 0x1f7bff, transparent: true, opacity: 0.09, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
      );
      core.rotation.x = -Math.PI / 2;
      core.position.y = -globeRadius * 0.025;
      base.add(core);
    }

    function resize() {
      const bounds = hostElement.getBoundingClientRect();
      const nextWidth = Math.max(1, bounds.width);
      const nextHeight = Math.max(1, bounds.height);
      if (Math.abs(nextWidth - sceneWidth) < 1 && Math.abs(nextHeight - sceneHeight) < 1) return;
      sceneWidth = nextWidth;
      sceneHeight = nextHeight;
      renderer.setSize(sceneWidth, sceneHeight, false);
      buildGlobe();
    }

    const resizeObserver = new ResizeObserver(() => {
      if (resizeQueued) return;
      resizeQueued = true;
      resizeRaf = requestAnimationFrame(() => { resizeQueued = false; resizeRaf = 0; resize(); });
    });
    resizeObserver.observe(hostElement);
    resize();

    const isOverGlobe = (event: PointerEvent) => {
      const bounds = hostElement.getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const y = event.clientY - bounds.top;
      return Math.hypot(x - globeCenterX, y - globeCenterY) <= globeRadius * 1.08;
    };
    const onPointerEnter = (event: PointerEvent) => { hover = isOverGlobe(event); };
    const onPointerLeave = () => { hover = false; dragging = false; pointerId = null; };
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || !isOverGlobe(event)) return;
      dragging = true;
      pointerId = event.pointerId;
      previousPointer = { x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = "grabbing";
    };
    const onPointerMove = (event: PointerEvent) => {
      const bounds = hostElement.getBoundingClientRect();
      hover = isOverGlobe(event);
      targetParallax = {
        x: ((event.clientX - bounds.left) / bounds.width - 0.5) * 10,
        y: -((event.clientY - bounds.top) / bounds.height - 0.5) * 8,
      };
      if (!dragging || pointerId !== event.pointerId || !globeGroup) return;
      const dx = event.clientX - previousPointer.x;
      const dy = event.clientY - previousPointer.y;
      previousPointer = { x: event.clientX, y: event.clientY };
      angularVelocity = dx * 0.0042;
      tiltVelocity = dy * 0.0022;
      globeGroup.rotation.y += angularVelocity;
      globeGroup.rotation.x = THREE.MathUtils.clamp(globeGroup.rotation.x + tiltVelocity, -0.52, 0.52);
    };
    const onPointerUp = (event: PointerEvent) => {
      if (pointerId !== event.pointerId) return;
      dragging = false;
      pointerId = null;
      canvas.style.cursor = "grab";
    };
    canvas.addEventListener("pointerenter", onPointerEnter);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);

    function draw(time: number) {
      if (disposed || document.hidden) return;
      raf = requestAnimationFrame(draw);
      if (time - lastFrame < 1000 / 60) return;
      const delta = Math.min((time - lastFrame) / 1000, 0.04);
      lastFrame = time;
      elapsed += delta;
      if (globeGroup) {
        if (!dragging) globeGroup.rotation.y += delta * (reducedMotion ? 0.012 : hover ? 0.095 : 0.26);
        if (!dragging) {
          globeGroup.rotation.y += angularVelocity * delta * 60;
          globeGroup.rotation.x = THREE.MathUtils.clamp(globeGroup.rotation.x + tiltVelocity * delta * 60, -0.52, 0.52);
          angularVelocity *= Math.pow(reducedMotion ? 0.9 : 0.965, delta * 60);
          tiltVelocity *= Math.pow(0.91, delta * 60);
        }
      }
      parallax.x += (targetParallax.x - parallax.x) * 0.025;
      parallax.y += (targetParallax.y - parallax.y) * 0.025;
      camera.position.x = parallax.x;
      camera.position.y = parallax.y;
      camera.lookAt(parallax.x, parallax.y, 0);
      stars.rotation.z = reducedMotion ? 0 : Math.sin(elapsed * 0.07) * 0.008;
      starMaterial.opacity = reducedMotion ? 0.65 : 0.62 + (Math.sin(elapsed * 0.6) + 1) * 0.08;
      if (cityRings) {
        cityDirections.forEach((direction, index) => {
          const pulse = reducedMotion ? 1 : 1 + 0.11 * (0.5 + 0.5 * Math.sin(elapsed * (Math.PI * 2 / 1.8) + cityPhases[index]));
          cityTransform.position.copy(direction).multiplyScalar(globeRadius * 1.015);
          cityTransform.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
          cityTransform.scale.setScalar(pulse);
          cityTransform.updateMatrix();
          cityRings?.setMatrixAt(index, cityTransform.matrix);
        });
        cityRings.instanceMatrix.needsUpdate = true;
      }
      if (packetInstances) {
        packets.forEach(({ curve, phase }, index) => {
          const progress = (elapsed * 0.3 + phase) % 1;
          const fade = reducedMotion ? 0 : Math.max(0, Math.min(1, progress / 0.1, (1 - progress) / 0.16));
          packetTransform.position.copy(curve.getPointAt(progress));
          packetTransform.scale.setScalar(fade);
          packetTransform.updateMatrix();
          packetInstances?.setMatrixAt(index, packetTransform.matrix);
        });
        packetInstances.instanceMatrix.needsUpdate = true;
      }
      orbitObjects.forEach(({ orbit, satellite }, index) => {
        if (!reducedMotion) orbit.rotation.z += delta * (index % 2 ? -0.12 : 0.09);
        const angle = elapsed * (0.68 + index * 0.09) + index * 1.8;
        satellite.position.set(Math.cos(angle) * satellite.userData.orbitRadiusX, Math.sin(angle) * satellite.userData.orbitRadiusY, 0);
      });
      if (!reducedMotion) {
        const pulse = 1 + Math.sin(elapsed * 1.8) * 0.018;
        baseRings.forEach((ring, index) => ring.scale.set(pulse + index * 0.004, 1, pulse + index * 0.004));
      }
      if (globeDots) (globeDots.material as THREE.ShaderMaterial).uniforms.uTime.value = reducedMotion ? 0 : elapsed;
      renderer.render(scene, camera);
    }

    function scheduleFrame() {
      if (!disposed && !document.hidden && inViewport && !raf) raf = requestAnimationFrame(draw);
    }

    const onVisibilityChange = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else {
        lastFrame = 0;
        scheduleFrame();
      }
    };
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      inViewport = entry.isIntersecting;
      if (inViewport) {
        lastFrame = 0;
        scheduleFrame();
      } else {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    });
    intersectionObserver.observe(hostElement);
    document.addEventListener("visibilitychange", onVisibilityChange);
    scheduleFrame();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(resizeRaf);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      landAbort.abort();
      mediaQuery.removeEventListener("change", onMotionChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      canvas.removeEventListener("pointerenter", onPointerEnter);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      clearGlobe();
      disposeObject(scene);
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className="login-globe-canvas absolute inset-0 h-full w-full touch-none" aria-label="Interactive 3D globe showing NEXUS data center connections" role="img" />;
}
