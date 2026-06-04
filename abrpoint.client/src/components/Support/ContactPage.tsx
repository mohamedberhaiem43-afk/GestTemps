import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, TextField, MenuItem, CircularProgress } from '@mui/material';
import { useFeedbackSnackbar } from '../helper/FeedbackSnackbar';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import ChatBubbleIcon from '@mui/icons-material/ChatBubble';
import SendIcon from '@mui/icons-material/Send';
import { useTranslation } from 'react-i18next';
import { sendSupportMessage } from '../../services/ContactService';

const SUBJECT_KEYS = ['technical', 'training', 'coaching', 'pack', 'billing', 'other'];

const ContactPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const subjectOptions = useMemo(
    () => SUBJECT_KEYS.map(k => ({ key: k, label: t(`support.contact.subjects.${k}`) })),
    [t]
  );

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subjectKey, setSubjectKey] = useState(SUBJECT_KEYS[0]);
  const [message, setMessage] = useState('');
  const feedback = useFeedbackSnackbar();
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !message.trim()) {
      feedback.showError(t('support.contact.errors.requiredFields'));
      return;
    }
    setSending(true);
    try {
      await sendSupportMessage({
        name: name.trim(),
        email: email.trim(),
        subject: t(`support.contact.subjects.${subjectKey}`),
        message: message.trim(),
      });
      feedback.showSuccess(t('support.contact.successMessage'));
      setName('');
      setEmail('');
      setSubjectKey(SUBJECT_KEYS[0]);
      setMessage('');
    } catch (err) {
      feedback.showError(err, t('support.contact.errors.sendFailed'));
    } finally {
      setSending(false);
    }
  };

  const cards = [
    { icon: <EmailIcon />, label: t('support.contact.email'), value: 'contact@concorde-tech.fr', color: '#16a34a' },
    { icon: <PhoneIcon />, label: t('support.contact.phone'), value: '+33 7 55 61 71 54', color: '#0040a1' },
    { icon: <ChatBubbleIcon />, label: t('support.contact.chat'), value: t('support.contact.chatValue'), color: '#7c3aed' },
  ];

  return (
    <Box sx={{ p: { xs: 3, md: 5 }, maxWidth: 1100, mx: 'auto' }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/dashboard/support')} sx={{ mb: 2, color: '#475569', textTransform: 'none', fontWeight: 600 }}>
        {t('support.common.back')}
      </Button>
      <Typography sx={{ fontSize: 28, fontWeight: 800, color: '#191c1e', mb: 1 }}>{t('support.contact.title')}</Typography>
      <Typography sx={{ fontSize: 14, color: '#475569', mb: 4 }}>
        {t('support.contact.subtitle')}
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2.5, mb: 4 }}>
        {cards.map((c, i) => (
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
        <Typography sx={{ fontSize: 18, fontWeight: 700, mb: 3, color: '#191c1e' }}>{t('support.contact.formTitle')}</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2.5 }}>
          <TextField label={t('support.contact.name')} size="small" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
          <TextField label={t('support.contact.yourEmail')} size="small" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth type="email" />
          <TextField label={t('support.contact.subject')} size="small" select value={subjectKey} onChange={(e) => setSubjectKey(e.target.value)} sx={{ gridColumn: { md: 'span 2' } }}>
            {subjectOptions.map((s) => <MenuItem key={s.key} value={s.key}>{s.label}</MenuItem>)}
          </TextField>
          <TextField label={t('support.contact.message')} size="small" value={message} onChange={(e) => setMessage(e.target.value)} multiline minRows={5} sx={{ gridColumn: { md: 'span 2' } }} />
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
          <Button
            variant="contained"
            startIcon={sending ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <SendIcon />}
            onClick={handleSubmit}
            disabled={sending}
            sx={{ bgcolor: '#16a34a', textTransform: 'none', fontWeight: 700, px: 4, py: 1.2, '&:hover': { bgcolor: '#15803d' } }}
          >
            {sending ? t('support.contact.sending') : t('support.contact.send')}
          </Button>
        </Box>
      </Box>
      {feedback.element}
    </Box>
  );
};

export default ContactPage;
