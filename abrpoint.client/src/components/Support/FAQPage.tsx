import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Accordion, AccordionSummary, AccordionDetails, Button } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useTranslation } from 'react-i18next';

const FAQ_KEYS = ['addEmployee', 'overtime', 'loginIssue', 'importExcel', 'leaveCarryover', 'billing', 'contract'];

const FAQPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<number | false>(0);

  return (
    <Box sx={{ p: { xs: 3, md: 5 }, maxWidth: 980, mx: 'auto' }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/dashboard/support')} sx={{ mb: 2, color: '#475569', textTransform: 'none', fontWeight: 600 }}>
        {t('support.common.back')}
      </Button>
      <Typography sx={{ fontSize: 28, fontWeight: 800, color: '#191c1e', mb: 1 }}>{t('support.faq.title')}</Typography>
      <Typography sx={{ fontSize: 14, color: '#475569', mb: 4 }}>
        {t('support.faq.subtitle')}
      </Typography>
      <Box sx={{ borderRadius: 3, overflow: 'hidden', border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
        {FAQ_KEYS.map((key, i) => (
          <Accordion
            key={key}
            expanded={expanded === i}
            onChange={(_, isOpen) => setExpanded(isOpen ? i : false)}
            disableGutters
            elevation={0}
            sx={{ borderBottom: i === FAQ_KEYS.length - 1 ? 'none' : '1px solid #e2e8f0', '&:before': { display: 'none' } }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 3, py: 1.5 }}>
              <Typography sx={{ fontWeight: 600, fontSize: 14, color: '#191c1e' }}>
                {t(`support.faq.items.${key}.q`)}
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 3, pb: 3, color: '#475569', fontSize: 13.5, lineHeight: 1.7 }}>
              {t(`support.faq.items.${key}.a`)}
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
    </Box>
  );
};

export default FAQPage;
