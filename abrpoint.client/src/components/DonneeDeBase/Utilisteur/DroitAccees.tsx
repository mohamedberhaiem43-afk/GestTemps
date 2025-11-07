import { Checkbox, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";
import { useEffect, useState } from "react";
import { Moduser } from "../../../models/moduser";
import { useUserContext } from "../../helper/UserProvider";
import ModuserService from "../../../services/ModuserService/ModuserService";
import { useQuery } from "react-query";

interface DroitAcceesProps {
    onPermissionsChange: (permissions: Moduser[]) => void;
}
export default function DroitAccees({ onPermissionsChange }: DroitAcceesProps) {



  const { selectedUser } = useUserContext();

  // Fetch modusers data
  const { data: modusers = [], isLoading: modusersLoading } = useQuery<Moduser[]>({
    queryKey: ['modusers', selectedUser],
    queryFn: async () => {
      if (!selectedUser) return [];
      const result = await ModuserService.getAllWithParams(`${selectedUser}`);
      return Array.isArray(result) ? result : [result];
    },
    enabled: !!selectedUser,
  });

  // Local state for modules
  const [modules, setModules] = useState<Moduser[]>([]);
  // Call onPermissionsChange whenever permissions change
    useEffect(() => {
        onPermissionsChange(modules);
    }, [modules]);
  // Only update modules when modusers changes AND selectedUser is not null
  useEffect(() => {
    if (selectedUser && modusers.length > 0) {
      setModules(modusers);
    } else {
      setModules([]);
    }
  }, [modusers, selectedUser]); // Add selectedUser to dependencies

  const handleCheckboxChange = (index: number, field: keyof Moduser) => {
    setModules((prev) =>
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
        <TableHead sx={{ backgroundColor: '#1976d2', position: 'sticky', top: 0, zIndex: 1 }}>
          <TableRow>
            <TableCell sx={{ color: 'white' }}>
              Module
            </TableCell>
            <TableCell align="right" sx={{ color: 'white' }}>
              Ajout
            </TableCell>
            <TableCell align="right" sx={{ color: 'white' }}>
              Modification
            </TableCell>
            <TableCell align="right" sx={{ color: 'white' }}>
              Suppression
            </TableCell>
            <TableCell align="right" sx={{ color: 'white' }}>
              Consultation
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {!modusersLoading && modules.length > 0 ? (
            modules.map((module, index) => (
              <TableRow key={module.modcod || index}>
                <TableCell component="th" scope="row">
                  {module.modlib}
                </TableCell>
                {(['modsais', 'modupd', 'modsupp', 'modconsult'] as const).map(
                  (field) => (
                    <TableCell align="right" key={field}>
                      <Checkbox
                        checked={module[field] === '1'}
                        onChange={() => handleCheckboxChange(index, field)}
                        size="small"
                      />
                    </TableCell>
                  )
                )}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5} align="center">
                {modusersLoading ? 'Loading...' : 'Select a user to view permissions'}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}