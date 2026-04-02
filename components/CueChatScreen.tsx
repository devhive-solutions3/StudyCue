import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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

type MessageRole = 'user' | 'cue';

type ChatMessage = {
  id: string;
  role: MessageRole;
  text: string;
  imageUri?: string;
};

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

function extractFencedJsonBodies(text: string): string[] {
  const re = /```(?:json)?\s*([\s\S]*?)\s*```/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const s = m[1]?.trim();
    if (s) out.push(s);
  }
  return out;
}

type CueJsonKind =
  | 'calendar_array'
  | 'replace_classes'
  | 'clear_classes'
  | 'add_tasks'
  | 'empty_array'
  | 'unknown';

function classifyCueJsonCommand(parsed: unknown): CueJsonKind {
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) return 'empty_array';
    const row = parsed[0];
    if (row && typeof row === 'object' && (row as { weekday?: string }).weekday) return 'calendar_array';
    return 'unknown';
  }
  if (parsed && typeof parsed === 'object' && 'action' in parsed) {
    const o = parsed as { action?: string; classes?: unknown; tasks?: unknown };
    if (o.action === 'clear_classes') return 'clear_classes';
    if (o.action === 'replace_classes' && Array.isArray(o.classes)) return 'replace_classes';
    if (o.action === 'add_tasks' && Array.isArray(o.tasks)) return 'add_tasks';
  }
  return 'unknown';
}

/** True when the user is clearly asking for the calendar/schedule surface, not the to-do list. */
function userMessagePrefersCalendar(message: string): boolean {
  const t = message.trim();
  if (!t) return false;
  if (/\b(not|instead|only)\b[^.!?]{0,80}\b(todo|to-?do|task\s*list)\b/i.test(t)) return true;
  if (/\b(calendar|calendar tab|time block|schedule block)\b/i.test(t)) return true;
  if (/\b(on|to|onto|into|put)[^.!?]{0,40}\b(my\s+)?(calendar|schedule)\b/i.test(t)) return true;
  return false;
}

/**
 * If the model emits several ```json``` blocks, using only the first breaks calendar fixes
 * when add_tasks appears before a calendar array. Prefer calendar-shaped JSON when the user asked for calendar.
 */
