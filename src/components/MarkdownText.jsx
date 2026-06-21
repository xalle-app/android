import { useState, useMemo, memo, useRef, useEffect } from "react";
import { Text, View, StyleSheet, Animated } from "react-native";
import { useTheme } from "../store/theme.js";

const INLINE_RE = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|~~(.+?)~~|(`(.+?)`)|(\|\|(.+?)\|\|)|(@[a-zA-Z0-9Ѐ-ӿ_-]+)|(#[a-zA-Z0-9Ѐ-ӿ_-]+)/g;

function parseInline(text) {
  const parts = [];
  let last = 0;
  INLINE_RE.lastIndex = 0;
  let m;
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) parts.push({ t: "text", s: text.slice(last, m.index) });
    if      (m[1])  parts.push({ t: "bold",    s: m[2] });
    else if (m[3])  parts.push({ t: "italic",  s: m[4] });
    else if (m[5])  parts.push({ t: "strike",  s: m[5] });
    else if (m[6])  parts.push({ t: "code",    s: m[7] });
    else if (m[8])  parts.push({ t: "spoiler", s: m[9] });
    else if (m[10]) parts.push({ t: "mention", s: m[10] });
    else if (m[11]) parts.push({ t: "tag",     s: m[11] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ t: "text", s: text.slice(last) });
  return parts;
}

function Spoiler({ text }) {
  const [open, setOpen] = useState(false);
  const reveal  = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(1)).current;

  const startShimmer = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 0.5, duration: 1100, useNativeDriver: false }),
        Animated.timing(shimmer, { toValue: 1.0, duration: 1100, useNativeDriver: false }),
      ])
    ).start();
  };

  useEffect(() => { startShimmer(); return () => shimmer.stopAnimation(); }, []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) { shimmer.stopAnimation(); shimmer.setValue(1); }
    Animated.spring(reveal, {
      toValue: next ? 1 : 0,
      useNativeDriver: false,
      tension: 65, friction: 9,
    }).start(() => { if (!next) startShimmer(); });
  };

  const textColor = reveal.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: ["rgba(26,24,21,0)", "rgba(26,24,21,0)", "rgba(26,24,21,1)"],
  });
  const bgColor = reveal.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: ["rgba(200,116,90,0.20)", "rgba(200,116,90,0.06)", "rgba(200,116,90,0)"],
  });
  const shadowR = reveal.interpolate({ inputRange: [0, 1], outputRange: [11, 0] });
  const hiddenFactor = reveal.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0, 0] });
  const shadowOpacity = Animated.multiply(hiddenFactor, shimmer);
  const shadowColorAnim = shadowOpacity.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["rgba(200,116,90,0)", "rgba(200,116,90,0.55)", "rgba(200,116,90,0.9)"],
  });

  return (
    <Animated.Text
      onPress={toggle}
      style={{
        color: textColor,
        backgroundColor: bgColor,
        borderRadius: 5,
        overflow: "hidden",
        paddingHorizontal: 1,
        textShadowColor: shadowColorAnim,
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: shadowR,
      }}
    >
      {text}
    </Animated.Text>
  );
}

function InlineParts({ parts, c, onMentionPress, onTagPress }) {
  return (
    <>
      {parts.map((p, i) => {
        if (p.t === "bold")    return <Text key={i} style={st.bold}><InlineParts parts={parseInline(p.s)} c={c} onMentionPress={onMentionPress} onTagPress={onTagPress} /></Text>;
        if (p.t === "italic")  return <Text key={i} style={st.italic}><InlineParts parts={parseInline(p.s)} c={c} onMentionPress={onMentionPress} onTagPress={onTagPress} /></Text>;
        if (p.t === "strike")  return <Text key={i} style={st.strike}><InlineParts parts={parseInline(p.s)} c={c} onMentionPress={onMentionPress} onTagPress={onTagPress} /></Text>;
        if (p.t === "code")    return <Text key={i} style={[st.icode, { backgroundColor: c.WARM }]}>{p.s}</Text>;
        if (p.t === "spoiler") return <Spoiler key={i} text={p.s} />;
        if (p.t === "mention") return (
          <Text key={i} style={[st.mention, { color: c.ACCENT }]} onPress={onMentionPress ? () => onMentionPress(p.s.slice(1)) : undefined}>
            {p.s}
          </Text>
        );
        if (p.t === "tag") return (
          <Text key={i} style={st.tag} onPress={onTagPress ? () => onTagPress(p.s.slice(1)) : undefined}>
            {p.s}
          </Text>
        );
        return <Text key={i}>{p.s}</Text>;
      })}
    </>
  );
}

