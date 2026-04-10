import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type ListRenderItem,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import GlowBackground from './GlowBackground';
import { colors, radii } from '../lib/theme';
import { createAttachment, fetchCueResponse, type CueMessage as ApiCueMessage } from '../lib/cue-api';
import { auth } from '../lib/firebase';
import {
  addParsedClasses,
  clearAllClasses,
  addParsedTasks,
  formatCuePlanningContextForPrompt,
  loadUserAppSnapshot,
} from '../lib/user-app-data';
import {
  parseCueCommandFromResponse,
  type CueCommand,
} from '../lib/cue-chat-response';
import { FLOATING_TAB_BAR_BOTTOM } from '../lib/tab-bar-layout';

type MessageRole = 'user' | 'cue';

type ChatMessage = {
  id: string;
  role: MessageRole;
  text: string;
  imageUri?: string;
};

type MessageListItem =
  | { type: 'message'; key: string; message: ChatMessage }
  | { type: 'loading'; key: string };

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'cue-1',
    role: 'cue',
    text: 'I can help you plan your study sessions, prioritize subjects, organize your deadlines, and build a more consistent study routine. What would you like help with today?',
  },
];

function createMessage(role: MessageRole, text: string, imageUri?: string): ChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    text,
    imageUri,
  };
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.messageRow, isUser ? styles.messageRowRight : styles.messageRowLeft]}>
      <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.cueBubble]}>
        {message.imageUri ? <Image source={{ uri: message.imageUri }} style={styles.messageImage} /> : null}
        {message.text ? (
          <Text style={[styles.messageText, isUser ? styles.userMessageText : styles.cueMessageText]}>{message.text}</Text>
        ) : null}
      </View>
    </View>
  );
}

