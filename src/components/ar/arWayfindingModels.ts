import * as THREE from 'three';

/**
 * Generates a soft radial contact shadow texture on an HTML5 2D canvas.
 */
export function createContactShadowTexture(colorHex = '#07142b', opacity = 0.5): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(
      size / 2,
      size / 2,
      size * 0.08,
      size / 2,
      size / 2,
      size * 0.48
    );
    grad.addColorStop(0, colorHex);
    grad.addColorStop(0.55, `${colorHex}88`);
    grad.addColorStop(1, 'rgba(7, 20, 43, 0)');
    ctx.globalAlpha = opacity;
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates a crisp architectural procedural stone/paver roughness & albedo texture
 * for the fallback simulated campus walkway (used when a device camera is unavailable).
 */
export function createWalkwayTextures(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const size = 256;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cCtx = colorCanvas.getContext('2d');

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d');

  if (cCtx && rCtx) {
    cCtx.fillStyle = '#334155';
    cCtx.fillRect(0, 0, size, size);
    rCtx.fillStyle = '#b8b8b8';
    rCtx.fillRect(0, 0, size, size);

    const tileW = 64;
    const tileH = 32;
    for (let row = 0; row < size / tileH; row++) {
      const offset = (row % 2) * (tileW / 2);
      for (let col = -1; col <= size / tileW; col++) {
        const x = col * tileW + offset;
        const y = row * tileH;
        const shade = 48 + ((row * 17 + col * 31) % 14);
        cCtx.fillStyle = `rgb(${shade}, ${shade + 12}, ${shade + 28})`;
        cCtx.fillRect(x + 2, y + 2, tileW - 4, tileH - 4);

        const roughVal = 175 + ((row * 13 + col * 23) % 45);
        rCtx.fillStyle = `rgb(${roughVal}, ${roughVal}, ${roughVal})`;
        rCtx.fillRect(x + 2, y + 2, tileW - 4, tileH - 4);
      }
    }

    // Subtle blue lane edges
    cCtx.fillStyle = '#1e3a8a';
    cCtx.fillRect(0, 0, 8, size);
    cCtx.fillRect(size - 8, 0, 8, size);
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2, 16);
  map.anisotropy = maxAnisotropy;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(2, 16);
  roughnessMap.anisotropy = maxAnisotropy;

  return { map, roughnessMap };
}

/**
 * Generates a high-contrast procedural signboard texture for the 3D waypoint beacon.
 */
