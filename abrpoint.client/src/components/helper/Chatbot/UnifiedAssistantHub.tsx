import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Drawer,
  Fab,
  IconButton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import GavelIcon from '@mui/icons-material/Gavel';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import RefreshIcon from '@mui/icons-material/Refresh';
import NavigationIcon from '@mui/icons-material/Navigation';
import ThumbUpAltOutlinedIcon from '@mui/icons-material/ThumbUpAltOutlined';
import ThumbDownAltOutlinedIcon from '@mui/icons-material/ThumbDownAltOutlined';
import ThumbUpAltIcon from '@mui/icons-material/ThumbUpAlt';
import ThumbDownAltIcon from '@mui/icons-material/ThumbDownAlt';
import { useAuth } from '../AuthProvider';
import apiInstance from '../../API/apiInstance';
import RagService, { RagChatAnswer, RagChatSource } from '../../../services/RagService';
import { useAskRag, useRagFeedback } from '../../../hooks/ragHooks/useRagChat';
// Unified hub :
// - Onglet "Assistant" — opérationnel (KPIs, présence, congés, navigation) via /AIAssistant/chat (Gemini + plugins).
// - Onglet "Documents juridiques" — RAG sur les documents du tenant via /ChatRag/ask (sources + feedback).
// Les deux conversations sont préservées indépendamment (changer d'onglet ne perd rien).

type TabKey = 'assistant' | 'rag';

interface AssistantMessage {
  role: 'user' | 'model';
  text: string;
  navigationAction?: { path: string; label: string };
  error?: boolean;
}

interface RagMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: RagChatSource[];
  logId?: number;
  feedback?: number;
  error?: boolean;
}

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function extractNavigationFromResponse(text: string): { path: string; label: string } | null {
  const navigationPatterns = [
    { pattern: /\[NAVIGATE:([^\]]+)\]/i, extract: (m: RegExpMatchArray) => m[1] },
    { pattern: /aller (?:à|vers|sur) (?:la page |le menu )?([^\n.,]+)/i, extract: (m: RegExpMatchArray) => m[1] },
  ];
  for (const { pattern, extract } of navigationPatterns) {
    const match = text.match(pattern);
    if (match) {
      const target = extract(match).trim().toLowerCase();
      const routeMap: Record<string, { path: string; label: string }> = {
        emppresence: { path: '/dashboard/etat-de-presence', label: 'État de Présence' },
        présence: { path: '/dashboard/etat-de-presence', label: 'État de Présence' },
        presence: { path: '/dashboard/etat-de-presence', label: 'État de Présence' },
        repos: { path: '/dashboard/Repos', label: 'Gestion des Repos' },
        pointeuse: { path: '/dashboard/liste-pointeuse', label: 'Pointeuse' },
        saisie: { path: '/dashboard/etat-periodique', label: 'Saisie Pointage' },
        dashboard: { path: '/dashboard', label: 'Tableau de Bord' },
        'tableau de bord': { path: '/dashboard', label: 'Tableau de Bord' },
      };
      for (const [key, value] of Object.entries(routeMap)) {
        if (target.includes(key)) return value;
      }
    }
  }
  return null;
}

function SourceChip({ source }: { source: RagChatSource }) {
  const handleClick = async () => {
    try {
      const blob = await RagService.download(source.documentId);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      /* silencieux */
    }
  };
  const label = `${source.documentName ?? `#${source.documentId}`}${source.page ? `, p.${source.page}` : ''}`;
  return (
    <Tooltip title={source.snippet}>
      <Chip size="small" label={label} onClick={handleClick} sx={{ maxWidth: 240, cursor: 'pointer' }} />
    </Tooltip>
  );
}