function pickJsonCandidateString(
  cueText: string,
  latestUserMessage: string
): { candidate: string | null; calendarIntentButOnlyTasks: boolean; fencedCount: number } {
  const bodies = extractFencedJsonBodies(cueText);
  const fencedCount = bodies.length;
  if (bodies.length === 0) {
    return { candidate: null, calendarIntentButOnlyTasks: false, fencedCount };
  }

  const tryParse = (body: string): unknown | null => {
    try {
      return JSON.parse(body) as unknown;
    } catch {
      return null;
    }
  };

  if (userMessagePrefersCalendar(latestUserMessage)) {
    for (const body of bodies) {
      const p = tryParse(body);
      if (!p) continue;
      const k = classifyCueJsonCommand(p);
      if (
        k === 'calendar_array' ||
        k === 'replace_classes' ||
        k === 'clear_classes' ||
        k === 'empty_array'
      ) {
        return { candidate: body, calendarIntentButOnlyTasks: false, fencedCount };
      }
    }
    const parsedDefined = bodies.map(tryParse).filter((x): x is NonNullable<typeof x> => x != null);
    const onlyAddTasks =
      parsedDefined.length > 0 &&
      parsedDefined.every((p) => classifyCueJsonCommand(p) === 'add_tasks');
    if (onlyAddTasks) {
      return { candidate: null, calendarIntentButOnlyTasks: true, fencedCount };
    }
  }

  return { candidate: bodies[0] ?? null, calendarIntentButOnlyTasks: false, fencedCount };
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
  const scrollRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [pendingImageUri, setPendingImageUri] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const composerBottomInset = isKeyboardVisible ? 12 : Math.max(insets.bottom, 12) + 104;
  const messageListBottomPadding = 22;

  useEffect(() => {
    const timeout = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 50);

    return () => clearTimeout(timeout);
  }, [messages]);

  const sendMessage = async () => {
    const nextText = input.trim();
    if ((!nextText && !pendingImageUri) || isSending) {
      return;
    }

    const userMessage = createMessage('user', nextText, pendingImageUri ?? undefined);
    const attachment = pendingImageUri ? createAttachment(pendingImageUri) : undefined;
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

    setMessages((current) => [...current, userMessage]);
    setInput('');
    setPendingImageUri(null);

    try {
      setIsSending(true);
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

      const jsonPick = pickJsonCandidateString(cueText, nextText);

      // #region agent log
      const shapePayload = {
        sessionId: '530b59',
        runId: 'post-fix',
        hypothesisId: 'H2-H3',
        location: 'CueChatScreen.tsx:post-fetchCueResponse',
        message: 'cue raw response shape',
        data: {
          historyLen: historyForApi.length,
          planningContextLen: planningContext?.length ?? 0,
          responseLen: cueText?.length ?? 0,
          hasFencedJson: /\`\`\`(?:json)?\s*[\s\S]*?\`\`\`/.test(cueText),
          startsWithBracket: cueText.trimStart().startsWith('['),
          startsWithBrace: cueText.trimStart().startsWith('{'),
          fencedCount: jsonPick.fencedCount,
          preferCalendar: userMessagePrefersCalendar(nextText),
          calendarIntentButOnlyTasks: jsonPick.calendarIntentButOnlyTasks,
          pickedFence: Boolean(jsonPick.candidate),
        },
        timestamp: Date.now(),
      };
      fetch('http://127.0.0.1:7870/ingest/d80afea3-449e-42fd-b7ab-6ca71d94c133', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '530b59' },
        body: JSON.stringify(shapePayload),
      }).catch(() => {});
      if (__DEV__) {
        console.warn('[CueDebug]', JSON.stringify(shapePayload));
      }
      // #endregion

      const user = firebaseUser;

      // --- JSON Action Interceptor ---
      // The AI may reply with a JSON command instead of a chat message. We detect
      // that, execute the database action, and show a friendly message instead.
      // If JSON parsing fails for any reason, we fall back to the chat text.

      // Try to extract JSON body from the response (multi-fence aware; see pickJsonCandidateString)
      let jsonCandidate: string | null = jsonPick.candidate;
      if (!jsonCandidate && !jsonPick.calendarIntentButOnlyTasks) {
        const firstBracket = cueText.indexOf('[');
        const lastBracket = cueText.lastIndexOf(']');
        const firstBrace = cueText.indexOf('{');
        const lastBrace = cueText.lastIndexOf('}');

        if (firstBracket !== -1 && lastBracket > firstBracket) {
          jsonCandidate = cueText.substring(firstBracket, lastBracket + 1);
        } else if (firstBrace !== -1 && lastBrace > firstBrace) {
          jsonCandidate = cueText.substring(firstBrace, lastBrace + 1);
        }
      }

      let finalResponseText = cueText;
      let handledAsJson = false;

      if (jsonPick.calendarIntentButOnlyTasks) {
        finalResponseText =
          'You asked for the calendar, but I only returned to-do list JSON. Say the weekday plus start and end time in 24-hour form (e.g. Monday 19:00–20:00), or add the block in the Calendar tab.';
        handledAsJson = true;
      }

      if (jsonCandidate) {
        try {
          const parsed = JSON.parse(jsonCandidate);

          // #region agent log
          const first = Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : null;
          const parsePayload = {
            sessionId: '530b59',
            runId: 'post-fix',
            hypothesisId: 'H1-H2',
            location: 'CueChatScreen.tsx:json-parse-ok',
            message: 'parsed JSON summary',
            data: {
              isArray: Array.isArray(parsed),
              arrayLen: Array.isArray(parsed) ? parsed.length : 0,
              objectAction: !Array.isArray(parsed) && parsed && typeof parsed === 'object' ? (parsed as any).action : null,
              commandKind: classifyCueJsonCommand(parsed),
              firstKeys: first && typeof first === 'object' ? Object.keys(first as object).sort() : [],
              firstHasWeekday: Boolean((first as any)?.weekday),
            },
            timestamp: Date.now(),
          };
          fetch('http://127.0.0.1:7870/ingest/d80afea3-449e-42fd-b7ab-6ca71d94c133', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '530b59' },
            body: JSON.stringify(parsePayload),
          }).catch(() => {});
          if (__DEV__) {
            console.warn('[CueDebug]', JSON.stringify(parsePayload));
          }
          // #endregion

          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].weekday) {
            // Add classes action
            if (user) {
              const { inserted, skipped } = await addParsedClasses(user, parsed);
              const uniqueSubjects = new Set(parsed.map((p: any) => p.title?.trim().toLowerCase())).size;
              if (inserted === 0) {
                finalResponseText =
                  'I could not add those to your calendar — each block needs a weekday, title, and valid start/end times (24-hour HH:MM). Say the day and times clearly, or add the block manually in the Calendar tab.';
              } else if (skipped > 0) {
                finalResponseText = `I added ${inserted} calendar block(s); ${skipped} row(s) were skipped (missing weekday or title). Check the Calendar tab.`;
              } else {
                finalResponseText = `I successfully added ${uniqueSubjects} subject${uniqueSubjects === 1 ? '' : 's'} to your calendar! You can view them in the Calendar tab.`;
              }
            } else {
              finalResponseText = 'You need to be signed in to save classes to your calendar.';
            }
            handledAsJson = true;

          } else if (parsed && !Array.isArray(parsed) && parsed.action === 'clear_classes') {
            // Clear all classes action
            if (user) {
              await clearAllClasses(user);
              finalResponseText = 'Done! All classes have been cleared from your calendar.';
            } else {
              finalResponseText = 'You need to be signed in to clear your calendar.';
            }
            handledAsJson = true;

          } else if (parsed && !Array.isArray(parsed) && parsed.action === 'replace_classes' && Array.isArray(parsed.classes)) {
            // Replace = clear then add
            if (user) {
              await clearAllClasses(user);
              const { inserted, skipped } = await addParsedClasses(user, parsed.classes);
              const uniqueSubjects = new Set(parsed.classes.map((p: any) => p.title?.trim().toLowerCase())).size;
              if (inserted === 0) {
                finalResponseText =
                  'I cleared your calendar but could not save the new schedule — each entry needs a weekday and title. Please try again with a full schedule or add events manually.';
              } else if (skipped > 0) {
                finalResponseText = `I replaced your schedule with ${inserted} saved block(s); ${skipped} row(s) were skipped (missing weekday or title). Check the Calendar tab.`;
              } else {
                finalResponseText = `Done! I replaced your schedule with ${uniqueSubjects} new subject${uniqueSubjects === 1 ? '' : 's'}. Check the Calendar tab!`;
              }
            } else {
              finalResponseText = 'You need to be signed in to update your calendar.';
            }
            handledAsJson = true;

          } else if (parsed && !Array.isArray(parsed) && parsed.action === 'add_tasks' && Array.isArray(parsed.tasks)) {
            // Add tasks action
            if (user) {
              await addParsedTasks(user, parsed.tasks);
              finalResponseText = `I have successfully added ${parsed.tasks.length} tasks to your to-do list! You can review them on the Home tab.`;
            } else {
              finalResponseText = 'You need to be signed in to save tasks.';
            }
            handledAsJson = true;

          } else if (Array.isArray(parsed) && parsed.length === 0) {
            finalResponseText = "I couldn't find any classes to extract from that image.";
            handledAsJson = true;
          }

          // #region agent log
          const handlerPayload = {
            sessionId: '530b59',
            runId: 'post-fix',
            hypothesisId: 'H1',
            location: 'CueChatScreen.tsx:json-handler-result',
            message: 'which JSON branch ran',
            data: {
              handledAsJson,
              hadJsonCandidate: true,
            },
            timestamp: Date.now(),
          };
          fetch('http://127.0.0.1:7870/ingest/d80afea3-449e-42fd-b7ab-6ca71d94c133', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '530b59' },
            body: JSON.stringify(handlerPayload),
          }).catch(() => {});
          if (__DEV__) {
            console.warn('[CueDebug]', JSON.stringify(handlerPayload));
          }
          // #endregion
        } catch (e) {
          // JSON.parse failed — if the AI gave us mostly JSON-looking output, suppress it
          // to avoid showing raw code to the user.
          const looksLikeJson = jsonCandidate.trim().startsWith('[') || jsonCandidate.trim().startsWith('{');
          if (looksLikeJson) {
            finalResponseText = "I had trouble reading that schedule. Please try again, or type out the schedule manually.";
            handledAsJson = true;
          }
          console.warn('[Cue] JSON parse failed:', e);
          // #region agent log
          const failPayload = {
            sessionId: '530b59',
            runId: 'post-fix',
            hypothesisId: 'H2',
            location: 'CueChatScreen.tsx:json-parse-fail',
            message: 'JSON.parse threw',
            data: {
              errName: e instanceof Error ? e.name : 'unknown',
              candidateLen: jsonCandidate?.length ?? 0,
            },
            timestamp: Date.now(),
          };
          fetch('http://127.0.0.1:7870/ingest/d80afea3-449e-42fd-b7ab-6ca71d94c133', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '530b59' },
            body: JSON.stringify(failPayload),
          }).catch(() => {});
          if (__DEV__) {
            console.warn('[CueDebug]', JSON.stringify(failPayload));
          }
          // #endregion
        }
      }

      // If the AI's full text looks like raw JSON dumped into the chat (even if not parsed),
      // sanitize it so we never show code blocks to the user.
      if (!handledAsJson && (cueText.includes('```json') || cueText.includes('```\n['))) {
        finalResponseText = "I had trouble saving your schedule. Please ask again.";
      }

      setMessages((current) => [...current, createMessage('cue', finalResponseText)]);
    } catch (error) {
      console.error('[Cue Chat] fallback path', error);
      setMessages((current) => [
        ...current,
        createMessage(
          'cue',
          attachment
            ? "I couldn't process that image. Please try another one."
            : 'Cue could not respond right now. Please try again.'
        ),
      ]);
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
          keyboardVerticalOffset={Platform.OS === 'ios' ? 18 : 0}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Cue</Text>
            <Text style={styles.headerSubtitle}>Study planner</Text>
          </View>

          <ScrollView
            ref={scrollRef}
            style={styles.messages}
            contentContainerStyle={[styles.messagesContent, { paddingBottom: messageListBottomPadding }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </ScrollView>

          <View style={[styles.composerShell, { paddingBottom: composerBottomInset }]}>
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
              <Pressable accessibilityRole="button" accessibilityLabel="Upload image" onPress={handlePickImage} style={styles.iconButton}>
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
                onPress={sendMessage}
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
