import beach from "@/assets/beach.jpg";
import town from "@/assets/town.jpg";
import mountain from "@/assets/mountain.jpg";
import food from "@/assets/food.jpg";
import city from "@/assets/city.jpg";
import desert from "@/assets/desert.jpg";

export const galleryImages = [beach, town, mountain, food, city, desert];

export type Vibe = "naturaleza" | "cultura" | "gastro" | "playa" | "fiesta";
export type Budget = "economico" | "moderado" | "premium";
export type Duration = "1" | "2-3" | "4-5";

export const VIBES: { id: Vibe; label: string }[] = [
  { id: "naturaleza", label: "Naturaleza & Relax 🌿" },
  { id: "cultura", label: "Pueblito Mágico & Cultura 🎨" },
  { id: "gastro", label: "Gastronómico & Buen Café ☕" },
  { id: "playa", label: "Aventura & Playa 🏖️" },
  { id: "fiesta", label: "Fiesta & diversión 🎉" },
];
export const BUDGETS: { id: Budget; label: string }[] = [
  { id: "economico", label: "Económico 💵" },
  { id: "moderado", label: "Moderado 💳" },
  { id: "premium", label: "Premium ✨" },
];
export const DURATIONS: { id: Duration; label: string; days: number }[] = [
  { id: "1", label: "Viaje solo de 1 día", days: 1 },
  { id: "2-3", label: "Fin de semana (2-3 días)", days: 3 },
  { id: "4-5", label: "Viaje de 4-5 días", days: 5 },
];

export type Prefs = {
  origin: string;
  knows: "si" | "no";
  destination: string;
  duration: Duration;
  budget: Budget;
  vibe: Vibe;
};

type Spot = { name: string; type: string; cost: number; lat: number; lng: number; img: string };
type Dish = { name: string; place: string; note: string; img: string };

export type Destination = {
  name: string;
  region: string;
  hubs: string[];
  hours: number;
  vibes: Vibe[];
  lat: number;
  lng: number;
  cover: string;
  intro: string;
  spots: Spot[];
  dishes: Dish[];
};

