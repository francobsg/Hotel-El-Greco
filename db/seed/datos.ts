import type { unidad_producto } from "@/db/schema";

type Unidad = typeof unidad_producto.enumValues[number];
type Producto = [nombre: string, unidad: Unidad, costo: number];
type Categoria = { nombre: string; grupo_grafico: string | null; productos: Producto[] };

export const catalogo: Categoria[] = [
  { nombre: "Vacuno", grupo_grafico: "Carnes", productos: [["Lomo de vacuno", "kg", 12500], ["Carne molida", "kg", 6900], ["Posta negra", "kg", 8900], ["Plateada", "kg", 9500], ["Asiento de vacuno", "kg", 10900]] },
  { nombre: "Pollo", grupo_grafico: "Carnes", productos: [["Pechuga de pollo", "kg", 4900], ["Trutro de pollo", "kg", 3200], ["Pollo entero", "kg", 3500], ["Alitas de pollo", "kg", 2900], ["Filetillo de pollo", "kg", 5200]] },
  { nombre: "Pescados y mariscos", grupo_grafico: "Carnes", productos: [["Filete de salmon", "kg", 11900], ["Merluza", "kg", 6500], ["Reineta", "kg", 8500], ["Camarones", "kg", 12500], ["Choritos", "kg", 3500]] },
  { nombre: "Cerdo", grupo_grafico: "Carnes", productos: [["Lomo de cerdo", "kg", 5900], ["Costillar de cerdo", "kg", 6500], ["Pulpa de cerdo", "kg", 4900], ["Tocino", "kg", 7500], ["Jamon cocido", "kg", 6800]] },
  { nombre: "Pastas y arroz", grupo_grafico: "Pastas y arroz", productos: [["Arroz", "kg", 1800], ["Espagueti", "kg", 2100], ["Fideos corbata", "kg", 2200], ["Lasana", "kg", 3500], ["Quinoa", "kg", 5900]] },
  { nombre: "Lacteos", grupo_grafico: "Lácteos y huevos", productos: [["Leche entera", "lt", 1100], ["Crema de leche", "lt", 4500], ["Queso mantecoso", "kg", 7900], ["Mantequilla", "kg", 6900], ["Yogur natural", "lt", 2200]] },
  { nombre: "Verduras", grupo_grafico: "Verduras y frutas", productos: [["Papa", "kg", 1200], ["Cebolla", "kg", 1000], ["Zanahoria", "kg", 1100], ["Tomate", "kg", 1600], ["Lechuga", "kg", 2300]] },
  { nombre: "Frutas", grupo_grafico: "Verduras y frutas", productos: [["Manzana", "kg", 1500], ["Platano", "kg", 1600], ["Naranja", "kg", 1300], ["Limon", "kg", 1900], ["Frutilla", "kg", 4500]] },
  { nombre: "Secos y condimentos", grupo_grafico: null, productos: [["Sal", "kg", 650], ["Azucar", "kg", 1300], ["Harina", "kg", 1000], ["Aceite vegetal", "lt", 2100], ["Oregano", "kg", 9900]] },
  { nombre: "Conservas y salsas", grupo_grafico: null, productos: [["Salsa de tomate", "kg", 2400], ["Atun en lata", "un", 1600], ["Choclo en conserva", "un", 1300], ["Duraznos en conserva", "un", 1900], ["Mayonesa", "kg", 3500]] },
  { nombre: "Panaderia y desayuno", grupo_grafico: null, productos: [["Pan de molde", "kg", 2900], ["Pan amasado", "kg", 2500], ["Avena", "kg", 1800], ["Cafe molido", "kg", 10900], ["Te en sobres", "caja", 3900]] },
  { nombre: "Huevos y refrigerados", grupo_grafico: "Lácteos y huevos", productos: [["Huevos frescos", "un", 250], ["Huevo liquido pasteurizado", "kg", 3900], ["Quesillo", "kg", 4900], ["Queso crema", "kg", 6500], ["Manjar", "kg", 3500]] },
];

export const menu = [
  { nombre: "Lomo con papas", precio: 14900, ingredientes: { "Lomo de vacuno": 250, Papa: 250, Mantequilla: 15, Sal: 3 } },
  { nombre: "Pollo con arroz", precio: 9900, ingredientes: { "Pechuga de pollo": 220, Arroz: 100, Zanahoria: 50, "Aceite vegetal": 10, Sal: 3 } },
  { nombre: "Salmon con ensalada", precio: 13900, ingredientes: { "Filete de salmon": 200, Lechuga: 80, Tomate: 100, Limon: 20, Sal: 3 } },
  { nombre: "Espagueti bolonesa", precio: 8900, ingredientes: { Espagueti: 120, "Carne molida": 120, "Salsa de tomate": 150, Cebolla: 40, Sal: 3 } },
  { nombre: "Cerdo con pure", precio: 10900, ingredientes: { "Lomo de cerdo": 220, Papa: 250, "Leche entera": 50, Mantequilla: 15, Sal: 3 } },
  { nombre: "Omelette con queso", precio: 6500, ingredientes: { "Huevo liquido pasteurizado": 150, "Queso mantecoso": 40, Tomate: 50, Mantequilla: 10, Sal: 2 } },
  { nombre: "Ensalada de pollo", precio: 8500, ingredientes: { "Pechuga de pollo": 150, Lechuga: 100, Tomate: 100, Zanahoria: 50, "Aceite vegetal": 10, Sal: 2 } },
  { nombre: "Avena con frutas", precio: 4500, ingredientes: { Avena: 60, "Leche entera": 200, Platano: 80, Manzana: 80, Azucar: 10 } },
];
