import { FormControlLabel, Checkbox, Typography } from '@mui/material';

interface CheckboxComponentProps {
  label: string;
  value: boolean;
  setValue: (checked: boolean) => void;
  disabled?: boolean;
}

function CheckboxComponent({ label, value, setValue, disabled = false }: CheckboxComponentProps) {
  return (
    <FormControlLabel
      control={
        <Checkbox
          size='small'
          checked={value}
          disabled={disabled}
          onChange={(e) => setValue(e.target.checked)}
        />
      }
      label={
        <Typography fontSize="small" color={disabled ? 'text.disabled' : 'text.primary'}>
          {label}
        </Typography>
      }
    />
  );
}

export default CheckboxComponent;