const D: Destination[] = [
  {
    name: "Tepoztlán", region: "Morelos", hubs: ["cdmx"], hours: 1.5, vibes: ["naturaleza", "cultura"],
    lat: 18.9847, lng: -99.0931, cover: mountain,
    intro: "Un pueblo mágico rodeado de cerros místicos y energía bohemia. Sube a la pirámide del Tepozteco y termina el día con una nieve artesanal.",
    spots: [
      { name: "Pirámide del Tepozteco", type: "Senderismo", cost: 100, lat: 18.9956, lng: -99.0968, img: mountain },
      { name: "Mercado de Tepoztlán", type: "Mercado", cost: 0, lat: 18.9852, lng: -99.0935, img: food },
      { name: "Ex Convento de la Natividad", type: "Cultura", cost: 90, lat: 18.9849, lng: -99.0929, img: town },
      { name: "Temazcal en Amatlán", type: "Relax", cost: 450, lat: 18.9733, lng: -99.0397, img: desert },
    ],
    dishes: [
      { name: "Nieves Tepoznieves", place: "Av. Revolución", note: "Sabores locos como pétalo de rosa y mezcal.", img: food },
      { name: "Quesadillas de flor de calabaza", place: "Mercado central", note: "Tortilla azul hecha a mano, comal de barro.", img: food },
    ],
  },
  {
    name: "Valle de Bravo", region: "Estado de México", hubs: ["cdmx"], hours: 2.5, vibes: ["naturaleza", "playa", "fiesta"],
    lat: 19.1925, lng: -100.1314, cover: mountain,
    intro: "Lago, bosque y parapente en un mismo fin de semana. Calles empedradas y atardeceres que se reflejan en el agua.",
    spots: [
      { name: "Vuelo en parapente El Peñón", type: "Aventura", cost: 1800, lat: 19.2081, lng: -100.1556, img: mountain },
      { name: "Paseo en lancha por la presa", type: "Lago", cost: 300, lat: 19.1955, lng: -100.1402, img: beach },
      { name: "Cascada Velo de Novia", type: "Naturaleza", cost: 50, lat: 19.1733, lng: -100.1189, img: mountain },
      { name: "Malecón y centro", type: "Paseo", cost: 0, lat: 19.1927, lng: -100.1316, img: town },
    ],
    dishes: [
      { name: "Trucha al ajillo", place: "Embarcadero", note: "Recién pescada, mantequilla y ajo dorado.", img: food },
      { name: "Café de altura", place: "La Michoacana", note: "Granos de la sierra, notas a cacao.", img: food },
    ],
  },
  {
    name: "Puebla", region: "Puebla", hubs: ["cdmx"], hours: 2, vibes: ["gastro", "cultura"],
    lat: 19.0414, lng: -98.2063, cover: town,
    intro: "La capital del mole y la talavera. Un centro histórico de azulejos donde cada esquina esconde un dulce típico.",
    spots: [
      { name: "Capilla del Rosario", type: "Cultura", cost: 0, lat: 19.0461, lng: -98.1975, img: town },
      { name: "Calle de los Dulces", type: "Gastronomía", cost: 150, lat: 19.0448, lng: -98.1955, img: food },
      { name: "Cholula y su pirámide", type: "Historia", cost: 95, lat: 19.0579, lng: -98.3019, img: desert },
      { name: "Barrio del Artista", type: "Arte", cost: 0, lat: 19.0446, lng: -98.1937, img: city },
    ],
    dishes: [
      { name: "Mole poblano", place: "El Mural de los Poblanos", note: "Más de 20 ingredientes, chocolate y chiles.", img: food },
      { name: "Chiles en nogada", place: "Casa Reyna", note: "Temporada de agosto a septiembre.", img: food },
      { name: "Cemitas", place: "Mercado del Carmen", note: "Pan de ajonjolí con pápalo y milanesa.", img: food },
    ],
  },
  {
    name: "Acapulco", region: "Guerrero", hubs: ["cdmx"], hours: 4, vibes: ["playa", "fiesta"],
    lat: 16.8531, lng: -99.8237, cover: beach,
    intro: "Playa, clavadistas y vida nocturna legendaria. El clásico escape costero que nunca pasa de moda.",
    spots: [
      { name: "Clavadistas de La Quebrada", type: "Show", cost: 60, lat: 16.8458, lng: -99.9131, img: beach },
      { name: "Playa Caleta", type: "Playa", cost: 0, lat: 16.8331, lng: -99.9003, img: beach },
      { name: "Pie de la Cuesta al atardecer", type: "Atardecer", cost: 0, lat: 16.8978, lng: -99.9817, img: beach },
      { name: "Antros de la Costera", type: "Fiesta", cost: 600, lat: 16.8608, lng: -99.8811, img: city },
    ],
    dishes: [
      { name: "Pescado a la talla", place: "Barra Vieja", note: "Adobo rojo y verde a las brasas.", img: food },
      { name: "Pozole verde (jueves)", place: "Centro", note: "Tradición guerrerense con chicharrón.", img: food },
    ],
  },
  {
    name: "Tequila", region: "Jalisco", hubs: ["guadalajara"], hours: 1, vibes: ["cultura", "fiesta", "gastro"],
    lat: 20.8826, lng: -103.8370, cover: desert,
    intro: "Campos azules de agave y destilerías centenarias. Brinda en la cuna de la bebida más mexicana.",
    spots: [
      { name: "Tour Casa Sauza", type: "Destilería", cost: 450, lat: 20.8812, lng: -103.8364, img: desert },
      { name: "Paisaje agavero", type: "Naturaleza", cost: 0, lat: 20.8700, lng: -103.8600, img: desert },
      { name: "Museo Nacional del Tequila", type: "Cultura", cost: 30, lat: 20.8828, lng: -103.8366, img: town },
    ],
    dishes: [
      { name: "Cantaritos", place: "El Güero", note: "Tequila, cítricos y sal en jarro de barro.", img: food },
      { name: "Birria tatemada", place: "Mercado municipal", note: "Chivo tierno en caldo especiado.", img: food },
    ],
  },
  {
    name: "Ajijic", region: "Jalisco", hubs: ["guadalajara"], hours: 1, vibes: ["naturaleza", "cultura", "gastro"],
    lat: 20.2972, lng: -103.2613, cover: town,
    intro: "Murales coloridos frente al lago de Chapala. Un pueblo tranquilo con cafés y galerías.",
    spots: [
      { name: "Malecón de Ajijic", type: "Paseo", cost: 0, lat: 20.2948, lng: -103.2615, img: beach },
      { name: "Ruta de murales", type: "Arte", cost: 0, lat: 20.2975, lng: -103.2610, img: town },
      { name: "Mirador La Cruz", type: "Senderismo", cost: 0, lat: 20.3050, lng: -103.2620, img: mountain },
    ],
    dishes: [
      { name: "Charales fritos", place: "Malecón", note: "Pescaditos crujientes con limón.", img: food },
      { name: "Café y pan artesanal", place: "Centro", note: "Panaderías con influencia europea.", img: food },
    ],
  },
  {
    name: "Santiago", region: "Nuevo León", hubs: ["monterrey"], hours: 0.7, vibes: ["naturaleza", "playa", "cultura"],
    lat: 25.4246, lng: -100.1513, cover: mountain,
    intro: "Pueblo mágico a los pies de la sierra. Cascadas, cañones y rápel para los aventureros.",
    spots: [
      { name: "Cascada Cola de Caballo", type: "Naturaleza", cost: 90, lat: 25.3672, lng: -100.1612, img: mountain },
      { name: "Cañón Matacanes", type: "Aventura", cost: 1500, lat: 25.3500, lng: -100.2500, img: desert },
      { name: "Presa La Boca", type: "Lago", cost: 0, lat: 25.4320, lng: -100.1270, img: beach },
    ],
    dishes: [
      { name: "Cabrito al pastor", place: "Carretera Nacional", note: "Asado lento a la leña.", img: food },
      { name: "Machacado con huevo", place: "Centro", note: "Desayuno norteño por excelencia.", img: food },
    ],
  },
  {
    name: "Toledo", region: "Castilla-La Mancha", hubs: ["madrid"], hours: 1, vibes: ["cultura", "gastro"],
    lat: 39.8628, lng: -4.0273, cover: city,
    intro: "La ciudad de las tres culturas sobre una colina. Calles medievales, mazapán y vistas épicas.",
    spots: [
      { name: "Catedral Primada", type: "Cultura", cost: 12, lat: 39.8570, lng: -4.0237, img: town },
      { name: "Mirador del Valle", type: "Vistas", cost: 0, lat: 39.8505, lng: -4.0241, img: city },
      { name: "Sinagoga del Tránsito", type: "Historia", cost: 3, lat: 39.8566, lng: -4.0293, img: town },
    ],
    dishes: [
      { name: "Mazapán", place: "Santo Tomé", note: "Almendra y azúcar desde 1856.", img: food },
      { name: "Carcamusas", place: "Bar Ludeña", note: "Guiso de cerdo con tomate y guisantes.", img: food },
    ],
  },
  {
    name: "Segovia", region: "Castilla y León", hubs: ["madrid"], hours: 1, vibes: ["cultura", "gastro", "naturaleza"],
    lat: 40.9429, lng: -4.1088, cover: city,
    intro: "Un acueducto romano intacto y un alcázar de cuento. Termina con cochinillo crujiente.",
    spots: [
      { name: "Acueducto romano", type: "Historia", cost: 0, lat: 40.9481, lng: -4.1184, img: town },
      { name: "Alcázar de Segovia", type: "Cultura", cost: 10, lat: 40.9525, lng: -4.1323, img: city },
      { name: "Sierra de Guadarrama", type: "Naturaleza", cost: 0, lat: 40.8500, lng: -4.0000, img: mountain },
    ],
    dishes: [
      { name: "Cochinillo asado", place: "Mesón de Cándido", note: "Se corta con un plato, piel crujiente.", img: food },
      { name: "Ponche segoviano", place: "Limón y Menta", note: "Bizcocho con mazapán tostado.", img: food },
    ],
  },
];

