import { FormControl, InputLabel, Select, MenuItem } from "@mui/material";

interface SelectInputComponentProps {
    label: string;
    value: string | string[] | null|undefined;
    setValue: (value: any) => void;
    maplist: Record<string, string> | Record<string, string>[];
    multiple?: boolean;
    onClick?: any;
}

export default function SelectComponent({label, value, setValue, maplist, multiple, onClick}: SelectInputComponentProps)
{
    return(
        <>
               <FormControl variant="standard" fullWidth>
                  <InputLabel shrink  id="employe-label">{label}</InputLabel>
                  <Select
                    size="small"
                    required
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