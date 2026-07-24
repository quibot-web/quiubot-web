"use client";
import { useEffect, useRef } from "react";

const NUM_CATEGORIAS = 7;
const COLOR_PRIMARIO = 0x534ab7;
const COLOR_CLARO = 0x7f77dd;

// Geometría de la hélice en 3D: dos hebras entrelazadas alrededor de un eje
// vertical, con la misma matemática (seno/coseno) que usamos en 2D, pero
// ahora con profundidad real (eje Z) para que la cámara pueda rotar
// alrededor y se sienta tridimensional de verdad.
function puntoHelice(t: number, fase: number, radio: number, altura: number) {
  const angulo = t * Math.PI * 2 * 2.3 + fase;
  const y = altura * (0.5 - t);
  return { x: Math.cos(angulo) * radio, y, z: Math.sin(angulo) * radio };
}

type Props = {
  faseActual: number; // -1 = sin empezar, 0..6 = categoría actual, 7 = completo
};

export default function EscenaParticulasADN3D({ faseActual }: Props) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const faseActualRef = useRef(faseActual);
  const asentadosRef = useRef<boolean[]>(new Array(NUM_CATEGORIAS).fill(false));
  const faseSpawneadaRef = useRef(-1);

  useEffect(() => {
    faseActualRef.current = faseActual;
    if (faseActual > asentadosRef.current.length - 1) return;
    if (faseActual >= 0 && faseSpawneadaRef.current < faseActual) {
      faseSpawneadaRef.current = faseActual;
      if (faseActual > 0) asentadosRef.current[faseActual - 1] = true;
      if (faseActual === NUM_CATEGORIAS - 1) {
        setTimeout(() => { asentadosRef.current[faseActual] = true; }, 650);
      }
      spawnParticulasRef.current?.(faseActual);
    }
  }, [faseActual]);

  const spawnParticulasRef = useRef<((idx: number) => void) | null>(null);

  useEffect(() => {
    let renderer: any;
    let camera: any;
    let cancelado = false;
    let rafId: number;
    let resizeObserver: ResizeObserver | null = null;

    // Radio y altura reales de la hélice, usados tanto para construir la
    // geometría como para calcular cuánto hay que alejar la cámara.
    const radio = 1.4;
    const altura = 9;

    async function iniciar() {
      // Carga diferida: Three.js solo se descarga cuando este componente
      // realmente se monta (es decir, cuando el usuario le da "Analizar
      // mis creativos" en /marca) — el resto de la app nunca lo carga.
      const THREE = await import("three");
      if (cancelado || !contenedorRef.current) return;

      const contenedor = contenedorRef.current;

      const scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      contenedor.innerHTML = "";
      contenedor.appendChild(renderer.domElement);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.display = "block";

      scene.add(new THREE.AmbientLight(0xffffff, 0.75));
      const luz = new THREE.PointLight(0xffffff, 0.9, 30);
      luz.position.set(4, 4, 6);
      scene.add(luz);

      const segmentos = 220;

      function construirHebra(fase: number) {
        const puntos: any[] = [];
        for (let i = 0; i <= segmentos; i++) {
          const p = puntoHelice(i / segmentos, fase, radio, altura);
          puntos.push(new THREE.Vector3(p.x, p.y, p.z));
        }
        const curva = new THREE.CatmullRomCurve3(puntos);

        const geoNucleo = new THREE.TubeGeometry(curva, 220, 0.075, 8, false);
        const matNucleo = new THREE.MeshStandardMaterial({
          color: COLOR_PRIMARIO,
          emissive: COLOR_CLARO,
          emissiveIntensity: 0.35,
          roughness: 0.35,
          metalness: 0.1,
        });
        const nucleo = new THREE.Mesh(geoNucleo, matNucleo);

        // Halo: un tubo más grueso y muy transparente encima. Sobre fondo
        // blanco usamos mezcla normal (no aditiva — la aditiva se pierde
        // contra blanco) para lograr un halo lila suave alrededor de cada
        // hebra, sin necesitar un motor de post-procesado completo.
        const geoHalo = new THREE.TubeGeometry(curva, 140, 0.16, 8, false);
        const matHalo = new THREE.MeshBasicMaterial({
          color: COLOR_CLARO,
          transparent: true,
          opacity: 0.15,
          depthWrite: false,
        });
        const halo = new THREE.Mesh(geoHalo, matHalo);

        const grupo = new THREE.Group();
        grupo.add(halo, nucleo);
        return grupo;
      }

      const hebraA = construirHebra(0);
      const hebraB = construirHebra(Math.PI);
      scene.add(hebraA, hebraB);

      const nodosGroup = new THREE.Group();
      scene.add(nodosGroup);
      const nodoMat = new THREE.MeshStandardMaterial({
        color: COLOR_PRIMARIO,
        emissive: COLOR_CLARO,
        emissiveIntensity: 0.45,
        roughness: 0.25,
      });
      const nodoGeo = new THREE.SphereGeometry(0.22, 16, 16);
      const nodosMeshes: any[] = [];
      for (let i = 0; i < NUM_CATEGORIAS; i++) {
        const t = i / (NUM_CATEGORIAS - 1);
        const p = puntoHelice(t, 0, radio, altura);
        const mesh = new THREE.Mesh(nodoGeo, nodoMat.clone());
        mesh.position.set(p.x, p.y, p.z);
        mesh.scale.setScalar(0.001);
        nodosGroup.add(mesh);
        nodosMeshes.push(mesh);
      }

      const ambientCount = 90;
      const ambientGeo = new THREE.BufferGeometry();
      const ambientPos = new Float32Array(ambientCount * 3);
      const ambientVel: number[][] = [];
      for (let i = 0; i < ambientCount; i++) {
        const r = 3 + Math.random() * 1.8;
        const ang = Math.random() * Math.PI * 2;
        const y = (Math.random() - 0.5) * altura * 1.1;
        ambientPos[i * 3] = Math.cos(ang) * r;
        ambientPos[i * 3 + 1] = y;
        ambientPos[i * 3 + 2] = Math.sin(ang) * r;
        ambientVel.push([(Math.random() - 0.5) * 0.004, (Math.random() - 0.5) * 0.004, (Math.random() - 0.5) * 0.004]);
      }
      ambientGeo.setAttribute("position", new THREE.BufferAttribute(ambientPos, 3));
      const ambientMat = new THREE.PointsMaterial({ color: 0xafa9ec, size: 0.05, transparent: true, opacity: 0.55 });
      const ambientPoints = new THREE.Points(ambientGeo, ambientMat);
      scene.add(ambientPoints);

      const MAX_VOLADORAS = 24 * 4;
      const voladorasGeo = new THREE.BufferGeometry();
      const voladorasPos = new Float32Array(MAX_VOLADORAS * 3);
      voladorasGeo.setAttribute("position", new THREE.BufferAttribute(voladorasPos, 3));
      const voladorasMat = new THREE.PointsMaterial({ color: COLOR_PRIMARIO, size: 0.09, transparent: true, opacity: 0.9 });
      const voladorasPoints = new THREE.Points(voladorasGeo, voladorasMat);
      scene.add(voladorasPoints);

      type Voladora = { sx: number; sy: number; sz: number; tx: number; ty: number; tz: number; t: number; activo: boolean };
      const voladoras: Voladora[] = new Array(MAX_VOLADORAS).fill(null).map(() => ({ sx: 0, sy: 0, sz: 0, tx: 0, ty: 0, tz: 0, t: 2, activo: false }));

      spawnParticulasRef.current = (idx: number) => {
        const t = idx / (NUM_CATEGORIAS - 1);
        const destino = puntoHelice(t, 0, radio, altura);
        let lanzadas = 0;
        for (let i = 0; i < voladoras.length && lanzadas < 22; i++) {
          if (voladoras[i].activo) continue;
          const r = 3 + Math.random() * 2;
          const ang = Math.random() * Math.PI * 2;
          voladoras[i] = {
            sx: Math.cos(ang) * r,
            sy: (Math.random() - 0.5) * altura,
            sz: Math.sin(ang) * r,
            tx: destino.x, ty: destino.y, tz: destino.z,
            t: -Math.random() * 0.3,
            activo: true,
          };
          lanzadas++;
        }
      };

      // --- Encuadre dinámico de cámara -------------------------------
      // En vez de una distancia fija (que se corta en cualquier tamaño
      // de pantalla distinto al que se probó), calculamos la distancia
      // mínima necesaria para que TODA la hélice (radio + altura) quepa
      // dentro del frustum de la cámara, tanto en el eje vertical como
      // en el horizontal (que depende del aspect ratio del contenedor).
      const MARGEN = 1.18; // aire extra alrededor de la hélice, evita que toque los bordes
      let distanciaActual = 6.2;

      function distanciaParaEncuadrar(ancho: number, alto: number) {
        const aspect = Math.max(ancho / Math.max(alto, 1), 0.0001);
        const vFov = (camera.fov * Math.PI) / 180;

        // Media altura visible = altura de la hélice/2 (+halo) * margen
        const mitadAlturaObjetivo = (altura / 2 + 0.3) * MARGEN;
        const distV = mitadAlturaObjetivo / Math.tan(vFov / 2);

        // Media anchura visible = radio de la hélice (+halo) * margen
        const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
        const mitadAnchoObjetivo = (radio + 0.3) * MARGEN;
        const distH = mitadAnchoObjetivo / Math.tan(hFov / 2);

        return Math.max(distV, distH);
      }

      function ajustarTamano() {
        const ancho = contenedor.clientWidth || 320;
        const alto = contenedor.clientHeight || 440;
        camera.aspect = ancho / Math.max(alto, 1);
        distanciaActual = distanciaParaEncuadrar(ancho, alto);
        camera.updateProjectionMatrix();
        renderer.setSize(ancho, alto);
      }

      ajustarTamano();
      resizeObserver = new ResizeObserver(() => ajustarTamano());
      resizeObserver.observe(contenedor);

      let inicio = performance.now();

      function animar(ahora: number) {
        if (cancelado) return;
        const dt = ahora - inicio;

        const anguloCam = dt * 0.00025;
        camera.position.x = Math.sin(anguloCam) * distanciaActual;
        camera.position.z = Math.cos(anguloCam) * distanciaActual;
        camera.position.y = Math.sin(dt * 0.0001) * (distanciaActual * 0.16);
        camera.lookAt(0, 0, 0);

        const posAmb = ambientGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < ambientCount; i++) {
          posAmb[i * 3] += ambientVel[i][0];
          posAmb[i * 3 + 1] += ambientVel[i][1];
          posAmb[i * 3 + 2] += ambientVel[i][2];
        }
        ambientGeo.attributes.position.needsUpdate = true;

        const posVol = voladorasGeo.attributes.position.array as Float32Array;
        voladoras.forEach((p, i) => {
          if (!p.activo) {
            posVol[i * 3] = 9999;
            posVol[i * 3 + 1] = 9999;
            posVol[i * 3 + 2] = 9999;
            return;
          }
          p.t += 0.018;
          if (p.t >= 1) { p.activo = false; return; }
          const e = 1 - Math.pow(1 - Math.max(p.t, 0), 3);
          posVol[i * 3] = p.sx + (p.tx - p.sx) * e;
          posVol[i * 3 + 1] = p.sy + (p.ty - p.sy) * e;
          posVol[i * 3 + 2] = p.sz + (p.tz - p.sz) * e;
        });
        voladorasGeo.attributes.position.needsUpdate = true;

        asentadosRef.current.forEach((asentado, i) => {
          const mesh = nodosMeshes[i];
          const objetivo = asentado ? 1 : 0.001;
          mesh.scale.x += (objetivo - mesh.scale.x) * 0.15;
          mesh.scale.y = mesh.scale.z = mesh.scale.x;
        });

        renderer.render(scene, camera);
        rafId = requestAnimationFrame(animar);
      }
      rafId = requestAnimationFrame(animar);
    }

    iniciar();

    return () => {
      cancelado = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (resizeObserver) resizeObserver.disconnect();
      if (renderer) {
        renderer.dispose();
      }
    };
  }, []);

  // Sin altura tope en vh/px: el componente ahora ocupa el 100% del alto
  // y ancho que le dé su contenedor padre. Si en la página sigue viéndose
  // corto, hay que darle a ESE contenedor padre un alto real (por ejemplo
  // `h-full` o `flex-1` dentro de un layout con `h-screen`/`h-[calc(100vh-Npx)]`),
  // porque un div sin altura definida por CSS colapsa a la altura de su contenido.
  return <div ref={contenedorRef} style={{ width: "100%", height: "100%" }} />;
}