export function hubOf(origin: string) {
  const o = origin.toLowerCase();
  if (o.includes("guadalajara") || o.includes("jalisco")) return "guadalajara";
  if (o.includes("monterrey") || o.includes("nuevo le")) return "monterrey";
  if (o.includes("madrid") || o.includes("españa")) return "madrid";
  return "cdmx";
}

export const ORIGIN_SUGGESTIONS = [
  "Ciudad de México, CDMX", "Guadalajara, Jalisco", "Monterrey, Nuevo León", "Madrid, España", "Puebla, Puebla", "Querétaro, Querétaro",
];
export const DEST_SUGGESTIONS = D.map((d) => `${d.name}, ${d.region}`);

const mult: Record<Budget, number> = { economico: 0.6, moderado: 1, premium: 1.8 };
const slots = ["09:00", "12:30", "15:00", "19:00"];

export type Trip = {
  dest: Destination;
  days: { day: number; items: { time: string; title: string; type: string; summary: string; cost: number; img: string }[] }[];
};

function build(dest: Destination, p: Prefs): Trip {
  const nDays = DURATIONS.find((d) => d.id === p.duration)!.days;
  const pool: Spot[] = [...dest.spots, ...dest.dishes.map((d) => ({ name: `Comer: ${d.name}`, type: "Comida", cost: 220, lat: dest.lat, lng: dest.lng, img: d.img }))];
  const days = Array.from({ length: nDays }, (_, di) => ({
    day: di + 1,
    items: slots.slice(0, nDays === 1 ? 4 : 3).map((time, si) => {
      const s = pool[(di * 3 + si) % pool.length]!;
      return {
        time, title: s.name, type: s.type, img: s.img,
        summary: `${s.type} en ${dest.name}, ideal para un plan ${VIBES.find((v) => v.id === p.vibe)!.label.split(" ")[0]?.toLowerCase()}.`,
        cost: Math.round(s.cost * mult[p.budget]),
      };
    }),
  }));
  return { dest, days };
}

