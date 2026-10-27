// Décompte hebdomadaire des frais : la semaine va du samedi au vendredi.
export const getFraisWeekStart = (date: Date): Date => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayOfWeek = d.getDay(); // 0 = dimanche, 6 = samedi
  // Reculer jusqu'au samedi précédent (ou rester si déjà samedi)
  const offset = dayOfWeek >= 6 ? dayOfWeek - 6 : dayOfWeek + 1;
  d.setDate(d.getDate() - offset);
  return d;
};
