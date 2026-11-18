// Catálogo de íconos que puede elegir la IA (18 nov 2026). Reemplaza los
// emoji que escribía en icono_palabra (icono_antes/icono_despues) y en
// el "icono" de anuncio_boton/conexion_whatsapp: el render corre en el
// navegador de cada cliente, un emoji se ve distinto en cada sistema
// operativo (o como cuadro blanco si no hay fuente de emoji), y 📅
// mostraba "JUL 17" fijo aunque fuera otro mes.
//
// La IA elige un NOMBRE del catálogo (ej. "camara"); el dibujo es un
// ícono SVG de lucide-react (ya dependencia del proyecto, licencia ISC)
// con los colores de la marca. Guiones ya guardados con emoji: se
// traducen al ícono equivalente (EMOJI_A_ICONO) y uno desconocido cae a
// un ícono genérico -- nunca se pinta el emoji.
import type { CSSProperties } from "react";
import {
  Award,
  Baby,
  Ban,
  Banknote,
  Bell,
  BookOpen,
  Box,
  Calculator,
  Calendar,
  Camera,
  Car,
  Check,
  Clock,
  Coffee,
  CreditCard,
  Crown,
  Dog,
  Droplet,
  Dumbbell,
  Eye,
  EyeOff,
  FileText,
  Flame,
  Flower,
  Frown,
  Gem,
  Gift,
  GraduationCap,
  Hammer,
  Hand,
  Heart,
  Hourglass,
  House,
  Image,
  ImageOff,
  Leaf,
  Lightbulb,
  Link,
  ListChecks,
  Lock,
  Mail,
  MapPin,
  Megaphone,
  MessageCircle,
  Mic,
  Moon,
  Package,
  Palette,
  Paintbrush,
  Pencil,
  Percent,
  Phone,
  Play,
  Pointer,
  Rabbit,
  Receipt,
  Repeat,
  Rocket,
  Ruler,
  Scissors,
  Search,
  Send,
  Shield,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Smile,
  Snail,
  Sofa,
  Sparkles,
  Star,
  Stethoscope,
  Store,
  Sun,
  Tag,
  Target,
  ThumbsUp,
  Timer,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Truck,
  User,
  Users,
  Utensils,
  Video,
  Wallet,
  WandSparkles,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { contrasteHex, hexConAlfa, mezclarColoresHex, type TemaGuion } from "./tema";
import { esNombreIcono, type NombreIcono } from "./nombresIconos";

export const CATALOGO_ICONOS = {
  // Fotos y apariencia
  camara: Camera,
  foto: Image,
  foto_rota: ImageOff,
  video: Video,
  play: Play,
  sol: Sun,
  luna: Moon,
  bombillo: Lightbulb,
  destellos: Sparkles,
  paleta: Palette,
  pincel: Paintbrush,
  varita: WandSparkles,
  ojo: Eye,
  ojo_tachado: EyeOff,
  lupa: Search,
  // Tiempo
  reloj: Clock,
  reloj_arena: Hourglass,
  temporizador: Timer,
  calendario: Calendar,
  repetir: Repeat,
  rayo: Zap,
  caracol: Snail,
  conejo: Rabbit,
  // Precios y venta
  etiqueta_precio: Tag,
  porcentaje: Percent,
  billete: Banknote,
  billetera: Wallet,
  tarjeta: CreditCard,
  recibo: Receipt,
  calculadora: Calculator,
  bolsa: ShoppingBag,
  carrito: ShoppingCart,
  regalo: Gift,
  paquete: Package,
  caja: Box,
  camion: Truck,
  ubicacion: MapPin,
  tienda: Store,
  // Comunicación
  chat: MessageCircle,
  celular: Smartphone,
  telefono: Phone,
  correo: Mail,
  enviar: Send,
  megafono: Megaphone,
  campana: Bell,
  microfono: Mic,
  link: Link,
  mano: Hand,
  clic: Pointer,
  // Personas y resultado
  persona: User,
  personas: Users,
  estrella: Star,
  corazon: Heart,
  pulgar_arriba: ThumbsUp,
  sonrisa: Smile,
  cara_triste: Frown,
  premio: Award,
  corona: Crown,
  diana: Target,
  cohete: Rocket,
  fuego: Flame,
  tendencia_sube: TrendingUp,
  tendencia_baja: TrendingDown,
  check: Check,
  cruz: X,
  alerta: TriangleAlert,
  prohibido: Ban,
  escudo: Shield,
  escudo_check: ShieldCheck,
  candado: Lock,
  documento: FileText,
  lista: ListChecks,
  lapiz: Pencil,
  regla: Ruler,
  // Rubros
  tijeras: Scissors,
  cubiertos: Utensils,
  cafe: Coffee,
  camisa: Shirt,
  casa: House,
  sofa: Sofa,
  flor: Flower,
  hoja: Leaf,
  gota: Droplet,
  llave: Wrench,
  martillo: Hammer,
  gema: Gem,
  bebe: Baby,
  perro: Dog,
  carro: Car,
  pesa: Dumbbell,
  salud: Stethoscope,
  estudio: GraduationCap,
  libro: BookOpen,
} satisfies Record<NombreIcono, LucideIcon>;


// Guiones guardados antes del catálogo (emoji) -> ícono equivalente.
const EMOJI_A_ICONO: Record<string, NombreIcono> = {
  "🌑": "luna", "🌙": "luna", "☀": "sol", "🌞": "sol", "💡": "bombillo", "✨": "destellos",
  "📷": "camara", "📸": "camara", "🖼": "foto", "🎥": "video", "📹": "video", "▶": "play",
  "⏳": "reloj_arena", "⌛": "reloj_arena", "🕐": "reloj", "⏰": "reloj", "⏱": "temporizador", "📅": "calendario", "📆": "calendario", "🗓": "calendario",
  "⚡": "rayo", "🐢": "caracol", "🐌": "caracol", "🐇": "conejo",
  "🏷": "etiqueta_precio", "💰": "billete", "💵": "billete", "💸": "billete", "💳": "tarjeta", "🧾": "recibo",
  "🛍": "bolsa", "🛒": "carrito", "🎁": "regalo", "📦": "paquete", "🚚": "camion", "📍": "ubicacion", "🏪": "tienda",
  "💬": "chat", "📱": "celular", "📞": "telefono", "✉": "correo", "📣": "megafono", "📢": "megafono", "🔔": "campana", "🎤": "microfono", "🔗": "link",
  "👆": "clic", "👉": "clic", "✋": "mano", "🙌": "mano", "👍": "pulgar_arriba",
  "👤": "persona", "👥": "personas", "⭐": "estrella", "🌟": "estrella", "❤": "corazon", "😊": "sonrisa", "🙂": "sonrisa", "😞": "cara_triste", "🏆": "premio", "🎯": "diana", "🚀": "cohete", "🔥": "fuego",
  "📈": "tendencia_sube", "📉": "tendencia_baja", "✅": "check", "✔": "check", "❌": "cruz", "⚠": "alerta", "🚫": "prohibido", "🔒": "candado", "🔍": "lupa", "🔎": "lupa", "👀": "ojo",
  "📝": "lapiz", "📄": "documento", "📋": "lista",
};
const ICONO_GENERICO: NombreIcono = "destellos";

export function resolverIcono(valor: string | undefined | null): NombreIcono | null {
  if (!valor) return null;
  const limpio = valor.trim();
  if (esNombreIcono(limpio)) return limpio;
  return EMOJI_A_ICONO[limpio.replace(/️/g, "")] ?? ICONO_GENERICO;
}

// Color de marca legible sobre la tarjeta blanca: el de más contraste
// entre primario y secundario; si ninguno llega a 3:1 (paleta muy
// clara), gris oscuro. El otro color de marca va de acento (el círculo
// de fondo).
export function coloresIconoSobreBlanco(tema: TemaGuion): { trazo: string; acento: string } {
  const [a, b] = [tema.color_primario, tema.color_secundario].sort((x, y) => contrasteHex(y, "#ffffff") - contrasteHex(x, "#ffffff"));
  return { trazo: contrasteHex(a, "#ffffff") >= 3 ? a : "#2B2B2B", acento: b };
}

// "sobre_blanco": trazo de marca sobre un círculo suave del acento.
// "sobre_marca": blanco, sin círculo (va encima del degradado de marca).
export function IconoCatalogo({
  valor,
  tamano,
  tema,
  variante = "sobre_blanco",
  colorLuz,
  colorSuperficie,
  estilo,
}: {
  valor: string | undefined | null;
  tamano: number;
  tema: TemaGuion;
  variante?: "sobre_blanco" | "sobre_marca" | "sobre_oscuro";
  // Solo "sobre_oscuro" (estilo Noche): la luz de la marca (anillo) y la
  // superficie del círculo.
  colorLuz?: string;
  colorSuperficie?: string;
  estilo?: CSSProperties;
}) {
  const nombre = resolverIcono(valor) ?? ICONO_GENERICO;
  const Componente = CATALOGO_ICONOS[nombre];
  if (variante === "sobre_marca") {
    return <Componente size={tamano} color="#ffffff" strokeWidth={2} style={{ display: "block", flexShrink: 0, ...estilo }} aria-hidden />;
  }
  if (variante === "sobre_oscuro") {
    return (
      <div
        style={{
          width: tamano,
          height: tamano,
          borderRadius: "50%",
          background: colorSuperficie ?? "#1c1c28",
          border: `${Math.round(tamano * 0.025)}px solid ${colorLuz ?? "#ffffff"}`,
          boxShadow: `0 0 ${Math.round(tamano * 0.3)}px ${hexConAlfa(colorLuz ?? "#ffffff", 0.45)}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          ...estilo,
        }}
      >
        <Componente size={Math.round(tamano * 0.58)} color="#ffffff" strokeWidth={2} aria-hidden />
      </div>
    );
  }
  const { trazo, acento } = coloresIconoSobreBlanco(tema);
  return (
    <div
      style={{
        width: tamano,
        height: tamano,
        borderRadius: "50%",
        background: mezclarColoresHex(acento, "#ffffff", 0.72),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        ...estilo,
      }}
    >
      <Componente size={Math.round(tamano * 0.62)} color={trazo} strokeWidth={2.2} aria-hidden />
    </div>
  );
}
