// Meals handed out to squads at the food counter (Admin -> Food). Each squad
// gets each meal once; the id is stored, so change labels freely but keep ids.
export const MEALS = [
  { id: "d1_lunch", label: "Day 1 · Lunch" },
  { id: "d1_refreshments", label: "Day 1 · Evening refreshments" },
  { id: "d2_lunch", label: "Day 2 · Lunch (finalists)" },
];
export const mealById = (id) => MEALS.find((m) => m.id === id);
