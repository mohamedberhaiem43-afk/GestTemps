import { Checkbox, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useUserContext } from "../../helper/UserProvider";
import Poidroit from "../../../models/Poidroit";
import useGetPoidroits from "../../../hooks/pointeuseHooks/useGetPointdroits";

interface DroitAcceesProps {
    onPermissionsChange: (permissions: Poidroit[]) => void;
}

export default function PointeuseAccees({ onPermissionsChange }: DroitAcceesProps) {
  const { t } = useTranslation();
  const { selectedUser } = useUserContext();
  const { data: poidroits = [], isLoading } = useGetPoidroits(selectedUser);

  // Local state for modules
  const [pointeuses, setPointeuses] = useState<Poidroit[]>([]);

  // Initialize pointeuses when poidroits data changes
  useEffect(() => {
    if (selectedUser && poidroits.length > 0) {
      setPointeuses(poidroits);
    } else {
      setPointeuses([]);
    }
  }, [poidroits, selectedUser]); // Only depend on poidroits and selectedUser

  // Call onPermissionsChange whenever permissions change
  useEffect(() => {
    onPermissionsChange(pointeuses);
  }, [pointeuses, onPermissionsChange]);

  const handleCheckboxChange = (index: number, field: keyof Poidroit) => {
    setPointeuses((prev) =>
      prev.map((mod, i) =>
        i === index
          ? {
              ...mod,
              [field]: mod[field] === '1' ? '0' : '1',
            }
          : mod
      )
    );
  };

  return (
    <TableContainer component={Paper} sx={{ maxHeight: 450 }}>
      <Table sx={{ minWidth: 650 }} size="small" aria-label="droit accès table">
        <TableHead sx={{ backgroundColor: "#1976d2", position: "sticky", top: 0, zIndex: 1 }}>
          <TableRow>
            <TableCell sx={{ color: "white" }}>{t('pointeuseAccees.table.code')}</TableCell>
            <TableCell sx={{ color: "white" }}>{t('pointeuseAccees.table.punchClock')}</TableCell>
            <TableCell align="right" sx={{ color: "white" }}>{t('pointeuseAccees.table.read')}</TableCell>
            <TableCell align="right" sx={{ color: "white" }}>{t('pointeuseAccees.table.purge')}</TableCell>
            <TableCell align="right" sx={{ color: "white" }}>{t('pointeuseAccees.table.configure')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {!isLoading && pointeuses.length > 0 ? (
            pointeuses.map((module, index) => (
              <TableRow key={module.poicod || index}>
                <TableCell>{module.poicod}</TableCell>
                <TableCell>{module.poilib}</TableCell>
                {(["lire", "purger", "config"] as const).map((field) => (
                  <TableCell align="right" key={field}>
                    <Checkbox
                      checked={module[field] === "1"}
                      onChange={() => handleCheckboxChange(index, field)}
                      size="small"
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5} align="center">
                {isLoading ? t('pointeuseAccees.table.loading') : t('pointeuseAccees.table.selectUser')}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}