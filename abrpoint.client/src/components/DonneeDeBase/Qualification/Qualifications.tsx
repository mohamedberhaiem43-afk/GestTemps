import { useState } from "react";
import { Box } from "@mui/material";
import { QualificationList } from "../../helper/table/QualificationList";
import { Qualification as QualificationModel } from "../../../models/Qualification";
import { QualificationForm } from "./QulificationForm";
import BreadcrumbNavigation from "../../helper/BreadcrumbNavigation";

export function Qualifications() {
  const [selectedQualification, setSelectedQualification] =
    useState<QualificationModel | null>(null);

  return (
    <Box sx={{ minWidth: "90vw", px: 2 }} mt={-10}>
      <BreadcrumbNavigation />
      <QualificationForm
        qualificationToEdit={selectedQualification}
        onEditComplete={() => setSelectedQualification(null)}
      />

      <QualificationList
        onSelectQualification={(qualification) =>
          setSelectedQualification(qualification)
        }
      />
    </Box>
  );
}