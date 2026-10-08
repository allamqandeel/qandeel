/**
 * S5-04 — the dependent discussion of the focused Public Experience, drawn in the field's chrome band over its panel.
 *
 * It is not a World, a feed or a DM: one Experience's discussion, opened from its panel at NEAR; Back (its own control or
 * the system Back) returns to the SAME panel in the SAME field. Reading order is the canonical one: each top-level post,
 * then its replies beneath it (one visible depth), each reply under its thread's root. Every human post is attributed to
 * its author's CURRENT Public Identity display only; a Public QANDEEL response is attributed to «قنديل» / QANDEEL in its
 * own visually distinct block with a text label (never colour alone), and is never shown as a human identity.
 *
 * There is no like, follower, ranking, badge, contact or private-message affordance, and no count other than the
 * Discussion entry's. The composer exists only while the server says the reader may contribute now (the CW2-08 / Stage 9
 * entitlement seam answers NOT_EVALUATED in production, so it is absent there). Nothing here is cached for display.
 */
import { useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';

import { Control, typeStyle, usePalette, type ConversationPalette } from '../../conversation';
import type { ChromeLanguage } from '../../orientation-chrome';
import type { PublicDiscussionPost } from '../../runtime-entry';
import { fillDiscussionCopy, publicDiscussionCopy, type PublicDiscussionCopy } from './discussion-copy';
import { PUBLIC_DISCUSSION_TEXT_MAX, type PublicDiscussionController } from './public-discussion-controller';

export const PUBLIC_DISCUSSION_TEST_ID = 'qandeel-public-discussion';

export interface PublicDiscussionProps {
  readonly controller: PublicDiscussionController;
  readonly language: ChromeLanguage;
  readonly onBack: () => void;
}

export function PublicDiscussion({ controller, language, onBack }: PublicDiscussionProps) {
  const copy = publicDiscussionCopy(language);
  const palette = usePalette();
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const screen = useWindowDimensions();
  const [text, setText] = useState('');
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const style = (role: 'body' | 'supporting' | 'metadata' | 'statement' | 'action', color: string) => ({ ...typeStyle(role), color, writingDirection: writing as 'rtl' | 'ltr' });
  const authorOf = (post: PublicDiscussionPost) => post.author.label ?? copy.someone;

  const send = () => {
    void controller.send(text).then((committed) => { if (committed) setText(''); });
  };

  return (
    <View testID={PUBLIC_DISCUSSION_TEST_ID} accessibilityLanguage={language}
      style={{ backgroundColor: palette.field, borderRadius: 20, paddingBottom: 12, maxHeight: Math.round(screen.height * 0.72) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 8, paddingHorizontal: 8, paddingTop: 6 }}>
        <Control palette={palette} language={language} accessibilityLabel={copy.back} onPress={onBack} testID="qandeel-public-discussion-back">
          <Text style={style('action', palette.restInk)}>{copy.back}</Text>
        </Control>
        <Text accessibilityRole="header" style={style('statement', palette.primary)}>{copy.discussion}</Text>
      </View>
      <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 20, rowGap: 12, paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
        {state.status === 'LOADING' ? (
          <View accessible accessibilityState={{ busy: true }} style={{ minHeight: 48, justifyContent: 'center' }}>
            <ActivityIndicator color={palette.secondary} />
          </View>
        ) : state.status === 'ABSENT' ? (
          <Text testID="qandeel-public-discussion-absent" accessibilityLiveRegion="polite" style={style('body', palette.secondary)}>{copy.experienceUnavailable}</Text>
        ) : state.status === 'UNAVAILABLE' ? (
          <View style={{ rowGap: 8, alignItems: 'flex-start' }}>
            <Text testID="qandeel-public-discussion-unavailable" accessibilityLiveRegion="polite" style={style('body', palette.secondary)}>{copy.unavailable}</Text>
            <Control palette={palette} language={language} accessibilityLabel={copy.retry} onPress={() => controller.refresh()} testID="qandeel-public-discussion-retry">
              <Text style={style('action', palette.primary)}>{copy.retry}</Text>
            </Control>
          </View>
        ) : state.threads.length === 0 ? (
          <Text testID="qandeel-public-discussion-empty" style={style('body', palette.secondary)}>{copy.noPosts}</Text>
        ) : (
          state.threads.map((thread) => (
            <View key={thread.root.id} testID={`qandeel-public-thread-${thread.root.id}`} style={{ rowGap: 8 }}>
              <PostRow post={thread.root} copy={copy} palette={palette} language={language} author={authorOf(thread.root)}
                canReply={state.canContribute} onReply={() => controller.replyTo(thread.root)} onRetry={() => controller.retryQandeel(thread.root.id)} />
              {thread.replies.map((reply) => (
                <View key={reply.id} style={{ marginStart: 16 }}>
                  <PostRow post={reply} copy={copy} palette={palette} language={language} author={authorOf(reply)}
                    canReply={state.canContribute} onReply={() => controller.replyTo(reply)} onRetry={() => controller.retryQandeel(reply.id)} />
                </View>
              ))}
            </View>
          ))
        )}
        {state.status === 'SERVED' && state.hasMore ? (
          <Control palette={palette} language={language} accessibilityLabel={copy.morePosts} onPress={() => controller.loadMore()} testID="qandeel-public-discussion-more">
            <Text style={style('action', palette.primary)}>{copy.morePosts}</Text>
          </Control>
        ) : null}
      </ScrollView>
      {state.status === 'SERVED' && state.canContribute ? (
        <View testID="qandeel-public-composer" style={{ paddingHorizontal: 12, rowGap: 6 }}>
          {state.replyTo !== null ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 8 }}>
              <Text testID="qandeel-public-replying-to" numberOfLines={1} style={{ ...style('metadata', palette.secondary), flex: 1 }}>
                {fillDiscussionCopy(copy.replyingTo, authorOf(state.replyTo))}
              </Text>
              <Control palette={palette} language={language} accessibilityLabel={copy.cancel} onPress={() => controller.replyTo(null)} testID="qandeel-public-reply-cancel">
                <Text style={style('action', palette.restInk)}>{copy.cancel}</Text>
              </Control>
            </View>
          ) : null}
          <Text style={style('metadata', palette.tertiary)}>{copy.invokeHint}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', columnGap: 8 }}>
            <TextInput testID="qandeel-public-composer-input" value={text} onChangeText={setText} multiline maxLength={PUBLIC_DISCUSSION_TEXT_MAX}
              accessibilityLabel={copy.composerName} placeholder={copy.composerPlaceholder} placeholderTextColor={palette.tertiary}
              accessibilityLanguage={language} selectionColor={palette.primary} cursorColor={palette.primary}
              style={{ ...typeStyle('body'), flex: 1, minHeight: 44, maxHeight: 132, color: palette.primary, backgroundColor: palette.world,
                borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, writingDirection: writing, textAlign: writing === 'rtl' ? 'right' : 'left' }} />
            <Control palette={palette} language={language} accessibilityLabel={copy.send} onPress={send} testID="qandeel-public-composer-send"
              accessibilityState={{ busy: state.send === 'SENDING', disabled: text.trim().length === 0 }}>
              <Text style={style('action', text.trim().length === 0 ? palette.tertiary : palette.primary)}>{copy.send}</Text>
            </Control>
          </View>
          {state.send === 'UNCONFIRMED' || state.send === 'REFUSED' ? (
            <Text testID="qandeel-public-send-failed" accessibilityLiveRegion="polite" style={style('supporting', palette.secondary)}>
              {state.send === 'UNCONFIRMED' ? copy.sendUnconfirmed : copy.sendRefused}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function PostRow({ post, copy, palette, language, author, canReply, onReply, onRetry }: {
  readonly post: PublicDiscussionPost; readonly copy: PublicDiscussionCopy; readonly palette: ConversationPalette; readonly language: ChromeLanguage;
  readonly author: string; readonly canReply: boolean; readonly onReply: () => void; readonly onRetry: () => void;
}) {
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const style = (role: 'body' | 'supporting' | 'metadata' | 'action', color: string) => ({ ...typeStyle(role), color, writingDirection: writing as 'rtl' | 'ltr' });
  return (
    <View testID={`qandeel-public-post-${post.id}`} style={{ rowGap: 4 }}>
      {/* One read: the author's Public display, then the words. */}
      <View accessible accessibilityLabel={`${author}: ${post.text}`} accessibilityLanguage={language}>
        <Text style={style('metadata', palette.tertiary)}>{author}</Text>
        <Text style={style('body', palette.primary)}>{post.text}</Text>
      </View>
      {canReply ? (
        <View style={{ flexDirection: 'row' }}>
          <Pressable testID={`qandeel-public-reply-${post.id}`} accessibilityRole="button" accessibilityLabel={copy.reply} accessibilityLanguage={language}
            onPress={onReply} style={{ minHeight: 44, minWidth: 44, justifyContent: 'center' }}>
            <Text style={style('action', palette.restInk)}>{copy.reply}</Text>
          </Pressable>
        </View>
      ) : null}
      {post.qandeel.state === 'RESPONDED' ? (
        <View testID={`qandeel-public-qandeel-${post.id}`} accessible accessibilityLabel={copy.qandeelSays(post.qandeel.text)} accessibilityLanguage={language}
          style={{ borderStartWidth: 2, borderColor: palette.secondary, paddingStart: 12, rowGap: 2 }}>
          <Text style={style('metadata', palette.secondary)}>{copy.qandeel}</Text>
          <Text style={style('body', palette.primary)}>{post.qandeel.text}</Text>
        </View>
      ) : post.qandeel.state === 'PENDING' ? (
        <Text testID={`qandeel-public-qandeel-pending-${post.id}`} accessibilityLiveRegion="polite" style={style('metadata', palette.secondary)}>{copy.qandeelPending}</Text>
      ) : post.qandeel.state === 'UNAVAILABLE' ? (
        <View style={{ rowGap: 2, alignItems: 'flex-start' }}>
          <Text testID={`qandeel-public-qandeel-unavailable-${post.id}`} style={style('metadata', palette.secondary)}>{copy.qandeelUnavailable}</Text>
          {post.own ? (
            <Control palette={palette} language={language} accessibilityLabel={copy.retry} onPress={onRetry} testID={`qandeel-public-qandeel-retry-${post.id}`}>
              <Text style={style('action', palette.primary)}>{copy.retry}</Text>
            </Control>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
