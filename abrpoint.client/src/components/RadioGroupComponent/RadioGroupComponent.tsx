import { 
  FormControl, 
  RadioGroup, 
  FormControlLabel, 
  Radio, 
  Typography 
} from '@mui/material';
import { ReactNode } from 'react';

interface RadioGroupComponentProps {
  value: string | null;
  setValue: (val: string) => void;
  children: ReactNode;
}

function RadioGroupComponent({ value, setValue, children }: RadioGroupComponentProps) {
  return (
    <FormControl component="fieldset">
      <RadioGroup
        row
        value={value}
        onChange={(e) => setValue(e.target.value)}
      >
        {children}
      </RadioGroup>
    </FormControl>
  );
}

interface FormControlLabelComponentProps {
  radioValue: string;
  label: string;
}

export function FormControlLabelComponent({ radioValue, label }: FormControlLabelComponentProps) {
  return (
    <FormControlLabel
      value={radioValue}
      control={<Radio size="small" />}
      label={<Typography fontSize="small">{label}</Typography>}
    />
  );
}

export default RadioGroupComponent;
