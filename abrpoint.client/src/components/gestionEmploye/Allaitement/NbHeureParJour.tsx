import React from 'react';
import { Box, Typography, Table, TableBody, TableCell, TableRow, Input } from '@mui/material';
import { useAllaitementContext } from '../../helper/AllaitementContext';

const NbHeureParJour: React.FC = () => {
  const { hoursData, setHoursData } = useAllaitementContext();

  const handleHoursChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;

    setHoursData((prevData:any) => ({
      ...prevData,
      [name]: parseInt(value, 10) || 0,
    }));
  };

  return (
    <Box>
      <Typography variant="h6">Heures par jour</Typography>
      <Table size='small'>
        <TableBody >
          {['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'].map((day) => (
            <TableRow key={day}>
              <TableCell>{day.charAt(0).toUpperCase() + day.slice(1)}</TableCell>
              <TableCell>
                <Input
                  type="number"
                  name={day}
                  value={hoursData[day] || 0} // Ensure hoursData[day] is accessible
                  onChange={handleHoursChange}
                  placeholder={day.charAt(0).toUpperCase() + day.slice(1)}
                  inputProps={{ min: 0 }}
                />
                {/* {hoursData[day] || 0} */}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
};

export default NbHeureParJour;
