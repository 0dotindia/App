import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import { getMarketplaceItem, getMarketplaceDownloadUrl, ApiError } from "../api/client";
import { API_BASE_URL } from "../config";
import { Button } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import { PurchaseSheet, type PurchaseSheetItem } from "../components/PurchaseSheet";
import { renderWikiMarkdown } from "../lib/wiki-markdown";
import { haptics } from "../utils/haptics";
import { formatCoins } from "../utils/formatCoins";
import { useContentMaxWidth } from "../utils/responsive";
import { useTheme, type Theme } from "../theme";
import type { MarketplaceItemDetail } from "../api/types";

// Native counterpart to /m/[id] (listings) and a creator's digital-product
// card: detail, buy with coins, and — once owned — download (digital
// products) or open on the web (themes/templates/apps, whose install and
// review flows are still web-only).
export function MarketplaceItemBody({ category, id }: { category: string; id: string }) {
  const theme = useTheme();
  const router = useRouter();
  const maxWidth = useContentMaxWidth();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [item, setItem] = useState<MarketplaceItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchase, setPurchase] = useState<PurchaseSheetItem | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItem(await getMarketplaceItem(category, id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load this item.");
    }
  }, [category, id]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  function openOnWeb() {
    if (!item) return;
    haptics.light();
    WebBrowser.openBrowserAsync(`${API_BASE_URL}${item.webPath}`).catch(() => {});
  }

  function openSeller() {
    if (!item) return;
    haptics.light();
    if (item.seller.businessSlug) router.push({ pathname: "/business/[slug]", params: { slug: item.seller.businessSlug } });
    else if (item.seller.username) router.push({ pathname: "/[username]", params: { username: item.seller.username } });
  }

  async function onDownload() {
    if (!item || downloading) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const { url } = await getMarketplaceDownloadUrl(item.category, item.id);
      await Linking.openURL(`${API_BASE_URL}${url}`);
    } catch (err) {
      haptics.warning();
      setDownloadError(err instanceof ApiError ? err.message : "Could not start the download.");
    } finally {
      setDownloading(false);
    }
  }

  async function onPurchased() {
    setPurchase(null);
    await load();
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }
  if (!item) {
    return (
      <View style={styles.center}>
        <EmptyState icon="bag-outline" title={error ?? "Item not found."} onRetry={error ? load : undefined} />
      </View>
    );
  }

  const sellerTappable = Boolean(item.seller.businessSlug || item.seller.username);
  const stats = [
    item.averageRating !== null ? `★ ${item.averageRating.toFixed(1)} (${item.reviewCount})` : null,
    item.purchaseCount ? `${item.purchaseCount} sold` : null,
  ].filter(Boolean);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, maxWidth ? { maxWidth, alignSelf: "center", width: "100%" } : null]}>
        {item.coverImageUrl ? (
          <Image source={{ uri: item.coverImageUrl }} style={styles.cover} contentFit="cover" alt={`${item.title} cover image`} />
        ) : null}

        <Text style={styles.categoryLabel}>{item.categoryLabel}</Text>
        <Text style={styles.title} accessibilityRole="header">
          {item.title}
        </Text>

        <Pressable onPress={openSeller} disabled={!sellerTappable} accessibilityRole={sellerTappable ? "link" : undefined}>
          <Text style={styles.seller}>
            by <Text style={sellerTappable ? styles.sellerLink : undefined}>{item.seller.name}</Text>
          </Text>
        </Pressable>
        {stats.length > 0 ? <Text style={styles.stats}>{stats.join(" · ")}</Text> : null}

        <Text style={styles.price}>{item.price === null ? "Free" : formatCoins(item.price)}</Text>

        <View style={styles.actionArea}>
          {item.isOwnItem ? (
            <StatusLine icon="person-circle-outline" text="This is your item." theme={theme} styles={styles} />
          ) : item.owned ? (
            <>
              <StatusLine icon="checkmark-circle-outline" text="You own this." theme={theme} styles={styles} success />
              {item.downloadable ? <Button label="Download" onPress={onDownload} loading={downloading} /> : null}
              {!item.downloadable ? <Button label="Open on web to use it" variant="secondary" onPress={openOnWeb} /> : null}
              {downloadError ? <Text style={styles.error}>{downloadError}</Text> : null}
            </>
          ) : !item.available ? (
            <StatusLine icon="close-circle-outline" text="This item is no longer available." theme={theme} styles={styles} />
          ) : (
            <Button
              label={item.price === null ? "Get it free" : `Buy for ${formatCoins(item.price)}`}
              onPress={() => {
                haptics.light();
                setPurchase({
                  target: item.category === "digital_product" ? "digital_product" : "marketplace_listing",
                  id: item.id,
                  title: item.title,
                  price: item.price,
                });
              }}
            />
          )}
        </View>

        {item.description ? (
          <View style={styles.description}>
            {item.descriptionFormat === "markdown" ? (
              renderWikiMarkdown(item.description, theme)
            ) : (
              <Text style={styles.body}>{item.description}</Text>
            )}
          </View>
        ) : null}

        <Pressable onPress={openOnWeb} accessibilityRole="link" style={styles.webLink}>
          <Text style={styles.webLinkText}>View on 0dot.in</Text>
          <Ionicons name="open-outline" size={14} color={theme.colors.accent} />
        </Pressable>
      </ScrollView>

      <PurchaseSheet item={purchase} onClose={() => setPurchase(null)} onPurchased={onPurchased} />
    </View>
  );
}

function StatusLine({
  icon,
  text,
  theme,
  styles,
  success = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  theme: Theme;
  styles: ReturnType<typeof createStyles>;
  success?: boolean;
}) {
  return (
    <View style={styles.statusRow}>
      <Ionicons name={icon} size={18} color={success ? theme.colors.success : theme.colors.mutedForeground} />
      <Text style={styles.statusText}>{text}</Text>
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.background },
    content: { padding: theme.space[5], gap: theme.space[2] },
    cover: { width: "100%", aspectRatio: 16 / 9, borderRadius: theme.radius.lg, marginBottom: theme.space[2] },
    categoryLabel: { color: theme.colors.accent, fontSize: theme.text.xs, fontWeight: theme.weight.emphasis, textTransform: "uppercase" },
    title: { color: theme.colors.foreground, fontSize: theme.text.xl, fontWeight: theme.weight.heading },
    seller: { color: theme.colors.mutedForeground, fontSize: theme.text.sm },
    sellerLink: { color: theme.colors.accent, fontWeight: theme.weight.label },
    stats: { color: theme.colors.mutedForeground, fontSize: theme.text.sm },
    price: { color: theme.colors.foreground, fontSize: theme.text.lg, fontWeight: theme.weight.emphasis, marginTop: theme.space[2] },
    actionArea: { gap: theme.space[2], marginTop: theme.space[2] },
    statusRow: { flexDirection: "row", alignItems: "center", gap: theme.space[2] },
    statusText: { color: theme.colors.foreground, fontSize: theme.text.sm },
    error: { color: theme.colors.danger, fontSize: theme.text.sm },
    description: { gap: theme.space[3], marginTop: theme.space[4] },
    body: { color: theme.colors.foreground, fontSize: theme.text.base, lineHeight: theme.text.base * 1.5 },
    webLink: { flexDirection: "row", alignItems: "center", gap: theme.space[1], marginTop: theme.space[5], alignSelf: "flex-start" },
    webLinkText: { color: theme.colors.accent, fontSize: theme.text.sm, fontWeight: theme.weight.label },
  });
}