function HubContent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { soccod, uticod, userName, roleName, isAdmin, isManager, isEmp, sercod } = useAuth();

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>('assistant');
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // ── Assistant (Gemini) state ─────────────────────────────────────────
  const buildWelcome = () => {
    const greet = userName ? `Bonjour ${userName.split(' ')[0]}!` : 'Bonjour!';
    const role = isAdmin ? 'administrateur' : isManager ? 'manager' : 'employé';
    if (isAdmin || isManager) {
      return `${greet} 👋 Je suis votre assistant intelligent (rôle: ${role}).

Je peux vous aider avec :
• Statistiques de présence et retards en temps réel
• Pointage d'un employé sur un mois donné
• Liste des absents / présents du jour
• Heures supplémentaires d'un employé
• Navigation dans l'application

Posez-moi votre question !`;
    }
    return `${greet} 👋 Je suis votre assistant intelligent.

Je peux vous aider avec :
• Vos heures travaillées et heures supplémentaires
• Votre solde de congés et vos demandes
• Vos prochains jours fériés et votre emploi du temps
• Navigation dans l'application

Posez-moi votre question !`;
  };

  const [assistantMsgs, setAssistantMsgs] = useState<AssistantMessage[]>([
    { role: 'model', text: buildWelcome() },
  ]);
  const [assistantLoading, setAssistantLoading] = useState(false);

  // ── RAG state ────────────────────────────────────────────────────────
  const [ragMsgs, setRagMsgs] = useState<RagMessage[]>([]);
  const [ragError, setRagError] = useState<string | null>(null);
  const askRag = useAskRag();
  const ragFeedback = useRagFeedback();

  // ── Bridge events (legacy support) ────────────────────────────────────
  // Permet à des composants tiers d'ouvrir le hub sur un onglet précis :
  //   window.dispatchEvent(new Event('rag-chat:open'))    → onglet RAG
  //   window.dispatchEvent(new Event('assistant:open'))   → onglet Assistant
  useEffect(() => {
    const openRag = () => { setTab('rag'); setOpen(true); };
    const openAssistant = () => { setTab('assistant'); setOpen(true); };
    window.addEventListener('rag-chat:open', openRag);
    window.addEventListener('assistant:open', openAssistant);
    return () => {
      window.removeEventListener('rag-chat:open', openRag);
      window.removeEventListener('assistant:open', openAssistant);
    };
  }, []);

  // Auto-scroll au bas de la conversation visible.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [assistantMsgs, ragMsgs, askRag.isLoading, assistantLoading, tab]);

  const handleNavigation = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  const resetAssistant = () => {
    setAssistantMsgs([{ role: 'model', text: buildWelcome() }]);
  };

  const sendAssistant = async (q: string) => {
    if (!q.trim() || assistantLoading) return;
    setAssistantMsgs((m) => [...m, { role: 'user', text: q }]);
    setAssistantLoading(true);
    try {
      const conversationHistory = assistantMsgs.map((msg) => ({
        role: msg.role,
        content: msg.text,
      }));
      const { data } = await apiInstance.post('/AIAssistant/chat', {
        messages: conversationHistory,
        newMessage: q,
        query: q,
        currentPage: location.pathname,
        soccod,
        userContext: { uticod, userName, roleName, isAdmin, isManager, isEmp, sercod },
      });
      if (data.response) {
        const text = data.response as string;
        const navigationAction = extractNavigationFromResponse(text) ?? undefined;
        setAssistantMsgs((m) => [...m, { role: 'model', text, navigationAction }]);
      } else {
        throw new Error('Pas de réponse du backend');
      }
    } catch (error: any) {
      const status = error?.response?.status;
      const serverMsg =
        error?.response?.data?.error ??
        (typeof error?.response?.data === 'string' ? error.response.data : null) ??
        error?.message;
      const friendly =
        status === 429
          ? 'Trop de requêtes. Veuillez patienter une minute.'
          : status === 401
            ? 'Session expirée, veuillez vous reconnecter.'
            : serverMsg ?? 'Erreur inconnue';
      setAssistantMsgs((m) => [
        ...m,
        { role: 'model', text: `❌ Erreur: ${friendly}\n\nVeuillez réessayer ou reformuler votre question.`, error: true },
      ]);
    } finally {
      setAssistantLoading(false);
    }
  };

  const sendRag = async (q: string) => {
    if (!q.trim() || askRag.isLoading) return;
    setRagError(null);
    setRagMsgs((m) => [...m, { id: genId(), role: 'user', content: q }]);
    try {
      const answer: RagChatAnswer = await askRag.mutateAsync({ question: q, topK: 5 });
      setRagMsgs((m) => [
        ...m,
        { id: genId(), role: 'assistant', content: answer.answer, sources: answer.sources, logId: answer.logId },
      ]);
    } catch (err: any) {
      const status = err?.response?.status;
      const msg =
        status === 429
          ? t('rag.chat.rateLimited')
          : err?.response?.data?.error || err?.message || t('rag.chat.askError');
      setRagError(msg as string);
      setRagMsgs((m) => [...m, { id: genId(), role: 'assistant', content: msg as string, error: true }]);
    }
  };

  const handleRagFeedback = async (m: RagMessage, score: number) => {
    if (!m.logId || m.feedback === score) return;
    try {
      await ragFeedback.mutateAsync({ logId: m.logId, score });
      setRagMsgs((arr) => arr.map((x) => (x.id === m.id ? { ...x, feedback: score } : x)));
    } catch {
      /* silencieux */
    }
  };

  const handleSend = () => {
    const q = input.trim();
    if (!q) return;
    setInput('');
    if (tab === 'assistant') sendAssistant(q);
    else sendRag(q);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isPriviledged = isAdmin || isManager;
  const quickQuestions = isPriviledged
    ? [
        "Combien d'employés sont présents aujourd'hui ?",
        "Qui est en retard aujourd'hui ?",
        "Qui est absent cette semaine ?",
        "Combien d'heures supplémentaires ce mois ?",
        'Quels sont les jours fériés à venir ?',
      ]
    : [
        "Combien d'heures j'ai travaillé ce mois ?",
        'Quel est mon solde de congé ?',
        'Quels sont mes prochains jours fériés ?',
        'Comment poser une demande de congé ?',
        'Comment voir mon emploi du temps ?',
      ];

  const isLoading = tab === 'assistant' ? assistantLoading : askRag.isLoading;
  const placeholder =
    tab === 'assistant'
      ? 'Posez votre question…'
      : (t('rag.chat.placeholder') as string);

  return (
    <>
      {/* FAB unique : gradient violet→bleu pour suggérer "deux modes en un".
          Icône composite SmartToy + Gavel pour signaler la double capacité.
          Micro-animations :
          - apparition à l'ouverture de la page (`@keyframes hubFabIn`)
          - halo pulsant pour attirer l'œil sans agresser (`hubFabPulse`)
          - hover : agrandissement subtil + halo accentué (transition 0.25s) */}
      <Tooltip title="Assistant IA & Documents juridiques" placement="left">
        <Fab
          aria-label="assistant-hub"
          onClick={() => setOpen(true)}
          sx={{
            // Positionné verticalement au milieu de l'écran, côté droit :
            // top: 50% + translateY(-50%) garantit un vrai centrage indépendant
            // de la hauteur du FAB et du viewport. `right: 8` colle le FAB au
            // bord (pas tout contre — on laisse 8 px pour éviter qu'un focus
            // ring soit coupé) ; avant il était à 24 px et chevauchait visuellement
            // les cellules d'agenda qui débordent légèrement à droite.
            position: 'fixed',
            top: '50%',
            right: 8,
            transform: 'translateY(-50%)',
            zIndex: 1200,
            background: 'linear-gradient(135deg, #5b21b6 0%, #1a6eff 100%)',
            color: 'white',
            boxShadow: '0 6px 20px rgba(91,33,182,0.35)',
            // ⚠ Toutes les valeurs `transform` des keyframes et du :hover incluent
            // `translateY(-50%)` pour préserver le centrage vertical. Sans ça, les
            // animations « écrasent » la translation de base et le FAB chute en
            // bas/haut pendant et après l'animation.
            '@keyframes hubFabIn': {
              '0%':   { opacity: 0, transform: 'translateY(calc(-50% + 40px)) scale(0.4) rotate(-20deg)' },
              '60%':  { opacity: 1, transform: 'translateY(calc(-50% - 6px)) scale(1.1) rotate(8deg)' },
              '100%': { opacity: 1, transform: 'translateY(-50%) scale(1) rotate(0deg)' },
            },
            '@keyframes hubFabPulse': {
              '0%, 100%': { boxShadow: '0 6px 20px rgba(91,33,182,0.35), 0 0 0 0 rgba(124,58,237,0.45)' },
              '50%':       { boxShadow: '0 6px 22px rgba(91,33,182,0.45), 0 0 0 14px rgba(124,58,237,0)' },
            },
            animation: 'hubFabIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both, hubFabPulse 2.6s ease-out 0.8s infinite',
            '&:hover': {
              background: 'linear-gradient(135deg, #4c1d95 0%, #0040a1 100%)',
              transform: 'translateY(-50%) scale(1.08) rotate(-4deg)',
              animationPlayState: 'paused',
              boxShadow: '0 10px 30px rgba(91,33,182,0.55)',
            },
            transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease',
          }}
        >
          <SmartToyIcon />
        </Fab>
      </Tooltip>

      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 480 }, display: 'flex', flexDirection: 'column' } }}
      >
        {/* Header */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
          <SmartToyIcon color="primary" />
          <Box flex={1}>
            <Typography variant="subtitle1" fontWeight={700}>
              Assistant IA
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {tab === 'assistant'
                ? 'Vos données : présence, congés, KPIs, navigation'
                : t('rag.chat.disclaimer')}
            </Typography>
          </Box>
          {tab === 'assistant' && (
            <IconButton onClick={resetAssistant} size="small" title="Réinitialiser">
              <RefreshIcon />
            </IconButton>
          )}
          <IconButton size="small" onClick={() => setOpen(false)}>
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Tabs */}
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v as TabKey)}
          variant="fullWidth"
          sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 44 }}
        >
          <Tab
            value="assistant"
            icon={<SmartToyIcon fontSize="small" />}
            iconPosition="start"
            label="Assistant"
            sx={{ minHeight: 44, textTransform: 'none', fontWeight: 600 }}
          />
          <Tab
            value="rag"
            icon={<GavelIcon fontSize="small" />}
            iconPosition="start"
            label="Documents juridiques"
            sx={{ minHeight: 44, textTransform: 'none', fontWeight: 600 }}
          />
        </Tabs>

        {/* Body */}
        <Box ref={scrollRef} sx={{ flex: 1, overflowY: 'auto', p: 2, bgcolor: 'background.default' }}>
          {/* ── Onglet Assistant ── */}
          {tab === 'assistant' && (
            <Stack spacing={2}>
              {/* Quick questions visibles uniquement avant le 1er échange. */}
              {assistantMsgs.length === 1 && (
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                    Questions fréquentes :
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                    {quickQuestions.map((q) => (
                      <Chip
                        key={q}
                        label={q}
                        size="small"
                        onClick={() => setInput(q)}
                        sx={{ cursor: 'pointer' }}
                      />
                    ))}
                  </Box>
                </Box>
              )}

              {assistantMsgs.map((m, i) => (
                <Box key={i} sx={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%' }}>
                  <Box
                    sx={{
                      px: 1.5,
                      py: 1,
                      borderRadius: 2,
                      bgcolor: m.role === 'user'
                        ? 'primary.main'
                        : m.error ? 'error.lighter' : 'background.paper',
                      color: m.role === 'user' ? 'primary.contrastText' : 'text.primary',
                      boxShadow: m.role === 'user' ? 'none' : '0 1px 2px rgba(0,0,0,0.06)',
                      border: m.role === 'model' && !m.error ? 1 : 0,
                      borderColor: 'divider',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                      {m.text.replace(/\[NAVIGATE:[^\]]+\]/g, '')}
                    </Typography>
                  </Box>
                  {m.navigationAction && (
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<NavigationIcon />}
                      onClick={() => handleNavigation(m.navigationAction!.path)}
                      sx={{ mt: 0.75, borderRadius: 2 }}
                    >
                      Aller à {m.navigationAction.label}
                    </Button>
                  )}
                </Box>
              ))}

              {assistantLoading && (
                <Stack direction="row" alignItems="center" gap={1} sx={{ alignSelf: 'flex-start' }}>
                  <CircularProgress size={16} />
                  <Typography variant="caption" color="text.secondary">
                    Recherche dans la base de données…
                  </Typography>
                </Stack>
              )}
            </Stack>
          )}

          {/* ── Onglet RAG ── */}
          {tab === 'rag' && (
            <>
              {ragMsgs.length === 0 && !askRag.isLoading && (
                <Stack alignItems="center" justifyContent="center" sx={{ height: '100%', color: 'text.secondary' }}>
                  <GavelIcon sx={{ fontSize: 64, opacity: 0.2, mb: 2 }} />
                  <Typography variant="body2" textAlign="center" sx={{ maxWidth: 320 }}>
                    {t('rag.chat.welcome')}
                  </Typography>
                </Stack>
              )}

              <Stack spacing={2}>
                {ragMsgs.map((m) => (
                  <Box key={m.id} sx={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%' }}>
                    <Box
                      sx={{
                        px: 1.5,
                        py: 1,
                        borderRadius: 2,
                        bgcolor: m.role === 'user'
                          ? 'primary.main'
                          : m.error ? 'error.lighter' : 'background.paper',
                        color: m.role === 'user' ? 'primary.contrastText' : 'text.primary',
                        boxShadow: m.role === 'user' ? 'none' : '0 1px 2px rgba(0,0,0,0.06)',
                        border: m.role === 'assistant' && !m.error ? 1 : 0,
                        borderColor: 'divider',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      <Typography variant="body2">{m.content}</Typography>
                    </Box>

                    {m.role === 'assistant' && m.sources && m.sources.length > 0 && (
                      <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 1 }}>
                        {m.sources.map((s, i) => (
                          <SourceChip key={`${s.documentId}-${i}`} source={s} />
                        ))}
                      </Stack>
                    )}

                    {m.role === 'assistant' && m.logId && !m.error && (
                      <Stack direction="row" gap={0.5} sx={{ mt: 0.5 }}>
                        <IconButton size="small" onClick={() => handleRagFeedback(m, 5)}>
                          {m.feedback === 5 ? (
                            <ThumbUpAltIcon fontSize="small" color="success" />
                          ) : (
                            <ThumbUpAltOutlinedIcon fontSize="small" />
                          )}
                        </IconButton>
                        <IconButton size="small" onClick={() => handleRagFeedback(m, 1)}>
                          {m.feedback === 1 ? (
                            <ThumbDownAltIcon fontSize="small" color="error" />
                          ) : (
                            <ThumbDownAltOutlinedIcon fontSize="small" />
                          )}
                        </IconButton>
                      </Stack>
                    )}
                  </Box>
                ))}

                {askRag.isLoading && (
                  <Stack direction="row" alignItems="center" gap={1} sx={{ alignSelf: 'flex-start' }}>
                    <CircularProgress size={16} />
                    <Typography variant="caption" color="text.secondary">
                      {t('rag.chat.thinking')}
                    </Typography>
                  </Stack>
                )}
              </Stack>
            </>
          )}
        </Box>

        {tab === 'rag' && ragError && (
          <Alert severity="error" sx={{ mx: 2, mb: 1 }} onClose={() => setRagError(null)}>
            {ragError}
          </Alert>
        )}

        {/* Input bar — partagé, route vers l'onglet actif */}
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 1 }}>
          <TextField
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={placeholder}
            size="small"
            fullWidth
            multiline
            maxRows={4}
            disabled={isLoading}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          <IconButton
            color="primary"
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            sx={{
              alignSelf: 'flex-end',
              bgcolor: 'primary.main',
              color: 'white',
              '&:hover': { bgcolor: 'primary.dark' },
              '&.Mui-disabled': { bgcolor: 'grey.300' },
            }}
          >
            <SendIcon />
          </IconButton>
        </Box>
      </Drawer>
    </>
  );
}

export default function UnifiedAssistantHub() {
  return (
    <HubContent />
  );
}
