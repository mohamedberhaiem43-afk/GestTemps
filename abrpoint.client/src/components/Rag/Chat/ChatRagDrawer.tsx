import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  Drawer,
  Fab,
  Fade,
  Grow,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { keyframes } from '@mui/system';
import { useTranslation } from 'react-i18next';
import GavelIcon from '@mui/icons-material/Gavel';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import ThumbUpAltOutlinedIcon from '@mui/icons-material/ThumbUpAltOutlined';
import ThumbDownAltOutlinedIcon from '@mui/icons-material/ThumbDownAltOutlined';
import ThumbUpAltIcon from '@mui/icons-material/ThumbUpAlt';
import ThumbDownAltIcon from '@mui/icons-material/ThumbDownAlt';
import RagService, { RagChatAnswer, RagChatSource } from '../../../services/RagService';
import { useAskRag, useRagFeedback } from '../../../hooks/ragHooks/useRagChat';
// Animations CSS — pensées pour rester sobres : un pulse léger sur le FAB pour
// signaler qu'il est interactif, des points qui rebondissent pendant la
// recherche, et un float discret sur l'icône d'accueil.
const fabPulse = keyframes`
  0% { box-shadow: 0 6px 20px rgba(91,33,182,0.35), 0 0 0 0 rgba(139,92,246,0.55); }
  70% { box-shadow: 0 6px 20px rgba(91,33,182,0.35), 0 0 0 14px rgba(139,92,246,0); }
  100% { box-shadow: 0 6px 20px rgba(91,33,182,0.35), 0 0 0 0 rgba(139,92,246,0); }
`;

const dotBounce = keyframes`
  0%, 60%, 100% { transform: translateY(0); opacity: 0.55; }
  30% { transform: translateY(-6px); opacity: 1; }
`;

const iconFloat = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
`;

const shimmer = keyframes`
  0% { background-position: -160px 0; }
  100% { background-position: 160px 0; }
