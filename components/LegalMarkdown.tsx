import { Text, StyleSheet, View } from 'react-native';

import { Colors, spacing } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

type Props = {
  markdown: string;
};

/** Minimal markdown renderer (headings + paragraphs + bold). */
export function LegalMarkdown({ markdown }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const blocks = markdown.trim().split(/\n{2,}/);

  return (
    <View style={styles.wrap}>
      {blocks.map((block, i) => {
        const line = block.trim();
        if (!line) return null;
        if (line.startsWith('# ')) {
          return (
            <Text key={i} style={[styles.h1, { color: colors.text }]}>
              {line.slice(2)}
            </Text>
          );
        }
        if (line.startsWith('## ')) {
          return (
            <Text key={i} style={[styles.h2, { color: colors.text }]}>
              {line.slice(3)}
            </Text>
          );
        }
        return (
          <Text key={i} style={[styles.p, { color: colors.textSecondary }]}>
            {renderInline(line, colors.text)}
          </Text>
        );
      })}
    </View>
  );
}

function renderInline(text: string, boldColor: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <Text key={i} style={{ fontWeight: '700', color: boldColor }}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    return part;
  });
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md, paddingBottom: spacing.xl },
  h1: { fontSize: 22, fontWeight: '800', marginTop: spacing.sm },
  h2: { fontSize: 17, fontWeight: '700', marginTop: spacing.sm },
  p: { fontSize: 15, lineHeight: 22 },
});
