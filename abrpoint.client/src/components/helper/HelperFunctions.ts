import { parseISO, format, addDays, isSunday } from 'date-fns';

export const getWeeksFromStartToSunday = (startStr: string, endStr: string) => {
  const result = [];

  let start = parseISO(startStr);
  let end = parseISO(endStr);

  // Étendre la fin jusqu'au dimanche suivant si ce n’est pas déjà un dimanche
  if (!isSunday(end)) {
    const daysToAdd = 7 - end.getDay(); // end.getDay() === 0 pour dimanche
    end = addDays(end, daysToAdd);
  }

  while (start <= end) {
    // Fin de semaine = dimanche à partir du start
    const daysToSunday = 7 - start.getDay(); // Si dimanche: 0
    const weekEnd = addDays(start, daysToSunday);

    result.push({
      start: format(start, 'dd/MM/yyyy'),
      end: format(weekEnd, 'dd/MM/yyyy'),
    });

    // Prochaine semaine commence le lundi suivant
    start = addDays(weekEnd, 1);
  }

  return result;
};
