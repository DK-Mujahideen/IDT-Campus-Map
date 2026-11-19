import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  Camera,
  CameraOff,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Compass,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import type { CalculatedRoute } from '../types/campus';
import {
  createContactShadowTexture,
  createHeroDirectionalArrow,
  createPathChevronMarker,
  createPathGuideRails,
  createWalkwayTextures,
  createWaypointBeacon,
  createWaypointSignTexture,
} from './ar/arWayfindingModels';

interface ARCameraNavigationViewProps {
  activeRoute: CalculatedRoute | null;
  onExitCameraView: () => void;
  heightClass?: string;
}

type CameraStatus = 'initializing' | 'live' | 'unavailable' | 'denied' | 'simulated';

interface OrientationEventWithWebkit extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
}

interface DeviceOrientationEventCtorWithPermission {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

function normalizeDegrees360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function normalizeSignedDegrees(deg: number): number {
  let d = ((deg + 180) % 360 + 360) % 360 - 180;
  if (d === -180) d = 180;
  return d;
}

function wrapRadians(rad: number): number {
  let r = (rad + Math.PI) % (Math.PI * 2);
  if (r < 0) r += Math.PI * 2;
  return r - Math.PI;
}

function cardinalLabel(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round(normalizeDegrees360(deg) / 45) % 8;
  return dirs[idx];
}

function computeSvgBearingDeg(fromX: number, fromY: number, toX: number, toY: number): number {
  const dx = toX - fromX;
  const dy = toY - fromY;
  // On SVG campus map: North is -Y, East is +X
  const rad = Math.atan2(dx, -dy);
  return normalizeDegrees360((rad * 180) / Math.PI);
}

function getManeuverInfo(relativeDeg: number): {
  label: string;
  direction: 'straight' | 'slight-right' | 'right' | 'slight-left' | 'left' | 'uturn';
} {
  const abs = Math.abs(relativeDeg);
  if (abs <= 18) return { label: 'Continue Straight', direction: 'straight' };
  if (abs > 135) return { label: 'Turn Around', direction: 'uturn' };
  if (relativeDeg > 0) {
    return abs <= 62
      ? { label: 'Bear Right', direction: 'slight-right' }
      : { label: 'Turn Right', direction: 'right' };
  }
  return abs <= 62
    ? { label: 'Bear Left', direction: 'slight-left' }
    : { label: 'Turn Left', direction: 'left' };
}

function detectSoftwareGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export function ARCameraNavigationView({
  activeRoute,
  onExitCameraView,
  heightClass = 'h-[580px]',
}: ARCameraNavigationViewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  const cameraRequestIdRef = useRef(0);

  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('initializing');
  const [cameraMessage, setCameraMessage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);

  const [activeSegmentIdx, setActiveSegmentIdx] = useState(0);
  const [userHeadingDeg, setUserHeadingDeg] = useState(0);
  const [sensorCompassActive, setSensorCompassActive] = useState(false);
  const [needsIosCompassPermission, setNeedsIosCompassPermission] = useState(false);

  const dragStateRef = useRef<{ active: boolean; lastX: number }>({ active: false, lastX: 0 });

  // Reset segment index whenever route changes
  const routeSignature = activeRoute ? activeRoute.nodeIds.join('->') : '';
  useEffect(() => {
    setActiveSegmentIdx(0);
  }, [routeSignature]);

  const totalSegments = activeRoute?.segments.length ?? 0;
  const clampedSegmentIdx = totalSegments > 0 ? Math.min(activeSegmentIdx, totalSegments - 1) : 0;

  const currentSegmentData = useMemo(() => {
    if (!activeRoute || activeRoute.nodes.length === 0) {
      return null;
    }

    if (activeRoute.segments.length === 0) {
      const node = activeRoute.nodes[0];
      return {
        fromLabel: node.label,
        toLabel: node.label,
        pathLabel: 'Destination reached',
        segmentDistance: 0,
        remainingDistance: 0,
        remainingMinutes: 0,
        targetBearingDeg: 0,
        isArrived: true,
        accessible: true,
      };
    }

    const seg = activeRoute.segments[clampedSegmentIdx];
    const fromNode = activeRoute.nodes[clampedSegmentIdx];
    const toNode = activeRoute.nodes[clampedSegmentIdx + 1] ?? fromNode;
    const remainingDistance = activeRoute.segments
      .slice(clampedSegmentIdx)
      .reduce((acc, s) => acc + Math.round(s.distanceMeters), 0);

    const targetBearingDeg = computeSvgBearingDeg(fromNode.x, fromNode.y, toNode.x, toNode.y);

    return {
      fromLabel: fromNode.label,
      toLabel: toNode.label,
      pathLabel: seg.pathLabel || 'Campus Walkway',
      segmentDistance: Math.round(seg.distanceMeters),
      remainingDistance,
      remainingMinutes: Math.max(1, Math.ceil(remainingDistance / 78)),
      targetBearingDeg,
      isArrived: false,
      accessible: seg.accessible,
    };
  }, [activeRoute, clampedSegmentIdx]);

  // Auto-align simulated initial heading slightly offset so user immediately sees directional steering
  useEffect(() => {
    if (!sensorCompassActive && currentSegmentData) {
      setUserHeadingDeg(normalizeDegrees360(currentSegmentData.targetBearingDeg));
    }
  }, [routeSignature, clampedSegmentIdx, sensorCompassActive]);

  const relativeBearingDeg = useMemo(() => {
    if (!currentSegmentData) return 0;
    return normalizeSignedDegrees(currentSegmentData.targetBearingDeg - userHeadingDeg);
  }, [currentSegmentData, userHeadingDeg]);

  const maneuver = useMemo(() => getManeuverInfo(relativeBearingDeg), [relativeBearingDeg]);

  // Mutable ref read inside the Three.js 60fps animation loop without recreating the renderer
  const arStateRef = useRef({
    relativeBearingRad: 0,
    showSimulatedBackdrop: true,
    isArrived: false,
    waypointLabel: 'Next Waypoint',
    distanceLabel: '0 m ahead',
    signDirty: true,
  });

  useEffect(() => {
    const label = currentSegmentData?.toLabel ?? 'Campus Destination';
    const distLabel = currentSegmentData?.isArrived
      ? 'ARRIVED'
      : `${currentSegmentData?.segmentDistance ?? 0} m · ${maneuver.label}`;
    const changedSign =
      arStateRef.current.waypointLabel !== label ||
      arStateRef.current.distanceLabel !== distLabel;

    arStateRef.current.relativeBearingRad = (relativeBearingDeg * Math.PI) / 180;
    arStateRef.current.showSimulatedBackdrop = cameraStatus !== 'live';
    arStateRef.current.isArrived = Boolean(currentSegmentData?.isArrived);
    arStateRef.current.waypointLabel = label;
    arStateRef.current.distanceLabel = distLabel;
    if (changedSign) {
      arStateRef.current.signDirty = true;
    }
  }, [relativeBearingDeg, cameraStatus, currentSegmentData, maneuver.label]);

  // Keyboard shortcut H to toggle bottom control dock & Escape to exit fullscreen
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => !prev);
      } else if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullscreen]);

  // Stop active camera tracks helper
  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Start device camera stream
  const startCamera = useCallback(
    async (preferredFacing: 'environment' | 'user') => {
      const reqId = ++cameraRequestIdRef.current;
      stopCameraStream();
      setCameraStatus('initializing');
      setCameraMessage(null);

      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setCameraStatus('unavailable');
        setCameraMessage(
          'Device camera API is unavailable in this browser. Running interactive 3D Campus AR Preview.'
        );
        return;
      }

      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: preferredFacing },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });
        } catch {
          // Fallback for desktop webcams without facingMode support
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }

        // Release stream immediately if unmounted or superseded by a newer request
        if (!mountedRef.current || reqId !== cameraRequestIdRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setCameraStatus('live');
      } catch (err) {
        if (!mountedRef.current || reqId !== cameraRequestIdRef.current) return;
        const name = err instanceof DOMException ? err.name : '';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setCameraStatus('denied');
          setCameraMessage(
            'Camera access was blocked. Allow camera permission to overlay markers on live video, or explore in 3D AR Preview below.'
          );
        } else {
          setCameraStatus('unavailable');
          setCameraMessage(
            'No active camera was detected on this device. Displaying 3D Campus AR Preview with live directional guidance.'
          );
        }
      }
    },
    [stopCameraStream]
  );

  // Track mount lifecycle and clean up active camera stream on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cameraRequestIdRef.current += 1;
      stopCameraStream();
    };
  }, [stopCameraStream]);

  // Initialize camera on mount & facingMode change (unless user explicitly chose simulated mode)
  useEffect(() => {
    if (cameraStatus === 'simulated') return;
    void startCamera(facingMode);
  }, [facingMode, startCamera]);

  // Device compass listener (magnetometer) when available on mobile devices
  useEffect(() => {
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return;

    const ctor = window.DeviceOrientationEvent as unknown as DeviceOrientationEventCtorWithPermission;
    if (typeof ctor?.requestPermission === 'function') {
      setNeedsIosCompassPermission(true);
      return;
    }

    const handleOrientation = (evt: DeviceOrientationEvent) => {
      const webkitEvt = evt as OrientationEventWithWebkit;
      let heading: number | null = null;
      if (typeof webkitEvt.webkitCompassHeading === 'number' && !Number.isNaN(webkitEvt.webkitCompassHeading)) {
        heading = webkitEvt.webkitCompassHeading;
      } else if (typeof evt.alpha === 'number' && !Number.isNaN(evt.alpha)) {
        heading = 360 - evt.alpha;
      }
      if (heading !== null) {
        setSensorCompassActive(true);
        setUserHeadingDeg(normalizeDegrees360(heading));
      }
    };

    window.addEventListener('deviceorientation', handleOrientation, true);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, []);

  const handleEnableIosCompass = async () => {
    const ctor = window.DeviceOrientationEvent as unknown as DeviceOrientationEventCtorWithPermission;
    if (typeof ctor?.requestPermission !== 'function') return;
    try {
      const res = await ctor.requestPermission();
      if (res === 'granted') {
        setNeedsIosCompassPermission(false);
        const handler = (evt: DeviceOrientationEvent) => {
          const webkitEvt = evt as OrientationEventWithWebkit;
          if (typeof webkitEvt.webkitCompassHeading === 'number') {
            setSensorCompassActive(true);
            setUserHeadingDeg(normalizeDegrees360(webkitEvt.webkitCompassHeading));
          }
        };
        window.addEventListener('deviceorientation', handler, true);
      }
    } catch {
      // User can continue using manual heading drag/alignment
    }
  };

  // Dedicated isolated Three.js WebGL scene mounted once in ref container
  useEffect(() => {
    const mountEl = canvasMountRef.current;
    if (!mountEl) return;

    const isSoftwareGl = detectSoftwareGl();
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);

    const width = Math.max(1, mountEl.clientWidth);
    const height = Math.max(1, mountEl.clientHeight);
    renderer.setSize(width, height, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    mountEl.innerHTML = '';
    mountEl.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    // Studio PBR reflections via RoomEnvironment + PMREMGenerator
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(58, width / height, 0.1, 120);
    camera.position.set(0, 1.72, 3.8);
    camera.lookAt(0, 1.05, -6);

    // Warm key light + cool HemisphereLight fill + rim backlight
    const hemiLight = new THREE.HemisphereLight(0xbfdbfe, 0x1e293b, 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff4e0, 1.85);
    keyLight.position.set(6, 11, 7);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 35;
    keyLight.shadow.camera.left = -10;
    keyLight.shadow.camera.right = 10;
    keyLight.shadow.camera.top = 10;
    keyLight.shadow.camera.bottom = -10;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x60a5fa, 0.9);
    rimLight.position.set(-5, 6, -10);
    scene.add(rimLight);

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const contactShadowTex = createContactShadowTexture('#07142b', 0.55);

    // Fallback Simulated Campus Corridor Backdrop (hidden when live device camera is streaming)
    const simulatedGroup = new THREE.Group();
    const walkwayTextures = createWalkwayTextures(maxAnisotropy);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.92,
      metalness: 0.05,
    });
    const groundPlane = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), groundMat);
    groundPlane.rotation.x = -Math.PI / 2;
    groundPlane.position.y = -0.02;
    groundPlane.receiveShadow = true;
    simulatedGroup.add(groundPlane);

    const walkwayMat = new THREE.MeshStandardMaterial({
      map: walkwayTextures.map,
      roughnessMap: walkwayTextures.roughnessMap,
      roughness: 0.85,
      metalness: 0.08,
    });
    const walkwayMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 48), walkwayMat);
    walkwayMesh.rotation.x = -Math.PI / 2;
    walkwayMesh.position.set(0, 0, -18);
    walkwayMesh.receiveShadow = true;
    simulatedGroup.add(walkwayMesh);

    const gridHelper = new THREE.GridHelper(60, 30, 0x1e3a8a, 0x172554);
    gridHelper.position.y = -0.01;
    simulatedGroup.add(gridHelper);
    scene.add(simulatedGroup);

    const simulatedFog = new THREE.FogExp2(0x0b1730, 0.036);
    const simulatedBg = new THREE.Color(0x0b1730);

    // Primary Wayfinding Pivot Rig (rotates smoothly to match target relative bearing)
    const guidanceRig = new THREE.Group();
    scene.add(guidanceRig);

    // 1. Composite 7-part Hero 3D Directional Arrow
    const { group: arrowGroup, bodyGroup: arrowBody } = createHeroDirectionalArrow(contactShadowTex);
    arrowGroup.position.set(0, 0, -1.65);
    guidanceRig.add(arrowGroup);

    // 2. Twin Illuminated Path Guide Rails (TubeGeometry)
    const guideRails = createPathGuideRails();
    guidanceRig.add(guideRails);

    // 3. Sequence of 5 composite ground chevrons flowing forward along the walking path
    const chevronCount = 5;
    const chevrons: THREE.Group[] = [];
    for (let i = 0; i < chevronCount; i++) {
      const ch = createPathChevronMarker(contactShadowTex);
      ch.position.set(0, 0, -3.2 - i * 2.1);
      guidanceRig.add(ch);
      chevrons.push(ch);
    }

    // 4. Composite 6-part Destination / Next-Waypoint Beacon ahead on path
    let currentSignTex = createWaypointSignTexture(
      arStateRef.current.waypointLabel,
      arStateRef.current.distanceLabel,
      maxAnisotropy
    );
    const beacon = createWaypointBeacon(contactShadowTex, currentSignTex);
    beacon.group.position.set(0, 0, -13.2);
    guidanceRig.add(beacon.group);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Resize observer keeps aspect ratio sharp across sidebar / fullscreen transitions
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const w = Math.max(1, Math.floor(entry.contentRect.width));
      const h = Math.max(1, Math.floor(entry.contentRect.height));
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    });
    resizeObserver.observe(mountEl);

    // Animation loop with exponential damping and zero per-frame allocations
    let frameId = 0;
    let disposed = false;
    let smoothedYaw = 0;
    const clock = new THREE.Clock();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const status = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (status === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const tick = () => {
      if (disposed) return;

      const dt = Math.min(0.05, clock.getDelta());
      const elapsed = clock.getElapsedTime();
      const state = arStateRef.current;

      // Toggle simulated backdrop vs transparent live camera overlay
      simulatedGroup.visible = state.showSimulatedBackdrop;
      if (state.showSimulatedBackdrop) {
        if (scene.background !== simulatedBg) scene.background = simulatedBg;
        if (scene.fog !== simulatedFog) scene.fog = simulatedFog;
      } else {
        if (scene.background !== null) scene.background = null;
        if (scene.fog !== null) scene.fog = null;
      }

      // Refresh waypoint signboard texture when user advances step or changes route
      if (state.signDirty) {
        state.signDirty = false;
        const nextTex = createWaypointSignTexture(
          state.waypointLabel,
          state.distanceLabel,
          maxAnisotropy
        );
        beacon.signMaterial.map = nextTex;
        beacon.signMaterial.needsUpdate = true;
        currentSignTex.dispose();
        currentSignTex = nextTex;
      }

      // Smooth damped yaw alignment toward target relative bearing
      const targetYaw = -state.relativeBearingRad;
      const deltaAngle = wrapRadians(targetYaw - smoothedYaw);
      const dampFactor = 1 - Math.exp(-8 * dt);
      smoothedYaw = wrapRadians(smoothedYaw + deltaAngle * dampFactor);
      guidanceRig.rotation.y = smoothedYaw;

      // Gentle buoyant hover & subtle bank on hero directional arrow
      arrowBody.position.y = 1.12 + Math.sin(elapsed * 2.6) * 0.085;
      arrowBody.rotation.z = THREE.MathUtils.clamp(deltaAngle * 0.35, -0.32, 0.32);

      // Flowing ground pathway chevrons advancing toward the destination beacon
      const flowSpeed = state.isArrived ? 0.3 : 2.1;
      const span = 10.5;
      for (let i = 0; i < chevrons.length; i++) {
        const phase = ((elapsed * flowSpeed + (i / chevronCount) * span) % span) / span;
        const zPos = -2.6 - phase * 9.8;
        const scalePulse = 0.85 + Math.sin(phase * Math.PI) * 0.25;
        chevrons[i].position.z = zPos;
        chevrons[i].scale.setScalar(scalePulse);
      }

      // Rotating gimbal ring & faceted crest on destination beacon
      beacon.ringMesh.rotation.y = elapsed * 1.15;
      beacon.ringMesh.rotation.x = Math.sin(elapsed * 0.9) * 0.25;
      beacon.crestMesh.rotation.y = -elapsed * 1.4;
      beacon.crestMesh.position.y = 2.08 + Math.sin(elapsed * 2.2) * 0.07;

      // Keep waypoint signboard facing the viewer cleanly
      beacon.signMesh.rotation.y = -smoothedYaw;

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });

      contactShadowTex.dispose();
      walkwayTextures.map.dispose();
      walkwayTextures.roughnessMap.dispose();
      currentSignTex.dispose();
      envTarget.dispose();
      renderer.dispose();
      mountEl.innerHTML = '';
    };
  }, []);

  // Drag-to-pan compass heading on desktop/indoor preview
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragStateRef.current = { active: true, lastX: e.clientX };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current.active) return;
    const dx = e.clientX - dragStateRef.current.lastX;
    dragStateRef.current.lastX = e.clientX;
    setSensorCompassActive(false);
    setUserHeadingDeg((prev) => normalizeDegrees360(prev - dx * 0.35));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    dragStateRef.current.active = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const renderManeuverIcon = () => {
    switch (maneuver.direction) {
      case 'straight':
        return <ArrowUp className="w-5 h-5 text-sky-300" />;
      case 'slight-right':
        return <ArrowUpRight className="w-5 h-5 text-sky-300" />;
      case 'right':
        return <ArrowRight className="w-5 h-5 text-sky-300" />;
      case 'slight-left':
        return <ArrowUpLeft className="w-5 h-5 text-sky-300" />;
      case 'left':
        return <ArrowLeft className="w-5 h-5 text-sky-300" />;
      case 'uturn':
        return <ArrowDown className="w-5 h-5 text-amber-300" />;
    }
  };

  // Compass tick strip around current user heading
  const compassTicks = useMemo(() => {
    const ticks: Array<{ deg: number; offsetPx: number; label: string }> = [];
    for (let offset = -60; offset <= 60; offset += 15) {
      const deg = normalizeDegrees360(Math.round((userHeadingDeg + offset) / 15) * 15);
      const diff = normalizeSignedDegrees(deg - userHeadingDeg);
      if (Math.abs(diff) <= 65) {
        const majorLabels: Record<number, string> = {
          0: 'N',
          45: 'NE',
          90: 'E',
          135: 'SE',
          180: 'S',
          225: 'SW',
          270: 'W',
          315: 'NW',
        };
        ticks.push({
          deg,
          offsetPx: diff * 2.2,
          label: majorLabels[deg] ?? `${deg}°`,
        });
      }
    }
    return ticks;
  }, [userHeadingDeg]);

  const targetTickOffsetPx = Math.max(-132, Math.min(132, relativeBearingDeg * 2.2));

  const containerClasses = isFullscreen
    ? 'fixed inset-0 z-50 w-screen h-screen bg-[#0B1730] overflow-hidden select-none'
    : `relative w-full ${heightClass} rounded-xl border border-slate-200 bg-[#0B1730] overflow-hidden shadow-xs select-none`;

  return (
    <div className={containerClasses}>
      {/* Layer 1: Live Device Camera Video Stream */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
          cameraStatus === 'live' ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Layer 2: Dedicated Isolated Three.js 3D Wayfinding WebGL Canvas */}
      <div
        ref={canvasMountRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing touch-none"
        aria-label="3D AR directional wayfinding overlay — drag horizontally to rotate heading"
      />

      {/* Layer 3: Top Minimal Directional HUD (No backdrop-filter over WebGL, no pulsing dots) */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-col gap-2 pointer-events-none">
        <div className="flex items-start justify-between gap-2">
          {/* Primary Maneuver & Distance Banner */}
          <div className="pointer-events-auto bg-[#0B1730]/92 border border-blue-400/35 rounded-xl px-4 py-2.5 text-white shadow-lg max-w-xl">
            {currentSegmentData ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-600/30 border border-sky-400/40 flex items-center justify-center shrink-0">
                  {renderManeuverIcon()}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-medium text-sky-300">
                    <span>{maneuver.label}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {currentSegmentData.isArrived
                        ? 'Destination Reached'
                        : `${currentSegmentData.segmentDistance} m to ${currentSegmentData.toLabel}`}
                    </span>
                  </div>
                  <div className="font-display text-sm font-semibold text-white truncate mt-0.5">
                    {currentSegmentData.isArrived
                      ? `You have arrived at ${currentSegmentData.toLabel}`
                      : `Follow ${currentSegmentData.pathLabel} → ${currentSegmentData.toLabel}`}
                  </div>
                  {!currentSegmentData.isArrived && (
                    <div className="text-[11px] text-slate-300 font-mono tabular-nums mt-0.5">
                      Total remaining: {currentSegmentData.remainingDistance} m · ~
                      {currentSegmentData.remainingMinutes} min walk
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-200">
                Select a starting point and destination to activate AR directional markers.
              </div>
            )}
          </div>

          {/* Right Top Compact Actions: Fullscreen + Back to Map */}
          <div className="pointer-events-auto flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsFullscreen((prev) => !prev)}
              aria-label={isFullscreen ? 'Exit fullscreen camera view' : 'Expand camera view fullscreen'}
              className="inline-flex items-center gap-1.5 px-2.5 py-2 bg-[#0B1730]/92 hover:bg-[#13254B] text-white border border-blue-400/35 rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer"
            >
              {isFullscreen ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsFullscreen(false);
                onExitCameraView();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#0F2557] hover:bg-blue-800 text-white border border-blue-400/40 rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer"
            >
              <MapIcon className="w-3.5 h-3.5" />
              Map View
            </button>
          </div>
        </div>

        {/* Sleek Horizontal Compass Bearing Tape */}
        <div className="mx-auto w-full max-w-xs bg-[#0B1730]/88 border border-blue-400/30 rounded-lg px-3 py-1.5 text-white overflow-hidden">
          <div className="relative h-6 flex items-center justify-center">
            {compassTicks.map((tick) => (
              <span
                key={`${tick.deg}-${Math.round(tick.offsetPx)}`}
                style={{ transform: `translateX(${tick.offsetPx}px)` }}
                className="absolute text-[10px] font-mono text-slate-300 tabular-nums"
              >
                {tick.label}
              </span>
            ))}
            {/* Target Bearing Triangle Marker */}
            {currentSegmentData && !currentSegmentData.isArrived && (
              <div
                style={{ transform: `translateX(${targetTickOffsetPx}px)` }}
                className="absolute -bottom-0.5 w-2 h-2 rotate-45 bg-sky-400 border border-white"
                title={`Target bearing ${Math.round(currentSegmentData.targetBearingDeg)}°`}
              />
            )}
            {/* Center Heading Reference Hairline */}
            <div className="absolute top-0 bottom-0 w-px bg-white/70" />
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-300 tabular-nums border-t border-white/10 pt-1 mt-0.5">
            <span>
              HDG {Math.round(userHeadingDeg)}° {cardinalLabel(userHeadingDeg)}
            </span>
            <span>
              {cameraStatus === 'live' ? 'LIVE CAMERA AR' : '3D CAMPUS AR PREVIEW'}
            </span>
            <span>
              TGT {currentSegmentData ? `${Math.round(currentSegmentData.targetBearingDeg)}°` : '--'}
            </span>
          </div>
        </div>

        {/* Camera fallback / permission notice (compact, dismissible/actionable) */}
        {cameraMessage && cameraStatus !== 'live' && (
          <div className="pointer-events-auto mx-auto max-w-lg bg-[#0B1730]/92 border border-amber-400/40 text-amber-100 rounded-lg px-3.5 py-2 text-[11px] flex flex-wrap items-center justify-between gap-2">
            <span>{cameraMessage}</span>
            <button
              type="button"
              onClick={() => void startCamera(facingMode)}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-md font-medium whitespace-nowrap cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              Retry Camera
            </button>
          </div>
        )}
      </div>

      {/* Layer 4: Collapsible Bottom-Center Control Dock (<=15% viewport footprint, solid/rgba surface) */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 w-[calc(100%-1.5rem)] max-w-[780px] flex flex-col items-center">
        {/* Collapse / Expand Pill Tab */}
        <button
          type="button"
          onClick={() => setDockCollapsed((prev) => !prev)}
          className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#0B1730]/92 hover:bg-[#13254B] text-slate-200 border border-b-0 border-blue-400/35 rounded-t-lg text-[11px] font-medium cursor-pointer"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              Show AR Controls
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              Hide Controls (H)
            </>
          )}
        </button>

        {!dockCollapsed && (
          <div className="w-full bg-[#0B1730]/94 border border-blue-400/35 rounded-xl px-3.5 py-2.5 text-white shadow-xl flex flex-wrap items-center justify-between gap-3">
            {/* Step Progression Controls */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={clampedSegmentIdx <= 0}
                onClick={() => setActiveSegmentIdx((i) => Math.max(0, i - 1))}
                aria-label="Previous route step"
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-35 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono tabular-nums px-1.5 whitespace-nowrap">
                {totalSegments > 0
                  ? `Step ${clampedSegmentIdx + 1} / ${totalSegments}`
                  : 'Arrived'}
              </span>
              <button
                type="button"
                disabled={clampedSegmentIdx >= totalSegments - 1}
                onClick={() =>
                  setActiveSegmentIdx((i) => Math.min(Math.max(0, totalSegments - 1), i + 1))
                }
                aria-label="Next route step"
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-35 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Interactive Heading Alignment / Drag-to-Look Slider */}
            <div className="flex items-center gap-2 flex-1 min-w-[180px] max-w-[280px]">
              <Compass className="w-4 h-4 text-sky-300 shrink-0" />
              <input
                type="range"
                min={0}
                max={359}
                value={Math.round(userHeadingDeg)}
                onChange={(e) => {
                  setSensorCompassActive(false);
                  setUserHeadingDeg(Number(e.target.value));
                }}
                aria-label="Adjust compass viewing heading"
                className="w-full accent-sky-400 cursor-pointer"
              />
              {currentSegmentData && (
                <button
                  type="button"
                  onClick={() => {
                    setSensorCompassActive(false);
                    setUserHeadingDeg(normalizeDegrees360(currentSegmentData.targetBearingDeg));
                  }}
                  title="Align view straight along active campus path"
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-white/10 hover:bg-white/20 rounded-md whitespace-nowrap cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  Align
                </button>
              )}
            </div>

            {/* Camera & Compass Sensor Controls */}
            <div className="flex items-center gap-1.5">
              {needsIosCompassPermission && (
                <button
                  type="button"
                  onClick={() => void handleEnableIosCompass()}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-medium rounded-lg whitespace-nowrap cursor-pointer"
                >
                  <Compass className="w-3.5 h-3.5" />
                  Enable Compass
                </button>
              )}

              {cameraStatus === 'live' ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white text-[11px] font-medium rounded-lg whitespace-nowrap cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Flip Camera
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      stopCameraStream();
                      setCameraStatus('simulated');
                      setCameraMessage(null);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-slate-200 text-[11px] font-medium rounded-lg whitespace-nowrap cursor-pointer"
                  >
                    <CameraOff className="w-3.5 h-3.5" />
                    3D Preview
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => void startCamera(facingMode)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-medium rounded-lg whitespace-nowrap cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  Use Live Camera
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
