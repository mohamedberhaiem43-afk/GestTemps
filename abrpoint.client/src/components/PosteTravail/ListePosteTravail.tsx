import { useContext } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { PosteContext } from "../helper/PostProvider/PostContext";
import useGetPoste from "../../hooks/posteHooks/useGetPoste";
import ForbiddenMessage from "../AlertModal/ForbiddenMessage";

interface Poste {
  codposte: string;
  libposte: string;
}

const PosteTable = () => {
  const context = useContext(PosteContext);
  if (!context) {
    throw new Error("PosteContext must be used within a PostProvider");
  }
  const { setSelectedPoste, selectedPoste } = context;

  const theme = useTheme();
  const { data, error, isError, isLoading, refetch } = useGetPoste();

  const postes: Poste[] = data
    ? Object.entries(data).map(([codposte, libposte]) => ({
        codposte,
        libposte: String(libposte),
      }))
    : [];

  const handleRowClick = (poste: any) => {
    setSelectedPoste(poste);
    refetch();
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", marginTop: "20px" }}>
        <CircularProgress />
      </div>
    );
  }

  // 👉 Show forbidden snackbar if 403
  if (isError && (error as any)?.response?.status === 403) {
    return <ForbiddenMessage message="Accès interdit aux postes." />;
  }

  return (
    <TableContainer component={Paper} sx={{ maxHeight: 270 }}>
      <Table size="small">
        <TableHead
          sx={{
            backgroundColor: "#1976d2",
            position: "sticky",
            top: 0,
            zIndex: 1,
          }}
        >
          <TableRow>
            <TableCell
              align="left"
              sx={{
                backgroundColor: theme.palette.primary.main,
                color: theme.palette.primary.contrastText,
                fontWeight: "bold",
              }}
            >
              Code
            </TableCell>
            <TableCell
              align="left"
              sx={{
                backgroundColor: theme.palette.primary.main,
                color: theme.palette.primary.contrastText,
                fontWeight: "bold",
              }}
            >
              Poste Horaire
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {postes.map((poste: Poste) => (
            <TableRow
              key={poste.codposte}
              onClick={() => handleRowClick(poste)}
              hover
              sx={{
                cursor: "pointer",
                backgroundColor:
                  selectedPoste?.codposte === poste.codposte
                    ? theme.palette.action.selected // ✅ couleur de sélection
                    : "inherit",
              }}
            >
              <TableCell align="left">{poste.codposte}</TableCell>
              <TableCell align="left">{poste.libposte}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default PosteTable;
