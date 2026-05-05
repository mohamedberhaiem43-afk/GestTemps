import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Drawer,
  Fab,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { QueryClient, QueryClientProvider } from 'react-query';
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

const queryClient = new QueryClient();

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
  }, [messages, ask.isLoading]);

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
            '&:hover': {
              background: 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%)',
              transform: 'scale(1.06)',
            },
            transition: 'all 0.2s',
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
          {messages.length === 0 && !ask.isLoading && (
            <Stack alignItems="center" justifyContent="center" sx={{ height: '100%', color: 'text.secondary' }}>
              <GavelIcon sx={{ fontSize: 64, opacity: 0.2, mb: 2 }} />
              <Typography variant="body2" textAlign="center" sx={{ maxWidth: 320 }}>
                {t('rag.chat.welcome')}
              </Typography>
            </Stack>
          )}

          <Stack spacing={2}>
            {messages.map((m) => (
              <Box
                key={m.id}
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
                    <IconButton size="small" onClick={() => handleFeedback(m, 5)}>
                      {m.feedback === 5 ? (
                        <ThumbUpAltIcon fontSize="small" color="success" />
                      ) : (
                        <ThumbUpAltOutlinedIcon fontSize="small" />
                      )}
                    </IconButton>
                    <IconButton size="small" onClick={() => handleFeedback(m, 1)}>
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

            {ask.isLoading && (
              <Stack direction="row" alignItems="center" gap={1} sx={{ alignSelf: 'flex-start' }}>
                <CircularProgress size={16} />
                <Typography variant="caption" color="text.secondary">
                  {t('rag.chat.thinking')}
                </Typography>
              </Stack>
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
            disabled={ask.isLoading}
          />
          <IconButton
            color="primary"
            onClick={handleSend}
            disabled={ask.isLoading || !input.trim()}
            sx={{ alignSelf: 'flex-end' }}
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
    <QueryClientProvider client={queryClient}>
      <ChatRagDrawerContent />
    </QueryClientProvider>
  );
}
