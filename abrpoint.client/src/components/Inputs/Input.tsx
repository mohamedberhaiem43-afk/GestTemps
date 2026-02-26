import { InputLabel, Input } from "@mui/material";

interface InputComponentProps {
  type: string;
  label: string;
  value: any;
  setValue?: (value: any) => void;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  name?: string;
  readOnly?: boolean;
  required?: boolean;
}

export default function InputComponent({
  type,
  label,
  value,
  setValue,
  onChange,
  name,
  readOnly = false,
  required = false
}: InputComponentProps): JSX.Element {
  return (
    <>
      <InputLabel shrink>{label}</InputLabel>
      <Input
        required={required}
        size="small"
        type={type}
        name={name}
        value={value}
        onChange={(e:any) => {
          if (onChange) onChange(e);
          else if (setValue) setValue(e.target.value);
        }}
        fullWidth
        readOnly={readOnly}
      />
    </>
  );
}
