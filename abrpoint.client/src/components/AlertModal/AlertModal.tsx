import * as React from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';

interface AlertModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  message: string;
}

const AlertModal: React.FC<AlertModalProps> = ({ open, onClose, onConfirm, message }) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm')); // Adjust breakpoint as needed
  const { t } = useTranslation();

  return (
    <Dialog
      fullScreen={fullScreen}
      open={open}
      onClose={onClose}
      aria-labelledby="responsive-dialog-title"
      sx={{
        '& .MuiDialog-container': {
          alignItems: 'center',
        },
        '& .MuiDialog-paper': {
          margin: { xs: '16px', sm: '32px' },
          width: { xs: '90%', sm: '400px' },
          maxWidth: '500px',
        },
      }}
    >
      <DialogTitle id="responsive-dialog-title">{t('common.confirmation') || 'Confirmation'}</DialogTitle>
      <DialogContent>
        <DialogContentText>{message}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel') || 'Cancel'}</Button>
        <Button onClick={onConfirm} autoFocus>{t('common.yes') || 'Yes'}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default AlertModal;