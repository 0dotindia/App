import { View } from "react-native";
import { EmptyState } from "../components/EmptyState";
import { useTheme } from "../theme";

// See VoiceRoomBody.web.tsx's comment: Metro picks this file over
// LivestreamViewerBody.tsx only when bundling for web, because merely
// importing @livekit/react-native there crashes react-native-web (it calls
// requireNativeComponent, which react-native-web doesn't implement) before
// any component code runs — this file avoids that import entirely rather
// than trying to guard it at runtime.
export function LivestreamViewerBody({ livestreamId: _livestreamId }: { livestreamId: string }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: "center", justifyContent: "center", padding: theme.space[6] }}>
      <EmptyState icon="videocam-off-outline" title="Livestreams aren't available in the web preview" description="LiveKit's native video module needs a real iOS or Android build — try this on a device or simulator." />
    </View>
  );
}
