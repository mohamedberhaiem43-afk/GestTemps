import { FormControl, InputLabel, Select, MenuItem } from "@mui/material";

interface SelectComponentProps {
    label: string;
    value: string | string[] | null|undefined;
    setValue: (value: any) => void;
    maplist: Record<string, string> | Array<{label: string, value: string}>;
    multiple?: boolean;
}

export default function SelectComponent({label, value, setValue, maplist, multiple}: SelectComponentProps) {
    return (
        <FormControl variant="standard" fullWidth>
            <InputLabel shrink id="employe-label">{label}</InputLabel>
            <Select
                size="small"
                required
                label={label}
                value={multiple ? (Array.isArray(value) ? value : []) : value}
                multiple={multiple || false}
                onChange={(e) => setValue(e.target.value)}
            >
                {Array.isArray(maplist) 
                    ? maplist.map((item) => (
                        <MenuItem key={item.value} value={item.value} sx={{ fontSize: '0.85rem' }}>
                            {item.label}
                        </MenuItem>
                    ))
                    : Object.entries(maplist).map(([cod, lib]) => (
                        <MenuItem key={cod} value={cod} sx={{ fontSize: '0.85rem' }}>
                            {lib}
                        </MenuItem>
                    ))
                }
            </Select>
        </FormControl>
    )
}