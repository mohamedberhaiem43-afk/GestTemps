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
import apiInstance from '../../API/apiInstance';

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
  const { soccod, uticod, userName, roleName, isAdmin, isManager, isEmp, sercod } = useAuth();

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

  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', parts: [{ text: buildWelcome() }] }
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
    setMessages([{ role: 'model', parts: [{ text: buildWelcome() }] }]);
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    setIsOpen(false);
  };
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
      // Préparer l'historique de conversation pour le backend
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.parts[0].text
      }));

      // apiInstance injecte automatiquement le header X-Tenant-Slug et envoie le cookie JWT.
      // Sans ça, le TenantResolverMiddleware répond 400 ("Tenant introuvable") et le controller
      // n'a pas accès aux claims utilisateur pour personnaliser la réponse.
      const { data } = await apiInstance.post('/AIAssistant/chat', {
        messages: conversationHistory,
        newMessage: currentInput,
        query: currentInput,
        currentPage: location.pathname,
        soccod: soccod,
        userContext: {
          uticod,
          userName,
          roleName,
          isAdmin,
          isManager,
          isEmp,
          sercod,
        },
      });

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
      const status = error?.response?.status;
      const serverMsg =
        error?.response?.data?.error
        ?? (typeof error?.response?.data === 'string' ? error.response.data : null)
        ?? error?.message;
      const friendly = status === 429
        ? 'Trop de requêtes. Veuillez patienter une minute.'
        : status === 401
          ? 'Session expirée, veuillez vous reconnecter.'
          : serverMsg ?? 'Erreur inconnue';
      setMessages(prev => [...prev, {
        role: 'model',
        parts: [{ text: `❌ Erreur: ${friendly}\n\nVeuillez réessayer ou reformuler votre question.` }]
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

  // Suggestions adaptées au rôle. Les admins/managers voient des questions agrégées,
  // un employé "lambda" voit des questions self-service. Évite de proposer des
  // requêtes que le backend refusera ensuite par manque de droits.
  const isPriviledged = isAdmin || isManager;
  const quickQuestions = isPriviledged
    ? [
      "Combien d'employés sont présents aujourd'hui ?",
      "Qui est en retard aujourd'hui ?",
      "Qui est absent cette semaine ?",
      "Combien d'heures supplémentaires ce mois ?",
      "Quels sont les jours fériés à venir ?",
    ]
    : [
      "Combien d'heures j'ai travaillé ce mois ?",
      "Quel est mon solde de congé ?",
      "Quels sont mes prochains jours fériés ?",
      "Comment poser une demande de congé ?",
      "Comment voir mon emploi du temps ?",
    ];

  return (
    <>
      <Fab
        color="primary"
        aria-label="assistant"
        onClick={() => setIsOpen(true)}
        sx={{
          // Ancre verticalement au milieu de l'écran, collé contre le bord droit.
          // Le translate compense la moitié de la hauteur du FAB pour un centrage
          // pixel-perfect indépendamment de sa taille.
          position: 'fixed',
          right: '-20px',
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 1200,
          background: 'linear-gradient(135deg, #0040a1 0%, #1a6eff 100%)',
          boxShadow: '0 6px 20px rgba(0,64,161,0.35)',
          '&:hover': {
            background: 'linear-gradient(135deg, #003080 0%, #0040a1 100%)',
            transform: 'translateY(-50%) scale(1.08)',
          },
          transition: 'all 0.2s',
        }}
      >
        <SmartToy />
      </Fab>

      <Dialog
        open={isOpen}
        onClose={() => setIsOpen(false)}
        maxWidth={false}
        // Le panneau glisse contre le bord droit (et non plus au centre) pour
        // que l'utilisateur garde la page sous les yeux pendant la discussion.
        sx={{
          '& .MuiDialog-container': {
            justifyContent: { xs: 'center', sm: 'flex-end' },
            alignItems: 'center',
          },
          '& .MuiDialog-paper': {
            margin: { xs: 0, sm: 2 },
            marginRight: { xs: 0, sm: 3 },
            width: { xs: '100%', sm: 460 },
            maxWidth: { xs: '100%', sm: 460 },
            height: { xs: '100%', sm: '88vh' },
            maxHeight: { xs: '100%', sm: '88vh' },
            borderRadius: { xs: 0, sm: '20px' },
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
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