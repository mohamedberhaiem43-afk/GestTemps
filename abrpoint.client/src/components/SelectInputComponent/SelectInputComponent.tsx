import { FormControl, InputLabel, Select, MenuItem } from "@mui/material";

interface SelectInputComponentProps {
    label: string;
    value: string | string[] | null|undefined;
    setValue: (value: any) => void;
    maplist: Record<string, string> | Record<string, string>[];
    multiple?: boolean;
    onClick?: any;
    disabled?: boolean;
}

export default function SelectComponent({label, value, setValue, maplist, multiple, onClick, disabled = false}: SelectInputComponentProps)
{
    return(
        <>
               <FormControl variant="standard" fullWidth disabled={disabled}>
                  <InputLabel shrink  id="employe-label">{label}</InputLabel>
                  <Select
                    size="small"
                    required
                    disabled={disabled}
                    label={label}
                    value={multiple ? (Array.isArray(value) ? value : []) : value}
                    multiple={multiple || false}
                    onChange={(e) => setValue(e.target.value)}
                    onClick={onClick}
                    onOpen={onClick}
                  >
                    {Object.entries(maplist).map(([cod, lib]: [string, string]) => (
                      <MenuItem key={cod} value={cod} sx={{ fontSize: '0.85rem' }}>
                        {lib}
                      </MenuItem>
                    ))}
                  </Select>
                  </FormControl>
        </>
    )
}
