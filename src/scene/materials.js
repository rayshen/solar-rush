import * as THREE from "three";
import { assetUrl } from "../config/appConfig.js";
function createSunMaterial() {
  const surfaceTexture = loadBodyTexture(assetUrl('/textures/bodies/sun.jpg'), {
    color: true
  });
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: {
        value: 0
      },
      uSurfaceMap: {
        value: surfaceTexture
      }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vSurfacePosition;
      varying vec3 vWorldNormal;
      varying vec3 vViewDirection;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vUv = uv;
        vSurfacePosition = normalize(position);
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vViewDirection = cameraPosition - worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform sampler2D uSurfaceMap;
      varying vec2 vUv;
      varying vec3 vSurfacePosition;
      varying vec3 vWorldNormal;
      varying vec3 vViewDirection;

      float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      float noise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(hash(i), hash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
          mix(mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
          f.z
        );
      }

      float fbm(vec3 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 5; i++) {
          value += amplitude * noise(p);
          p = p * 2.03 + vec3(7.1, 3.4, 5.7);
          amplitude *= 0.5;
        }
        return value;
      }

      void main() {
        vec3 observedSurface = texture2D(uSurfaceMap, vUv).rgb;
        vec3 surfaceDetail = pow(max(observedSurface, vec3(0.015)), vec3(0.55));
        vec3 flow = vec3(uTime * 0.035, -uTime * 0.018, uTime * 0.024);
        float broad = fbm(vSurfacePosition * 3.8 + flow);
        float cells = fbm(vSurfacePosition * 12.0 - flow * 1.7);
        float filaments = 1.0 - smoothstep(0.035, 0.2, abs(fbm(vSurfacePosition * 7.0 + flow * 2.2) - 0.52));
        float heat = clamp(broad * 0.82 + cells * 0.42 + filaments * 0.3, 0.0, 1.35);
        float granules = smoothstep(0.48, 0.78, cells + filaments * 0.28);

        // Preserve the observed photosphere instead of tinting the whole star
        // deep orange. The warmer fringe is added separately below.
        vec3 photosphere = surfaceDetail * vec3(1.16, 0.86, 0.5);
        vec3 color = vec3(0.34, 0.055, 0.002) + photosphere;
        color *= mix(0.9, 1.18, smoothstep(0.24, 1.02, heat));
        color += vec3(1.18, 0.58, 0.09) * granules * 0.48;
        color = mix(color, vec3(1.5, 0.78, 0.22), filaments * 0.18);

        float facing = clamp(dot(normalize(vWorldNormal), normalize(vViewDirection)), 0.0, 1.0);
        float limb = pow(facing, 0.42);
        color *= mix(0.76, 1.1, limb);
        color += vec3(1.1, 0.35, 0.012) * filaments * 0.16;
        gl_FragColor = vec4(color, 1.0);
      }
    `
  });
  material.userData.animatedSun = true;
  return material;
}
function createRimGlowMaterial(color, opacity, power = 2.4) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: {
        value: new THREE.Color(color)
      },
      uOpacity: {
        value: opacity
      },
      uPower: {
        value: power
      }
    },
    vertexShader: `
      varying vec3 vWorldNormal;
      varying vec3 vViewDirection;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vViewDirection = cameraPosition - worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uPower;
      varying vec3 vWorldNormal;
      varying vec3 vViewDirection;

      void main() {
        float facing = clamp(dot(normalize(vWorldNormal), normalize(vViewDirection)), 0.0, 1.0);
        float rim = pow(1.0 - facing, uPower);
        gl_FragColor = vec4(uColor, rim * uOpacity);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
}
function loadBodyTexture(path, {
  color = false
} = {}) {
  const assetPath = path.startsWith(import.meta.env.BASE_URL) ? path : assetUrl(path);
  const texture = new THREE.TextureLoader().load(assetPath);
  if (color) texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}
