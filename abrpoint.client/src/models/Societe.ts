export type Societe = { 
    soccod: string;
    soclib: string;
    socresp: string;
    socadr: string;
    socville: string;
    soctel: string;
    socfax: string;
    socemail: string;
    socccb: string;
    soctva: string;
    soctva1: string;
    soctva2: string;
    soctva3: string;
    soctva000: string;
    socreg: number;
    socmois: number;
    soctype: string;
    socpresence: string;
    sochsup: string;
    socmere: string;
    // Le backend type ce champ en `double?` (Models/Societe.cs:89). Il faut donc
    // envoyer un nombre ou null — un `""` provoque une erreur 400 de désérialisation
    // (« The JSON value could not be converted to System.Nullable<Double> »), qui
    // remontait aussi sous forme de "societe field is required" car le binding du
    // body entier échouait.
    socsmig: number | null;
    soclibar: string;
    socadrar: string;
    socrespar: string;
  };