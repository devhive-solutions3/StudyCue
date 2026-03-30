import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
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
import { addParsedClasses, clearAllClasses, addParsedTasks, type ParsedClass } from '../lib/user-app-data';

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
  const composerBottomInset = Math.max(insets.bottom, 12) + 104;
  const messageListBottomPadding = composerBottomInset + 22;

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
      const cueText = await fetchCueResponse({
        history: historyForApi,
        latestUserText: nextText,
        attachment,
      });

      const user = auth.currentUser;

      // --- JSON Action Interceptor ---
      // The AI may reply with a JSON command instead of a chat message. We detect
      // that, execute the database action, and show a friendly message instead.
      // If JSON parsing fails for any reason, we fall back to the chat text.

      // Try to extract JSON body from the response
      let jsonCandidate: string | null = null;
      const mdMatch = cueText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (mdMatch) {
        jsonCandidate = mdMatch[1];
      } else {
        // No markdown block — try to pull out a raw JSON literal
        const firstBracket = cueText.indexOf('[');
        const lastBracket  = cueText.lastIndexOf(']');
        const firstBrace   = cueText.indexOf('{');
        const lastBrace    = cueText.lastIndexOf('}');

        if (firstBracket !== -1 && lastBracket > firstBracket) {
          jsonCandidate = cueText.substring(firstBracket, lastBracket + 1);
        } else if (firstBrace !== -1 && lastBrace > firstBrace) {
          jsonCandidate = cueText.substring(firstBrace, lastBrace + 1);
        }
      }

      let finalResponseText = cueText;
      let handledAsJson = false;

      if (jsonCandidate) {
        try {
          const parsed = JSON.parse(jsonCandidate);

          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].weekday) {
            // Add classes action
            if (user) {
              await addParsedClasses(user, parsed);
              finalResponseText = `I successfully added ${parsed.length} classes to your calendar! You can view them in the Calendar tab.`;
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
              await addParsedClasses(user, parsed.classes);
              finalResponseText = `Done! I replaced your schedule with ${parsed.classes.length} new classes. Check the Calendar tab!`;
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
        } catch (e) {
          // JSON.parse failed — if the AI gave us mostly JSON-looking output, suppress it
          // to avoid showing raw code to the user.
          const looksLikeJson = jsonCandidate.trim().startsWith('[') || jsonCandidate.trim().startsWith('{');
          if (looksLikeJson) {
            finalResponseText = "I had trouble reading that schedule. Please try again, or type out the schedule manually.";
            handledAsJson = true;
          }
          console.warn('[Cue] JSON parse failed:', e);
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
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
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
