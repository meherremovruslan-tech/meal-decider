// Filter chip constants shared by the desktop page and mobile DecideTab.
export const MEAL_TIMES = [
  { id: 'Breakfast', emoji: '🍳' },
  { id: 'Lunch', emoji: '🥗' },
  { id: 'Dinner', emoji: '🍲' },
];
export const CUISINE_FILTERS = ['Asian', 'Italian', 'Turkish', 'Mexican', 'Mediterranean'];

// Smart default: which meal is the clock pointing at?
// 04:00–10:59 → Breakfast · 11:00–15:59 → Lunch · 16:00–03:59 → Dinner
export function defaultMealTime(date = new Date()) {
  const h = date.getHours();
  if (h >= 4 && h < 11) return 'Breakfast';
  if (h >= 11 && h < 16) return 'Lunch';
  return 'Dinner';
}

// Intro line above the chosen meal, matching the selected meal time
// (or the clock's pick when the user chose no preference).
export function mealIntro(mealTime, date = new Date()) {
  const m = mealTime || defaultMealTime(date);
  if (m === 'Breakfast') return "For breakfast you're making";
  if (m === 'Lunch') return "For lunch you're making";
  return "Tonight you're making";
}