function parseBlocks(text) {
  const lines = text.split("\n");
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trimStart().startsWith("```")) {
      const code = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) { code.push(lines[i]); i++; }
      blocks.push({ type: "code", content: code.join("\n") });
      i++; continue;
    }
    const hm = line.match(/^(#{1,4})\s+(.+)$/);
    if (hm) { blocks.push({ type: "h", level: hm[1].length, content: hm[2] }); i++; continue; }
    if (line.startsWith("> ") || line === ">") {
      const q = [];
      while (i < lines.length && (lines[i].startsWith("> ") || lines[i] === ">")) { q.push(lines[i].replace(/^> ?/, "")); i++; }
      blocks.push({ type: "quote", content: q.join("\n") }); continue;
    }
    if (/^-{3,}$/.test(line) || /^~{3,}$/.test(line)) { blocks.push({ type: "hr" }); i++; continue; }
    blocks.push({ type: "p", content: line }); i++;
  }
  return blocks;
}

function MarkdownText({ children, style, numberOfLines, onMentionPress, onTagPress }) {
  const c = useTheme();
  const text = typeof children === "string" ? children : String(children ?? "");
  const blocks = useMemo(() => parseBlocks(text), [text]);

  const flatParts = useMemo(() => {
    const out = [];
    blocks.forEach((b, bi) => {
      if (bi > 0) out.push({ t: "text", s: "\n" });
      out.push(...parseInline(b.content || ""));
    });
    return out;
  }, [blocks]);

  const hasBlockSyntax = blocks.some(b => b.type !== "p");

  const ip = (parts) => <InlineParts parts={parts} c={c} onMentionPress={onMentionPress} onTagPress={onTagPress} />;

  if (!hasBlockSyntax || numberOfLines) {
    return (
      <Text style={[st.base, style]} numberOfLines={numberOfLines}>
        {ip(flatParts)}
      </Text>
    );
  }

  return (
    <View style={style}>
      {blocks.map((b, bi) => {
        if (b.type === "h") {
          const hSt = b.level === 1 ? st.h1 : b.level === 2 ? st.h2 : st.h3;
          return <Text key={bi} style={[st.base, hSt]}>{ip(parseInline(b.content))}</Text>;
        }
        if (b.type === "quote") {
          return (
            <View key={bi} style={[st.quoteWrap, { borderLeftColor: c.ACCENT, backgroundColor: `${c.ACCENT}08` }]}>
              <Text style={[st.base, st.quoteText, { color: c.INK_SOFT }]}>{ip(parseInline(b.content))}</Text>
            </View>
          );
        }
        if (b.type === "code") {
          return (
            <View key={bi} style={st.codeWrap}>
              <Text style={st.codeText} selectable>{b.content}</Text>
            </View>
          );
        }
        if (b.type === "hr") return <View key={bi} style={[st.hr, { backgroundColor: c.LINE }]} />;
        if (!b.content) return <View key={bi} style={{ height: 6 }} />;
        return <Text key={bi} style={[st.base, style]}>{ip(parseInline(b.content))}</Text>;
      })}
    </View>
  );
}

export default memo(MarkdownText);

const MONO = "Courier New";

const st = StyleSheet.create({
  base:        { fontSize: 15, lineHeight: 22 },
  bold:        { fontWeight: "700" },
  italic:      { fontStyle: "italic" },
  strike:      { textDecorationLine: "line-through" },
  icode:       { fontFamily: MONO, fontSize: 13, paddingHorizontal: 4, borderRadius: 4, color: "#b36f40" },
  mention:     { fontWeight: "600" },
  tag:         { color: "#5a8be0", fontWeight: "600" },
  h1:          { fontSize: 22, fontWeight: "800", marginTop: 4, marginBottom: 4, lineHeight: 28 },
  h2:          { fontSize: 19, fontWeight: "700", marginTop: 4, marginBottom: 2, lineHeight: 26 },
  h3:          { fontSize: 16, fontWeight: "700", marginTop: 2, marginBottom: 2, lineHeight: 22 },
  quoteWrap:   { borderLeftWidth: 3, paddingLeft: 10, marginVertical: 4, borderRadius: 4, paddingVertical: 6 },
  quoteText:   { fontStyle: "italic" },
  codeWrap:    { backgroundColor: "#1e1e1e", borderRadius: 10, padding: 12, marginVertical: 6 },
  codeText:    { fontFamily: MONO, fontSize: 13, color: "#d4d4d4", lineHeight: 19 },
  hr:          { height: StyleSheet.hairlineWidth, marginVertical: 10 },
});
