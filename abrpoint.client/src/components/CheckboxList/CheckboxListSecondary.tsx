import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import Checkbox from '@mui/material/Checkbox';
import Avatar from '@mui/material/Avatar';

interface CheckboxListSecondaryProps {
  employees: string[];  // Array of employee names
  checked: number[];    // Array of indices for checked items
  handleToggle: (value: number) => () => void;
}

export default function CheckboxListSecondary({ employees, checked, handleToggle }: CheckboxListSecondaryProps) {
  return (
    <List
      dense
      sx={{
        width: '100%',
        maxWidth: 360,
        bgcolor: 'background.paper',
        maxHeight: 200, // Set a fixed height for the list
        overflow: 'auto', // Enable scrolling
      }}
    >
      {
  Object.entries(employees).map(([empcod, emplib], index) => {
    const labelId = `checkbox-list-secondary-label-${index}`;
    return (
      <ListItem
        key={empcod} // Use empcod as the unique key
        secondaryAction={
          <Checkbox
            size='small'
            edge="end"
            onChange={handleToggle(index)}
            checked={checked.includes(index)}
            inputProps={{ 'aria-labelledby': labelId }}
          />
        }
        disablePadding
      >
        <ListItemButton>
          <ListItemAvatar>
            <Avatar
              alt={`Avatar of ${emplib}`} // Use name for the alt text
              src="/static/images/avatar/default-avatar.png" // Default image
              sx={{ width: 32, height: 32 }} // Make the avatar smaller

            />
          </ListItemAvatar>
          <ListItemText 
            id={labelId} 
            primary={emplib}
            primaryTypographyProps={{ fontSize: '0.8rem' }} // Set smaller font size
          /> {/* Display the employee name */}
        </ListItemButton>
      </ListItem>
    );
  })
}

    </List>
  );
}