export function createWaypointSignTexture(
  label: string,
  distanceLabel: string,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 176;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // Deep navy body
    ctx.fillStyle = '#0F2557';
    ctx.fillRect(0, 0, 512, 176);

    // Top accent bar
    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(0, 0, 512, 14);

    // Outer metallic border
    ctx.strokeStyle = '#93C5FD';
    ctx.lineWidth = 6;
    ctx.strokeRect(5, 5, 502, 166);

    // Waypoint label
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 36px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const trimmed = label.length > 22 ? `${label.slice(0, 21)}…` : label;
    ctx.fillText(trimmed, 256, 76);

    // Distance metric
    ctx.fillStyle = '#7DD3FC';
    ctx.font = '600 28px "JetBrains Mono", monospace';
    ctx.fillText(distanceLabel, 256, 130);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Builds the hero composite 7-part 3D directional wayfinding arrow.
 * Oriented to point forward along -Z in its local coordinate frame.
 */
export function createHeroDirectionalArrow(shadowTex: THREE.CanvasTexture): {
  group: THREE.Group;
  bodyGroup: THREE.Group;
} {
  const group = new THREE.Group();
  const bodyGroup = new THREE.Group();
  group.add(bodyGroup);

  // 1. Primary aerodynamic beveled arrowhead (ExtrudeGeometry)
  const headShape = new THREE.Shape();
  headShape.moveTo(0, 1.05);
  headShape.lineTo(0.76, -0.35);
  headShape.lineTo(0.28, -0.2);
  headShape.lineTo(0.28, -0.95);
  headShape.lineTo(-0.28, -0.95);
  headShape.lineTo(-0.28, -0.2);
  headShape.lineTo(-0.76, -0.35);
  headShape.closePath();

  const headGeo = new THREE.ExtrudeGeometry(headShape, {
    depth: 0.16,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.045,
    bevelSegments: 3,
  });
  headGeo.center();
  headGeo.rotateX(-Math.PI / 2);

  const primaryMat = new THREE.MeshPhysicalMaterial({
    color: 0x2563eb,
    metalness: 0.35,
    roughness: 0.22,
    clearcoat: 0.8,
    clearcoatRoughness: 0.15,
    emissive: 0x1d4ed8,
    emissiveIntensity: 0.32,
  });
  const headMesh = new THREE.Mesh(headGeo, primaryMat);
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  bodyGroup.add(headMesh);

  // 2. Machined brushed-silver central dorsal spine (varied metalness/roughness)
  const spineShape = new THREE.Shape();
  spineShape.moveTo(0, 0.85);
  spineShape.lineTo(0.18, -0.1);
  spineShape.lineTo(0.14, -0.88);
  spineShape.lineTo(-0.14, -0.88);
  spineShape.lineTo(-0.18, -0.1);
  spineShape.closePath();

  const spineGeo = new THREE.ExtrudeGeometry(spineShape, {
    depth: 0.08,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
  });
  spineGeo.center();
  spineGeo.rotateX(-Math.PI / 2);

  const brushedSteelMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.9,
    roughness: 0.22,
  });
  const spineMesh = new THREE.Mesh(spineGeo, brushedSteelMat);
  spineMesh.position.y = 0.14;
  spineMesh.castShadow = true;
  bodyGroup.add(spineMesh);

  // 3. Luminous sky-blue directional chevron inlay strip
  const inlayShape = new THREE.Shape();
  inlayShape.moveTo(0, 0.72);
  inlayShape.lineTo(0.46, -0.12);
  inlayShape.lineTo(0.32, -0.18);
  inlayShape.lineTo(0, 0.42);
  inlayShape.lineTo(-0.32, -0.18);
  inlayShape.lineTo(-0.46, -0.12);
  inlayShape.closePath();

  const inlayGeo = new THREE.ExtrudeGeometry(inlayShape, {
    depth: 0.03,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.01,
    bevelSegments: 1,
  });
  inlayGeo.center();
  inlayGeo.rotateX(-Math.PI / 2);

  const emissiveAccentMat = new THREE.MeshStandardMaterial({
    color: 0x7dd3fc,
    emissive: 0x38bdf8,
    emissiveIntensity: 1.15,
    metalness: 0.1,
    roughness: 0.18,
  });
  const inlayMesh = new THREE.Mesh(inlayGeo, emissiveAccentMat);
  inlayMesh.position.set(0, 0.17, -0.05);
  bodyGroup.add(inlayMesh);

  // 4 & 5. Twin machined navy-titanium winglet stabilizers (left & right)
  const finMat = new THREE.MeshStandardMaterial({
    color: 0x0f2557,
    metalness: 0.72,
    roughness: 0.48,
  });
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(0.28, -0.22);
  finShape.lineTo(0.16, -0.5);
  finShape.lineTo(0, -0.36);
  finShape.closePath();

  const finGeo = new THREE.ExtrudeGeometry(finShape, {
    depth: 0.04,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.01,
    bevelSegments: 1,
  });
  finGeo.center();
  finGeo.rotateX(-Math.PI / 2);

  const rightFin = new THREE.Mesh(finGeo, finMat);
  rightFin.position.set(0.36, 0.03, 0.62);
  rightFin.rotation.z = -0.22;
  bodyGroup.add(rightFin);

  const leftFin = new THREE.Mesh(finGeo, finMat);
  leftFin.position.set(-0.36, 0.03, 0.62);
  leftFin.scale.x = -1;
  leftFin.rotation.z = 0.22;
  bodyGroup.add(leftFin);

  // 6. Rear turned collar ring (LatheGeometry)
  const collarPoints = [
    new THREE.Vector2(0.12, 0),
    new THREE.Vector2(0.22, 0.03),
    new THREE.Vector2(0.24, 0.12),
    new THREE.Vector2(0.18, 0.18),
    new THREE.Vector2(0.12, 0.18),
  ];
  const collarGeo = new THREE.LatheGeometry(collarPoints, 24);
  collarGeo.rotateX(Math.PI / 2);
  const collarMesh = new THREE.Mesh(collarGeo, brushedSteelMat);
  collarMesh.position.set(0, 0, 0.92);
  bodyGroup.add(collarMesh);

  // 7. Tail guidance emitter core
  const coreGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.06, 20);
  coreGeo.rotateX(Math.PI / 2);
  const coreMesh = new THREE.Mesh(coreGeo, emissiveAccentMat);
  coreMesh.position.set(0, 0, 1.08);
  bodyGroup.add(coreMesh);

  // Grounded soft radial contact shadow underneath the floating arrow
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(2.3, 2.3),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.45,
    })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.02;
  group.add(shadowPlane);

  bodyGroup.position.y = 1.15;

  return { group, bodyGroup };
}