export default function CueChatScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  /** Tab bar is `position: 'absolute'`; reserve space when keyboard is hidden only. */
  const composerBottomPaddingCollapsed =
    tabBarHeight + FLOATING_TAB_BAR_BOTTOM + Math.max(insets.bottom, 8) + 12;
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const composerBottomPadding = isKeyboardVisible ? 10 : composerBottomPaddingCollapsed;

  const listRef = useRef<FlatList<MessageListItem>>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [pendingImageUri, setPendingImageUri] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [lastFailedPayload, setLastFailedPayload] = useState<{ text: string; imageUri?: string } | null>(null);

  const items = useMemo<MessageListItem[]>(
    () => [
      ...messages.map((message) => ({ type: 'message', key: message.id, message }) as MessageListItem),
      ...(isSending ? [{ type: 'loading', key: 'cue-loading' } as MessageListItem] : []),
    ],
    [isSending, messages]
  );

  const renderItem = useCallback<ListRenderItem<MessageListItem>>(({ item }) => {
    if (item.type === 'loading') {
      return (
        <View style={[styles.messageRow, styles.messageRowLeft]}>
          <View style={[styles.messageBubble, styles.cueBubble]}>
            <Text style={[styles.messageText, styles.cueMessageText]} accessibilityLabel="Cue is typing">
              Cue is thinking...
            </Text>
          </View>
        </View>
      );
    }
    return <MessageBubble message={item.message} />;
  }, []);

  async function executeCueCommand(command: CueCommand, user: typeof auth.currentUser): Promise<string> {
    if (command.kind === 'empty_calendar') {
      return "I couldn't find any classes to extract from that image.";
    }
    if (!user) {
      if (command.kind === 'add_tasks') return 'You need to be signed in to save tasks.';
      return 'You need to be signed in to update your calendar.';
    }

    if (command.kind === 'add_calendar') {
      const { inserted, skipped } = await addParsedClasses(user, command.classes);
      const uniqueSubjects = new Set(command.classes.map((p) => p.title.trim().toLowerCase())).size;
      if (inserted === 0) {
        return 'I could not add those to your calendar. Each block needs weekday, title, and valid HH:MM start/end times.';
      }
      if (skipped > 0) {
        return `I added ${inserted} calendar block(s); ${skipped} row(s) were skipped. Check the Calendar tab.`;
      }
      return `I successfully added ${uniqueSubjects} subject${uniqueSubjects === 1 ? '' : 's'} to your calendar.`;
    }

    if (command.kind === 'clear_classes') {
      await clearAllClasses(user);
      return 'Done! All classes have been cleared from your calendar.';
    }

    if (command.kind === 'replace_classes') {
      await clearAllClasses(user);
      const { inserted, skipped } = await addParsedClasses(user, command.classes);
      const uniqueSubjects = new Set(command.classes.map((p) => p.title.trim().toLowerCase())).size;
      if (inserted === 0) {
        return 'I cleared your calendar but could not save the new schedule. Please try again with valid day/time entries.';
      }
      if (skipped > 0) {
        return `I replaced your schedule with ${inserted} saved block(s); ${skipped} row(s) were skipped.`;
      }
      return `Done! I replaced your schedule with ${uniqueSubjects} subject${uniqueSubjects === 1 ? '' : 's'}.`;
    }

    await addParsedTasks(user, command.tasks);
    return `I have successfully added ${command.tasks.length} tasks to your to-do list.`;
  }

  const sendMessage = async (override?: { text: string; imageUri?: string }) => {
    const nextText = (override?.text ?? input).trim();
    const imageUri = override?.imageUri ?? pendingImageUri ?? undefined;
    if ((!nextText && !imageUri) || isSending) {
      return;
    }

    const userMessage = createMessage('user', nextText, imageUri);
    const attachment = imageUri ? createAttachment(imageUri) : undefined;
    const historyForApi: ApiCueMessage[] = messages.map((message) => ({
      role: message.role,
      text: message.text,
      imageUri: message.imageUri,
    }));

    console.log('[Cue Chat] sending message', {
      latestUserText: nextText,
      hasAttachment: Boolean(attachment),
      attachmentUri: attachment?.uri,
    });

    if (!override) {
      setMessages((current) => [...current, userMessage]);
      setInput('');
      setPendingImageUri(null);
    }

    try {
      setIsSending(true);
      setLastFailedPayload(null);
      const firebaseUser = auth.currentUser;
      let planningContext: string | undefined;
      if (firebaseUser) {
        try {
          const snapshot = await loadUserAppSnapshot(firebaseUser);
          planningContext = formatCuePlanningContextForPrompt(snapshot);
        } catch (snapErr) {
          console.warn('[Cue Chat] could not load app snapshot for planning context', snapErr);
        }
      }

      const cueText = await fetchCueResponse({
        history: historyForApi,
        latestUserText: nextText,
        attachment,
        planningContext,
      });
      let finalResponseText = cueText;
      const parsed = parseCueCommandFromResponse(cueText, nextText);
      if (parsed.status === 'ok') {
        finalResponseText = await executeCueCommand(parsed.command, firebaseUser);
      } else if (parsed.status === 'calendar_intent_tasks_only') {
        finalResponseText =
          'You asked for calendar changes, but I only got to-do JSON. Please include weekday and HH:MM start/end time in your request.';
      } else if (parsed.status === 'invalid_json') {
        finalResponseText = 'I had trouble reading the response format. Please try again.';
      } else if (parsed.status === 'invalid_payload') {
        finalResponseText =
          'I understood this as a command but some required fields are missing or invalid. Please try again with clearer times and titles.';
      } else if (parsed.status === 'unsupported') {
        finalResponseText = 'I got an unsupported command format. Please ask again in plain language.';
      } else if (cueText.includes('```json')) {
        finalResponseText = 'I had trouble saving your schedule. Please ask again.';
      }

      setMessages((current) => [...current, createMessage('cue', finalResponseText)]);
    } catch (error) {
      console.error('[Cue Chat] fallback path', error);
      const isAuthError = error instanceof Error && /auth|permission|sign in/i.test(error.message);
      const failMessage = isAuthError
        ? 'Please sign in first so Cue can save your schedule and tasks.'
        : attachment
          ? "I couldn't process that image right now. Please retry with another image."
          : 'Cue could not respond right now (network/server issue). Please retry.';
      setMessages((current) => [
        ...current,
        createMessage('cue', failMessage),
      ]);
      setLastFailedPayload({ text: nextText, imageUri });
    } finally {
      setIsSending(false);
    }
  };

  const handlePickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Photos permission needed', 'Allow photo access so you can attach an image for study planning context.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        let finalUri = result.assets[0].uri;
        try {
          // Shrink massive camera-roll images to avoid React Native 'fetch' crash
          // when converting 5MB bodies to base64.
          const manip = await ImageManipulator.manipulateAsync(
            finalUri,
            [{ resize: { width: 1024 } }],
            { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
          );
          finalUri = manip.uri;
        } catch (manipError) {
          console.warn('[Cue Chat] failed to compress image, using original', manipError);
        }
        setPendingImageUri(finalUri);
      }
    } catch (error) {
      console.error('Image picker error', error);
      Alert.alert('Unable to open photos', 'Cue could not open your photo library right now. Please try again.');
    }
  };

  return (
    <GlowBackground>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView
          style={styles.keyboardShell}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Cue</Text>
            <Text style={styles.headerSubtitle}>Study planner</Text>
          </View>

          <FlatList
            ref={listRef}
            style={styles.messages}
            contentContainerStyle={styles.messagesContent}
            data={items}
            renderItem={renderItem}
            keyExtractor={(item) => item.key}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
          />

          <View style={[styles.composerShell, { paddingBottom: composerBottomPadding }]}>
            {lastFailedPayload ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retry last failed message"
                accessibilityHint="Resend the last failed text and attachment"
                onPress={() => {
                  void sendMessage(lastFailedPayload);
                }}
                style={styles.retryButton}>
                <Text style={styles.retryButtonText}>Retry last message</Text>
              </Pressable>
            ) : null}
            <View style={styles.composer}>
              {pendingImageUri ? (
                <View style={styles.attachmentPreview}>
                  <Image source={{ uri: pendingImageUri }} style={styles.attachmentImage} />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Remove attached image"
                    onPress={() => setPendingImageUri(null)}
                    style={styles.attachmentRemove}>
                    <Ionicons name="close" size={14} color={colors.ink} />
                  </Pressable>
                </View>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Upload image"
                accessibilityHint="Attach a class schedule or notes screenshot"
                onPress={handlePickImage}
                style={styles.iconButton}>
                <Ionicons name="image-outline" size={20} color={colors.inkMuted} />
              </Pressable>

              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Message Cue"
                placeholderTextColor={colors.inkMuted}
                style={styles.input}
                multiline
              />

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Send message"
                accessibilityHint={isSending ? 'Cue is generating a response' : 'Send your message to Cue'}
                onPress={() => {
                  void sendMessage();
                }}
                disabled={isSending}
                style={[styles.sendButton, isSending && styles.sendButtonDisabled]}>
                <Ionicons name="arrow-up" size={18} color={colors.white} />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GlowBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardShell: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  headerTitle: {
    color: colors.ink,
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
  },
  headerSubtitle: {
    color: colors.inkMuted,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    marginTop: 2,
  },
  messages: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  messageRow: {
    marginBottom: 12,
    flexDirection: 'row',
  },
  messageRowLeft: {
    justifyContent: 'flex-start',
  },
  messageRowRight: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '82%',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
  },
  cueBubble: {
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderColor: 'rgba(255,255,255,0.6)',
  },
  userBubble: {
    backgroundColor: 'rgba(124,98,255,0.92)',
    borderColor: 'rgba(255,255,255,0.22)',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'Inter_400Regular',
  },
  cueMessageText: {
    color: colors.ink,
  },
  userMessageText: {
    color: colors.white,
  },
  messageImage: {
    width: 180,
    height: 120,
    borderRadius: 16,
    marginBottom: 10,
  },
  composerShell: {
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: 'rgba(246,247,255,0.75)',
    zIndex: 2,
    elevation: 6,
  },
  retryButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(124,98,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.72)',
    marginBottom: 8,
  },
  retryButtonText: {
    color: colors.purple,
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  composer: {
    minHeight: 64,
    borderRadius: radii.xl,
    backgroundColor: 'rgba(255,255,255,0.58)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
    flexDirection: 'row',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  attachmentPreview: {
    width: 64,
    height: 64,
    borderRadius: 18,
    marginRight: 10,
    marginBottom: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
    position: 'relative',
  },
  attachmentImage: {
    width: '100%',
    height: '100%',
  },
  attachmentRemove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.52)',
    marginRight: 8,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    color: colors.ink,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 2,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.purple,
    marginLeft: 8,
  },
  sendButtonDisabled: {
    opacity: 0.55,
  },
});
