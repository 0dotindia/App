import { Modal, Platform, Pressable, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";

type Props = {
  uri: string | null;
  onClose: () => void;
};

// A full-screen viewer for an avatar/cover tap — the "pro" pattern every
// major social app has (X, Instagram) for a photo that's otherwise only
// ever seen small and cropped. `uri: null` means closed, rather than a
// separate `visible` boolean, since there's never a meaningful "open with
// no image" state here. Modal's own built-in fade handles the transition
// — unlike BottomSheet, this isn't opened/closed often enough per session
// to be worth a Reanimated gesture investment of its own.
export function ImageLightbox({ uri, onClose }: Props) {
  return (
    <Modal visible={uri !== null} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close image">
        <SafeAreaView style={styles.safeArea} edges={["top"]}>
          {uri ? <Image source={{ uri }} style={styles.image} contentFit="contain" alt="Enlarged image" /> : null}
        </SafeAreaView>
        {/* Tapping anywhere closes the lightbox already, but that has no
            visible affordance — an explicit close button is the same "pro"
            expectation the file's own header comment calls out (X/Instagram
            both show one), same fixed-dark-glass-over-a-photo treatment
            ProfileScreenBody's GlassIconButton uses. */}
        <SafeAreaView style={styles.closeButtonSafeArea} edges={["top"]} pointerEvents="box-none">
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} style={styles.closeButton}>
            {Platform.OS === "ios" ? <BlurView tint="dark" intensity={36} style={StyleSheet.absoluteFill} /> : null}
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>
        </SafeAreaView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.92)" },
  safeArea: { flex: 1 },
  image: { flex: 1 },
  closeButtonSafeArea: { position: "absolute", top: 0, left: 0, right: 0 },
  closeButton: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: Platform.OS === "ios" ? "rgba(0, 0, 0, 0.4)" : "rgba(0, 0, 0, 0.55)",
  },
});