/**
 * Builds a 4-part composite ground pathway chevron marker (pivoted flush at y = 0).
 */
export function createPathChevronMarker(shadowTex: THREE.CanvasTexture): THREE.Group {
  const marker = new THREE.Group();

  // 1. Beveled chevron outer wing
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.48);
  shape.lineTo(0.68, -0.18);
  shape.lineTo(0.46, -0.34);
  shape.lineTo(0, 0.12);
  shape.lineTo(-0.46, -0.34);
  shape.lineTo(-0.68, -0.18);
  shape.closePath();

  const bodyGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.07,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
  });
  bodyGeo.center();
  bodyGeo.rotateX(-Math.PI / 2);

  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x0f2557,
    metalness: 0.78,
    roughness: 0.36,
  });
  const baseMesh = new THREE.Mesh(bodyGeo, frameMat);
  baseMesh.position.y = 0.06;
  marker.add(baseMesh);

  // 2. Glowing sky-blue upper directional ridge
  const innerShape = new THREE.Shape();
  innerShape.moveTo(0, 0.36);
  innerShape.lineTo(0.5, -0.14);
  innerShape.lineTo(0.38, -0.22);
  innerShape.lineTo(0, 0.15);
  innerShape.lineTo(-0.38, -0.22);
  innerShape.lineTo(-0.5, -0.14);
  innerShape.closePath();

  const innerGeo = new THREE.ExtrudeGeometry(innerShape, {
    depth: 0.04,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.01,
    bevelSegments: 1,
  });
  innerGeo.center();
  innerGeo.rotateX(-Math.PI / 2);

  const glowMat = new THREE.MeshStandardMaterial({
    color: 0x60a5fa,
    emissive: 0x2563eb,
    emissiveIntensity: 0.95,
    metalness: 0.2,
    roughness: 0.18,
  });
  const glowMesh = new THREE.Mesh(innerGeo, glowMat);
  glowMesh.position.y = 0.11;
  marker.add(glowMesh);

  // 3. Center brushed-steel alignment stud
  const studGeo = new THREE.CylinderGeometry(0.055, 0.075, 0.07, 16);
  const studMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    metalness: 0.92,
    roughness: 0.18,
  });
  const stud = new THREE.Mesh(studGeo, studMat);
  stud.position.set(0, 0.1, -0.16);
  marker.add(stud);

  // 4. Soft radial contact shadow flush with ground
  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(1.75, 1.35),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.35,
    })
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = 0.015;
  marker.add(contact);

  return marker;
}

/**
 * Builds a 6-part architectural waypoint destination beacon pivoted at bottom-center (y = 0).
 */
