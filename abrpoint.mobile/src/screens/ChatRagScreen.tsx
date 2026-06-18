import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../config/env';
import apiService from '../services/api';
import { useT } from '../i18n';

interface Source {
  documentId: number;
  documentName: string;
  page?: number | null;
  snippet: string;
  score: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  sources?: Source[];
  logId?: number;
  feedbackScore?: number;
  pending?: boolean;
  error?: boolean;
}

const SUGGESTION_KEYS = [
  'chatRag.suggestion1',
  'chatRag.suggestion2',
  'chatRag.suggestion3',
  'chatRag.suggestion4',
];

export default function ChatRagScreen({ navigation }: any) {
  const t = useT();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  const ask = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || sending) return;

    const userMsg: Message = { id: `u_${Date.now()}`, role: 'user', text: trimmed };
    const pendingId = `a_${Date.now()}`;
    const pending: Message = { id: pendingId, role: 'assistant', text: '', pending: true };
    setMessages((m) => [...m, userMsg, pending]);
    setInput('');
    setSending(true);

    try {
      const res = await apiService.askRag(trimmed, 5);
      setMessages((m) =>
        m.map((msg) =>
          msg.id === pendingId
            ? {
                ...msg,
                text: res.answer || t('chatRag.noAnswer'),
                sources: res.sources,
                logId: res.logId,
                pending: false,
              }
            : msg,
        ),
      );
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.error || err?.message || t('chatRag.unknownError');
      const text =
        status === 503
          ? t('chatRag.aiServiceNotStarted')
          : status === 502
          ? t('chatRag.aiServiceUnavailable')
          : status === 429
          ? t('chatRag.tooManyQuestions')
          : t('chatRag.errorWithDetail', { detail });
      setMessages((m) =>
        m.map((msg) =>
          msg.id === pendingId ? { ...msg, text, pending: false, error: true } : msg,
        ),
      );
    } finally {
      setSending(false);
    }
  };

  const sendFeedback = async (msg: Message, score: number) => {
    if (!msg.logId) return;
    try {
      await apiService.sendRagFeedback(msg.logId, score);
      setMessages((m) =>
        m.map((x) => (x.id === msg.id ? { ...x, feedbackScore: score } : x)),
      );
    } catch {
      Alert.alert(t('common.error'), t('chatRag.feedbackError'));
    }
  };

  const clearChat = () => {
    if (messages.length === 0) return;
    Alert.alert(
      t('chatRag.clearTitle'),
      t('chatRag.clearMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('chatRag.clearConfirm'), style: 'destructive', onPress: () => setMessages([]) },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.onSurface} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerIconWrap}>
            <MaterialCommunityIcons name="scale-balance" size={18} color="#fff" />
          </View>
          <View>
            <Text style={styles.headerTitle}>{t('chatRag.headerTitle')}</Text>
            <Text style={styles.headerSubtitle}>{t('chatRag.headerSubtitle')}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={clearChat} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons name="trash-can-outline" size={22} color={COLORS.outline} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            <EmptyState onPick={ask} t={t} />
          ) : (
            messages.map((m) => (
              <MessageBubble key={m.id} message={m} onFeedback={sendFeedback} t={t} />
            ))
          )}
        </ScrollView>

        <View style={styles.disclaimer}>
          <MaterialCommunityIcons name="information-outline" size={12} color={COLORS.outline} />
          <Text style={styles.disclaimerText}>
            {t('chatRag.disclaimer')}
          </Text>
        </View>

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={t('chatRag.inputPlaceholder')}
            placeholderTextColor={COLORS.outline}
            multiline
            maxLength={500}
            editable={!sending}
            onSubmitEditing={() => ask(input)}
            returnKeyType="send"
            blurOnSubmit
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
            onPress={() => ask(input)}
            disabled={!input.trim() || sending}
            activeOpacity={0.8}
          >
            {sending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <MaterialCommunityIcons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function EmptyState({ onPick, t }: { onPick: (q: string) => void; t: (key: string, vars?: Record<string, any>) => string }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <MaterialCommunityIcons name="scale-balance" size={32} color={COLORS.primary} />
      </View>
      <Text style={styles.emptyTitle}>{t('chatRag.emptyTitle')}</Text>
      <Text style={styles.emptyHint}>
        {t('chatRag.emptyHint')}
      </Text>
      <Text style={styles.suggestionsTitle}>{t('chatRag.suggestionsTitle')}</Text>
      {SUGGESTION_KEYS.map((key) => {
        const s = t(key);
        return (
          <TouchableOpacity key={key} style={styles.suggestion} onPress={() => onPick(s)} activeOpacity={0.8}>
            <MaterialCommunityIcons name="lightbulb-outline" size={16} color={COLORS.primary} />
            <Text style={styles.suggestionText}>{s}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function MessageBubble({
  message,
  onFeedback,
  t,
}: {
  message: Message;
  onFeedback: (m: Message, score: number) => void;
  t: (key: string, vars?: Record<string, any>) => string;
}) {
  const isUser = message.role === 'user';
  return (
    <View style={[styles.row, isUser ? styles.rowRight : styles.rowLeft]}>
      {!isUser && (
        <View style={styles.avatar}>
          <MaterialCommunityIcons name="scale-balance" size={14} color="#fff" />
        </View>
      )}
      <View
        style={[
          styles.bubble,
          isUser ? styles.userBubble : styles.assistantBubble,
          message.error && styles.errorBubble,
        ]}
      >
        {message.pending ? (
          <View style={styles.thinking}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.thinkingText}>{t('chatRag.searching')}</Text>
          </View>
        ) : (
          <Text style={isUser ? styles.userText : styles.assistantText}>{message.text}</Text>
        )}

        {message.sources && message.sources.length > 0 && (
          <View style={styles.sourcesWrap}>
            <Text style={styles.sourcesTitle}>{t('chatRag.sources')}</Text>
            {message.sources.map((s, i) => (
              <View key={`${s.documentId}_${i}`} style={styles.sourceChip}>
                <MaterialCommunityIcons name="file-document-outline" size={14} color={COLORS.primary} />
                <Text style={styles.sourceText} numberOfLines={2}>
                  {s.documentName}
                  {s.page != null ? t('chatRag.pageSuffix', { page: s.page }) : ''}
                </Text>
              </View>
            ))}
          </View>
        )}

        {!isUser && !message.pending && !message.error && message.logId && (
          <View style={styles.feedbackRow}>
            <Text style={styles.feedbackLabel}>{t('chatRag.feedbackLabel')}</Text>
            <TouchableOpacity
              style={[styles.feedbackBtn, message.feedbackScore === 5 && styles.feedbackBtnActive]}
              onPress={() => onFeedback(message, 5)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <MaterialCommunityIcons
                name="thumb-up-outline"
                size={16}
                color={message.feedbackScore === 5 ? COLORS.primary : COLORS.outline}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.feedbackBtn, message.feedbackScore === 1 && styles.feedbackBtnActive]}
              onPress={() => onFeedback(message, 1)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <MaterialCommunityIcons
                name="thumb-down-outline"
                size={16}
                color={message.feedbackScore === 1 ? COLORS.error : COLORS.outline}
              />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outlineVariant,
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginLeft: 12 },
  headerIconWrap: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 15, fontWeight: '800', color: COLORS.onSurface },
  headerSubtitle: { fontSize: 10, color: COLORS.outline, marginTop: 2 },
  scrollContent: { padding: 16, paddingBottom: 8, gap: 12 },
  empty: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 12 },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: COLORS.primaryFixed,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: COLORS.onSurface, marginBottom: 8 },
  emptyHint: {
    fontSize: 13, color: COLORS.outline, textAlign: 'center', lineHeight: 19,
    marginBottom: 24,
  },
  suggestionsTitle: {
    fontSize: 10, fontWeight: '800', color: COLORS.outline, letterSpacing: 1,
    alignSelf: 'flex-start', marginBottom: 8,
  },
  suggestion: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14,
    marginBottom: 8, alignSelf: 'stretch',
    borderWidth: 1, borderColor: COLORS.outlineVariant,
  },
  suggestionText: { fontSize: 13, color: COLORS.onSurface, flex: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  rowLeft: { justifyContent: 'flex-start' },
  rowRight: { justifyContent: 'flex-end' },
  avatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  userBubble: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
  },
  errorBubble: { borderColor: COLORS.error, backgroundColor: COLORS.errorContainer },
  userText: { color: '#fff', fontSize: 14, lineHeight: 20 },
  assistantText: { color: COLORS.onSurface, fontSize: 14, lineHeight: 20 },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  thinkingText: { fontSize: 13, color: COLORS.outline, fontStyle: 'italic' },
  sourcesWrap: { marginTop: 10, gap: 6 },
  sourcesTitle: {
    fontSize: 9, fontWeight: '800', color: COLORS.outline, letterSpacing: 1,
  },
  sourceChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primaryFixed,
    borderRadius: 8, paddingVertical: 5, paddingHorizontal: 8,
  },
  sourceText: { fontSize: 11, color: COLORS.onPrimaryFixedVariant, flex: 1, fontWeight: '600' },
  feedbackRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 10, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: COLORS.outlineVariant,
  },
  feedbackLabel: { fontSize: 11, color: COLORS.outline, fontWeight: '600' },
  feedbackBtn: { padding: 4, borderRadius: 6 },
  feedbackBtnActive: { backgroundColor: COLORS.primaryFixed },
  disclaimer: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 6,
    backgroundColor: COLORS.surfaceContainerLow,
  },
  disclaimerText: { fontSize: 10, color: COLORS.outline, flex: 1 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: COLORS.outlineVariant,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontSize: 14,
    color: COLORS.onSurface,
    maxHeight: 120,
    minHeight: 44,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: COLORS.disabled },
});
