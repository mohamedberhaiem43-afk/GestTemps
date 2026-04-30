import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, TextField, MenuItem, Snackbar, Alert } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import ChatBubbleIcon from '@mui/icons-material/ChatBubble';
import SendIcon from '@mui/icons-material/Send';

const subjects = [
  'Question technique',
  'Demande de formation',
  'Demande de coaching',
  'Pack de mise en place',
  'Facturation / abonnement',
  'Autre',
];

const ContactPage: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState(subjects[0]);
  const [message, setMessage] = useState('');
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' as 'success' | 'error' });

  const handleSubmit = () => {
    if (!name.trim() || !email.trim() || !message.trim()) {
      setSnack({ open: true, msg: 'Tous les champs sont requis.', sev: 'error' });
      return;
    }
    // Front-only pour l'instant : ouverture du client mail. Un endpoint /support/ticket pourra
    // être branché plus tard côté serveur (envoi via Brevo/SMTP déjà configuré).
    const body = encodeURIComponent(`Nom : ${name}\nEmail : ${email}\nSujet : ${subject}\n\n${message}`);
    window.location.href = `mailto:contact@concorde-tech.fr?subject=${encodeURIComponent('[Support] ' + subject)}&body=${body}`;
    setSnack({ open: true, msg: 'Votre client mail va s\'ouvrir avec le message pré-rempli.', sev: 'success' });
  };

  return (
    <Box sx={{ p: { xs: 3, md: 5 }, maxWidth: 1100, mx: 'auto' }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/dashboard/support')} sx={{ mb: 2, color: '#475569', textTransform: 'none', fontWeight: 600 }}>
        Retour au centre d'assistance
      </Button>
      <Typography sx={{ fontSize: 28, fontWeight: 800, color: '#191c1e', mb: 1 }}>Contactez-nous</Typography>
      <Typography sx={{ fontSize: 14, color: '#475569', mb: 4 }}>
        Notre équipe support répond sous 24h ouvrées (Premium : 2h garanties).
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2.5, mb: 4 }}>
        {[
          { icon: <EmailIcon />, label: 'Email', value: 'contact@concorde-tech.fr', color: '#16a34a' },
          { icon: <PhoneIcon />, label: 'Téléphone', value: '+33 1 86 76 12 34', color: '#0040a1' },
          { icon: <ChatBubbleIcon />, label: 'Chat IA', value: "Bouton flottant en bas à droite", color: '#7c3aed' },
        ].map((c, i) => (
          <Box key={i} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#fff', display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: `${c.color}15`, color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.icon}</Box>
            <Box>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>{c.label}</Typography>
              <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: '#191c1e' }}>{c.value}</Typography>
            </Box>
          </Box>
        ))}
      </Box>

      <Box sx={{ p: 4, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
        <Typography sx={{ fontSize: 18, fontWeight: 700, mb: 3, color: '#191c1e' }}>Formulaire de contact</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2.5 }}>
          <TextField label="Votre nom" size="small" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
          <TextField label="Votre email" size="small" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth type="email" />
          <TextField label="Sujet" size="small" select value={subject} onChange={(e) => setSubject(e.target.value)} sx={{ gridColumn: { md: 'span 2' } }}>
            {subjects.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </TextField>
          <TextField label="Message" size="small" value={message} onChange={(e) => setMessage(e.target.value)} multiline minRows={5} sx={{ gridColumn: { md: 'span 2' } }} />
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
          <Button variant="contained" startIcon={<SendIcon />} onClick={handleSubmit} sx={{ bgcolor: '#16a34a', textTransform: 'none', fontWeight: 700, px: 4, py: 1.2, '&:hover': { bgcolor: '#15803d' } }}>
            Envoyer
          </Button>
        </Box>
      </Box>
      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({ ...snack, open: false })}>
        <Alert severity={snack.sev} onClose={() => setSnack({ ...snack, open: false })} sx={{ borderRadius: '10px' }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
};

export default ContactPage;