export function generateTrip(p: Prefs, exclude: string[] = []): Trip {
  if (p.knows === "si" && p.destination.trim() && exclude.length === 0) {
    const q = p.destination.toLowerCase();
    const found = D.find((d) => q.includes(d.name.toLowerCase()));
    if (found) return build(found, p);
    const name = (p.destination.split(",")[0] ?? "").trim();
    const base = D[Math.abs([...name].reduce((a, c) => a + c.charCodeAt(0), 0)) % D.length]!;
    return build({ ...base, name, region: p.destination.split(",")[1]?.trim() ?? "Tu destino", intro: `Un itinerario a tu medida en ${name}. Ajustamos actividades a tu vibe y presupuesto.` }, p);
  }
  const hub = hubOf(p.origin);
  const maxH = p.duration === "1" ? 2.5 : p.duration === "2-3" ? 4 : 6;
  const score = (d: Destination) => (d.hubs.includes(hub) ? 10 : 0) + (d.vibes.includes(p.vibe) ? 5 : 0) + (d.hours <= maxH ? 3 : 0);
  const ranked = D.filter((d) => !exclude.includes(d.name)).sort((a, b) => score(b) - score(a));
  const sameHub = ranked.filter((d) => d.hubs.includes(hub));
  const pick = (sameHub.length ? sameHub : ranked.length ? ranked : D)[0]!;
  return build(pick, p);
}

/** Build a trip around a real destination found near the origin. */
export function tripForReal(p: Prefs, r: { name: string; region: string; lat: number; lng: number; minutes: number }): Trip {
  const base = D[Math.abs([...r.name].reduce((a, c) => a + c.charCodeAt(0), 0)) % D.length]!;
  const hours = Math.round((r.minutes / 60) * 10) / 10;
  return build({
    ...base, name: r.name, region: r.region || "Cerca de ti", lat: r.lat, lng: r.lng, hours,
    intro: `A unas ${hours} h por carretera (auto o bus) desde ${p.origin.split(",")[0]}. Un itinerario armado con lugares reales según tu vibe.`,
  }, p);
}
