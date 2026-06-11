export const AVATAR_POOL = ['🍳','🥄','🔪','🫕','🍴','🥢','🧂','📟','🥣','🫙'];

export function randomAvatar() {
  return AVATAR_POOL[Math.floor(Math.random() * AVATAR_POOL.length)];
}
