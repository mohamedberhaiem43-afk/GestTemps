import { FormControlLabel, Checkbox, Typography } from '@mui/material';

interface CheckboxComponentProps {
  label: string;
  value: boolean;
  setValue: (checked: boolean) => void;
}

function CheckboxComponent({ label, value, setValue }: CheckboxComponentProps) {
  return (
    <FormControlLabel
      control={
        <Checkbox
          size='small'
          checked={value} // Use boolean value directly
          onChange={(e) => setValue(e.target.checked)} // Pass boolean directly
        />
      }
      label={<Typography fontSize="small">{label}</Typography>}
    />
  );
}

export default CheckboxComponent;
