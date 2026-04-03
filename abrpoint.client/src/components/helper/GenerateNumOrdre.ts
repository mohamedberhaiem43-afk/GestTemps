// helpers/generateNumeroOrdre.ts
let counter = 1; // ou récupéré depuis backend/localStorage

export default function generateNumeroOrdre() {
  const year = new Date().getFullYear().toString().slice(-2); // ex: "25"
  const prefix = "00";
  const formattedCounter = counter.toString().padStart(2, "0"); // ex: "01"
  const numero = `${prefix}${year}${formattedCounter}`;
  counter++; // incrémenter pour le prochain
  return numero;
}