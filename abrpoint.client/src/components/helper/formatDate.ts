export default function formatDateForApi (date:string|Date) {
  const d = new Date(date);
  return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()} 00:00:00`;
}
