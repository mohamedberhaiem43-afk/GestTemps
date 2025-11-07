import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { HeuresSupplementairesResultat, PointageMois } from "../../../models/PointageMois";

function EtatGlobalButton({ pointageMois }: { pointageMois: PointageMois[] }) {
  const handleExport = () => {
    if (!pointageMois || pointageMois.length === 0) {
      alert("Aucune donnée disponible pour l'export.");
      return;
    }

    // Applatir chaque heureSupplementairesResultats en ligne individuelle
    const dataToExport = pointageMois.flatMap((item: PointageMois) => {
      return item.heuresSupplementairesResultats.map((res: HeuresSupplementairesResultat) => ({
        "Matricule": item.empMat,
        "Nom et Prénom": item.empLib,
        "Régime": item.empReg,
        "Site": item.empSite,
        //"Date": res.dateJour || "",

        "Nb. Jours": res.nbJours || 0,
        "J. Abs.": res.absj + res.absnp + res.absnj || 0,
        "H. Nor": res.heuresNormales || 0,
        //"H. Abs": res.nbHeureAbs || 0,
        //"Aut.S Payé": res.autPaye || 0,
        "HS. 25%": res.heuresSupTranche1 || 0,
        "HS. 75%": res.heuresSupTranche2 || 0,
        "Férier": res.nbJourFerier || 0,
        "H. Férier": res.hreFerier || 0,
        "H. Fer. Trv": res.hreFerieTrv || 0,
        "H. Rep. Trav": res.heureRepos || 0,
        "Congé": res.nbJourCngPaye || 0,
        "H. Congé": res.nbHeureConge || 0,
        "H. Nuit": res.hreNuits || 0,
        "Nb. Nuit": res.nbNuits || 0,
        "Nb. Allait": res.hreAllaitement || 0,
        "Tot. Heure": res.tothre || 0,
      }));
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "État Global");

    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(blob, "etat-global.xlsx");
  };

  return (
    <button onClick={handleExport} className="bg-green-600 text-white p-2 rounded">
      État Global
    </button>
  );
}

export default EtatGlobalButton;
