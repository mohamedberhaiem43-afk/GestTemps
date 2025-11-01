import { Alert, AlertTitle, IconButton, Snackbar } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useState } from "react";

type ForbiddenMessageProps = {
  message: string;
  autoHideDuration?: number; // en ms
};

export default function ForbiddenMessage({
  message,
  autoHideDuration = 6000,
}: ForbiddenMessageProps) {
  const [open, setOpen] = useState(true);

  const handleClose = (_?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === "clickaway") return;
    setOpen(false);
  };

  return (
    <Snackbar
      open={open}
      autoHideDuration={autoHideDuration}
      onClose={handleClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
    >
      <Alert
        severity="error"
        onClose={handleClose}
        action={
          <IconButton
            aria-label="fermer"
            size="small"
            onClick={() => setOpen(false)}
          >
            <CloseIcon fontSize="inherit" />
          </IconButton>
        }
        sx={{ width: "100%" }}
      >
        <AlertTitle>Action interdite</AlertTitle>
        {message}
      </Alert>
    </Snackbar>
  );
}