`;

function TypingDots() {
  const dot = (delay: string) => ({
    width: 7,
    height: 7,
    borderRadius: '50%',
    backgroundColor: 'secondary.main',
    animation: `${dotBounce} 1.1s ease-in-out infinite`,
    animationDelay: delay,
  });
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6 }} aria-label="typing">
      <Box sx={dot('0s')} />
      <Box sx={dot('0.18s')} />
      <Box sx={dot('0.36s')} />
    </Box>
  );
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: RagChatSource[];
  logId?: number;
  feedback?: number; // 1 ou 5 selon thumbs down/up
  error?: boolean;
}

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function SourceChip({ source }: { source: RagChatSource }) {
  const handleClick = async () => {
    try {
      const blob = await RagService.download(source.documentId);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      // Ne pas révoquer immédiatement : l'onglet a besoin de l'URL.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      // silencieux
    }
  };

  const label = `${source.documentName ?? `#${source.documentId}`}${source.page ? `, p.${source.page}` : ''}`;
  return (
    <Tooltip title={source.snippet}>
      <Chip
        size="small"
        label={label}
        onClick={handleClick}
        sx={{ maxWidth: 240, cursor: 'pointer' }}
      />
    </Tooltip>
  );
}

function ChatRagDrawerContent() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const ask = useAskRag();
  const feedback = useRagFeedback();

  // Écoute un événement global "rag-chat:open" pour ouvrir depuis ailleurs.
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('rag-chat:open', handler);
    return () => window.removeEventListener('rag-chat:open', handler);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, ask.isPending]);

  const handleSend = async () => {
    const q = input.trim();
    if (!q) return;
    setError(null);
    setInput('');

    const userMsg: ChatMessage = { id: genId(), role: 'user', content: q };
    setMessages((m) => [...m, userMsg]);

    try {
      const answer: RagChatAnswer = await ask.mutateAsync({ question: q, topK: 5 });
      const assistantMsg: ChatMessage = {
        id: genId(),
        role: 'assistant',
        content: answer.answer,
        sources: answer.sources,
        logId: answer.logId,
      };
      setMessages((m) => [...m, assistantMsg]);
    } catch (err: any) {
      const status = err?.response?.status;
      const msg =
        status === 429
          ? t('rag.chat.rateLimited')
          : err?.response?.data?.error || err?.message || t('rag.chat.askError');
      setError(msg);
      setMessages((m) => [
        ...m,
        { id: genId(), role: 'assistant', content: msg, error: true },
      ]);
    }
  };

  const handleFeedback = async (m: ChatMessage, score: number) => {
    if (!m.logId || m.feedback === score) return;
    try {
      await feedback.mutateAsync({ logId: m.logId, score });
      setMessages((arr) =>
        arr.map((x) => (x.id === m.id ? { ...x, feedback: score } : x)),
      );
    } catch {
      // silencieux : feedback optionnel
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <Tooltip title={t('rag.chat.title')} placement="left">
        <Fab
          color="secondary"
          aria-label="rag-assistant"
          onClick={() => setOpen(true)}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1200,
            background: 'linear-gradient(135deg, #5b21b6 0%, #8b5cf6 100%)',
            color: 'white',
            boxShadow: '0 6px 20px rgba(91,33,182,0.35)',
            // Pulse continu uniquement quand le drawer est fermé : on évite la
            // distraction quand l'utilisateur est déjà en conversation.
            animation: open ? 'none' : `${fabPulse} 2.4s ease-in-out infinite`,
            '&:hover': {
              background: 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%)',
              transform: 'scale(1.08) rotate(-4deg)',
            },
            '&:active': { transform: 'scale(0.96)' },
            transition: 'transform 0.2s ease, background 0.3s ease',
          }}
        >
          <GavelIcon />
        </Fab>
      </Tooltip>

      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 460 }, display: 'flex', flexDirection: 'column' } }}
      >
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
          <GavelIcon color="secondary" />
          <Box flex={1}>
            <Typography variant="subtitle1" fontWeight={700}>
              {t('rag.chat.title')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('rag.chat.disclaimer')}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setOpen(false)}>
            <CloseIcon />
          </IconButton>
        </Box>

        <Box ref={scrollRef} sx={{ flex: 1, overflowY: 'auto', p: 2, bgcolor: 'background.default' }}>
          {messages.length === 0 && !ask.isPending && (
            <Fade in timeout={500}>
              <Stack alignItems="center" justifyContent="center" sx={{ height: '100%', color: 'text.secondary', gap: 1 }}>
                <Box
                  sx={{
                    width: 96,
                    height: 96,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'radial-gradient(circle, rgba(139,92,246,0.18) 0%, rgba(139,92,246,0) 70%)',
                    animation: `${iconFloat} 3.6s ease-in-out infinite`,
                  }}
                >
                  <GavelIcon sx={{ fontSize: 56, color: 'secondary.main', opacity: 0.7 }} />
                </Box>
                <Typography variant="body2" textAlign="center" sx={{ maxWidth: 320, mt: 1 }}>
                  {t('rag.chat.welcome')}
                </Typography>
                <Box
                  sx={{
                    mt: 1.5,
                    px: 1.5,
                    py: 0.5,
                    borderRadius: '999px',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'secondary.dark',
                    background: 'linear-gradient(90deg, rgba(139,92,246,0.08), rgba(139,92,246,0.18), rgba(139,92,246,0.08))',
                    backgroundSize: '320px 100%',
                    animation: `${shimmer} 2.4s linear infinite`,
                  }}
                >
                  {t('rag.chat.disclaimer')}
                </Box>
              </Stack>
            </Fade>
          )}

          <Stack spacing={2}>
            {messages.map((m) => (
              <Grow in key={m.id} timeout={280} style={{ transformOrigin: m.role === 'user' ? 'right center' : 'left center' }}>
                <Box
                  sx={{
                    alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '90%',
                  }}
                >
                <Box
                  sx={{
                    px: 1.5,
                    py: 1,
                    borderRadius: 2,
                    bgcolor: m.role === 'user' ? 'primary.main' : m.error ? 'error.lighter' : 'background.paper',
                    color: m.role === 'user' ? 'primary.contrastText' : 'text.primary',
                    boxShadow: m.role === 'user' ? '0 2px 8px rgba(0,64,161,0.25)' : '0 1px 2px rgba(0,0,0,0.06)',
                    border: m.role === 'assistant' && !m.error ? 1 : 0,
                    borderColor: 'divider',
                    whiteSpace: 'pre-wrap',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                    '&:hover': m.role === 'assistant' && !m.error ? { transform: 'translateY(-1px)', boxShadow: '0 4px 10px rgba(91,33,182,0.12)' } : undefined,
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
                    <IconButton
                      size="small"
                      onClick={() => handleFeedback(m, 5)}
                      sx={{ transition: 'transform 0.15s ease', '&:hover': { transform: 'scale(1.18)' }, '&:active': { transform: 'scale(0.92)' } }}
                    >
                      {m.feedback === 5 ? (
                        <ThumbUpAltIcon fontSize="small" color="success" />
                      ) : (
                        <ThumbUpAltOutlinedIcon fontSize="small" />
                      )}
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleFeedback(m, 1)}
                      sx={{ transition: 'transform 0.15s ease', '&:hover': { transform: 'scale(1.18)' }, '&:active': { transform: 'scale(0.92)' } }}
                    >
                      {m.feedback === 1 ? (
                        <ThumbDownAltIcon fontSize="small" color="error" />
                      ) : (
                        <ThumbDownAltOutlinedIcon fontSize="small" />
                      )}
                    </IconButton>
                  </Stack>
                )}
                </Box>
              </Grow>
            ))}

            {ask.isPending && (
              <Fade in timeout={200}>
                <Stack
                  direction="row"
                  alignItems="center"
                  gap={1.25}
                  sx={{
                    alignSelf: 'flex-start',
                    px: 1.5,
                    py: 1,
                    borderRadius: 2,
                    bgcolor: 'background.paper',
                    border: 1,
                    borderColor: 'divider',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                  }}
                >
                  <TypingDots />
                  <Typography variant="caption" color="text.secondary">
                    {t('rag.chat.thinking')}
                  </Typography>
                </Stack>
              </Fade>
            )}
          </Stack>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mx: 2, mb: 1 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 1 }}>
          <TextField
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={t('rag.chat.placeholder') as string}
            size="small"
            fullWidth
            multiline
            maxRows={4}
            disabled={ask.isPending}
          />
          <IconButton
            color="primary"
            onClick={handleSend}
            disabled={ask.isPending || !input.trim()}
            sx={{
              alignSelf: 'flex-end',
              transition: 'transform 0.18s ease, background-color 0.2s ease',
              '&:not(:disabled):hover': { transform: 'translateX(2px) scale(1.08)', backgroundColor: 'primary.lighter' },
              '&:not(:disabled):active': { transform: 'scale(0.94)' },
            }}
          >
            <SendIcon />
          </IconButton>
        </Box>
      </Drawer>
    </>
  );
}

export default function ChatRagDrawer() {
  return (
    <ChatRagDrawerContent />
  );
}