export function createWaypointBeacon(
  shadowTex: THREE.CanvasTexture,
  signTex: THREE.CanvasTexture
): {
  group: THREE.Group;
  ringMesh: THREE.Mesh;
  crestMesh: THREE.Mesh;
  signMesh: THREE.Mesh;
  signMaterial: THREE.MeshStandardMaterial;
} {
  const group = new THREE.Group();

  // 1. Stepped architectural plinth (LatheGeometry, matte slate)
  const plinthPoints = [
    new THREE.Vector2(0.01, 0),
    new THREE.Vector2(0.62, 0),
    new THREE.Vector2(0.58, 0.12),
    new THREE.Vector2(0.46, 0.15),
    new THREE.Vector2(0.42, 0.28),
    new THREE.Vector2(0.18, 0.34),
    new THREE.Vector2(0.12, 0.34),
  ];
  const plinthGeo = new THREE.LatheGeometry(plinthPoints, 28);
  const plinthMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.2,
    roughness: 0.78,
  });
  const plinth = new THREE.Mesh(plinthGeo, plinthMat);
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  group.add(plinth);

  // 2. Tapered brushed-navy metallic mast (LatheGeometry)
  const mastPoints = [
    new THREE.Vector2(0.11, 0.34),
    new THREE.Vector2(0.085, 1.45),
    new THREE.Vector2(0.13, 1.56),
    new THREE.Vector2(0.06, 1.72),
    new THREE.Vector2(0.01, 1.72),
  ];
  const mastGeo = new THREE.LatheGeometry(mastPoints, 20);
  const mastMat = new THREE.MeshStandardMaterial({
    color: 0x0f2557,
    metalness: 0.85,
    roughness: 0.26,
  });
  const mast = new THREE.Mesh(mastGeo, mastMat);
  mast.castShadow = true;
  group.add(mast);

  // 3. Rotating metallic gimbal ring
  const ringGeo = new THREE.TorusGeometry(0.46, 0.038, 16, 40);
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x93c5fd,
    metalness: 0.92,
    roughness: 0.16,
    emissive: 0x2563eb,
    emissiveIntensity: 0.35,
  });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  ringMesh.position.y = 2.08;
  group.add(ringMesh);

  // 4. Floating faceted emerald/blue beacon crest
  const crestGeo = new THREE.OctahedronGeometry(0.28, 0);
  const crestMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.75,
    metalness: 0.25,
    roughness: 0.12,
    clearcoat: 1.0,
  });
  const crestMesh = new THREE.Mesh(crestGeo, crestMat);
  crestMesh.position.y = 2.08;
  group.add(crestMesh);

  // 5. Procedural CanvasTexture signboard panel mounted above crest
  const signMaterial = new THREE.MeshStandardMaterial({
    map: signTex,
    roughness: 0.35,
    metalness: 0.15,
    emissive: 0x0f2557,
    emissiveIntensity: 0.28,
  });
  const signMesh = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.82, 0.08), signMaterial);
  signMesh.position.y = 3.05;
  group.add(signMesh);

  // 6. Soft ground contact shadow disc
  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 1.9),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.5,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = 0.015;
  group.add(contact);

  return { group, ringMesh, crestMesh, signMesh, signMaterial };
}

/**
 * Builds twin illuminated pathway guide rails using TubeGeometry along a forward curve.
 */
export function createPathGuideRails(): THREE.Group {
  const railGroup = new THREE.Group();

  const railMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.65,
    metalness: 0.3,
    roughness: 0.25,
    transparent: true,
    opacity: 0.75,
  });

  [-0.95, 0.95].forEach((xOffset) => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(xOffset, 0.06, -1.2),
      new THREE.Vector3(xOffset, 0.06, -5.0),
      new THREE.Vector3(xOffset, 0.06, -9.2),
      new THREE.Vector3(xOffset, 0.06, -12.6),
    ]);
    const tubeGeo = new THREE.TubeGeometry(curve, 24, 0.035, 8, false);
    const tubeMesh = new THREE.Mesh(tubeGeo, railMat);
    railGroup.add(tubeMesh);
  });

  return railGroup;
}
