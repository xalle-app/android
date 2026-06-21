import { useState, useEffect, useRef, memo } from "react";
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Post from "../components/Post.jsx";
import Avatar from "../components/Avatar.jsx";
import CollabPanel from "../components/CollabPanel.jsx";
import { api } from "../lib/api.js";
import { useAuthStore } from "../store/auth.js";
import { timeAgo } from "../lib/format.js";
import { useTheme } from "../store/theme.js";

const Comment = memo(function Comment({ item }) {
  const c = useTheme();
  return (
    <View style={[styles.comment, { borderBottomColor: c.LINE }]}>
      <Avatar url={item.avatar_url} name={item.name} size={30} />
      <View style={styles.commentBody}>
        <View style={styles.commentHeader}>
          <Text style={[styles.commentName, { color: c.INK }]}>{item.name}</Text>
          <Text style={[styles.commentTime, { color: c.INK_SOFT }]}>{timeAgo(item.created_at)}</Text>
        </View>
        <Text style={[styles.commentText, { color: c.INK }]}>{item.body}</Text>
      </View>
    </View>
  );
});

export default function PostDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { post: initialPost } = route.params;
  const user = useAuthStore(s => s.user);
  const c = useTheme();
  const listRef = useRef(null);
  const [comments, setComments] = useState([]);
  const [text, setText]         = useState("");
  const [sending, setSending]   = useState(false);
  const [loading, setLoading]   = useState(true);

  const loadComments = async () => {
    try {
      const data = await api(`/posts/${initialPost.id}/comments`);
      setComments(Array.isArray(data) ? data : []);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { loadComments(); }, []);

  const sendComment = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    try {
      await api(`/posts/${initialPost.id}/comments`, { method: "POST", body: { body: t } });
      setText("");
      await loadComments();
      // Scroll to last comment after sending
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {}
    finally { setSending(false); }
  };

  // When input gains focus, scroll list to bottom so input stays visible
  const handleInputFocus = () => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 350);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: c.BG }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 50 : 0}
    >
      <FlatList
        ref={listRef}
        data={comments}
        keyExtractor={item => String(item.id)}
        ListHeaderComponent={
          <>
            <Post
              post={initialPost}
              me={user}
              onAvatarPress={() => navigation.navigate("UserProfile", { handle: initialPost.handle })}
              onMentionPress={handle => navigation.navigate("UserProfile", { handle })}
            />
            {!!initialPost.collab && (
              <CollabPanel post={initialPost} onRefresh={loadComments} />
            )}
          </>
        }
        renderItem={({ item }) => <Comment item={item} />}
        ListEmptyComponent={
          !loading && <Text style={[styles.noComments, { color: c.INK_SOFT }]}>Пока нет комментариев</Text>
        }
        contentContainerStyle={{ paddingBottom: 8 }}
        // Taps on list dismiss keyboard; dragging dismisses it immediately
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        // Auto-scroll when new comments load
        onContentSizeChange={() => {
          if (comments.length > 3) listRef.current?.scrollToEnd({ animated: false });
        }}
      />

      {/* Comment input — pinned at bottom above keyboard */}
      <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, 8), backgroundColor: c.SURFACE, borderTopColor: c.LINE }]}>
        <Avatar url={user?.avatar_url} name={user?.name} size={32} />
        <TextInput
          style={[styles.input, { backgroundColor: c.WARM, color: c.INK }]}
          placeholder="Написать комментарий..."
          placeholderTextColor={c.INK_SOFT}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={2000}
          onFocus={handleInputFocus}
          returnKeyType="default"
        />
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: c.ACCENT }, (!text.trim() || sending) && { backgroundColor: c.LINE }]}
          onPress={sendComment}
          disabled={!text.trim() || sending}
        >
          {sending
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.sendText}>↑</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1 },
  comment:       { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  commentBody:   { flex: 1 },
  commentHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  commentName:   { fontSize: 13.5, fontWeight: "700" },
  commentTime:   { fontSize: 12 },
  commentText:   { fontSize: 14, lineHeight: 20 },
  noComments:    { textAlign: "center", padding: 24, fontSize: 14 },
  inputRow:      { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingTop: 10, paddingHorizontal: 12, borderTopWidth: 1 },
  input:         { flex: 1, minHeight: 38, maxHeight: 120, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 14 },
  sendBtn:       { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 1 },
  sendText:      { color: "#fff", fontSize: 18, fontWeight: "700", marginTop: -2 },
});
