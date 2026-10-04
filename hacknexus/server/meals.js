// Meals handed out to squads at the food counter (Admin -> Food). Each squad
// gets each meal once; the id is stored, so change labels freely but keep ids.
export const MEALS = [
  { id: "d1_morning_snacks", label: "Day 1 · Morning snacks" },
  { id: "d1_lunch", label: "Day 1 · Lunch" },
  { id: "d1_evening_snacks", label: "Day 1 · Evening snacks" },
];
export const mealById = (id) => MEALS.find((m) => m.id === id);
