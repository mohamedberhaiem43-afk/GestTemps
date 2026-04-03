import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import EtatPeriodiquePresence from './EtatPeriodiquePresence';
import ValeurDefautSelection from './ValeurDefautSelection/ValeurDefautSelection';
import { useState } from 'react';
import { Button } from '@mui/material';
import { Parametre } from '../../../models/Parametre';
import useAddLogoSoc from '../../../hooks/parametreHooks/useAddLogoSoc';

const Item = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.mode === 'dark' ? '#1A2027' : '#fff',
  ...theme.typography.body2,
  padding: theme.spacing(1),
  textAlign: 'center',
  color: theme.palette.text.secondary,
}));

interface AffichageProps {
  parametre?: Parametre;
  onChange?: (data: Partial<Parametre>) => void;
}

const Affichage: React.FC<AffichageProps> = ({ parametre,onChange }) => {

    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
  const { mutateAsync: uploadLogo } = useAddLogoSoc();
    
  const handleUpload = async () => {
      if (!selectedImage) return;

      const formData = new FormData();
      formData.append("file", selectedImage);

      try {
          const response = await uploadLogo(formData);

          // Save societe logo path and notify layout
          const filePath = response?.filePath;
          if (filePath) {
              localStorage.setItem('societeImage', filePath);
              globalThis.window.dispatchEvent(new Event('imageUpdated'));
          }
      } catch (error) {
          console.error("Upload failed:", error);
      }
  };
const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];

  if (file && file.type.startsWith("image/")) {

    // 🔹 Renommer le fichier en Societe.png
    const renamedFile = new File(
      [file],
      "Societe.png",
      { type: file.type }
    );

    setSelectedImage(renamedFile);

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(renamedFile);

  } else {
    setSelectedImage(null);
    setImagePreview(null);
  }
};

    
  return (
    <Box sx={{ flexGrow: 1 }}>
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <Item>
            <EtatPeriodiquePresence
              parmetres={parametre}
              onChange={(data) => onChange?.(data)}
            />
          </Item>
        </Grid>
        <Grid item xs={6}>
          <Item>
            <ValeurDefautSelection
              parmetres={parametre}
              onChange={(data) => onChange?.(data)}
            />
          </Item>
        </Grid>
        <Grid item xs={6}>
          <Item>
            <Button
              variant="outlined"
              component="label"
              fullWidth
              sx={{ textTransform: "none", mb: 1 }}
            >
              Select Image
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={handleImageChange}
              />
            </Button>

            <Button
              variant="contained"
              color="primary"
              fullWidth
              sx={{ textTransform: "none" }}
              onClick={handleUpload}
              disabled={!selectedImage}
            >
              Enregistrer Logo
            </Button>

            {imagePreview && (
              <Box mt={2} textAlign="center">
                <img
                  src={imagePreview}
                  alt="Preview"
                  style={{ maxWidth: "100%", height: "auto" }}
                />
              </Box>
            )}
          </Item>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Affichage;