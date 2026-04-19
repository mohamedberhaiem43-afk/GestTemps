import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  TextField,
  IconButton,
  Paper,
  Typography,
  CircularProgress,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  Chip,
  Button
} from '@mui/material';
import { Send, SmartToy, Close, Refresh, Navigation } from '@mui/icons-material';
import { useAuth } from '../AuthProvider';

interface Message {
  role: 'user' | 'model';
  parts: { text: string }[];
  navigationAction?: {
    path: string;
    label: string;
  };
  actions?: { // Nouveau: actions disponibles
    type: 'download' | 'navigate' | 'refresh';
    label: string;
    url?: string;
    method?: string;
  }[];
}

const GeminiChat = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      parts: [{ 
        text: `Bonjour! 👋 Je suis votre assistant pour l'application de gestion de présence.

Je peux vous aider avec:
• Navigation dans l'application
• Explication des fonctionnalités
• Résolution de problèmes
• Interprétation des données
• Statistiques en temps réel

Posez-moi une question!` 
      }]
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const resetChat = () => {
    setMessages([{
      role: 'model',
      parts: [{ 
        text: `Bonjour! 👋 Je suis votre assistant pour l'application de gestion de présence.

Je peux vous aider avec:
• Navigation dans l'application
• Explication des fonctionnalités
• Résolution de problèmes
• Interprétation des données
• Statistiques en temps réel

Posez-moi une question!` 
      }]
    }]);
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    setIsOpen(false);
  };
  const { soccod } = useAuth();
  const extractNavigationFromResponse = (text: string): { path: string; label: string } | null => {
    // Détecter les chemins de navigation dans la réponse
    const navigationPatterns = [
      { pattern: /\[NAVIGATE:([^\]]+)\]/i, extract: (match: RegExpMatchArray) => match[1] },
      { pattern: /aller (?:à|vers|sur) (?:la page |le menu )?([^\n.,]+)/i, extract: (match: RegExpMatchArray) => match[1] }
    ];

    for (const { pattern, extract } of navigationPatterns) {
      const match = text.match(pattern);
      if (match) {
        const target = extract(match).trim().toLowerCase();
        const routeMap: { [key: string]: { path: string; label: string } } = {
          'emppresence': { path: '/dashboard/etat-de-presence', label: 'État de Présence' },
          'présence': { path: '/dashboard/etat-de-presence', label: 'État de Présence' },
          'presence': { path: '/dashboard/etat-de-presence', label: 'État de Présence' },
          'repos': { path: '/dashboard/Repos', label: 'Gestion des Repos' },
          'pointeuse': { path: '/dashboard/liste-pointeuse', label: 'Pointeuse' },
          'saisie': { path: '/dashboard/etat-periodique', label: 'Saisie Pointage' },
          'dashboard': { path: '/dashboard', label: 'Tableau de Bord' },
          'tableau de bord': { path: '/dashboard', label: 'Tableau de Bord' }
        };

        for (const [key, value] of Object.entries(routeMap)) {
          if (target.includes(key)) {
            return value;
          }
        }
      }
    }
    return null;
  };

  const handleQuickQuestion = (question: string) => {
    setInput(question);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      parts: [{ text: input }]
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    try {
      const API_URL = import.meta.env.VITE_REACT_APP_API_URL;
      
      if (!API_URL) {
        throw new Error('URL API non configurée.');
      }

      // Préparer l'historique de conversation pour le backend
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.parts[0].text
      }));

      // Appeler le backend au lieu de Gemini directement
      const response = await fetch(`${API_URL}/AIAssistant/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
        messages: conversationHistory,
        newMessage: currentInput,
        query: currentInput,
        currentPage: location.pathname,
        soccod: soccod
      })
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Trop de requêtes. Veuillez patienter une minute.');
        }
        const errorText = await response.text();
        console.error('API Error:', errorText);
        throw new Error(`Erreur API: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      if (data.response) {
        const responseText = data.response;
        const navigationAction = extractNavigationFromResponse(responseText);
        
        const assistantMessage: Message = {
          role: 'model',
          parts: [{ text: responseText }],
          navigationAction: navigationAction || undefined
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        throw new Error('Pas de réponse du backend');
      }
    } catch (error: any) {
      console.error('Error calling backend:', error);
      setMessages(prev => [...prev, {
        role: 'model',
        parts: [{ text: `❌ Erreur: ${error.message}\n\nVeuillez réessayer ou reformuler votre question.` }]
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickQuestions = [
    "Combien d'employés sont présents aujourd'hui ?",
    "Qui est absent cette semaine ?",
    "Comment exporter les données ?",
    "Que signifie 'preretmateup' ?",
    "Quels sont les repos à venir ?"
  ];

  return (
    <>
      <Fab
        color="primary"
        aria-label="assistant"
        onClick={() => setIsOpen(true)}
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1200,
          background: 'linear-gradient(135deg, #0040a1 0%, #1a6eff 100%)',
          boxShadow: '0 6px 20px rgba(0,64,161,0.35)',
          '&:hover': {
            background: 'linear-gradient(135deg, #003080 0%, #0040a1 100%)',
            transform: 'scale(1.08)',
          },
          transition: 'all 0.2s',
        }}
      >
        <SmartToy />
      </Fab>

      <Dialog
        open={isOpen}
        onClose={() => setIsOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { height: '80vh', display: 'flex', flexDirection: 'column' }
        }}
        sx={{
          '& .MuiDialog-container': {
            alignItems: 'center',
          },
          '& .MuiDialog-paper': {
            margin: { xs: 0, sm: '32px' },
            width: { xs: '95%', sm: 'auto' },
            maxWidth: { xs: '95%', sm: '600px' },
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SmartToy color="primary" />
            <Typography variant="h6">Assistant IA</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton onClick={resetChat} size="small" title="Réinitialiser">
              <Refresh />
            </IconButton>
            <IconButton onClick={() => setIsOpen(false)} size="small">
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 0 }}>
          {/* Quick Questions */}
          {messages.length === 1 && (
            <Box sx={{ p: 2, pb: 1 }}>
              <Typography variant="caption" sx={{ mb: 1, display: 'block', color: 'text.secondary' }}>
                Questions fréquentes :
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {quickQuestions.map((question, index) => (
                  <Chip
                    key={index}
                    label={question}
                    onClick={() => handleQuickQuestion(question)}
                    size="small"
                    sx={{ cursor: 'pointer' }}
                  />
                ))}
              </Box>
            </Box>
          )}

          {/* Messages */}
          <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
            {messages.map((message, index) => (
              <Box key={index}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                    mb: 2
                  }}
                >
                  <Paper
                    elevation={1}
                    sx={{
                      p: 2,
                      maxWidth: '80%',
                      bgcolor: message.role === 'user' ? 'primary.main' : 'grey.100',
                      color: message.role === 'user' ? 'white' : 'text.primary',
                      borderRadius: 2
                    }}
                  >
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                      {message.parts[0].text.replace(/\[NAVIGATE:[^\]]+\]/g, '')}
                    </Typography>
                  </Paper>
                </Box>
                
                {/* Navigation Button */}
                {message.navigationAction && (
                  <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2, ml: 1 }}>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<Navigation />}
                      onClick={() => handleNavigation(message.navigationAction!.path)}
                      sx={{ borderRadius: 2 }}
                    >
                      Aller à {message.navigationAction.label}
                    </Button>
                  </Box>
                )}
              </Box>
            ))}
            {isLoading && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }}>
                <Paper elevation={1} sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={16} />
                    <Typography variant="body2" color="text.secondary">
                      En train de chercher dans la base de données...
                    </Typography>
                  </Box>
                </Paper>
              </Box>
            )}
            <div ref={messagesEndRef} />
          </Box>

          {/* Input */}
          <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                multiline
                maxRows={3}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Posez votre question..."
                disabled={isLoading}
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2
                  }
                }}
              />
              <IconButton
                color="primary"
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                sx={{
                  bgcolor: 'primary.main',
                  color: 'white',
                  '&:hover': {
                    bgcolor: 'primary.dark'
                  },
                  '&.Mui-disabled': {
                    bgcolor: 'grey.300'
                  }
                }}
              >
                <Send />
              </IconButton>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default GeminiChat;