const bodyTextureProfiles = {
  mercury: {
    map: 'mercury.jpg',
    normal: 'mercury-normal.jpg'
  },
  venus: {
    map: 'venus.jpg',
    normal: 'venus-normal.jpg'
  },
  moon: {
    map: 'moon.jpg',
    normal: 'moon-normal.jpg'
  },
  mars: {
    map: 'mars.jpg',
    normal: 'mars-normal.jpg'
  },
  phobos: {
    map: 'phobos.jpg',
    monochrome: true
  },
  deimos: {
    map: 'deimos.jpg',
    monochrome: true
  },
  jupiter: {
    map: 'jupiter.jpg',
    atmosphere: true
  },
  io: {
    map: 'io.jpg'
  },
  europa: {
    map: 'europa.jpg',
    tint: '#d6cbb8'
  },
  ganymede: {
    map: 'ganymede.jpg',
    monochrome: true
  },
  callisto: {
    map: 'callisto.jpg',
    monochrome: true
  },
  saturn: {
    map: 'saturn.jpg',
    atmosphere: true
  },
  titan: {
    map: 'titan.jpg',
    atmosphere: true
  },
  rhea: {
    map: 'rhea.jpg',
    monochrome: true
  },
  iapetus: {
    map: 'iapetus.jpg',
    monochrome: true
  },
  dione: {
    map: 'dione.jpg',
    monochrome: true
  },
  uranus: {
    map: 'uranus.jpg',
    atmosphere: true
  },
  titania: {
    map: 'titania.jpg',
    monochrome: true
  },
  oberon: {
    map: 'oberon.jpg',
    monochrome: true
  },
  neptune: {
    map: 'neptune.jpg',
    atmosphere: true
  },
  triton: {
    map: 'triton.jpg'
  }
};
const atmosphereProfiles = {
  venus: {
    color: '#e8ad5d',
    opacity: 0.68,
    scale: 1.045,
    power: 2.35
  },
  earth: {
    color: '#4c89d9',
    opacity: 0.72,
    scale: 1.035,
    power: 2.65
  },
  mars: {
    color: '#d7835f',
    opacity: 0.18,
    scale: 1.025,
    power: 2.8
  },
  jupiter: {
    color: '#e2bd91',
    opacity: 0.3,
    scale: 1.025,
    power: 2.65
  },
  saturn: {
    color: '#e6ce9a',
    opacity: 0.3,
    scale: 1.025,
    power: 2.65
  },
  titan: {
    color: '#d8882d',
    opacity: 0.76,
    scale: 1.075,
    power: 2.15
  },
  uranus: {
    color: '#8fdbe0',
    opacity: 0.38,
    scale: 1.03,
    power: 2.55
  },
  neptune: {
    color: '#4779ff',
    opacity: 0.42,
    scale: 1.03,
    power: 2.5
  }
};
function createEarthNightMaterial() {
  const nightTexture = loadBodyTexture(assetUrl('/textures/earth/night.png'), {
    color: true
  });
  return new THREE.ShaderMaterial({
    uniforms: {
      uNightMap: {
        value: nightTexture
      },
      uSunPosition: {
        value: new THREE.Vector3()
      },
      uIntensity: {
        value: 1.15
      }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vUv = uv;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D uNightMap;
      uniform vec3 uSunPosition;
      uniform float uIntensity;
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        vec3 lights = texture2D(uNightMap, vUv).rgb;
        vec3 sunDirection = normalize(uSunPosition - vWorldPosition);
        float daylight = dot(normalize(vWorldNormal), sunDirection);
        float night = 1.0 - smoothstep(-0.18, 0.16, daylight);
        float luminance = dot(lights, vec3(0.2126, 0.7152, 0.0722));
        float alpha = smoothstep(0.025, 0.48, luminance) * night;
        gl_FragColor = vec4(lights * uIntensity, alpha * 0.92);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });
}
function addEarthSurfaceLayers(mesh, radius) {
  const detailGeometry = new THREE.SphereGeometry(radius, 144, 72);
  const nightMaterial = createEarthNightMaterial();
  const nightLights = new THREE.Mesh(detailGeometry, nightMaterial);
  nightLights.scale.setScalar(1.0015);
  nightLights.renderOrder = 1;
  mesh.add(nightLights);
  const cloudTexture = loadBodyTexture(assetUrl('/textures/earth/clouds.png'), {
    color: true
  });
  const clouds = new THREE.Mesh(detailGeometry.clone(), new THREE.MeshPhongMaterial({
    map: cloudTexture,
    alphaMap: cloudTexture,
    color: '#eef7ff',
    transparent: true,
    opacity: 0.72,
    alphaTest: 0.025,
    depthWrite: false,
    side: THREE.DoubleSide,
    shininess: 4
  }));
  clouds.scale.setScalar(1.011);
  clouds.renderOrder = 2;
  mesh.add(clouds);
  return {
    clouds,
    nightMaterial
  };
}
function createSeededRandom(seedText) {
  let seed = [...seedText].reduce((value, char) => Math.imul(value ^ char.charCodeAt(0), 2654435761), 2166136261) >>> 0;
  return () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}
function createProceduralPlanetTexture(body) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const random = createSeededRandom(body.id);
  const base = new THREE.Color(body.color);
  const palette = {
    mercury: ['#6d6964', '#a49a8f', '#d0c2ad'],
    venus: ['#8e5f2d', '#d89b52', '#f1cb82'],
    mars: ['#6f2f1f', '#bf5b38', '#e09a62'],
    moon: ['#65635f', '#aaa69c', '#d4d0c4'],
    phobos: ['#493b32', '#796354', '#a18b77'],
    deimos: ['#51463e', '#88776a', '#b3a18f'],
    io: ['#b78b16', '#f1d45a', '#fff2a5'],
    europa: ['#71604e', '#d3c8aa', '#f4edcf'],
    ganymede: ['#514b44', '#8f8171', '#c0ad94'],
    callisto: ['#282521', '#5b5349', '#9a8c78'],
    titan: ['#7d4016', '#ca7628', '#efb85b'],
    rhea: ['#777b7c', '#b5b9b7', '#e2e5df'],
    iapetus: ['#302a24', '#766b5d', '#c4b59b'],
    dione: ['#777d80', '#bac0c0', '#edf0eb'],
    titania: ['#5c5a57', '#94918b', '#c6c1b8'],
    oberon: ['#403a37', '#716763', '#a59a90'],
    triton: ['#765f63', '#b79ca0', '#dfc7c0'],
    uranus: ['#74dce5', '#a7f2f4', '#5bb8c7'],
    neptune: ['#163f9c', '#2c75ff', '#7aa5ff']
  };
  const colors = palette[body.id] ?? [body.color, base.clone().offsetHSL(0, 0, 0.16).getStyle(), base.clone().offsetHSL(0, 0, -0.14).getStyle()];
  const gradient = ctx.createLinearGradient(0, 0, 512, 256);
  gradient.addColorStop(0, colors[2]);
  gradient.addColorStop(0.48, colors[1]);
  gradient.addColorStop(1, colors[0]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 256);
  const isIce = ['uranus', 'neptune'].includes(body.id);
  if (isIce) {
    for (let y = 0; y < 256; y += 6) {
      ctx.strokeStyle = `rgba(235,255,255,${0.06 + random() * 0.08})`;
      ctx.lineWidth = 2 + random() * 4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= 512; x += 18) {
        ctx.lineTo(x, y + Math.sin(x * 0.025 + y * 0.09) * 7);
      }
      ctx.stroke();
    }
  } else {
    for (let i = 0; i < 96; i += 1) {
      ctx.fillStyle = `rgba(255,255,255,${0.04 + random() * 0.08})`;
      ctx.beginPath();
      ctx.ellipse(random() * 512, random() * 256, 8 + random() * 36, 3 + random() * 16, random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 90; i += 1) {
      ctx.fillStyle = `rgba(0,0,0,${0.06 + random() * 0.12})`;
      ctx.beginPath();
      ctx.ellipse(random() * 512, random() * 256, 5 + random() * 22, 2 + random() * 12, random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const isRocky = ['mercury', 'moon', 'mars', 'phobos', 'deimos', 'ganymede', 'callisto', 'rhea', 'iapetus', 'dione', 'titania', 'oberon', 'triton'].includes(body.id);
  if (isRocky) {
    for (let i = 0; i < 74; i += 1) {
      const x = random() * 512;
      const y = random() * 256;
      const radius = 2 + random() * (body.id === 'callisto' ? 15 : 10);
      const crater = ctx.createRadialGradient(x - radius * 0.25, y - radius * 0.22, radius * 0.12, x, y, radius);
      crater.addColorStop(0, 'rgba(255,255,255,0.12)');
      crater.addColorStop(0.38, 'rgba(12,8,5,0.2)');
      crater.addColorStop(0.72, 'rgba(20,12,8,0.3)');
      crater.addColorStop(1, 'rgba(255,238,210,0.08)');
      ctx.fillStyle = crater;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (body.id === 'venus') {
    ctx.globalCompositeOperation = 'screen';
    for (let y = 4; y < 256; y += 9) {
      ctx.strokeStyle = `rgba(255,232,174,${0.1 + random() * 0.12})`;
      ctx.lineWidth = 4 + random() * 7;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= 512; x += 14) ctx.lineTo(x, y + Math.sin(x * 0.022 + y * 0.08) * 8);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  if (body.id === 'io') {
    for (let i = 0; i < 58; i += 1) {
      const x = random() * 512;
      const y = random() * 256;
      const radius = 3 + random() * 14;
      const volcano = ctx.createRadialGradient(x, y, 0, x, y, radius);
      volcano.addColorStop(0, 'rgba(28,20,12,0.92)');
      volcano.addColorStop(0.34, 'rgba(116,35,13,0.82)');
      volcano.addColorStop(0.7, 'rgba(235,105,16,0.44)');
      volcano.addColorStop(1, 'rgba(255,215,54,0)');
      ctx.fillStyle = volcano;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (['europa', 'dione', 'rhea'].includes(body.id)) {
    const crackColor = body.id === 'europa' ? 'rgba(91,43,27,0.9)' : 'rgba(62,83,98,0.62)';
    for (let i = 0; i < 46; i += 1) {
      let x = random() * 512;
      let y = random() * 256;
      ctx.strokeStyle = crackColor;
      ctx.lineWidth = 1.4 + random() * 2.8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let step = 0; step < 9; step += 1) {
        x += 8 + random() * 16;
        y += (random() - 0.5) * 18;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  if (body.id === 'titan') {
    ctx.globalCompositeOperation = 'screen';
    for (let y = 0; y < 256; y += 12) {
      ctx.fillStyle = `rgba(255,187,77,${0.08 + random() * 0.1})`;
      ctx.fillRect(0, y, 512, 5 + random() * 8);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  if (body.id === 'iapetus') {
    const albedo = ctx.createLinearGradient(190, 0, 330, 0);
    albedo.addColorStop(0, 'rgba(16,13,11,0.72)');
    albedo.addColorStop(0.55, 'rgba(44,34,26,0.48)');
    albedo.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = albedo;
    ctx.fillRect(0, 0, 360, 256);
  }
  if (body.id === 'mars') {
    const northCap = ctx.createLinearGradient(0, 0, 0, 34);
    northCap.addColorStop(0, 'rgba(245,238,218,0.95)');
    northCap.addColorStop(1, 'rgba(245,238,218,0)');
    ctx.fillStyle = northCap;
    ctx.fillRect(0, 0, 512, 34);
    const southCap = ctx.createLinearGradient(0, 222, 0, 256);
    southCap.addColorStop(0, 'rgba(245,238,218,0)');
    southCap.addColorStop(1, 'rgba(245,238,218,0.86)');
    ctx.fillStyle = southCap;
    ctx.fillRect(0, 222, 512, 34);
  }
  if (body.id === 'triton') {
    for (let i = 0; i < 32; i += 1) {
      ctx.fillStyle = `rgba(119,61,67,${0.12 + random() * 0.16})`;
      ctx.fillRect(random() * 512, random() * 170, 1 + random() * 3, 18 + random() * 46);
    }
  }
  if (body.id === 'neptune') {
    ctx.fillStyle = 'rgba(4,18,68,0.58)';
    ctx.beginPath();
    ctx.ellipse(340, 142, 34, 13, -0.18, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}
function createPlanetRingMaterial(body) {
  if (body.id === 'saturn') {
    const texture = loadBodyTexture(assetUrl('/textures/bodies/saturn-rings.png'), {
      color: true
    });
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.repeat.set(0.5, 1);
    return new THREE.MeshBasicMaterial({
      map: texture,
      color: '#eee1bd',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.94,
      alphaTest: 0.015,
      depthWrite: false
    });
  }
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const center = 256;
  const inner = 176;
  const outer = 226;
  const random = createSeededRandom(`${body.id}-rings`);
  ctx.clearRect(0, 0, 512, 512);
  for (let radius = inner; radius <= outer; radius += 1) {
    const progress = (radius - inner) / (outer - inner);
    const alpha = 0.2 + random() * 0.5;
    ctx.strokeStyle = `rgba(145,215,222,${alpha * 0.34})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.42,
    depthWrite: false
  });
}
function createLabelSprite(body) {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = '600 34px Inter, Arial, sans-serif';
  ctx.fillStyle = 'rgba(3, 8, 17, 0.64)';
  ctx.strokeStyle = 'rgba(125, 248, 255, 0.22)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(12, 22, 330, 74, 12);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(245, 248, 255, 0.94)';
  ctx.fillText(body.name, 34, 58);
  ctx.font = '500 22px Inter, Arial, sans-serif';
  ctx.fillStyle = 'rgba(157, 177, 207, 0.88)';
  ctx.fillText(body.zh, 34, 84);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: body.type === 'moon' ? 0.48 : 0.78,
    depthWrite: false
  });
  const sprite = new THREE.Sprite(material);
  const labelScale = body.type === 'moon' ? 1.72 : 2.9;
  sprite.scale.set(labelScale, labelScale * 0.33, 1);
  sprite.position.set(body.scaleRadius * 1.2 + 0.42, body.scaleRadius * 1.08 + 0.28, 0);
  return sprite;
}
function createPlanetMaterial(body) {
  if (body.id === 'earth') {
    return new THREE.MeshPhongMaterial({
      map: loadBodyTexture(assetUrl('/textures/earth/day.jpg'), {
        color: true
      }),
      normalMap: loadBodyTexture(assetUrl('/textures/earth/normal.jpg')),
      normalScale: new THREE.Vector2(0.62, 0.62),
      specularMap: loadBodyTexture(assetUrl('/textures/earth/specular.jpg')),
      specular: new THREE.Color('#4d7189'),
      shininess: 14
    });
  }
  const profile = bodyTextureProfiles[body.id];
  if (profile) {
    const map = loadBodyTexture(assetUrl(`/textures/bodies/${profile.map}`), {
      color: true
    });
    const materialOptions = {
      map,
      color: profile.tint ?? (profile.monochrome ? body.color : '#ffffff'),
      roughness: profile.atmosphere ? 0.78 : 0.92,
      metalness: 0
    };
    if (profile.normal) {
      materialOptions.normalMap = loadBodyTexture(assetUrl(`/textures/bodies/${profile.normal}`));
      materialOptions.normalScale = new THREE.Vector2(0.52, 0.52);
    } else if (!profile.atmosphere) {
      materialOptions.bumpMap = map;
      materialOptions.bumpScale = body.type === 'moon' ? 0.014 : 0.01;
    }
    return new THREE.MeshStandardMaterial(materialOptions);
  }
  const texture = createProceduralPlanetTexture(body);
  texture.anisotropy = 4;
  return new THREE.MeshStandardMaterial({
    map: texture,
    bumpMap: texture,
    bumpScale: body.type === 'moon' ? 0.055 : 0.025,
    roughness: body.type === 'moon' ? 0.94 : 0.78,
    metalness: 0.02,
    emissive: body.color,
    emissiveIntensity: body.type === 'moon' ? 0.08 : 0.11
  });
}
export { createSunMaterial, createRimGlowMaterial, loadBodyTexture, bodyTextureProfiles, atmosphereProfiles, createEarthNightMaterial, addEarthSurfaceLayers, createSeededRandom, createProceduralPlanetTexture, createPlanetRingMaterial, createLabelSprite, createPlanetMaterial };
