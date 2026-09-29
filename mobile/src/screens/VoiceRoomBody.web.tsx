import { View } from "react-native";
import { EmptyState } from "../components/EmptyState";
import { useTheme } from "../theme";

// Metro platform resolution picks this file over VoiceRoomBody.tsx only
// when bundling for web (`expo start --web` / `expo export --platform
// web`) — iOS/Android still get the real, LiveKit-backed screen unchanged.
// @livekit/react-native wraps react-native-webrtc's native modules; merely
// *importing* it (registerGlobals et al.) calls react-native-web's
// unimplemented requireNativeComponent and crashes the whole screen before
// any of our own code runs, so a runtime Platform.OS check inside the real
// component can't help here — the import itself has to not happen on web.
export function VoiceRoomBody({ slug: _slug, roomId: _roomId }: { slug: string; roomId: string }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: "center", justifyContent: "center", padding: theme.space[6] }}>
      <EmptyState icon="mic-off-outline" title="Voice rooms aren't available in the web preview" description="LiveKit's native audio module needs a real iOS or Android build — try this on a device or simulator." />
    </View>
  );
}
