import { useState, useEffect } from "react";
import { Grid } from "@mui/material";
import InputComponent from "../../../Inputs/Input";
import SelectInputComponent from "../../../SelectInputComponent/SelectInputComponent";
import useGetVillesLibs from "../../../../hooks/villeHooks/useGetVillesLibs";
import useGetPaysLibs from "../../../../hooks/paysHooks/useGetPaysLibs";
import Employe from "../../../../models/Employe";

interface EmployeDetailsProps {
  onChange: (data: any) => void;
  empData: Employe;
}

export default function Cordonees({ onChange, empData }: EmployeDetailsProps) {
  const etatCivile = {
    "C": "Célibataire(e)",
    "M": "Marié(e)",
    "D": "Divorcé(e)"
  };

  const { data: villes = [] } = useGetVillesLibs();
  const { data: nations = [] } = useGetPaysLibs();

  const [formData, setFormData] = useState(empData);

  useEffect(() => {
    setFormData(empData);
  }, [empData]);

  const handleChange = (event: any) => {
    const { name, value } = event.target;
    const updatedData = {
      ...formData,
      [name]: value,
    };
    setFormData(updatedData);
    onChange({ [name]: value }); // Notify parent with field update
  };

  useEffect(() => {
    onChange(formData); // Notify parent with full form data on any update
  }, [formData, onChange]);

  return (
    <Grid container spacing={2}>
      <Grid item xs={4}>
        <InputComponent
          type='text'
          label='Adresse'
          value={formData.empadr}
          setValue={(value: any) => handleChange({ target: { name: 'empadr', value } })}
        />
      </Grid>
      <Grid item xs={3} mt={1}>
        <SelectInputComponent
          label='Nationalité'
          value={formData.natcod}
          setValue={(value) => handleChange({ target: { name: 'natcod', value } })}
          maplist={nations}
        />
      </Grid>
      <Grid item xs={3} mt={1}>
        <SelectInputComponent
          label='Ville'
          value={formData.vilcod}
          setValue={(value) => handleChange({ target: { name: 'vilcod', value } })}
          maplist={villes}
        />
      </Grid>
      <Grid item xs={3}>
        <InputComponent
          type='tel'
          label='Tél'
          value={formData.emptel}
          setValue={(value: any) => handleChange({ target: { name: 'emptel', value } })}
        />
      </Grid>
      <Grid item xs={3}>
        <InputComponent
          type='number'
          label='Mobile'
          value={formData.empmob}
          setValue={(value: any) => handleChange({ target: { name: 'empmob', value } })}
        />
      </Grid>
      <Grid item xs={3}>
        <InputComponent
          type='email'
          label='Email'
          value={formData.empemail}
          setValue={(value: any) => handleChange({ target: { name: 'empemail', value } })}
        />
      </Grid>
      <Grid item xs={3}>
        <SelectInputComponent
          label='Etat Civil'
          value={formData.empsitfam}
          setValue={(value) => handleChange({ target: { name: 'empsitfam', value } })}
          maplist={etatCivile}
        />
      </Grid>
    </Grid>
  );
}
